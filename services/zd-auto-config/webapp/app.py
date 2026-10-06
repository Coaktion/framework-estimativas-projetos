# -*- coding: utf-8 -*-
"""ZD Auto Config - API + app web: cofre de ambientes por usuario, progresso ao
vivo (SSE), pausa p/ Help Center e rollback.

Dois modos:
  - SITE (ZDCFG_SSO_SECRET definida): a tela mora no site (Next.js). Toda chamada
    traz `Authorization: Bearer <token>` emitido pelo site; nao ha login local,
    sessao nem cookie. CORS liberado so para a origem de ZDCFG_SITE_URL.
  - LOCAL (sem a variavel): tela HTML propria, login por usuario/senha, como
    sempre foi na maquina do consultor.
"""
from __future__ import annotations
import os, sys, json, uuid, queue, threading, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from fastapi import FastAPI, UploadFile, File, Form, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse, RedirectResponse

from blueprint import Access0, SLA
from provisioner.mapper_xlsx import load_blueprint
from provisioner.client import ZendeskClient, ZendeskError
from provisioner.runner import Runner, Cancelled
from provisioner.preflight import run_preflight
from webapp import store, sso

TPL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates")
LOGIN_HTML = open(os.path.join(TPL, "login.html"), encoding="utf-8").read()
APP_HTML = open(os.path.join(TPL, "app.html"), encoding="utf-8").read()
MAX_UPLOAD = 20 * 1024 * 1024

app = FastAPI(title="ZD Auto Config")
if sso.ativo():
    if sso.site_origin():
        app.add_middleware(CORSMiddleware, allow_origins=[sso.site_origin()],
                           allow_methods=["GET", "POST", "PUT", "DELETE"],
                           allow_headers=["Authorization", "Content-Type"],
                           allow_credentials=False, max_age=600)
else:                        # com SSO nao existe usuario local
    store.ensure_seed()

_sessions: dict[str, str] = {}          # so no modo local
_uploads: dict[str, dict] = {}          # id -> {path, dono}
_jobs: dict[str, dict] = {}


def _secoes_status(bp):
    """Secoes que o app permite escolher, com presenca e default (padrao)."""
    g = len(bp.grupos)
    cat = [
        ("marca", "Marca + Help Center", True, bp.marca is not None, 1 if bp.marca else 0),
        ("grupos", "Grupos", True, g > 0, g),
        ("campos_ticket", "Campos de ticket + formulario", True, len(bp.campos_ticket) > 0, len(bp.campos_ticket)),
        ("condicionais", "Campos condicionais", True, len(bp.condicionais) > 0, len(bp.condicionais)),
        ("gatilhos", "Gatilhos padrao", True, len(bp.gatilhos_padrao) > 0, len(bp.gatilhos_padrao)),
        ("macros", "Macros", True, len(bp.macros) > 0, len(bp.macros)),
        ("guide", "Help Center: secoes + artigos + guia", True,
         bool(bp.guide_secoes or bp.guide_artigos or bp.guia_apresentacao), len(bp.guide_artigos)),
        ("sla", "Group SLA (por grupo)", True, bp.sla is not None, g if bp.sla else 0),
        ("views", "Views", False, len(bp.views) > 0, len(bp.views)),
        ("campos_usuario", "Campos de usuario", False, len(bp.campos_usuario) > 0, len(bp.campos_usuario)),
        ("campos_org", "Campos de organizacao", False, len(bp.campos_org) > 0, len(bp.campos_org)),
        ("programacao", "Programacao (horario comercial)", False, bp.programacao is not None, 1 if bp.programacao else 0),
        ("feriados", "Feriados", False, len(bp.feriados) > 0, len(bp.feriados)),
    ]
    return [{"key": k, "label": lb, "default": d, "presente": p, "qtd": q} for (k, lb, d, p, q) in cat]


