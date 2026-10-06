# -*- coding: utf-8 -*-
"""
Schema canonico ("Blueprint") da ZD Auto Config v5.

Fonte unica da verdade que descreve o ambiente de demo do Zendesk.
Planilha, formulario web e templates de segmento sao todos MAPEADOS para
este modelo; o provisionador consome SOMENTE este modelo.

Principios:
- Cada demo e MONOLINGUE (um unico idioma). Sem Dynamic Content.
- Referencia por NOME/chave, nunca por indice de linha.
- Toggle `criar` em cada bloco -> validacao seletiva universal.
- Tags de opcao namespaced por `tag_prefix` -> previne colisao entre demos.
- Identificador (numero + emoji) prefixa nomes na visao de agente.

Requer: pydantic v2  (pip install pydantic)
"""
from __future__ import annotations
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator


# --------------------------------------------------------------------------- #
# Tipos base
# --------------------------------------------------------------------------- #
class Locale(str, Enum):
    pt = "pt-br"
    en = "en-us"
    es = "es"


class FieldType(str, Enum):
    text = "text"
    textarea = "textarea"
    dropdown = "dropdown"
    checkbox = "checkbox"
    date = "date"
    integer = "integer"
    decimal = "decimal"
    multiselect = "multiselect"


class Channel(str, Enum):
    web = "web"
    messaging = "messaging"
    whatsapp = "whatsapp"
    email = "email"
    voice = "voice"
    social = "social"


class Access(str, Enum):
    aberto = "aberto"     # user_segment = None
    logado = "logado"     # signed-in users
    agente = "agente"     # staff = Agentes e admins (interno; invisivel ao cliente)


# --------------------------------------------------------------------------- #
# Blocos de configuracao
# --------------------------------------------------------------------------- #
class ToggledBlock(BaseModel):
    """Base de qualquer bloco que pode ser ligado/desligado."""
    criar: bool = True


class Brand(ToggledBlock):
    nome: str
    subdominio: str
    tipo: str = "full"  # "simple" pula Guide/Views/Prog/Users/SLA


class Group(BaseModel):
    """Ordem importa: o 1o grupo e o destino padrao de roteamento."""
    nome: str


class FieldOption(BaseModel):
    label: str            # texto exibido
    ref: Optional[str] = None  # sufixo de tag; se vazio, derivado do label


class CustomField(BaseModel):
    nome: str
    tipo: FieldType
    chave_ref: str                       # apelido estavel usado nas condicionais
    opcoes: list[FieldOption] = []
    visivel_portal: bool = True
    nome_portal: Optional[str] = None

    @field_validator("opcoes", mode="before")
    @classmethod
    def _split(cls, v):
        if isinstance(v, str):
            return [FieldOption(label=x.strip()) for x in v.split(",") if x.strip()]
        return v


class FieldCondition(BaseModel):
    """Campo condicional no formulario (Ticket Field Conditions)."""
    criar: bool = True
    campo_pai_ref: str
    quando_valor: str
    mostrar_refs: list[str] = []
    obrigatorios_refs: list[str] = []
    publico: str = "ambos"  # agente | usuario | ambos


class View(BaseModel):
    criar: bool = True
    categoria: str          # agrupamento visual (ex: "Tickets por status")
    nome: str
    criterio: str           # descricao; mapeada p/ conditions no provisionador


class DefaultTrigger(BaseModel):
    """Gatilho padrao de roteamento -> sempre aponta p/ 1o grupo."""
    criar: bool = True
    nome: str
    canal: Channel
    grupo_destino: str = "__PRIMEIRO_GRUPO__"
    categoria: str = "Roteamento"
    copilot: bool = False   # se True, adiciona tag agent_copilot_enabled


class Macro(BaseModel):
    criar: bool = True
    nome: str
    mensagem: str                            # idioma unico da demo
    status_ticket: Optional[str] = None      # aberto/pendente/espera/resolvido
    prioridade: Optional[str] = None
    publico: bool = True
    grupo_visualizador: Optional[str] = None
    grupo_destino: Optional[str] = None
    # macros podem ser inseridas em procedures do Copilot (Knowledge admin)


class SLA(ToggledBlock):
    criar: bool = False
    first_reply: dict[str, int] = {}   # {"urgent":15,"high":30,...} em minutos
    resolution: dict[str, int] = {}


class GuideSection(BaseModel):
    criar: bool = True
    titulo: str


class GuideArticle(BaseModel):
    criar: bool = True
    secao_titulo: str
    titulo: str
    corpo: str                 # conteudo real; pode ser gerado por IA
    acesso: Access = Access.aberto


class Schedule(ToggledBlock):
    criar: bool = False
    nome: str = "Comercial"
    dia_inicio: str = "seg"
    dia_fim: str = "sex"
    hora_inicio: int = 8
    hora_fim: int = 18
    feriados_modo: Optional[str] = None    # normal | prolongado


class Lembrete(BaseModel):
    """Passo manual pendente pos-provisionamento (exibido no webapp)."""
    titulo: str
    detalhe: str = ""


