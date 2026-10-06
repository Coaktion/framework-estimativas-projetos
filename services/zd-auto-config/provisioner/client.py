# -*- coding: utf-8 -*-
"""Cliente HTTP do Zendesk: auth, backoff em 429, SSL ligado e modo dry-run."""
from __future__ import annotations
import time
import logging
from typing import Any, Optional

try:
    import httpx
except ImportError:  # fallback p/ ambientes sem httpx
    httpx = None

log = logging.getLogger("zd.client")


class ZendeskClient:
    def __init__(self, subdomain: str, email: str = "", secret: str = "",
                 auth_tipo: str = "token", dry_run: bool = False,
                 timeout: float = 30.0, client_id: str = "", client_secret: str = "",
                 scope: str = "read write"):
        self.subdomain = subdomain
        self.base = f"https://{subdomain}.zendesk.com/api/v2"
        self.guide_sub = subdomain   # trocado p/ subdominio da marca apos cria-la
        self.auth_tipo = auth_tipo
        self.dry_run = dry_run
        self._fake_id = 1000
        # OAuth (client credentials): access token curto, buscado sob demanda
        self._oauth_url = f"https://{subdomain}.zendesk.com/oauth/tokens"
        self.client_id, self.client_secret = client_id, client_secret
        self.scope = scope or "read write"
        self._bearer = None
        if auth_tipo == "oauth":
            self.auth = None
        else:
            user = f"{email}/token" if auth_tipo == "token" else email
            self.auth = (user, secret)
        if httpx and not dry_run:
            self._c = httpx.Client(timeout=timeout, verify=True,
                                   headers={"Content-Type": "application/json"})
        else:
            self._c = None

    # -- OAuth: troca client_id/secret por access token (Bearer) ------------- #
    def _fetch_bearer(self):
        r = self._c.post(self._oauth_url,
                         data={"grant_type": "client_credentials",
                               "client_id": self.client_id,
                               "client_secret": self.client_secret,
                               "scope": self.scope,
                               "expires_in": 14400},   # 4h: cobre run + pausa do Help Center
                         headers={"Content-Type": "application/x-www-form-urlencoded"})
        if r.status_code >= 400:
            raise ZendeskError(r.status_code, r.text, self._oauth_url)
        self._bearer = r.json().get("access_token")
        if not self._bearer:
            raise ZendeskError(500, "sem access_token na resposta OAuth", self._oauth_url)

    # -- baixo nivel com retry/backoff --------------------------------------- #
    def _req(self, method: str, url: str, json: Optional[dict] = None) -> dict:
        if self.dry_run:
            self._fake_id += 1
            log.info("[dry-run] %s %s", method, url)
            return {"_dry": True, "id": self._fake_id}
        auth_retries = 0
        for attempt in range(8):
            if self.auth_tipo == "oauth":
                if not self._bearer:
                    self._fetch_bearer()
                r = self._c.request(method, url, json=json,
                                    headers={"Authorization": f"Bearer {self._bearer}"})
            else:
                r = self._c.request(method, url, json=json, auth=self.auth)
            if r.status_code == 429:
                wait = int(r.headers.get("Retry-After", 2 ** attempt))
                log.warning("429 rate limit; aguardando %ss", wait)
                time.sleep(wait)
                continue
            # 401 = falha de auth. Um 401 apos varias chamadas OK e quase sempre
            # transitorio (blip/throttle da Zendesk). Retentamos ate 3x: no OAuth,
            # renovando o access token; no token de API, aguardando um pouco.
            # Retentar em 401 e seguro (a requisicao nao foi processada).
            if r.status_code == 401 and auth_retries < 3:
                auth_retries += 1
                if self.auth_tipo == "oauth":
                    self._bearer = None
                    self._fetch_bearer()
                else:
                    log.warning("401 transitorio; tentativa %s/3 apos backoff", auth_retries)
                    time.sleep(1.5 * auth_retries)
                continue
            if r.status_code >= 400:
                raise ZendeskError(r.status_code, r.text, url)
            return r.json() if r.content else {}
        raise ZendeskError(429, "limite de tentativas excedido", url)

    def get(self, path: str) -> dict:      return self._req("GET", self._u(path))
    def post(self, path: str, body: dict): return self._req("POST", self._u(path), body)
    def put(self, path: str, body: dict):  return self._req("PUT", self._u(path), body)
    def delete(self, path: str):           return self._req("DELETE", self._u(path))

    def _u(self, path: str) -> str:
        if path.startswith("http"): return path
        if not path.startswith("/"): path = "/" + path
        if path.startswith("/help_center"):
            return f"https://{self.guide_sub}.zendesk.com/api/v2" + path
        return self.base + path


class ZendeskError(Exception):
    def __init__(self, status: int, body: str, url: str):
        self.status, self.body, self.url = status, body, url
        super().__init__(f"HTTP {status} em {url}: {body[:300]}")
