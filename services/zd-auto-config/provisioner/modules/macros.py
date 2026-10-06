# -*- coding: utf-8 -*-
"""Macros (idioma unico). Reutilizaveis em procedures do Copilot."""
STATUS = {"aberto": "open", "pendente": "pending", "espera": "hold", "resolvido": "solved"}
PRIOR = {"baixa": "low", "normal": "normal", "alta": "high", "urgente": "urgent"}

def provision(bp, client, res, record, log):
    for m in bp.macros:
        if not m.status_ticket or not m.grupo_destino:
            log(f"AVISO: macro '{m.nome}' sem status e/ou grupo destino "
                f"(regra: macros devem alterar status e grupo de atribuicao)")
        actions = [
            {"field": "comment_value_html", "value": f"<p>{m.mensagem}</p>"},
            {"field": "comment_mode_is_public", "value": "true" if m.publico else "false"},
        ]
        if m.status_ticket:
            actions.append({"field": "status", "value": STATUS.get(m.status_ticket.lower(), m.status_ticket)})
        if m.prioridade:
            actions.append({"field": "priority", "value": PRIOR.get(m.prioridade.lower(), m.prioridade)})
        if m.grupo_destino:
            actions.append({"field": "group", "value": str(res.group(m.grupo_destino))})
        body = {"macro": {"title": bp.display(m.nome), "active": True, "actions": actions}}
        # visivel SOMENTE para os grupos da demo (o especifico, ou todos os criados)
        if m.grupo_visualizador:
            vids = [res.group(m.grupo_visualizador)]
        else:
            vids = list(res.groups.values())
        if vids:
            body["macro"]["restriction"] = {"type": "Group", "id": vids[0], "ids": vids}
        r = client.post("/macros.json", body)
        record("macro", (r.get("macro") or r).get("id"))
        log(f"macro: {bp.display(m.nome)}")
