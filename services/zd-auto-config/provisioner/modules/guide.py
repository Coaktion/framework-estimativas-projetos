# -*- coding: utf-8 -*-
"""Guide: CRIA categoria 'Geral' + secoes + artigos (idioma da demo).

Nao depende de existir categoria default. Funciona mesmo com o Help Center
em modo setup (nao publicado a usuarios finais) - a API cria normalmente.

Guia de apresentacao entra como artigo INTERNO (segmento 'Agentes e admins').
"""
from provisioner.client import ZendeskError

SECAO_APRESENTACAO_L = {"pt-br": "Guia de Apresentacao (interno)",
                        "en-us": "Presentation Guide (internal)",
                        "es": "Guía de presentación (interno)"}
CATEGORIA_PADRAO_L = {"pt-br": "Geral", "en-us": "General", "es": "General"}


def _segments(client):
    if client.dry_run:
        return {"logado": 90, "staff": 91}
    out = {}
    try:
        for seg in client.get("/help_center/user_segments.json").get("user_segments", []):
            ut = (seg.get("user_type") or "").lower()
            if ut in ("signed_in_users", "signed-in users"):
                out["logado"] = seg["id"]
            elif ut == "staff":
                out["staff"] = seg["id"]
    except ZendeskError:
        pass
    return out


def _perm_group_managers(client):
    if client.dry_run:
        return 80
    try:
        for pg in client.get("/guide/permission_groups.json").get("permission_groups", []):
            if "manage" in (pg.get("name") or "").lower() or pg.get("built_in"):
                return pg["id"]
    except ZendeskError:
        pass
    return None


def _segment_for(acesso, segs):
    a = getattr(acesso, "value", acesso)
    if a == "logado":
        return segs.get("logado")
    if a == "agente":
        return segs.get("staff")
    return None


def _ensure_category(client, loc, idi, record, log):
    """Cria a categoria padrao (nome no idioma 'idi', endpoint no locale 'loc' do HC)."""
    nome_cat = CATEGORIA_PADRAO_L.get(idi, "Geral")
    try:
        r = client.post(f"/help_center/{loc}/categories.json",
                        {"category": {"name": nome_cat, "locale": loc}})
        cid = (r.get("category") or r).get("id")
        record("category", cid)
        log(f"categoria: {nome_cat} -> {cid}")
        return cid
    except ZendeskError as e:
        try:
            cats = client.get(f"/help_center/{loc}/categories.json").get("categories", [])
            if cats:
                log(f"categoria existente reutilizada -> {cats[0]['id']}")
                return cats[0]["id"]
        except ZendeskError:
            pass
        log(f"nao foi possivel criar categoria (HTTP {e.status})")
        return None


def _post_article(client, loc, sid, titulo, corpo, seg_id, perm_id, record, log):
    art = {"title": titulo, "body": corpo, "locale": loc, "draft": False}
    if seg_id is not None:
        art["user_segment_id"] = seg_id
    if perm_id is not None:
        art["permission_group_id"] = perm_id
    r = client.post(f"/help_center/{loc}/sections/{sid}/articles.json", {"article": art})
    record("article", (r.get("article") or r).get("id"))
    log(f"artigo: {titulo}")


def _resolve_locale(client, want, log):
    """Casa o idioma da demo com um locale REAL habilitado no Help Center.
    Ex.: want='es' e o HC tem 'es-es' -> usa 'es-es'. Sem match -> default do HC."""
    if client.dry_run:
        return want
    try:
        data = client.get("/help_center/locales.json")
    except ZendeskError:
        return want
    locales = [str(x).lower() for x in (data.get("locales") or [])]
    default = (data.get("default_locale") or want)
    w = want.lower()
    if not locales:
        return want
    if w in locales:
        return w
    base = w.split("-")[0]
    # prefere um locale que comece com o mesmo idioma base (es -> es-es, es-419...)
    for candidato in locales:
        if candidato == base or candidato.startswith(base + "-"):
            log(f"locale: '{want}' nao habilitado; usando '{candidato}' do Help Center")
            return candidato
    log(f"locale: '{want}' indisponivel; usando default do Help Center '{default}'")
    return default


def provision(bp, client, res, record, log):
    if not bp.guide_secoes and not bp.guide_artigos and not bp.guia_apresentacao:
        return
    idi = bp.idioma.value                       # base p/ NOMES traduzidos (pt-br|en-us|es)
    loc = _resolve_locale(client, idi, log)     # locale REAL do HC p/ endpoints e campo 'locale'
    cat = _ensure_category(client, loc, idi, record, log)
    if cat is None:
        log("sem categoria - pulando Guide")
        return
    segs = _segments(client)
    perm = _perm_group_managers(client)

    for s in bp.guide_secoes:
        r = client.post(f"/help_center/{loc}/categories/{cat}/sections.json",
                        {"section": {"name": s.titulo, "locale": loc, "position": 1}})
        sid = (r.get("section") or r).get("id")
        res.sections[s.titulo] = sid
        record("section", sid)
        log(f"secao: {s.titulo} -> {sid}")

    for a in bp.guide_artigos:
        sid = res.sections.get(a.secao_titulo)
        if sid is None:
            log(f"artigo '{a.titulo}': secao '{a.secao_titulo}' nao encontrada - pulando")
            continue
        _post_article(client, loc, sid, a.titulo, a.corpo,
                      _segment_for(a.acesso, segs), perm, record, log)

    g = bp.guia_apresentacao
    if g and g.criar:
        sec_apres = SECAO_APRESENTACAO_L.get(idi, "Guia de Apresentacao (interno)")
        r = client.post(f"/help_center/{loc}/categories/{cat}/sections.json",
                        {"section": {"name": sec_apres, "locale": loc, "position": 9999}})
        sid = (r.get("section") or r).get("id")
        res.sections[sec_apres] = sid
        record("section", sid)
        _post_article(client, loc, sid, bp.display(g.titulo), g.corpo,
                      segs.get("staff"), perm, record, log)
        log("guia de apresentacao: artigo interno (Agentes e admins) criado")