def _aplicar_selecao(bp, sections):
    """Aplica a selecao do app: mantem so o que estiver marcado (server-authoritative)."""
    escolha = {x["key"]: x["default"] for x in _secoes_status(bp)}
    escolha.update({k: bool(v) for k, v in (sections or {}).items()})
    if not escolha.get("marca"): bp.marca = None
    if not escolha.get("grupos"): bp.grupos = []
    if not escolha.get("campos_ticket"): bp.campos_ticket = []
    if not escolha.get("condicionais"): bp.condicionais = []
    if not escolha.get("gatilhos"): bp.gatilhos_padrao = []
    if not escolha.get("macros"): bp.macros = []
    if not escolha.get("guide"):
        bp.guide_secoes = []; bp.guide_artigos = []; bp.guia_apresentacao = None
    if not escolha.get("sla"): bp.sla = None
    if not escolha.get("views"): bp.views = []
    if not escolha.get("campos_usuario"): bp.campos_usuario = []
    if not escolha.get("campos_org"): bp.campos_org = []
    if not escolha.get("programacao"): bp.programacao = None
    if not escolha.get("feriados"): bp.feriados = []


def _quem(request: Request):
    """Identidade de quem chama, ou None.

    Modo site: token Bearer validado. Modo local: cookie de sessao (tudo visivel).
    """
    if sso.ativo():
        h = request.headers.get("authorization") or ""
        if not h.lower().startswith("bearer "):
            return None
        try:
            return sso.identidade(sso.validar(h[7:].strip()))
        except sso.TokenInvalido:
            return None
    u = _sessions.get(request.cookies.get("zdauth"))
    return {"email": u, "nome": u, "adm": True, "local": True} if u else None


def _exigir(request: Request) -> dict:
    q = _quem(request)
    if not q:
        raise HTTPException(401, "nao autenticado")
    return q


def _job_do(job_id: str, quem: dict) -> dict:
    j = _jobs.get(job_id)
    if not j or (not quem.get("local") and j.get("dono") != quem["email"]):
        raise HTTPException(404)
    return j


# ------------------------------ telas / login ------------------------------ #
@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    if sso.ativo():
        # A tela agora mora no site.
        if sso.site_url():
            return RedirectResponse(f"{sso.site_url()}/zd-auto-config", status_code=303)
        return HTMLResponse("ZD Auto Config: acesse pelo site.", status_code=404)
    q = _quem(request)
    if not q:
        return HTMLResponse(LOGIN_HTML)
    return HTMLResponse(APP_HTML.replace("{{USER}}", q["email"]))


@app.get("/api/health")
def health():
    return {"ok": True, "modo": "site" if sso.ativo() else "local",
            "cofre": "banco" if store.usando_banco() else "arquivo"}


@app.get("/api/me")
def me(request: Request):
    q = _exigir(request)
    return {"email": q["email"], "nome": q.get("nome"), "adm": q.get("adm", False)}


@app.post("/login")
def login(request: Request, username: str = Form(...), password: str = Form(...)):
    if sso.ativo():
        raise HTTPException(403, "Login local desativado: entre pelo site.")
    if not store.verify_user(username.strip(), password):
        return HTMLResponse(LOGIN_HTML.replace("<!--ERR-->",
                            '<p class="err">Usuario ou senha incorretos.</p>'), status_code=401)
    tok = uuid.uuid4().hex
    _sessions[tok] = username.strip()
    r = RedirectResponse("/", status_code=303)
    r.set_cookie("zdauth", tok, httponly=True, samesite="lax")
    return r


@app.get("/logout")
def logout(request: Request):
    _sessions.pop(request.cookies.get("zdauth"), None)
    destino = f"{sso.site_url()}/" if sso.ativo() and sso.site_url() else "/"
    r = RedirectResponse(destino, status_code=303)
    r.delete_cookie("zdauth")
    return r


# ------------------------------ ambientes ---------------------------------- #
@app.get("/api/envs")
def api_envs(request: Request):
    return {"envs": store.list_envs(_exigir(request))}


