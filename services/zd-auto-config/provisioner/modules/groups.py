# -*- coding: utf-8 -*-
"""Grupos. Ordem preservada: 1o grupo = destino padrao."""
def provision(bp, client, res, record, log):
    for g in bp.grupos:
        nome = bp.display(g.nome)
        r = client.post("/groups.json", {"group": {"name": nome}})
        gid = r.get("group", r).get("id") if isinstance(r.get("group"), dict) else r.get("id")
        res.groups[g.nome] = gid
        record("group", gid)
        log(f"grupo: {nome} -> {gid}")
