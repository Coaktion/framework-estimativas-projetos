# -*- coding: utf-8 -*-
"""GROUP SLA: SEMPRE uma politica de GRUPO (group_ownership_time) por grupo criado.

Objeto distinto do SLA comum: POST /api/v2/group_slas/policies.json
Mede o tempo que o ticket fica sob posse de cada grupo.
"""
DEFAULT = {"urgent": 60, "high": 120, "normal": 240, "low": 480}  # min de posse do grupo


def provision(bp, client, res, record, log):
    if not bp.sla or not bp.sla.criar:
        return
    alvos = bp.sla.resolution or bp.sla.first_reply or DEFAULT
    pos = 1
    for g in bp.grupos:
        gid = res.group(g.nome)
        metrics = [{"priority": p, "metric": "group_ownership_time",
                    "target": t, "business_hours": False} for p, t in alvos.items()]
        body = {"group_sla_policy": {
            "title": bp.display(f"SLA {g.nome}"),
            "description": f"Group SLA da demo para {g.nome}",
            "position": pos,
            "filter": {"all": [{"field": "group_id", "operator": "includes", "value": [gid]}], "any": []},
            "policy_metrics": metrics,
        }}
        r = client.post("/group_slas/policies.json", body)
        record("group_sla_policy", (r.get("group_sla_policy") or r).get("id"))
        log(f"GROUP SLA: {bp.display('SLA ' + g.nome)} (posse do grupo {g.nome})")
        pos += 1