def _campos_env(b: dict) -> dict:
    auth = (b.get("auth") or "token").strip()
    if auth not in ("token", "oauth"):
        raise HTTPException(400, "auth invalido")
    nome, sub = (b.get("nome") or "").strip(), (b.get("subdomain") or "").strip()
    if not nome or not sub:
        raise HTTPException(400, "nome e subdominio sao obrigatorios")
    return {"nome": nome, "subdomain": sub, "auth": auth,
            "email": (b.get("email") or "").strip(), "token": (b.get("token") or "").strip(),
            "client_id": (b.get("client_id") or "").strip(),
            "client_secret": (b.get("client_secret") or "").strip(),
            "compartilhado": bool(b.get("compartilhado"))}


@app.post("/api/envs")
async def api_env_criar(request: Request):
    q = _exigir(request)
    c = _campos_env(await request.json())
    if c["auth"] == "token" and not c["token"] or c["auth"] == "oauth" and not c["client_secret"]:
        raise HTTPException(400, "informe o segredo do ambiente")
    try:
        return {"ok": True, "id": store.save_env(q, **c)}
    except ValueError as e:
        raise HTTPException(400, str(e))


@app.put("/api/envs/{env_id}")
async def api_env_editar(env_id: str, request: Request):
    q = _exigir(request)
    c = _campos_env(await request.json())
    if not store.get_env(env_id, q):
        raise HTTPException(404)
    try:
        store.save_env(q, env_id=env_id, **c)
    except PermissionError:
        raise HTTPException(403, "ambiente de outro usuario")
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"ok": True, "id": env_id}


@app.delete("/api/envs/{env_id}")
def api_env_del(env_id: str, request: Request):
    q = _exigir(request)
    if not store.delete_env(env_id, q):
        raise HTTPException(403, "ambiente inexistente ou de outro usuario")
    return {"ok": True}


# ------------------------------ planilha ----------------------------------- #
@app.post("/api/analyze")
async def analyze(request: Request, file: UploadFile = File(...)):
    q = _exigir(request)
    data = await file.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(413, "planilha maior que 20 MB")
    fd, path = tempfile.mkstemp(suffix=".xlsx")
    with os.fdopen(fd, "wb") as f:
        f.write(data)
    try:
        bp = load_blueprint(path)
    except Exception as e:
        os.remove(path)
        raise HTTPException(400, f"planilha invalida: {e}")
    upload_id = uuid.uuid4().hex
    _uploads[upload_id] = {"path": path, "dono": q["email"]}
    resumo = {"cliente": bp.cliente, "identificador": bp.identificador, "idioma": bp.idioma.value,
              "grupos": len(bp.grupos), "campos": len(bp.campos_ticket),
              "condicionais": len(bp.condicionais), "views": len(bp.views),
              "gatilhos": len(bp.gatilhos_padrao), "macros": len(bp.macros),
              "secoes": len(bp.guide_secoes), "artigos": len(bp.guide_artigos),
              "marca": bp.marca.nome if bp.marca else None,
              "lembretes": [{"titulo": l.titulo, "detalhe": l.detalhe} for l in bp.lembretes],
              "copilots": [{"titulo": c.titulo, "quando_utilizar": c.quando_utilizar, "corpo": c.corpo}
                           for c in bp.copilots],
              "ai_agents": [{"nome": a.nome, "descricao": a.descricao, "prompt": a.prompt}
                            for a in bp.ai_agents],
              "secoes_disp": [x for x in _secoes_status(bp) if x["presente"]]}
    return {"upload_id": upload_id, "resumo": resumo}


TEMAS_DIR = os.path.join(ROOT, "temas")


