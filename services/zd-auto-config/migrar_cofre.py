# -*- coding: utf-8 -*-
"""Leva os ambientes do cofre LOCAL do consultor para o cofre do servico,
vinculados ao usuario do site (e-mail).

Os segredos sao decifrados com a chave local (.appkey de origem) e cifrados de
novo com a chave do destino (ZDCFG_FERNET_KEY ou o .appkey do destino). Nada e
impresso alem de nome e subdominio.

Uso:
  python migrar_cofre.py --origem <pasta com environments.json e .appkey>
                         --dono rzanetti@aktienow.com
                         [--compartilhar "Prod BR,Prod SSAC"]
                         [--so "Prod BR,Prod RZ"] [--aplicar]

Sem --aplicar so mostra o que faria. O destino segue as mesmas variaveis do
servico: ZDCFG_DATA_DIR (pasta) e ZDCFG_FERNET_KEY (chave). Ambiente com o mesmo
nome e o mesmo dono no destino e ATUALIZADO, nao duplicado.
"""
from __future__ import annotations
import os
import sys
import json
import argparse

from cryptography.fernet import Fernet, InvalidToken

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
from webapp import store  # noqa: E402  (destino: respeita ZDCFG_DATA_DIR / ZDCFG_FERNET_KEY)


def _lista(txt: str) -> set[str]:
    return {x.strip().lower() for x in (txt or "").split(",") if x.strip()}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--origem", required=True)
    ap.add_argument("--dono", required=True)
    ap.add_argument("--compartilhar", default="")
    ap.add_argument("--so", default="")
    ap.add_argument("--aplicar", action="store_true")
    a = ap.parse_args()

    origem = os.path.abspath(a.origem)
    env_f, key_f = os.path.join(origem, "environments.json"), os.path.join(origem, ".appkey")
    if not os.path.exists(env_f) or not os.path.exists(key_f):
        print(f"ERRO: nao achei environments.json e .appkey em {origem}")
        return 1
    if not store.usando_banco() and os.path.abspath(store.BASE) == origem:
        print("ERRO: origem e destino sao a mesma pasta. Defina ZDCFG_DATA_DIR para o destino.")
        return 1

    f_origem = Fernet(open(key_f, "rb").read().strip())
    dados = json.load(open(env_f, encoding="utf-8"))
    dono = a.dono.strip().lower()
    compartilhar, so = _lista(a.compartilhar), _lista(a.so)

    # formato antigo {nome: rec} ou novo {id: {nome, ...}}
    itens = [(v.get("nome") or k, v) for k, v in dados.items()]
    existentes = {(e["nome"] or "").lower(): e for e in store.list_envs(None)
                  if (e.get("dono") or "").lower() == dono}

    print(f"Origem : {origem}")
    destino = "banco (ZDCFG_DATABASE_URL)" if store.usando_banco() else store.BASE
    print(f"Destino: {destino}  (chave: {'ZDCFG_FERNET_KEY' if os.environ.get('ZDCFG_FERNET_KEY') else '.appkey do destino'})")
    print(f"Dono   : {dono}")
    print(f"Modo   : {'APLICAR' if a.aplicar else 'simulacao (use --aplicar para gravar)'}\n")

    ok = falhas = 0
    for nome, v in itens:
        if so and nome.lower() not in so:
            continue
        auth = v.get("auth", "token")
        campo = "client_secret" if auth == "oauth" else "token"
        try:
            segredo = f_origem.decrypt(v.get(campo, "").encode()).decode() if v.get(campo) else ""
        except InvalidToken:
            print(f"  FALHA  {nome:<22} ({v.get('subdomain')}): a chave local nao abre este segredo")
            falhas += 1
            continue
        comp = nome.lower() in compartilhar
        acao = "atualiza" if nome.lower() in existentes else "cria"
        print(f"  {acao:<7}{nome:<22} {v.get('subdomain'):<28} [{auth}]{'  compartilhado' if comp else ''}")
        if a.aplicar:
            quem = {"email": dono, "adm": False}
            env_id = existentes.get(nome.lower(), {}).get("id")
            try:
                store.save_env(quem, nome, v.get("subdomain", ""), auth=auth,
                               email=v.get("email", ""), token=segredo if auth != "oauth" else "",
                               client_id=v.get("client_id", ""),
                               client_secret=segredo if auth == "oauth" else "",
                               compartilhado=comp, env_id=env_id, dono=dono)
            except (ValueError, PermissionError) as e:
                print(f"         -> FALHA: {e}")
                falhas += 1
                continue
        ok += 1

    print(f"\n{ok} ambiente(s) {'gravado(s)' if a.aplicar else 'a migrar'}; {falhas} falha(s).")
    return 0 if not falhas else 2


if __name__ == "__main__":
    sys.exit(main())
