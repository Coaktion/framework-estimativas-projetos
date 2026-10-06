# -*- coding: utf-8 -*-
"""Programacao (horario comercial) + feriados. Opcional.

workweek e feriados sao BEST-EFFORT: se a API recusar, viram aviso (o schedule
ja foi criado). Suporta 24/7 (dia todo)."""
from provisioner.client import ZendeskError

DIAS = {"dom": 0, "seg": 1, "ter": 2, "qua": 3, "qui": 4, "sex": 5, "sab": 6}


def provision(bp, client, res, record, log):
    sc = bp.programacao
    if not sc or not sc.criar:
        return
    r = client.post("/business_hours/schedules.json",
                    {"schedule": {"name": bp.display(sc.nome), "time_zone": "Brasilia"}})
    sid = (r.get("schedule") or r).get("id")
    record("schedule", sid)
    log(f"programacao: {sc.nome} -> {sid}")

    di, dfim = DIAS.get(sc.dia_inicio, 1), DIAS.get(sc.dia_fim, 5)
    h_ini, h_fim = max(0, int(sc.hora_inicio)), int(sc.hora_fim)
    full = h_fim <= h_ini or h_fim >= 24   # dia inteiro (ex.: 24/7)
    intervals = []
    for d in range(di, dfim + 1):
        base = d * 1440
        start = base + (0 if full else h_ini * 60)
        end = base + (1439 if full else h_fim * 60)   # 1439 evita estourar o limite da semana
        if end > start:
            intervals.append({"start_time": start, "end_time": end})
    if intervals:
        try:
            client.put(f"/business_hours/schedules/{sid}/workweek.json",
                       {"workweek": {"intervals": intervals}})
            log(f"programacao: workweek aplicado ({'24h' if full else f'{h_ini}h-{h_fim}h'})")
        except ZendeskError as e:
            log(f"programacao: workweek nao aplicado (HTTP {e.status}); horario padrao mantido")

    for h in bp.feriados:
        start = f"{h.ano}-{h.mes:02d}-{h.dia_inicio:02d}"
        end = f"{h.ano}-{h.mes:02d}-{h.dia_fim:02d}"
        try:
            client.post(f"/business_hours/schedules/{sid}/holidays.json",
                        {"holiday": {"name": h.nome, "start_date": start, "end_date": end}})
            log(f"feriado: {h.nome} ({start}..{end})")
        except ZendeskError as e:
            log(f"feriado '{h.nome}' nao criado (HTTP {e.status})")
