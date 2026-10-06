# -*- coding: utf-8 -*-
"""Resolucao por NOME/chave -> ID (substitui os indices frageis do v4)."""
from __future__ import annotations


class NameResolver:
    def __init__(self):
        self.groups: dict[str, int] = {}       # nome grupo -> id
        self.fields: dict[str, int] = {}        # chave_ref -> ticket_field id
        self.field_options: dict[str, dict[str, str]] = {}  # chave_ref -> {label: tag}
        self.sections: dict[str, int] = {}      # titulo secao -> id
        self.brand_id: int | None = None
        self.form_id: int | None = None
        self.category_ids: dict[str, int] = {}  # categoria trigger -> id

    def group(self, nome: str) -> int:
        if nome not in self.groups:
            raise KeyError(f"Grupo nao resolvido: {nome!r}")
        return self.groups[nome]

    def field(self, ref: str) -> int:
        if ref not in self.fields:
            raise KeyError(f"Campo (chave_ref) nao resolvido: {ref!r}")
        return self.fields[ref]