def _tema_zip_para(idioma):
    """Escolhe o .zip do tema pelo idioma da demo; cai p/ BR se o especifico nao existir.

    Procura em services/zd-auto-config/temas/ (versionado) e, por compatibilidade,
    na raiz do servico.
    """
    mapa = {"pt-br": "tema_hc_br.zip", "en-us": "tema_hc_en.zip", "es": "tema_hc_es.zip"}
    for nome in (mapa.get(idioma, "tema_hc_br.zip"), "tema_hc_br.zip", "tema_hc.zip"):
        for pasta in (TEMAS_DIR, ROOT):
            cand = os.path.join(pasta, nome)
            if os.path.exists(cand):
                return cand
    return None


def _run_job(job_id, upload_id, creds, apply, force, sections):
    job = _jobs[job_id]
    q = job["q"]
    emit = lambda m: q.put(("log", m))
    try:
        bp = load_blueprint(_uploads[upload_id]["path"])
        sub = creds["sub"]
        if creds.get("auth") == "oauth":
            bp.acesso = Access0(subdominio=sub, admin_email="(oauth)", auth_tipo="oauth",
                                segredo=creds.get("client_secret", ""), config="full")
            client = ZendeskClient(sub, auth_tipo="oauth", dry_run=not apply,
                                   client_id=creds.get("client_id", ""),
                                   client_secret=creds.get("client_secret", ""))
        else:
            bp.acesso = Access0(subdominio=sub, admin_email=creds.get("email", ""),
                                auth_tipo="token", segredo=creds.get("token", ""), config="full")
            client = ZendeskClient(sub, creds.get("email", ""), creds.get("token", ""),
                                   auth_tipo="token", dry_run=not apply)
        _aplicar_selecao(bp, sections)
        _tema = _tema_zip_para(bp.idioma.value)   # tema por idioma, com fallback p/ BR
        if _tema:
            bp.tema_zip = _tema
            emit(f"tema: usando {os.path.basename(_tema)}")
        elif bp.marca is not None:
            emit("ATENCAO: nenhum tema (.zip) encontrado no servico - o tema do Help Center "
                 "NAO sera importado. Coloque tema_hc_br.zip em services/zd-auto-config/temas/.")
        emit("PREFLIGHT")
        rep = run_preflight(bp, client)
        emit(rep.resumo())
        if not rep.ok and not force:
            emit("ABORTADO no preflight (marque forcar para prosseguir).")
            q.put(("done", "abortado"))
            return

        def after_brand(runner):
            if not runner.res.brand_id:
                return
            c = runner.client
            if c.dry_run:
                emit("(dry-run) Help Center nao e ativado de verdade; seguindo.")
                return
            try:
                c.put(f"/brands/{runner.res.brand_id}.json", {"brand": {"has_help_center": True}})
            except ZendeskError:
                pass
            b = {}
            try:
                b = c.get(f"/brands/{runner.res.brand_id}.json").get("brand", {})
            except ZendeskError:
                pass
            if b.get("has_help_center") or b.get("help_center_state") in ("enabled", "restricted"):
                emit("Help Center ativo.")
                return
            url_ativacao = (f"https://{c.subdomain}.zendesk.com/knowledge/generation/"
                            f"newHelpCenter/?brand_id={runner.res.brand_id}")
            emit(f"ATENCAO: ative o Help Center da marca '{c.guide_sub}'. "
                 "Ao ativar, escolha a opcao 'Comece do zero' (NAO deixe a IA da Zendesk "
                 "criar artigos - nos criamos os artigos por API). Depois clique em Continuar.")
            emit(f"Abrindo a pagina de ativacao: {url_ativacao}")
            job["status"] = "waiting"
            q.put(("waiting", url_ativacao))
            job["event"].wait()
            job["event"].clear()
            emit("Continuando...")

        runner = Runner(bp, client, on_log=emit)
        job["runner"] = runner
        if job.get("cancel"):           # cancelado antes do runner existir
            runner.cancel_event.set()
        runner.run(rollback_on_error=apply, after_brand=after_brand)
        emit(f"CONCLUIDO. {len(runner.created)} recursos.")
        q.put(("done", "ok"))
    except Cancelled:
        emit("INTERROMPIDO: execucao cancelada e desfeita.")
        q.put(("done", "cancelado"))
    except Exception as e:
        emit(f"FALHA: {e}")
        q.put(("done", "erro"))


