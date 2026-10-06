# -*- coding: utf-8 -*-
"""Armazenamento local: usuarios (senha com hash) e ambientes (token cifrado).

- users.json          -> {username: {salt, hash}}   (pbkdf2-sha256)
- environments.json   -> {id: {nome, dono, compartilhado, subdomain, auth, segredo(cifrado)}}
- .appkey             -> chave Fernet (gerada na 1a vez; NAO versionar)

Tokens sao cifrados em repouso com cryptography.Fernet.
"""
import os
import json
import hashlib
import secrets

from cryptography.fernet import Fernet

# Em servidor, ZDCFG_DATA_DIR aponta para o disco persistente; localmente, sem a
# variavel, tudo continua na pasta do webapp como sempre foi.
BASE = os.environ.get("ZDCFG_DATA_DIR") or os.path.dirname(os.path.abspath(__file__))
os.makedirs(BASE, exist_ok=True)
USERS_F = os.path.join(BASE, "users.json")
ENVS_F = os.path.join(BASE, "environments.json")
KEY_F = os.path.join(BASE, ".appkey")


# ------------------------- chave / cifra ----------------------------------- #
def _key() -> bytes:
    # Em servidor a chave vem do ambiente: assim um disco perdido nao torna os
    # tokens ilegiveis, e a chave nunca fica gravada ao lado dos dados.
    env_key = (os.environ.get("ZDCFG_FERNET_KEY") or "").strip()
    if env_key:
        return env_key.encode()
    if not os.path.exists(KEY_F):
        with open(KEY_F, "wb") as f:
            f.write(Fernet.generate_key())
        try:
            os.chmod(KEY_F, 0o600)
        except OSError:
            pass
    return open(KEY_F, "rb").read()


def _f() -> Fernet:
    return Fernet(_key())


def _load(path):
    if not os.path.exists(path):
        return {}
    try:
        return json.load(open(path, encoding="utf-8"))
    except Exception:
        return {}


def _save(path, data):
    json.dump(data, open(path, "w", encoding="utf-8"), indent=2, ensure_ascii=False)


# ------------------------- usuarios ---------------------------------------- #
def set_user(username: str, password: str) -> None:
    d = _load(USERS_F)
    salt = secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 200_000).hex()
    d[username] = {"salt": salt, "hash": h}
    _save(USERS_F, d)


def verify_user(username: str, password: str) -> bool:
    u = _load(USERS_F).get(username)
    if not u:
        return False
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(u["salt"]), 200_000).hex()
    return secrets.compare_digest(h, u["hash"])


def list_users():
    return sorted(_load(USERS_F).keys())


def delete_user(username: str) -> None:
    d = _load(USERS_F)
    d.pop(username, None)
    _save(USERS_F, d)


def ensure_seed() -> None:
    """Cria um admin inicial se nao houver nenhum usuario.

    Local (sem ZDCFG_DATA_DIR): admin / aktienow, como sempre foi.
    Servidor: a senha vem de ZDCFG_ADMIN_PASSWORD; sem ela, gera uma aleatoria e
    escreve UMA vez no log de inicializacao — nunca sobe com senha conhecida.
    """
    if _load(USERS_F):
        return
    senha = (os.environ.get("ZDCFG_ADMIN_PASSWORD") or "").strip()
    if not senha and os.environ.get("ZDCFG_DATA_DIR"):
        senha = secrets.token_urlsafe(12)
        print(f"[zd-auto-config] usuario inicial: admin / {senha}  "
              f"(troque ou defina ZDCFG_ADMIN_PASSWORD)", flush=True)
    set_user("admin", senha or "aktienow")


# ------------------------- ambientes --------------------------------------- #
# Onde ficam: no BANCO quando ZDCFG_DATABASE_URL esta definida (tabela
# zdcfg_environments, declarada no schema.prisma do site); senao, no ARQUIVO
# environments.json (uso local). A interface publica e a mesma nos dois casos:
# list_envs / save_env / get_env / delete_env.
#
# Dois modos de auth por ambiente:
#   - "token"  -> email + token de API (cifrado)          [legado, valido ate 2027]
#   - "oauth"  -> client_id + client_secret (cifrado)     [Client Credentials]
# Segredos (token/client_secret) sao cifrados em repouso com Fernet.
#
# Cada ambiente tem um DONO (e-mail do usuario do site) e pode ser COMPARTILHADO
# com o time. Formato em disco: {id: {nome, dono, compartilhado, subdomain, auth, ...}}.
# O formato antigo ({nome: {...}}, sem dono) e convertido na primeira leitura;
# esses ambientes ficam "sem dono" e so administradores os enxergam.
#
# `quem` e a identidade de quem chama: {"email", "adm", "local"?}. Com local=True
# (app rodando na maquina do consultor, sem SSO) tudo e visivel.
def _enc(s: str) -> str:
    return _f().encrypt((s or "").encode()).decode()


