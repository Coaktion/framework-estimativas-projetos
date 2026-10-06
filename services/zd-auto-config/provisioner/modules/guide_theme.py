# -*- coding: utf-8 -*-
"""Importa um tema (.zip) no Help Center da marca via Theming API.

Fluxo (2 passos):
  1) POST /guide/theming/jobs/themes/imports  -> retorna URL+params de upload
  2) upload do .zip (multipart) para a URL retornada (host externo, sem auth ZD)
  3) poll do job -> theme_id
  4) POST /guide/theming/themes/{theme_id}/publish -> define como tema ativo (live)
"""
import os
import time
import httpx
from provisioner.client import ZendeskError


def provision(bp, client, res, record, log):
    zip_path = getattr(bp, "tema_zip", None)
    if not zip_path:
        if res.brand_id:
            log("tema: NENHUM tema configurado - Help Center fica com o tema padrao da Zendesk")
        return
    if not res.brand_id:
        log("tema: sem marca criada - pulando")
        return
    if not os.path.exists(zip_path):
        log(f"tema: arquivo nao encontrado '{zip_path}' - pulando")
        return
    if client.dry_run:
        log(f"tema: (dry-run) importaria '{zip_path}' na marca {res.brand_id}")
        return

    # 1) cria job de importacao
    r = client.post("/guide/theming/jobs/themes/imports",
                    {"job": {"attributes": {"brand_id": str(res.brand_id), "format": "zip"}}})
    job = r.get("job", r)
    data = job.get("data") or {}
    upload = data.get("upload") or {}
    url = upload.get("url")
    params = upload.get("parameters") or {}
    job_id = job.get("id")
    theme_id = data.get("theme_id")   # o theme_id ja vem AQUI, na criacao do job
    if not url:
        log(f"tema: resposta inesperada ao criar job -> {r}")
        return
    log(f"tema: job de import criado ({job_id}); theme_id={theme_id}; enviando .zip...")

    # 2) upload do .zip para a URL retornada (S3 presigned; sem auth do Zendesk)
    with open(zip_path, "rb") as fh:
        files = {"file": (os.path.basename(zip_path), fh, "application/zip")}
        up = httpx.post(url, data=params, files=files, timeout=180)
    log(f"tema: upload HTTP {up.status_code}")
    if up.status_code >= 400:
        log(f"tema: falha no upload -> {up.text[:300]}")
        return

    # 3) poll do job ate concluir (o theme_id ja foi capturado na criacao)
    for _ in range(30):
        j = client.get(f"/guide/theming/jobs/{job_id}").get("job", {})
        status = j.get("status")
        tid = (j.get("data") or {}).get("theme_id")
        if tid:
            theme_id = tid
        if status in ("completed", "failed"):
            log(f"tema: job {status}")
            if status == "failed":
                log(f"tema: erros -> {j.get('errors')}")
                return
            break
        time.sleep(2)

    if not theme_id:
        log("tema: nao obtive theme_id (verifique o job na tela)")
        return
    record("theme", theme_id)

    # define como tema ativo (live): endpoint correto e POST .../publish
    try:
        pub = client.post(f"/guide/theming/themes/{theme_id}/publish", {})
        live = (pub.get("theme") or {}).get("live")
        log(f"tema: importado e PUBLICADO (live={live}) -> {theme_id}")
    except ZendeskError as e:
        log(f"tema: importado -> {theme_id} (falha ao publicar; defina como ativo na tela; HTTP {e.status})")
