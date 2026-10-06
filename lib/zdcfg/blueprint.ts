/**
 * ZD Auto Config — modelo canônico ("Blueprint") de uma demo Zendesk.
 *
 * Porte fiel de blueprint.py. A planilha é convertida para este modelo e o
 * provisionador consome SOMENTE ele. Código compartilhado entre navegador e
 * servidor: não importe nada de Node aqui.
 */

export type Locale = 'pt-br' | 'en-us' | 'es';
export type FieldType =
  | 'text' | 'textarea' | 'dropdown' | 'checkbox' | 'date' | 'integer' | 'decimal' | 'multiselect';
export type Channel = 'web' | 'messaging' | 'whatsapp' | 'email' | 'voice' | 'social';
export type Access = 'aberto' | 'logado' | 'agente';

export const FIELD_TYPES: FieldType[] = [
  'text', 'textarea', 'dropdown', 'checkbox', 'date', 'integer', 'decimal', 'multiselect',
];
export const CHANNELS: Channel[] = ['web', 'messaging', 'whatsapp', 'email', 'voice', 'social'];
export const ACCESSES: Access[] = ['aberto', 'logado', 'agente'];

export type Brand = { criar: boolean; nome: string; subdominio: string; tipo: string };
export type Group = { nome: string };
export type FieldOption = { label: string; ref?: string | null };
export type CustomField = {
  nome: string;
  tipo: FieldType;
  chave_ref: string;
  opcoes: FieldOption[];
  visivel_portal: boolean;
  nome_portal?: string | null;
};
export type FieldCondition = {
  criar: boolean;
  campo_pai_ref: string;
  quando_valor: string;
  mostrar_refs: string[];
  obrigatorios_refs: string[];
  publico: string; // agente | usuario | ambos
};
export type View = { criar: boolean; categoria: string; nome: string; criterio: string };
export type DefaultTrigger = {
  criar: boolean; nome: string; canal: Channel; grupo_destino: string; categoria: string; copilot: boolean;
};
export type Macro = {
  criar: boolean;
  nome: string;
  mensagem: string;
  status_ticket?: string | null;
  prioridade?: string | null;
  publico: boolean;
  grupo_visualizador?: string | null;
  grupo_destino?: string | null;
};
export type SLA = { criar: boolean; first_reply: Record<string, number>; resolution: Record<string, number> };
export type GuideSection = { criar: boolean; titulo: string };
export type GuideArticle = { criar: boolean; secao_titulo: string; titulo: string; corpo: string; acesso: Access };
export type Schedule = {
  criar: boolean; nome: string; dia_inicio: string; dia_fim: string;
  hora_inicio: number; hora_fim: number; feriados_modo?: string | null;
};
export type Lembrete = { titulo: string; detalhe: string };
export type CopilotSuggestion = { titulo: string; quando_utilizar: string; corpo: string };
export type AIAgentSuggestion = { nome: string; descricao: string; prompt: string };
export type Holiday = { nome: string; ano: number; mes: number; dia_inicio: number; dia_fim: number };

export type Blueprint = {
  cliente: string;
  tag_prefix: string;
  identificador: string;
  idioma: Locale;
  guia_apresentacao: GuideArticle | null;
  marca: Brand | null;
  grupos: Group[];
  campos_ticket: CustomField[];
  condicionais: FieldCondition[];
  views: View[];
  gatilhos_padrao: DefaultTrigger[];
  campos_usuario: CustomField[];
  campos_org: CustomField[];
  macros: Macro[];
  sla: SLA | null;
  guide_secoes: GuideSection[];
  guide_artigos: GuideArticle[];
  programacao: Schedule | null;
  feriados: Holiday[];
  lembretes: Lembrete[];
  copilots: CopilotSuggestion[];
  ai_agents: AIAgentSuggestion[];
};

/** 1º grupo = destino padrão do roteamento. */
export function grupoPadrao(bp: Blueprint): string | null {
  return bp.grupos.length ? bp.grupos[0].nome : null;
}

/** Prefixa o identificador da demo (número + emoji) no nome — visão do agente. */
export function display(bp: Pick<Blueprint, 'identificador'>, base: string): string {
  return bp.identificador ? `${bp.identificador} ${base}`.trim() : base;
}

/** Tag namespaced e slugificada: <prefix>_<campo>_<opção>. */
export function optionTag(bp: Pick<Blueprint, 'tag_prefix'>, fieldRef: string, option: FieldOption): string {
  const raw = option.ref || option.label;
  return slug(`${bp.tag_prefix}_${fieldRef}_${raw}`);
}

/** Igual ao _slug do Python: NFKD -> ASCII -> minúsculas -> [^a-z0-9]+ vira "_". */
export function slug(text: string): string {
  const ascii = text
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .toLowerCase()
    .trim();
  return ascii.replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
}

/** "a, b ,c" -> opções (mesma regra do validador do pydantic). */
export function splitOpcoes(v: string): FieldOption[] {
  return v.split(',').map((x) => x.trim()).filter(Boolean).map((label) => ({ label }));
}
