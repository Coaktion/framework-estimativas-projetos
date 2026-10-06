# -*- coding: utf-8 -*-
"""Campos de ticket. Tags de opcao namespaced (previne colisao)."""
def provision(bp, client, res, record, log):
    for f in bp.campos_ticket:
        portal = f.nome_portal or f.nome
        payload = {"ticket_field": {
            "title": bp.display(f.nome),                 # visao AGENTE (com id)
            "title_in_portal": portal,                   # visao CLIENTE (limpo)
            "type": "tagger" if f.tipo.value == "dropdown" else f.tipo.value,
            "visible_in_portal": f.visivel_portal,
            "editable_in_portal": f.visivel_portal,
            "description": "",                           # SEM descricao (agente e portal)
        }}
        if f.tipo.value in ("dropdown", "multiselect"):
            opts, mapa = [], {}
            for o in f.opcoes:
                tag = bp.option_tag(f.chave_ref, o)
                opts.append({"name": o.label, "value": tag})
                mapa[o.label] = tag
            payload["ticket_field"]["custom_field_options"] = opts
            res.field_options[f.chave_ref] = mapa
        r = client.post("/ticket_fields.json", payload)
        fid = (r.get("ticket_field") or r).get("id")
        res.fields[f.chave_ref] = fid
        record("ticket_field", fid)
        log(f"campo: {bp.display(f.nome)} ({f.tipo.value}) -> {fid}")