def _dec(s: str) -> str:
    return _f().decrypt((s or "").encode()).decode() if s else ""


def _novo_id() -> str:
    return secrets.token_hex(8)


def _load_envs() -> dict:
    d = _load(ENVS_F)
    if d and any("nome" not in v for v in d.values()):
        conv = {}
        for k, v in d.items():
            if "nome" in v:
                conv[k] = v
            else:
                conv[_novo_id()] = {"nome": k, "dono": None, "compartilhado": False, **v}
        _save(ENVS_F, conv)
        d = conv
    return d


def _visivel(v: dict, quem) -> bool:
    if quem is None or quem.get("local"):
        return True
    dono = (v.get("dono") or "").lower()
    if dono and dono == quem.get("email", "").lower():
        return True
    if v.get("compartilhado"):
        return True
    return not dono and bool(quem.get("adm"))


def _pode_editar(v: dict, quem) -> bool:
    if quem is None or quem.get("local"):
        return True
    dono = (v.get("dono") or "").lower()
    if dono:
        return dono == quem.get("email", "").lower()
    return bool(quem.get("adm"))


def _arq_list_envs(quem=None):
    """Metadados sem segredos (nunca saem do servidor)."""
    out = []
    for i, v in _load_envs().items():
        if not _visivel(v, quem):
            continue
        out.append({"id": i, "nome": v.get("nome"), "subdomain": v.get("subdomain"),
                    "auth": v.get("auth", "token"), "email": v.get("email"),
                    "client_id": v.get("client_id"), "dono": v.get("dono"),
                    "compartilhado": bool(v.get("compartilhado")),
                    "pode_editar": _pode_editar(v, quem)})
    return sorted(out, key=lambda e: (e["nome"] or "").lower())


def _arq_save_env(quem, nome, subdomain, auth="token", email="", token="",
             client_id="", client_secret="", compartilhado=False, env_id=None,
             dono=None) -> str:
    """Cria ou atualiza. Segredo vazio na atualizacao = manter o atual."""
    d = _load_envs()
    if env_id and env_id in d:
        atual = d[env_id]
        if not _pode_editar(atual, quem):
            raise PermissionError("ambiente de outro usuario")
    else:
        env_id, atual = _novo_id(), {}
        dono = dono if dono is not None else (quem or {}).get("email")
        atual["dono"] = (dono or None) and dono.strip().lower()
    rec = {"nome": nome, "dono": atual.get("dono"), "compartilhado": bool(compartilhado),
           "subdomain": subdomain, "auth": auth}
    if auth == "oauth":
        rec["client_id"] = client_id
        rec["client_secret"] = (_enc(client_secret) if client_secret
                                else atual.get("client_secret", ""))
    else:
        rec["email"] = email
        rec["token"] = _enc(token) if token else atual.get("token", "")
    d[env_id] = rec
    _save(ENVS_F, d)
    return env_id


def _arq_get_env(env_id: str, quem=None):
    v = _load_envs().get(env_id)
    if not v or not _visivel(v, quem):
        return None
    auth = v.get("auth", "token")
    if auth == "oauth":
        return {"nome": v.get("nome"), "subdomain": v["subdomain"], "auth": "oauth",
                "client_id": v.get("client_id", ""),
                "client_secret": _dec(v.get("client_secret", ""))}
    return {"nome": v.get("nome"), "subdomain": v["subdomain"], "auth": "token",
            "email": v.get("email", ""), "token": _dec(v.get("token", ""))}


def _arq_delete_env(env_id: str, quem=None) -> bool:
    d = _load_envs()
    v = d.get(env_id)
    if not v or not _pode_editar(v, quem):
        return False
    d.pop(env_id, None)
    _save(ENVS_F, d)
    return True


# ------------------------- ambientes no banco ------------------------------ #
# Tabela criada pelo Prisma do site (model ZdEnvironment). Colunas em camelCase,
# como o Prisma gera. O dono e uma FK para "User".id; o e-mail vem do join.
DB_URL = (os.environ.get("ZDCFG_DATABASE_URL") or "").strip()
_T = "zdcfg_environments"


def usando_banco() -> bool:
    return bool(DB_URL)


# Parametros que so o Prisma entende; o libpq recusa a URL se eles vierem junto.
_SO_PRISMA = {"pgbouncer", "connection_limit", "pool_timeout", "schema",
              "socket_timeout", "connect_timeout", "statement_cache_size"}


def url_libpq(url: str) -> str:
    """A mesma DATABASE_URL do site, sem os parametros exclusivos do Prisma."""
    from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
    u = urlsplit(url)
    q = [(k, v) for k, v in parse_qsl(u.query, keep_blank_values=True) if k not in _SO_PRISMA]
    return urlunsplit((u.scheme, u.netloc, u.path, urlencode(q), u.fragment))


def _db():
    import psycopg  # so e necessario no modo banco
    return psycopg.connect(url_libpq(DB_URL), autocommit=True, connect_timeout=10)


