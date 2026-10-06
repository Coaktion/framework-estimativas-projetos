# -*- coding: utf-8 -*-
"""CLI: le a planilha, roda preflight e provisiona (dry-run por padrao)."""
from __future__ import annotations
import argparse
import logging
from .mapper_xlsx import load_blueprint
from .client import ZendeskClient
from .runner import Runner


def main(argv=None):
    ap = argparse.ArgumentParser(description="ZD Auto Config v5 - provisionador")
    ap.add_argument("planilha", help="caminho do .xlsx da demo")
    ap.add_argument("--apply", action="store_true",
                    help="executa de verdade (default: dry-run)")
    ap.add_argument("--secret", help="token/senha do admin (sobrepoe a planilha)")
    ap.add_argument("--force", action="store_true",
                    help="prossegue mesmo com colisoes no preflight")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO if args.verbose else logging.WARNING,
                        format="%(levelname)s %(name)s: %(message)s")

    bp = load_blueprint(args.planilha)
    print(f"Cliente: {bp.cliente} | id: {bp.identificador!r} | prefixo: {bp.tag_prefix} "
          f"| idioma: {bp.idioma.value}")
    print(f"Grupo padrao: {bp.grupo_padrao} | campos: {len(bp.campos_ticket)} "
          f"| condicionais: {len(bp.condicionais)} | views: {len(bp.views)} "
          f"| gatilhos: {len(bp.gatilhos_padrao)} | macros: {len(bp.macros)}")

    secret = args.secret or bp.acesso.segredo or ""
    client = ZendeskClient(bp.acesso.subdominio, bp.acesso.admin_email, secret,
                           auth_tipo=bp.acesso.auth_tipo, dry_run=not args.apply)

    print("\n== PREFLIGHT ==")
    rep = Runner(bp, client).preflight()
    print(rep.resumo())
    if not rep.ok and not args.force:
        print("\nAbortado no preflight. Ajuste as colisoes ou use --force.")
        return 1

    Runner(bp, client).run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
