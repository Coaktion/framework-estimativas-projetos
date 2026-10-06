# -*- coding: utf-8 -*-
"""Gatilhos padrao (3) em categoria 'Roteamento', sempre p/ 1o grupo.

Canal via via_id (numeros PADRAO do Zendesk, valem em qualquer conta):
  0=Formulario web  4=E-mail  75=Mensagens  74=WhatsApp
O CAMPO (subject) e descoberto na conta: prefere 'via_id', senao 'current_via_id'.
"""
VIA_ID = {"web": "0", "email": "4", "messaging": "75", "whatsapp": "74",
          "voice": "34", "social": "38"}


def _channel_subject(client):
    """Descobre qual campo de canal a conta aceita em gatilhos."""
    if client.dry_run:
        return "via_id"
    try:
        defs = client.get("/triggers/definitions.json").get("definitions", {})
        subjects = {c.get("subject") for c in
                    (defs.get("conditions_all") or []) + (defs.get("conditions_any") or [])}
        if "via_id" in subjects:
            return "via_id"
        if "current_via_id" in subjects:
            return "current_via_id"
    except Exception:
        pass
    return "current_via_id"


def _categoria(client, res, nome, record, log):
    if nome in res.category_ids:
        return res.category_ids[nome]
    r = client.post("/trigger_categories", {"trigger_category": {"name": nome}})
    cid = (r.get("trigger_category") or r).get("id")
    res.category_ids[nome] = cid
    record("trigger_category", cid)
    log(f"categoria de gatilho: {nome} -> {cid}")
    return cid


def provision(bp, client, res, record, log):
    if not bp.gatilhos_padrao:
        return
    grupo0 = bp.grupo_padrao
    if grupo0 is None:
        log("SEM grupos - pulando gatilhos padrao")
        return
    gid = res.group(grupo0)
    chan_subject = _channel_subject(client)
    termo_rot = {"pt-br": "Roteamento", "en-us": "Routing", "es": "Enrutamiento"}.get(bp.idioma.value, "Roteamento")
    cat_nome = bp.display(f"{bp.cliente} - {termo_rot}")   # ex: 056 Grupo Mater - Roteamento
    for t in bp.gatilhos_padrao:
        cid = _categoria(client, res, cat_nome, record, log)
        via = VIA_ID.get(t.canal.value)
        # nome: troca o token do "primeiro grupo" (em qualquer idioma) pelo nome real do grupo
        nome_t = t.nome
        for tok in ("1o grupo", "1º grupo", "1o Grupo", "primeiro grupo", "1st group", "1er grupo"):
            nome_t = nome_t.replace(tok, grupo0)
        if t.copilot:
            nome_t = nome_t + " + Copilot"
        conds_all = [
            {"field": "update_type", "operator": "is", "value": "Create"},
            {"field": "group_id", "operator": "is", "value": ""},
        ]
        if via is not None:
            conds_all.append({"field": chan_subject, "operator": "is", "value": via})
        # "atende QUALQUER uma": marca OU formulario da demo
        conds_any = []
        if res.brand_id:
            conds_any.append({"field": "brand_id", "operator": "is", "value": str(res.brand_id)})
        if res.form_id:
            conds_any.append({"field": "ticket_form_id", "operator": "is", "value": str(res.form_id)})
        body = {"trigger": {
            "title": bp.display(nome_t),
            "category_id": cid,
            "active": True,
            "actions": ([
                {"field": "group_id", "value": str(gid)},
                {"field": "priority", "value": "normal"},
                {"field": "type", "value": "question"},
            ] + ([{"field": "current_tags", "value": "agent_copilot_enabled"}] if t.copilot else [])),
            "conditions": {"all": conds_all, "any": conds_any},
        }}
        r = client.post("/triggers.json", body)
        tid = (r.get("trigger") or r).get("id")
        record("trigger", tid)
        log(f"gatilho: {bp.display(nome_t)} [canal {t.canal.value}={via}]")
