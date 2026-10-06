# -*- coding: utf-8 -*-
"""Formulario + campos condicionais. Formulario VISIVEL SO NA MARCA da demo."""
def _sys_type_priority(client):
    """IDs (por ambiente!) dos campos de sistema Tipo e Prioridade, nesta ordem.
    Subject/Description sao sempre exibidos no topo pelo Zendesk automaticamente."""
    if client.dry_run:
        return [90001, 90002]
    achado = {}
    for f in client.get("/ticket_fields.json").get("ticket_fields", []):
        t = f.get("type")
        if t in ("tickettype", "priority"):
            achado[t] = f["id"]
    return [achado[k] for k in ("tickettype", "priority") if k in achado]

def provision(bp, client, res, record, log):
    field_ids = _sys_type_priority(client) + [res.fields[f.chave_ref] for f in bp.campos_ticket]
    nome = bp.display(bp.cliente)
    form = {"name": nome, "display_name": nome, "active": True,
            "end_user_visible": True, "position": 9999, "ticket_field_ids": field_ids}
    # visivel SOMENTE na marca da demo
    if res.brand_id:
        form["in_all_brands"] = False
        form["restricted_brand_ids"] = [res.brand_id]
    r = client.post("/ticket_forms.json", {"ticket_form": form})
    res.form_id = (r.get("ticket_form") or r).get("id")
    record("ticket_form", res.form_id)
    escopo = f"marca {res.brand_id}" if res.brand_id else "todas as marcas"
    log(f"formulario: {nome} -> {res.form_id} (visivel em: {escopo})")

    # condicionais
    def build(publico_ok):
        conds = []
        for c in bp.condicionais:
            if not publico_ok(c.publico):
                continue
            parent_id = res.fields.get(c.campo_pai_ref)
            valor = res.field_options.get(c.campo_pai_ref, {}).get(c.quando_valor, c.quando_valor)
            children = [{"id": res.fields.get(ref), "is_required": ref in c.obrigatorios_refs}
                        for ref in c.mostrar_refs]
            conds.append({"parent_field_id": parent_id, "value": valor, "child_fields": children})
        return conds
    eu = build(lambda p: p in ("usuario", "ambos"))
    ag = build(lambda p: p in ("agente", "ambos"))
    if eu or ag:
        client.put(f"/ticket_forms/{res.form_id}.json",
                   {"ticket_form": {"id": res.form_id, "end_user_conditions": eu,
                                    "agent_conditions": ag}})
        log(f"condicionais: {len(eu)} usuario / {len(ag)} agente")
