# -*- coding: utf-8 -*-
"""Vincula TODOS os admins e agentes a TODOS os grupos criados na demo.

Usa default=false -> NAO altera o grupo principal de cada agente.
Os vinculos somem junto quando o grupo e excluido (rollback), sem tracking extra.
"""
from provisioner.client import ZendeskError


def _staff(client):
    if client.dry_run:
        return [{"id": 1}, {"id": 2}, {"id": 3}]
    users, url = [], "/users.json?role[]=agent&role[]=admin&per_page=100"
    while url:
        j = client.get(url)
        users += j.get("users", [])
        url = j.get("next_page")
    # apenas ativos
    return [u for u in users if not u.get("suspended")]


def provision(bp, client, res, record, log):
    gids = list(res.groups.values())
    if not gids:
        return
    staff = _staff(client)
    if not staff:
        log("membership: nenhum agente/admin encontrado")
        return
    vinculos = [{"user_id": u["id"], "group_id": g, "default": False}
                for u in staff for g in gids]
    log(f"membership: {len(staff)} agentes/admins x {len(gids)} grupos = {len(vinculos)} vinculos")
    criados = 0
    for i in range(0, len(vinculos), 100):
        lote = vinculos[i:i + 100]
        try:
            client.post("/group_memberships/create_many.json", {"group_memberships": lote})
            criados += len(lote)
        except ZendeskError as e:
            log(f"membership: lote falhou HTTP {e.status}: {e.body[:120]}")
    log(f"membership: {criados} vinculos criados (default=false; grupo principal intacto)")