def _linha_meta(r, quem) -> dict:
    i, nome, sub, auth, email, cid, comp, dono = r
    local = quem is None or quem.get("local")
    meu = bool(quem) and dono.lower() == (quem.get("email") or "").lower()
    return {"id": i, "nome": nome, "subdomain": sub, "auth": auth, "email": email,
            "client_id": cid, "dono": dono.lower(), "compartilhado": bool(comp),
            "pode_editar": bool(local or meu)}


_SEL = (f'SELECT e.id, e.name, e.subdomain, e."authType", e."adminEmail", e."clientId", '
        f'e.shared, u.email FROM {_T} e JOIN "User" u ON u.id = e."ownerId"')


def _db_list_envs(quem=None):
    with _db() as c:
        if quem is None or quem.get("local"):
            rows = c.execute(_SEL + " ORDER BY lower(e.name)").fetchall()
        else:
            rows = c.execute(_SEL + " WHERE lower(u.email) = lower(%s) OR e.shared"
                             " ORDER BY lower(e.name)", (quem.get("email") or "",)).fetchall()
    return [_linha_meta(r, quem) for r in rows]


def _db_um(c, env_id):
    return c.execute(_SEL.replace("e.shared, u.email", 'e.shared, u.email, e."secretEnc"')
                     + " WHERE e.id = %s", (env_id,)).fetchone()


def _db_save_env(quem, nome, subdomain, auth="token", email="", token="",
                 client_id="", client_secret="", compartilhado=False, env_id=None,
                 dono=None) -> str:
    import psycopg
    segredo = client_secret if auth == "oauth" else token
    with _db() as c:
        try:
            if env_id:
                r = _db_um(c, env_id)
                if not r:
                    raise ValueError("ambiente inexistente")
                if not _linha_meta(r[:8], quem)["pode_editar"]:
                    raise PermissionError("ambiente de outro usuario")
                enc = _enc(segredo) if segredo else r[8]
                c.execute(f'UPDATE {_T} SET name=%s, subdomain=%s, "authType"=%s, "adminEmail"=%s, '
                          f'"clientId"=%s, "secretEnc"=%s, shared=%s, "updatedAt"=now() WHERE id=%s',
                          (nome, subdomain, auth, email or None, client_id or None, enc,
                           bool(compartilhado), env_id))
                return env_id
            alvo = (dono or (quem or {}).get("email") or "").strip().lower()
            u = c.execute('SELECT id FROM "User" WHERE lower(email) = %s', (alvo,)).fetchone()
            if not u:
                raise ValueError(f"o usuario {alvo} nao existe no site")
            if not segredo:
                raise ValueError("informe o segredo do ambiente")
            env_id = secrets.token_hex(12)
            c.execute(f'INSERT INTO {_T} (id, name, subdomain, "authType", "adminEmail", "clientId", '
                      f'"secretEnc", shared, "ownerId", "createdAt", "updatedAt") '
                      f'VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,now(),now())',
                      (env_id, nome, subdomain, auth, email or None, client_id or None,
                       _enc(segredo), bool(compartilhado), u[0]))
            return env_id
        except psycopg.errors.UniqueViolation:
            raise ValueError(f"voce ja tem um ambiente chamado '{nome}'")


def _db_get_env(env_id: str, quem=None):
    with _db() as c:
        r = _db_um(c, env_id)
    if not r:
        return None
    meta = _linha_meta(r[:8], quem)
    if not (quem is None or quem.get("local") or meta["pode_editar"] or meta["compartilhado"]):
        return None
    segredo = _dec(r[8])
    if meta["auth"] == "oauth":
        return {"nome": meta["nome"], "subdomain": meta["subdomain"], "auth": "oauth",
                "client_id": meta["client_id"] or "", "client_secret": segredo}
    return {"nome": meta["nome"], "subdomain": meta["subdomain"], "auth": "token",
            "email": meta["email"] or "", "token": segredo}


def _db_delete_env(env_id: str, quem=None) -> bool:
    with _db() as c:
        r = _db_um(c, env_id)
        if not r or not _linha_meta(r[:8], quem)["pode_editar"]:
            return False
        c.execute(f"DELETE FROM {_T} WHERE id = %s", (env_id,))
    return True


# ------------------------- interface publica ------------------------------- #
def list_envs(quem=None):
    return _db_list_envs(quem) if usando_banco() else _arq_list_envs(quem)


def save_env(quem, *args, **kw) -> str:
    return _db_save_env(quem, *args, **kw) if usando_banco() else _arq_save_env(quem, *args, **kw)


def get_env(env_id: str, quem=None):
    return _db_get_env(env_id, quem) if usando_banco() else _arq_get_env(env_id, quem)


def delete_env(env_id: str, quem=None) -> bool:
    return _db_delete_env(env_id, quem) if usando_banco() else _arq_delete_env(env_id, quem)
