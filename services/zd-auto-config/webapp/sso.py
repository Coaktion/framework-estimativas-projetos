# -*- coding: utf-8 -*-
"""Autenticacao pelo site (pre-sales-ai / Tool Center).

A tela do ZD Auto Config mora dentro do site (Next.js). O site confere o login
do usuario (NextAuth) e o segmento, e entrega a tela um token curto, assinado
com HMAC-SHA256 (formato JWT HS256). A tela chama esta API com
`Authorization: Bearer <token>`. Este modulo so VALIDA o token — quem
autentica de verdade e o site. O servico nao guarda sessao nem cookie.

Regras de validacao:
  - so HS256 (nenhum outro algoritmo e aceito, nem 'none');
  - assinatura conferida em tempo constante;
  - iss = pre-sales-ai e aud = zd-auto-config-api;
  - expirado e recusado; validade maxima de 30 minutos, mesmo que o token diga mais;
  - o segmento e conferido de novo aqui: ADMIN, SC ou isAdmin.

Ativado quando ZDCFG_SSO_SECRET esta definida. Sem ela, o app continua com o
login local de sempre (uso na maquina do consultor).
"""
from __future__ import annotations

import os
import hmac
import json
import time
import base64
import hashlib

ISS = "pre-sales-ai"
AUD = "zd-auto-config-api"
SEGMENTOS = {"ADMIN", "SC"}
VALIDADE_MAX = 30 * 60      # segundos
TOLERANCIA_RELOGIO = 30     # segundos


class TokenInvalido(Exception):
    pass


def segredo() -> str:
    return (os.environ.get("ZDCFG_SSO_SECRET") or "").strip()


def ativo() -> bool:
    return bool(segredo())


def site_url() -> str:
    return (os.environ.get("ZDCFG_SITE_URL") or "").strip().rstrip("/")


def site_origin() -> str:
    """Origem (esquema + host + porta) do site, para o CORS."""
    u = site_url()
    if not u:
        return ""
    partes = u.split("/")
    return "/".join(partes[:3]) if len(partes) >= 3 else u


def _b64d(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def validar(token: str) -> dict:
    """Devolve as claims se o token for valido; levanta TokenInvalido se nao."""
    chave = segredo()
    if not chave:
        raise TokenInvalido("SSO nao configurado")
    try:
        h64, p64, s64 = token.split(".")
        cab = json.loads(_b64d(h64))
        claims = json.loads(_b64d(p64))
        assinatura = _b64d(s64)
    except Exception:
        raise TokenInvalido("token malformado")

    if cab.get("alg") != "HS256" or cab.get("typ", "JWT") != "JWT":
        raise TokenInvalido("algoritmo nao aceito")
    esperada = hmac.new(chave.encode(), f"{h64}.{p64}".encode(), hashlib.sha256).digest()
    if not hmac.compare_digest(esperada, assinatura):
        raise TokenInvalido("assinatura invalida")

    agora = time.time()
    try:
        iat, exp = float(claims.get("iat", 0)), float(claims.get("exp", 0))
    except (TypeError, ValueError):
        raise TokenInvalido("token malformado")
    if claims.get("iss") != ISS or claims.get("aud") != AUD:
        raise TokenInvalido("emissor ou destino invalido")
    if exp <= agora:
        raise TokenInvalido("token expirado")
    if iat > agora + TOLERANCIA_RELOGIO or exp - iat > VALIDADE_MAX:
        raise TokenInvalido("janela de validade invalida")
    if not claims.get("sub"):
        raise TokenInvalido("token incompleto")

    segmento = str(claims.get("role") or "").upper()
    if not (claims.get("adm") is True or segmento in SEGMENTOS):
        raise TokenInvalido("sem permissao para o ZD Auto Config")
    return claims


def identidade(claims: dict) -> dict:
    """O que o resto do app precisa saber sobre quem esta chamando."""
    return {"email": str(claims["sub"]).strip().lower(),
            "nome": str(claims.get("name") or claims["sub"]),
            "adm": claims.get("adm") is True,
            "role": str(claims.get("role") or "").upper()}
