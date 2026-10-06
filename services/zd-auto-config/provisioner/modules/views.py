# -*- coding: utf-8 -*-
"""Views padrao (17) com CATALOGO de condicoes REAIS (replicado do prod).

Padroes do prod:
- quase todas: group_id=current_groups + support_type=0
- SLA Vencido: sla_next_breach_at > 0 (filtro nativo)
- Sentimento negativo: campo de IA cujo ID muda por ambiente -> lookup em runtime
- canais: mistura de tags (ocr_email/email, whatsapp, chat, talk/ura_callwe) + via_id

Criacao tolerante a falha: uma view rejeitada nao derruba as demais.
Chave do catalogo = nome da view SEM o emoji inicial.
"""
import re
from provisioner.client import ZendeskError

COLS = ["subject", "requester", "created_at", "status"]

# --- traducao SO do titulo exibido (a chave das condicoes continua sendo o nome PT) ---
CAT_TR = {
    "en-us": {"Tickets com prioridade": "Priority tickets",
              "Tickets por status": "Tickets by status",
              "Tickets por canais": "Tickets by channel"},
    "es": {"Tickets com prioridade": "Tickets prioritarios",
           "Tickets por status": "Tickets por estado",
           "Tickets por canais": "Tickets por canal"},
}
NAME_TR = {
    "en-us": {
        "Tickets com sentimento negativo": "Negative sentiment tickets",
        "SLA Vencido": "SLA breached", "VIP tickets": "VIP tickets",
        "Meus tickets abertos": "My open tickets", "Abertos no grupo": "Open in group",
        "Novos": "New", "Aguardando aprovação": "Awaiting approval",
        "Pendentes (Clientes)": "Pending (Customers)", "Em espera (Interno)": "On hold (Internal)",
        "Resolvidos": "Solved", "Abertos em outros grupos": "Open in other groups",
        "E-mail": "Email", "Formulário Web": "Web form", "Whatsapp": "WhatsApp",
        "Chat / Mensageria": "Chat / Messaging", "SMS ou Telefone": "SMS or Phone",
        "Mídias Sociais": "Social media",
    },
    "es": {
        "Tickets com sentimento negativo": "Tickets con sentimiento negativo",
        "SLA Vencido": "SLA vencido", "VIP tickets": "Tickets VIP",
        "Meus tickets abertos": "Mis tickets abiertos", "Abertos no grupo": "Abiertos en el grupo",
        "Novos": "Nuevos", "Aguardando aprovação": "Esperando aprobación",
        "Pendentes (Clientes)": "Pendientes (Clientes)", "Em espera (Interno)": "En espera (Interno)",
        "Resolvidos": "Resueltos", "Abertos em outros grupos": "Abiertos en otros grupos",
        "E-mail": "Correo", "Formulário Web": "Formulario web", "Whatsapp": "WhatsApp",
        "Chat / Mensageria": "Chat / Mensajería", "SMS ou Telefone": "SMS o Teléfono",
        "Mídias Sociais": "Redes sociales",
    },
}


def _titulo(loc, categoria, nome, base):
    """Traduz categoria e nome (preservando o emoji) para o idioma da demo."""
    prefix = re.match(r"^[^\wÀ-ÿ(]*", nome).group(0)   # emoji + espaco inicial
    cat = CAT_TR.get(loc, {}).get(categoria, categoria)
    nm = NAME_TR.get(loc, {}).get(base, base)
    return f"{cat}::{prefix}{nm}"

# condicoes comuns
GRP = {"field": "group_id", "operator": "is", "value": "current_groups"}
STYPE = {"field": "support_type", "operator": "is", "value": "0"}
NOTSELF = {"field": "requester_id", "operator": "is_not", "value": "assignee_id"}
OPEN_LT = {"field": "status", "operator": "less_than", "value": "solved"}


def _base(nome: str) -> str:
    return re.sub(r"^[^\wÀ-ÿ(]+", "", nome).strip()


def _sentiment_field(client):
    """ID do campo de IA de sentimento (varia por ambiente)."""
    if client.dry_run:
        return "SENT"
    for f in client.get("/ticket_fields.json").get("ticket_fields", []):
        if "sentiment" in (f.get("title") or "").lower() or "sentimento" in (f.get("title") or "").lower():
            return f["id"]
    return None


def _tag(v):
    return {"field": "current_tags", "operator": "includes", "value": v}


def _via(v):
    return {"field": "via_id", "operator": "is", "value": v}


