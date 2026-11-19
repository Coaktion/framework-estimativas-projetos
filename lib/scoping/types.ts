/**
 * Scoping: tipos e validações compartilhados (banco de perguntas, sessão e respostas).
 *
 * O módulo é isolado do resto do Tool Center: só lê o catálogo e chama o motor
 * de estimativa em modo simulação (lib/scoping/estimate.ts). Nada aqui grava em
 * tabela de outro módulo.
 */

import { z } from 'zod';

export const SCOPING_LANGS = ['pt', 'en', 'es'] as const;
export type ScopingLang = (typeof SCOPING_LANGS)[number];

/** Texto traduzido: { pt, en, es }. Um idioma ausente cai no fallback (lib/scoping/i18n.ts). */
export type I18nText = Partial<Record<ScopingLang, string>>;

export const TRACK_TYPES = ['core', 'product', 'usecase', 'segment'] as const;
export type TrackType = (typeof TRACK_TYPES)[number];

export const QUESTION_TYPES = [
  'short_text', 'long_text', 'number', 'single', 'multi', 'yes_no', 'date', 'table', 'ai_usecases',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const PRIORITIES = ['essencial', 'recomendada', 'opcional'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const COMPLEXITIES = ['baixa', 'media', 'alta'] as const;
export type Complexity = (typeof COMPLEXITIES)[number];

export const ANSWER_STATUSES = ['nao_perguntada', 'respondida', 'pendente', 'nao_se_aplica'] as const;
export type AnswerStatus = (typeof ANSWER_STATUSES)[number];

export const ANSWER_SOURCES = ['manual', 'notes', 'tldv', 'claude_meetings', 'import'] as const;
export type AnswerSource = (typeof ANSWER_SOURCES)[number];

export const SESSION_STATUSES = ['em_andamento', 'concluida'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const YES_NO_VALUES = ['sim', 'nao', 'nao_sei'] as const;
export type YesNo = (typeof YES_NO_VALUES)[number];

export const AI_COMPLEXITIES = ['simples', 'intermediario', 'complexo'] as const;
export type AiComplexity = (typeof AI_COMPLEXITIES)[number];

export const PLANS = ['team', 'growth', 'professional', 'enterprise'] as const;
export const SKUS = ['CS', 'ES'] as const;
export const DEPLOYMENT_TYPES = ['new', 'optimization'] as const;

export interface ChoiceOption {
  value: string;
  label: I18nText;
}

export type TableColumnType = 'text' | 'long_text' | 'number' | 'single' | 'yes_no';

export interface TableColumn {
  key: string;
  type: TableColumnType;
  label: I18nText;
  options?: ChoiceOption[];
  maxLength?: number;
}

/** Condição de exibição: a pergunta só aparece se a resposta da outra bater. */
export interface ShowIf {
  questionKey: string;
  /** yes_no / single: valor exato (ex.: 'sim') */
  equals?: string;
  /** multi: a opção precisa estar marcada */
  includes?: string;
  /** number: maior que */
  gt?: number;
  /** single: valor entre estes; multi: alguma destas opções marcada */
  in?: string[];
  /** basta a pergunta ter qualquer resposta */
  answered?: boolean;
}

/** Item do catálogo (id + nome guardado para exibir mesmo se o catálogo mudar). */
export interface CatalogRef {
  itemId: number;
  itemName: string;
}

interface MappingBase {
  /** Como juntar com outras perguntas que alimentam o mesmo item. Padrão: soma. */
  combine?: 'sum' | 'max';
  /** Só conta com esta trilha ativa na sessão. */
  requiresTrack?: string;
}

export type CatalogMapping =
  | (MappingBase & CatalogRef & { rule: 'quantity'; factor?: number })
  | (MappingBase & CatalogRef & { rule: 'fixed_if_yes'; quantity: number })
  | (MappingBase & CatalogRef & { rule: 'fixed_if_positive'; quantity: number })
  | (MappingBase & CatalogRef & { rule: 'per_option'; option: string; quantity?: number; quantityFrom?: string })
  | (MappingBase & CatalogRef & { rule: 'table_count'; factor?: number })
  | (MappingBase & {
      rule: 'table_item_qty';
      /** coluna (single) cuja opção escolhe o item */
      itemColumn: string;
      /** coluna numérica com a quantidade (vazia = 1) */
      qtyColumn: string;
      items: Record<string, CatalogRef>;
    })
  | (MappingBase & { rule: 'ai_usecase_complexity'; items: Record<AiComplexity, CatalogRef> });

export type MappingRule = CatalogMapping['rule'];

/** Item que a trilha soma sozinha quando está ativa (configurações gerais, workshops). */
export interface FixedItem extends CatalogRef {
  quantity: number;
}

/** Regras de sugestão de trilha: qualquer regra que bata sugere a trilha no assistente. */
export interface SuggestRule {
  sku?: string;
  plan?: string;
  deploymentType?: string;
  /** sugere a trilha quando a conversa indicar (resposta de outra pergunta) */
  answer?: ShowIf;
}

// ---------------------------------------------------------------------------
// Valores de resposta
// ---------------------------------------------------------------------------

/** Número exato ou faixa (RF-11). A estimativa usa o máximo da faixa. */
export type NumberValue = number | { min: number; max: number };

export type TableRow = Record<string, string | number | null>;

/**
 * O que fica em ScopingAnswer.value: o valor tipado em `v` e, opcionalmente, um
 * comentário livre (a coluna "Client Answer / Notes" do template).
 */
export interface AnswerValue {
  v?: string | string[] | NumberValue | TableRow[] | null;
  note?: string;
}

const numberValue = z.union([
  z.number().finite(),
  z.object({ min: z.number().finite(), max: z.number().finite() }).refine((r) => r.max >= r.min, 'max < min'),
]);

const tableRows = z.array(z.record(z.union([z.string().max(2000), z.number().finite(), z.null()]))).max(200);

/** Validação do valor conforme o tipo da pergunta. */
export function answerValueSchema(type: QuestionType) {
  let v: z.ZodTypeAny;
  switch (type) {
    case 'short_text': v = z.string().max(500); break;
    case 'long_text': v = z.string().max(10000); break;
    case 'number': v = numberValue; break;
    case 'single': v = z.string().max(200); break;
    case 'multi': v = z.array(z.string().max(200)).max(50); break;
    case 'yes_no': v = z.enum(YES_NO_VALUES); break;
    case 'date': v = z.string().regex(/^\d{4}-\d{2}-\d{2}$/); break;
    case 'table':
    case 'ai_usecases': v = tableRows; break;
    default: v = z.any();
  }
  return z.object({ v: v.nullable().optional(), note: z.string().max(5000).optional() });
}

/** Colunas fixas da lista de casos de uso de AI Agents (RF-10). */
export const AI_USECASE_COLUMNS: TableColumn[] = [
  { key: 'name', type: 'text', maxLength: 60, label: { pt: 'Nome', en: 'Name', es: 'Nombre' } },
  {
    key: 'reason', type: 'long_text', maxLength: 300,
    label: { pt: 'Motivo da solicitação do cliente', en: 'Customer request reason', es: 'Motivo de la solicitud del cliente' },
  },
  {
    key: 'complexity', type: 'single',
    label: { pt: 'Complexidade', en: 'Complexity', es: 'Complejidad' },
    options: [
      { value: 'simples', label: { pt: 'Simples', en: 'Simple', es: 'Simple' } },
      { value: 'intermediario', label: { pt: 'Intermediário', en: 'Intermediate', es: 'Intermedio' } },
      { value: 'complexo', label: { pt: 'Complexo', en: 'Complex', es: 'Complejo' } },
    ],
  },
  { key: 'systems', type: 'text', label: { pt: 'Sistemas consultados', en: 'Systems queried', es: 'Sistemas consultados' } },
  { key: 'volume', type: 'number', label: { pt: 'Volume mensal estimado', en: 'Estimated monthly volume', es: 'Volumen mensual estimado' } },
];

// ---------------------------------------------------------------------------
// Formas carregadas do banco (usadas pela tela, testes e exportação)
// ---------------------------------------------------------------------------

export interface BankTrack {
  key: string;
  type: TrackType;
  order: number;
  name: I18nText;
  description: I18nText;
  suggestRules: SuggestRule[];
  fixedItems: FixedItem[];
}

export interface BankSection {
  key: string;
  order: number;
  title: I18nText;
  deliverable: I18nText;
}

export interface BankQuestion {
  key: string;
  sectionKey: string;
  order: number;
  trackKeys: string[];
  type: QuestionType;
  options: ChoiceOption[];
  unit: I18nText | null;
  min: number | null;
  max: number | null;
  tableColumns: TableColumn[];
  text: I18nText;
  help: I18nText;
  configImpact: I18nText;
  translationStatus: Partial<Record<ScopingLang, 'machine' | 'reviewed'>>;
  priority: Priority;
  defaultComplexity: Complexity | null;
  showIf: ShowIf | null;
  followUps: I18nText[];
  catalogMappings: CatalogMapping[];
  noCatalogItem: boolean;
  dataKey: string | null;
}

export interface Bank {
  id: number;
  version: number;
  tracks: BankTrack[];
  sections: BankSection[];
  questions: BankQuestion[];
}

export interface SessionAnswer {
  questionKey: string;
  value: AnswerValue | null;
  status: AnswerStatus;
  pendingOwner: string | null;
  pendingDue: string | null;
  naReason: string | null;
  source: AnswerSource;
  sourceRef: Record<string, unknown> | null;
  version: number;
  updatedAt?: string;
  updatedByName?: string | null;
}

export interface SessionContext {
  language: ScopingLang;
  deploymentType: string;
  sku: string;
  plan: string;
  trackKeys: string[];
}