class CopilotSuggestion(BaseModel):
    """Sugestao de procedure do Copilot (assistente do AGENTE humano).
    Conteudo apenas informativo (Copilot e configurado na UI, sem API).
    As tags citadas nos passos devem estar ancoradas nas tags de opcao
    dos campos desta demo (ver Blueprint.option_tag)."""
    titulo: str                 # "Procedimento para ... - Gerado pela IA da Zendesk"
    quando_utilizar: str = ""   # contexto + falas tipicas de acionamento
    corpo: str = ""             # passos formatados (texto puro, com quebras reais)


class AIAgentSuggestion(BaseModel):
    """Sugestao de fluxo do AI Agents (bot voltado ao CLIENTE).
    Conteudo apenas informativo (fluxo e configurado na UI, sem API).
    Integracoes sao SIMULADAS com dados chumbados no proprio prompt;
    tags de ticket ancoradas nas tags de opcao dos campos desta demo."""
    nome: str                   # nome do caso de uso
    descricao: str = ""         # descricao do caso de uso
    prompt: str = ""            # prompt em passos para o fluxo


class Holiday(BaseModel):
    nome: str
    ano: int
    mes: int
    dia_inicio: int
    dia_fim: int


# --------------------------------------------------------------------------- #
# Blueprint completo
# --------------------------------------------------------------------------- #
class Access0(BaseModel):
    subdominio: str
    admin_email: str
    auth_tipo: str = "token"       # token | senha
    segredo: Optional[str] = None  # nunca persistir em texto puro
    config: str = "full"


class Blueprint(BaseModel):
    # metadados / controle global
    cliente: str
    tag_prefix: str                       # namespacing global de tags desta demo
    identificador: str = ""               # ex: "056 " + emoji do segmento
    idioma: Locale = Locale.pt            # UMA demo = UM idioma
    guia_apresentacao: Optional[GuideArticle] = None  # artigo INTERNO (Agentes e admins); conteudo TBD
    tema_zip: Optional[str] = None        # caminho do .zip de tema do Help Center (import via Theming API)

    acesso: Access0
    marca: Optional[Brand] = None
    grupos: list[Group] = []
    campos_ticket: list[CustomField] = []
    condicionais: list[FieldCondition] = []
    views: list[View] = []
    gatilhos_padrao: list[DefaultTrigger] = []
    campos_usuario: list[CustomField] = []
    campos_org: list[CustomField] = []
    macros: list[Macro] = []
    sla: Optional[SLA] = None
    guide_secoes: list[GuideSection] = []
    guide_artigos: list[GuideArticle] = []
    programacao: Optional[Schedule] = None
    feriados: list[Holiday] = []
    lembretes: list[Lembrete] = []      # passos manuais pendentes (webapp)
    copilots: list[CopilotSuggestion] = []    # 3 sugestoes de procedure Copilot (webapp)
    ai_agents: list[AIAgentSuggestion] = []   # 3 sugestoes de fluxo AI Agents (webapp)

    # ---- helpers de resolucao (nome -> valor), usados pelo provisionador ---- #
    @property
    def grupo_padrao(self) -> Optional[str]:
        return self.grupos[0].nome if self.grupos else None

    def display(self, base: str) -> str:
        """Prefixa o identificador da demo (numero + emoji) no nome.
        Aplicar em: grupos, formulario, TITULO DE AGENTE dos campos,
        macros e gatilhos. NAO aplicar no nome de portal (visao cliente)."""
        return f"{self.identificador} {base}".strip() if self.identificador else base

    def option_tag(self, field_ref: str, option: FieldOption) -> str:
        """Tag namespaced e slugificada: <prefix>_<field>_<option>."""
        raw = option.ref or option.label
        return _slug(f"{self.tag_prefix}_{field_ref}_{raw}")


def _slug(text: str) -> str:
    """Substitui as ~200 linhas de .replace() do script antigo."""
    import re
    import unicodedata
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return re.sub(r"_+", "_", text).strip("_")


if __name__ == "__main__":
    # exemplo minimo de validacao
    bp = Blueprint(
        cliente="Grupo Mater",
        tag_prefix="gmater",
        identificador="056" + "\U0001F6D2",  # numero + emoji do segmento (SEM espaco)
        idioma=Locale.pt,
        acesso=Access0(subdominio="grupomater", admin_email="admin@aktienow.com"),
        grupos=[Group(nome="N1 - Atendimento"), Group(nome="N2 - Backoffice")],
        campos_ticket=[
            CustomField(nome="Motivo do contato", tipo=FieldType.dropdown,
                        chave_ref="motivo_contato",
                        opcoes="Troca ou devolucao,Duvida sobre pedido"),
        ],
    )
    opt = bp.campos_ticket[0].opcoes[0]
    print("idioma       :", bp.idioma.value)
    print("grupo padrao :", bp.grupo_padrao)
    print("tag exemplo  :", bp.option_tag("motivo_contato", opt))
    print("nome agente  :", bp.display("Motivo do contato"))
    print("nome portal  :", bp.campos_ticket[0].nome_portal or "(limpo, sem id)")