def _catalogo(sent_id):
    st = lambda s: {"field": "status", "operator": "is", "value": s}
    cat = {
        "SLA Vencido": {"all": [{"field": "sla_next_breach_at", "operator": "greater_than", "value": "0"}, GRP, STYPE], "any": []},
        "VIP tickets": {"all": [NOTSELF, GRP, _tag("vip_premier"), STYPE], "any": []},
        "Meus tickets abertos": {"all": [{"field": "assignee_id", "operator": "is", "value": "current_user"}, OPEN_LT, STYPE], "any": []},
        "Abertos no grupo": {"all": [st("open"), GRP, STYPE], "any": []},
        "Novos": {"all": [st("new"), GRP, STYPE], "any": []},
        "Aguardando aprovação": {"all": [OPEN_LT, GRP, STYPE, _tag("aguardando_aprovacao")], "any": []},
        "Pendentes (Clientes)": {"all": [st("pending"), GRP, STYPE], "any": []},
        "Em espera (Interno)": {"all": [st("hold"), GRP, STYPE], "any": []},
        "Resolvidos": {"all": [{"field": "status", "operator": "greater_than", "value": "hold"}, GRP], "any": []},
        "Abertos em outros grupos": {"all": [OPEN_LT, STYPE], "any": []},
        "E-mail": {"all": [NOTSELF, _tag("ocr_email email"), GRP, OPEN_LT, STYPE], "any": []},
        "Formulário Web": {"all": [NOTSELF, OPEN_LT, STYPE], "any": [_via("0")]},
        "Whatsapp": {"all": [NOTSELF, OPEN_LT, STYPE], "any": [_tag("whatsapp"), _via("74")]},
        "Chat / Mensageria": {"all": [NOTSELF, OPEN_LT, _tag("chat"), GRP, STYPE], "any": []},
        "SMS ou Telefone": {"all": [NOTSELF, _tag("talk ura_callwe"), OPEN_LT, STYPE], "any": []},
        "Mídias Sociais": {"all": [NOTSELF, OPEN_LT, STYPE], "any": [_via("38"), _via("41"), _via("30"), _via("86")]},
    }
    # sentimento negativo depende do campo de IA (id por ambiente)
    if sent_id:
        cf = f"custom_fields_{sent_id}"
        cat["Tickets com sentimento negativo"] = {
            "all": [OPEN_LT, GRP, STYPE],
            "any": [{"field": cf, "operator": "is", "value": "sentiment__negative"},
                    {"field": cf, "operator": "is", "value": "sentiment__very_negative"}],
        }
    return cat


def _cond_do_criterio(criterio):
    """Monta condicoes a partir do texto do criterio da planilha.
    Formatos aceitos (separados por ';'):
      tags:tag1,tag2      -> current_tags includes
      status:open|pending|hold|solved|new
      abertos             -> status < solved
      grupo               -> group_id = current_groups
      meus                -> assignee = current_user
    Ex.: 'tags:aeti_tipo_processo_incidente; abertos; grupo'
    """
    if not criterio:
        return None
    alls = []
    for parte in str(criterio).split(";"):
        p = parte.strip().lower()
        if not p:
            continue
        if p.startswith("tags:"):
            tags = [t.strip() for t in p[5:].split(",") if t.strip()]
            if tags:
                alls.append({"field": "current_tags", "operator": "includes", "value": " ".join(tags)})
        elif p.startswith("status:"):
            alls.append({"field": "status", "operator": "is", "value": p[7:].strip()})
        elif p in ("abertos", "aberto", "open"):
            alls.append(OPEN_LT)
        elif p in ("grupo", "meus grupos", "group"):
            alls.append(GRP)
        elif p in ("meus", "meu", "mine"):
            alls.append({"field": "assignee_id", "operator": "is", "value": "current_user"})
    if not alls:
        return None
    alls.append(STYPE)
    return {"all": alls, "any": []}


def provision(bp, client, res, record, log):
    sent_id = _sentiment_field(client)
    cat = _catalogo(sent_id)
    loc = bp.idioma.value
    default = {"all": [OPEN_LT, STYPE], "any": []}
    ok = falhas = pulei = 0
    for v in bp.views:
        base = _base(v.nome)
        if base == "Tickets com sentimento negativo" and not sent_id:
            log(f"view PULADA: {v.nome} (campo de sentimento/IA nao encontrado neste ambiente)")
            pulei += 1
            continue
        cond = cat.get(base) or _cond_do_criterio(getattr(v, 'criterio', '')) or default
        titulo = _titulo(loc, v.categoria, v.nome, base)   # traduz p/ idioma; '::' aninha na categoria
        body = {"view": {"title": titulo, "active": True,
                         "conditions": {"all": cond["all"], "any": cond["any"]},
                         "execution": {"columns": COLS}}}
        try:
            r = client.post("/views.json", body)
            record("view", (r.get("view") or r).get("id"))
            ok += 1
            log(f"view: {titulo}")
        except ZendeskError as e:
            falhas += 1
            log(f"view FALHOU: {titulo} -> HTTP {e.status}: {e.body[:150]}")
    log(f"views: {ok} criadas, {falhas} rejeitadas, {pulei} puladas")