@app.post("/api/provision")
async def provision(request: Request):
    q = _exigir(request)
    b = await request.json()
    up = _uploads.get(b.get("upload_id") or "")
    if not up or (not q.get("local") and up["dono"] != q["email"]):
        raise HTTPException(400, "Planilha nao encontrada: analise de novo")
    if b.get("env_id"):
        env = store.get_env(b["env_id"], q)
        if not env:
            raise HTTPException(400, "Ambiente nao encontrado")
        creds = {"auth": env.get("auth", "token"), "sub": env["subdomain"],
                 "email": env.get("email", ""), "token": env.get("token", ""),
                 "client_id": env.get("client_id", ""), "client_secret": env.get("client_secret", "")}
    else:
        auth = (b.get("auth") or "token").strip()
        creds = {"auth": auth, "sub": (b.get("subdomain") or "").strip(),
                 "email": (b.get("email") or "").strip(), "token": (b.get("token") or "").strip(),
                 "client_id": (b.get("client_id") or "").strip(),
                 "client_secret": (b.get("client_secret") or "").strip()}
        if not creds["sub"]:
            raise HTTPException(400, "Informe o subdominio")
        if b.get("save_as"):
            store.save_env(q, b["save_as"].strip(), creds["sub"], auth=auth,
                           email=creds["email"], token=creds["token"],
                           client_id=creds["client_id"], client_secret=creds["client_secret"],
                           compartilhado=bool(b.get("compartilhado")))
    job_id = uuid.uuid4().hex
    _jobs[job_id] = {"q": queue.Queue(), "event": threading.Event(), "status": "running",
                     "runner": None, "dono": q["email"]}
    threading.Thread(target=_run_job, args=(job_id, b["upload_id"], creds,
                     bool(b.get("apply")), bool(b.get("force")), b.get("sections") or {}), daemon=True).start()
    return {"job_id": job_id}


@app.post("/api/resume/{job_id}")
def resume(job_id: str, request: Request):
    _job_do(job_id, _exigir(request))["event"].set()
    return {"ok": True}


@app.post("/api/cancel/{job_id}")
def cancel(job_id: str, request: Request):
    """Interrompe a execucao em andamento e dispara o rollback do que ja foi criado."""
    j = _job_do(job_id, _exigir(request))
    j["cancel"] = True
    runner = j.get("runner")
    if runner is not None:
        runner.cancel_event.set()
    j["event"].set()   # libera a pausa do Help Center, se estiver aguardando
    return {"ok": True}


@app.post("/api/rollback/{job_id}")
def rollback(job_id: str, request: Request):
    j = _job_do(job_id, _exigir(request))
    runner = j.get("runner")
    if not runner:
        raise HTTPException(400, "Nada para desfazer")
    if not runner.created or runner.client.dry_run:
        return {"ok": False, "motivo": "nada real a desfazer"}

    def worker():
        try:
            runner.rollback()
        finally:
            j["q"].put(("done", "rollback"))
    threading.Thread(target=worker, daemon=True).start()
    return {"ok": True, "count": len(runner.created)}


@app.get("/api/stream/{job_id}")
def stream(job_id: str, request: Request):
    """Server-Sent Events. Cada `data:` e JSON (texto com quebras de linha passa inteiro)."""
    j = _job_do(job_id, _exigir(request))
    q = j["q"]

    def gen():
        while True:
            try:
                kind, payload = q.get(timeout=20)
            except queue.Empty:
                yield ": ka\n\n"
                continue
            yield f"event: {kind}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
            if kind == "done":
                break
    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})
