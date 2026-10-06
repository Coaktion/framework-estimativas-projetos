# -*- coding: utf-8 -*-
"""Usuarios (agentes). Opcional; grupo resolvido por nome."""
def provision(bp, client, res, record, log):
    # nota: usuarios saem de aba propria; no Fase 0 usamos bp.<...> se existir
    users = getattr(bp, "usuarios", None) or []
    for u in users:
        body = {"user": {"name": u.get("nome"), "email": u.get("email"),
                         "role": "agent", "verified": True,
                         "default_group_id": res.group(u["grupo"]) if u.get("grupo") else None}}
        r = client.post("/users/create_or_update.json", body)
        record("user", (r.get("user") or r).get("id"))
        log(f"usuario: {u.get('nome')}")
