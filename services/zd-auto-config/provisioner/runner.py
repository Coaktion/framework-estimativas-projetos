# -*- coding: utf-8 -*-
"""Orquestracao: preflight -> marca -> modulos, na ordem correta.
Rastreia tudo que cria (para rollback) e respeita os toggles do Blueprint."""
from __future__ import annotations
import logging
import time
import threading
import re
import random
from blueprint import Blueprint
from .client import ZendeskClient, ZendeskError
from .resolver import NameResolver
from .preflight import run_preflight
from . import modules

log = logging.getLogger("zd.runner")

# ordem de exclusao (reverso da criacao) e path de delete por tipo
_DELETE = {
    "user": None,  # nao excluimos usuarios automaticamente
    "schedule": "/business_hours/schedules/{id}.json",
    "sla_policy": "/slas/policies/{id}.json",
    "group_sla_policy": "/group_slas/policies/{id}.json",
    "theme": "/guide/theming/themes/{id}",
    "article": None,       # depende de locale; tratado a parte se necessario
    "section": None,
    "view": "/views/{id}.json",
    "macro": "/macros/{id}.json",
    "trigger": "/triggers/{id}.json",
    "trigger_category": "/trigger_categories/{id}",
    "ticket_form": "/ticket_forms/{id}.json",
    "ticket_field": "/ticket_fields/{id}.json",
    "group": "/groups/{id}.json",
    "brand": "/brands/{id}.json",
}


class Cancelled(Exception):
    """Execucao interrompida pelo usuario."""


class Runner:
    def __init__(self, bp: Blueprint, client: ZendeskClient, on_log=None):
        self.bp, self.client = bp, client
        self.res = NameResolver()
        self.created: list[tuple[str, int]] = []
        self.on_log = on_log   # callback opcional p/ streaming (web)
        self.cancel_event = threading.Event()   # setado -> interrompe entre etapas

    def _check_cancel(self) -> None:
        if self.cancel_event.is_set():
            raise Cancelled()

    def _record(self, kind: str, rid) -> None:
        if rid is not None:
            self.created.append((kind, rid))

    def _log(self, msg: str) -> None:
        print(f"  . {msg}")
        if self.on_log:
            try:
                self.on_log(msg)
            except Exception:
                pass

    # -- marca (fora de modules p/ setar brand_id cedo) --------------------- #
    @staticmethod
    def _novo_sub(base: str) -> str:
        """Gera um subdominio novo a partir do base (para escapar de colisao/reserva)."""
        core = re.sub(r"[^a-z0-9]", "", (base or "zddemo").lower())[:18] or "zddemo"
        return f"{core}{random.randint(1000, 9999)}"

    def _brand(self) -> None:
        b = self.bp.marca
        if not b or not b.criar:
            return
        sub = b.subdominio
        ultimo = None
        for _ in range(5):
            try:
                r = self.client.post("/brands.json",
                                     {"brand": {"name": self.bp.display(b.nome),
                                                "subdomain": sub}})
                self.res.brand_id = (r.get("brand") or r).get("id")
                b.subdominio = sub
                self.client.guide_sub = sub          # Guide vai p/ o host da marca
                self._record("brand", self.res.brand_id)
                self._log(f"marca: {self.bp.display(b.nome)} -> {self.res.brand_id} (guide host: {sub})")
                return
            except ZendeskError as e:
                ultimo = e
                body = (e.body or "").lower()
                colisao = e.status == 422 and any(t in body for t in (
                    "subdomain", "reservedvalue", "reservado", "recipient_addresses",
                    "duplicate", "ja existe", "já existe"))
                if not colisao:
                    raise
                novo = self._novo_sub(sub)
                self._log(f"subdominio '{sub}' indisponivel (reservado/duplicado); tentando '{novo}'")
                sub = novo
        if ultimo:
            raise ultimo

    def preflight(self):
        rep = run_preflight(self.bp, self.client)
        return rep

    def run(self, rollback_on_error: bool = True, after_brand=None) -> None:
        self._log("PROVISIONAMENTO " + ("(dry-run)" if self.client.dry_run else "(REAL)"))
        # --- Fase 1: marca + base. Erro AQUI aborta (e desfaz, se pedido). ---
        try:
            self._check_cancel()
            self._brand()
            if after_brand is not None:
                after_brand(self)
            self._check_cancel()
        except Cancelled:
            self._log("INTERROMPIDO pelo usuario; desfazendo o que ja foi criado...")
            if not self.client.dry_run:
                self.rollback()
            raise
        except (ZendeskError, KeyError) as e:
            self._log(f"ERRO na criacao da marca/base: {e}")
            if rollback_on_error and not self.client.dry_run:
                self.rollback()
            raise
        # --- Fase 2: modulos. Falha em UM NAO derruba os demais nem faz rollback. ---
        falhas = []
        for mod in modules.ORDER:
            nome = mod.__name__.split(".")[-1]
            try:
                self._check_cancel()   # ponto de interrupcao entre etapas
                self._log(f"== {nome} ==")
                mod.provision(self.bp, self.client, self.res, self._record, self._log)
            except Cancelled:
                self._log("INTERROMPIDO pelo usuario; desfazendo o que ja foi criado...")
                if not self.client.dry_run:
                    self.rollback()
                raise
            except (ZendeskError, KeyError) as e:
                falhas.append(nome)
                self._log(f"ETAPA '{nome}' FALHOU (seguindo; NADA foi desfeito): {e}")
                continue
        if falhas:
            self._log(f"CONCLUIDO COM AVISOS. Etapas com falha: {', '.join(falhas)}. "
                      f"{len(self.created)} recursos mantidos - use 'Desfazer tudo' se quiser reverter.")
        else:
            self._log(f"OK: {len(self.created)} recursos criados")

    def rollback_log(self, msg):
        self._log(msg)

    def _del_one(self, kind, rid) -> bool:
        """Remove UM recurso. Retorna True se removido (ou se nao ha o que remover).
        As chamadas passam por client._req, que ja retenta em 401 transitorio."""
        try:
            if kind == "brand":
                try:
                    self.client.put(f"/brands/{rid}.json", {"brand": {"active": False}})
                except ZendeskError:
                    pass
                self.client.delete(f"/brands/{rid}.json")
                self._log(f"- removido brand {rid}")
                return True
            path = _DELETE.get(kind)
            if not path:
                self._log(f"(mantido) {kind} {rid}")
                return True
            self.client.delete(path.format(id=rid))
            self._log(f"- removido {kind} {rid}")
            return True
        except ZendeskError as e:
            self._log(f"! falha ao remover {kind} {rid}: {e.status}")
            return False

    def rollback(self) -> None:
        self._log(f"ROLLBACK: desfazendo {len(self.created)} recursos")
        pendentes = []
        for kind, rid in reversed(self.created):
            if not self._del_one(kind, rid):
                pendentes.append((kind, rid))
        # 2a varredura: alguns 401 sao transitorios e duram mais que as retentativas
        # internas; espera e tenta de novo o que sobrou, para nao deixar residuo.
        if pendentes:
            self._log(f"ROLLBACK: {len(pendentes)} pendente(s); nova tentativa em 5s...")
            time.sleep(5)
            ainda = [(k, r) for (k, r) in pendentes if not self._del_one(k, r)]
            if ainda:
                self._log("ATENCAO: nao consegui remover automaticamente: "
                          + ", ".join(f"{k} {r}" for k, r in ainda)
                          + ". Remova manualmente no Zendesk (ou rode LIMPAR_DEMO).")
            else:
                self._log("ROLLBACK: pendencias resolvidas na 2a tentativa.")
