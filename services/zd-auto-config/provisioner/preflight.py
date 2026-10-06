# -*- coding: utf-8 -*-
"""Pre-checagem: detecta colisao de tags/campos ANTES de criar qualquer coisa.

Resolve a dor de 'apagar tudo e refazer': o relatorio sai antes do 1o POST.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from blueprint import Blueprint


@dataclass
class PreflightReport:
    tag_colisoes: list[str] = field(default_factory=list)
    campos_existentes: list[str] = field(default_factory=list)
    grupos_existentes: list[str] = field(default_factory=list)
    ok: bool = True

    def resumo(self) -> str:
        linhas = []
        if self.tag_colisoes:
            linhas.append(f"TAGS EM COLISAO ({len(self.tag_colisoes)}): " +
                          ", ".join(self.tag_colisoes[:20]))
        if self.campos_existentes:
            linhas.append(f"Campos ja existentes: {', '.join(self.campos_existentes[:20])}")
        if self.grupos_existentes:
            linhas.append(f"Grupos ja existentes: {', '.join(self.grupos_existentes[:20])}")
        return "\n".join(linhas) or "Sem colisoes detectadas."


def _tags_planejadas(bp: Blueprint) -> set[str]:
    tags = set()
    for f in bp.campos_ticket + bp.campos_usuario + bp.campos_org:
        for opt in f.opcoes:
            tags.add(bp.option_tag(f.chave_ref, opt))
    return tags


def run_preflight(bp: Blueprint, client) -> PreflightReport:
    rep = PreflightReport()
    if client.dry_run:
        # sem ambiente real: so valida unicidade interna das tags planejadas
        planejadas = list()
        vistos = set()
        for f in bp.campos_ticket + bp.campos_usuario + bp.campos_org:
            for opt in f.opcoes:
                t = bp.option_tag(f.chave_ref, opt)
                if t in vistos:
                    rep.tag_colisoes.append(t)
                vistos.add(t)
        rep.ok = not rep.tag_colisoes
        return rep

    # ambiente real: compara com o que ja existe
    existentes_tags: set[str] = set()
    data = client.get("/ticket_fields.json")
    for f in data.get("ticket_fields", []):
        for opt in f.get("custom_field_options", []) or []:
            existentes_tags.add(opt.get("value", ""))
    for t in _tags_planejadas(bp):
        if t in existentes_tags:
            rep.tag_colisoes.append(t)

    nomes_campo = {f.get("title") for f in data.get("ticket_fields", [])}
    for f in bp.campos_ticket:
        if bp.display(f.nome) in nomes_campo:
            rep.campos_existentes.append(f.nome)

    gdata = client.get("/groups.json")
    nomes_grupo = {g.get("name") for g in gdata.get("groups", [])}
    for g in bp.grupos:
        if bp.display(g.nome) in nomes_grupo:
            rep.grupos_existentes.append(g.nome)

    rep.ok = not (rep.tag_colisoes or rep.campos_existentes)
    return rep
