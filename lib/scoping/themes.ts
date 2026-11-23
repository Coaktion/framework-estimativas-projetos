/**
 * O caminho da reunião: cinco etapas de conversa, mais "Depois da reunião"
 * (dimensionamento, sem o cliente), e o porte da oportunidade, que decide a
 * profundidade. Segue o "Roteiro de Scoping" combinado com o Renato em
 * 23/11/2026.
 *
 * Etapa e porte saem do código (pela key da pergunta), não do banco de dados:
 * valem para qualquer versão do banco e mudam sem migração.
 *  - Perguntas do roteiro têm etapa e porte explícitos (ROTEIRO).
 *  - Contagens de configuração (número com item do catálogo, tabelas de
 *    itens) vão para "Depois da reunião": quem estima é o pré-vendas.
 *  - O resto segue a etapa da seção; no núcleo entra só no porte Grande; nas
 *    trilhas, obrigatória = Pequena, recomendada = Média, aprofundamento = Grande.
 */

import type { Bank, BankQuestion, I18nText } from './types';

export const TIERS = ['P', 'M', 'G'] as const;
export type Tier = (typeof TIERS)[number];
const TIER_RANK: Record<Tier, number> = { P: 0, M: 1, G: 2 };

export function normalizeTier(v: unknown): Tier {
  return (TIERS as readonly string[]).includes(String(v)) ? (v as Tier) : 'M';
}

export interface Stage {
  key: string;
  title: I18nText;
  goal: I18nText;
  /** etapa feita sem o cliente: fora do Modo reunião */
  afterMeeting?: boolean;
}

const t = (pt: string, en: string, es: string): I18nText => ({ pt, en, es });

export const STAGES: Stage[] = [
  { key: 'opening', title: t('Abertura e decisão', 'Opening and decision', 'Apertura y decisión'), goal: t('Entender por que agora e como vão decidir.', 'Understand why now and how they will decide.', 'Entender por qué ahora y cómo van a decidir.') },
  { key: 'operation', title: t('Operação hoje', 'Operation today', 'Operación hoy'), goal: t('Dimensionar a operação: quem atende, por onde e quanto.', 'Size the operation: who handles, through which channels and how much.', 'Dimensionar la operación: quién atiende, por dónde y cuánto.') },
  { key: 'future', title: t('Onde querem chegar', 'Where they want to go', 'A dónde quieren llegar'), goal: t('Integrações, automação e autoatendimento: onde mora a maior parte do esforço.', 'Integrations, automation and self-service: where most of the effort lies.', 'Integraciones, automatización y autoservicio: donde está la mayor parte del esfuerzo.') },
  { key: 'rules', title: t('Regras do atendimento', 'Service rules', 'Reglas de la atención'), goal: t('Só o que muda o desenho: prazos, direcionamento e escalonamento.', 'Only what changes the design: targets, routing and escalation.', 'Solo lo que cambia el diseño: plazos, enrutamiento y escalamiento.') },
  { key: 'timeline', title: t('Prazo e próximos passos', 'Timeline and next steps', 'Plazo y próximos pasos'), goal: t('Fechar com data, dono e o que ficou pendente.', 'Close with a date, an owner and the open items.', 'Cerrar con fecha, responsable y lo que quedó pendiente.') },
  { key: 'after', title: t('Depois da reunião', 'After the meeting', 'Después de la reunión'), goal: t('Sem o cliente: estimar as contagens de configuração a partir do que foi conversado.', 'Without the customer: estimate configuration counts from the conversation.', 'Sin el cliente: estimar los conteos de configuración a partir de la conversación.'), afterMeeting: true },
];

/** Perguntas do roteiro: etapa e porte mínimo. A ordem aqui é a ordem dentro da etapa. */
const ROTEIRO: [string, string, Tier][] = [
  // 1 · Abertura e decisão
  ['core.ctx.problem', 'opening', 'P'],
  ['core.ctx.decision_stage', 'opening', 'P'],
  ['core.ctx.platforms', 'opening', 'P'],
  ['core.ctx.decision_criteria', 'opening', 'P'],
  ['core.ctx.approval', 'opening', 'P'],
  ['core.ctx.approval_date', 'opening', 'M'],
  ['core.ctx.trigger', 'opening', 'M'],
  ['core.ctx.trigger_date', 'opening', 'M'],
  ['core.ctx.kpis_current', 'opening', 'G'],
  ['core.ctx.current_spend', 'opening', 'G'],
  // 2 · Operação hoje
  ['core.users.agents', 'operation', 'P'],
  ['core.channels.list', 'operation', 'P'],
  ['core.channels.whatsapp_numbers', 'operation', 'P'],
  ['core.channels.whatsapp_account', 'operation', 'P'],
  ['core.channels.email_addresses', 'operation', 'M'],
  ['core.channels.volume', 'operation', 'P'],
  ['core.ticket_types.top_categories', 'operation', 'M'],
  ['core.current_process.ticket_lifecycle', 'operation', 'M'],
  ['core.teams.which_teams', 'operation', 'G'],
  ['core.teams.hours', 'operation', 'G'],
  ['core.teams.regions_languages', 'operation', 'G'],
  // 3 · Onde querem chegar
  ['core.integrations.systems', 'future', 'P'],
  ['core.integrations.read_write', 'future', 'M'],
  ['core.automations.repetitive_work', 'future', 'P'],
  ['core.future.wants_bot', 'future', 'P'],
  ['core.knowledge.help_center', 'future', 'M'],
  ['core.knowledge.languages', 'future', 'G'],
  ['core.knowledge.access', 'future', 'G'],
  ['core.knowledge.content_owner', 'future', 'G'],
  ['core.future.data_migration', 'future', 'M'],
  ['core.future.agent_ai', 'future', 'G'],
  // 4 · Regras do atendimento
  ['core.slas.existing', 'rules', 'M'],
  ['core.slas.targets', 'rules', 'M'],
  ['core.routing.criteria', 'rules', 'M'],
  ['core.escalation.triggers', 'rules', 'G'],
  ['core.macros.canned_today', 'rules', 'G'],
  // 5 · Prazo e próximos passos
  ['core.launch.golive_date', 'timeline', 'P'],
  ['core.launch.rollout', 'timeline', 'M'],
  ['core.launch.project_owner', 'timeline', 'M'],
];

const ROTEIRO_MAP = new Map(ROTEIRO.map(([key, stage, tier], i) => [key, { stage, tier, rank: i }]));

const SECTION_STAGE: Record<string, string> = {
  ctx: 'opening', business_goals: 'opening',
  current_process: 'operation', teams: 'operation', users: 'operation', channels: 'operation', voice: 'operation',
  ticket_types: 'operation', retail: 'operation', itsm: 'operation', hidden: 'operation',
  integrations: 'future', knowledge: 'future', ai_agent: 'future', copilot: 'future', migration: 'future',
  forms: 'rules', fields: 'rules', routing: 'rules', slas: 'rules', escalation: 'rules', automations: 'rules',
  macros: 'rules', reporting: 'rules', security: 'rules',
  launch: 'timeline',
};

/** Contagem de configuração: o cliente raramente sabe; o pré-vendas estima depois da reunião. */
export function isDimensioning(q: BankQuestion): boolean {
  if (ROTEIRO_MAP.has(q.key) || q.priority === 'essencial') return false;
  if (q.type === 'number') return q.catalogMappings.length > 0 || q.noCatalogItem;
  if (q.type === 'table') return q.catalogMappings.some((m) => m.rule === 'table_item_qty' || m.rule === 'table_count');
  return false;
}

export function stageOf(q: BankQuestion): string {
  const r = ROTEIRO_MAP.get(q.key);
  if (r) return r.stage;
  if (isDimensioning(q)) return 'after';
  return SECTION_STAGE[q.sectionKey] || 'operation';
}

export function tierOf(q: BankQuestion): Tier {
  const r = ROTEIRO_MAP.get(q.key);
  if (r) return r.tier;
  if (q.priority === 'essencial') return 'P';
  if (isDimensioning(q)) return 'P'; // depois da reunião: o porte não esconde contagens
  const inTrack = !q.trackKeys.includes('core');
  if (inTrack) return q.priority === 'recomendada' ? 'M' : 'G';
  return 'G';
}

/** A pergunta entra no porte escolhido? Aprofundamento (opcional) só com "aprofundar". */
export function inTier(q: BankQuestion, tier: Tier, deep = false): boolean {
  if (deep) return true;
  if (q.priority === 'opcional' && !ROTEIRO_MAP.has(q.key)) return false;
  return TIER_RANK[tierOf(q)] <= TIER_RANK[tier];
}

export interface StageGroup {
  stage: Stage;
  questions: BankQuestion[];
}

/** Agrupa perguntas por etapa: roteiro primeiro (na ordem dele), depois o resto na ordem do banco. */
export function groupByStage(bank: Bank, questions: BankQuestion[]): StageGroup[] {
  const sectionOrder = new Map(bank.sections.map((s) => [s.key, s.order]));
  const by = new Map<string, BankQuestion[]>();
  questions.forEach((q) => {
    const k = stageOf(q);
    by.set(k, [...(by.get(k) || []), q]);
  });
  const sortKey = (q: BankQuestion): [number, number, number] => {
    const r = ROTEIRO_MAP.get(q.key);
    return r ? [0, r.rank, 0] : [1, sectionOrder.get(q.sectionKey) ?? 999, q.order];
  };
  return STAGES.filter((s) => by.has(s.key)).map((stage) => ({
    stage,
    questions: by.get(stage.key)!.sort((a, b) => {
      const ka = sortKey(a); const kb = sortKey(b);
      return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
    }),
  }));
}

/** Sugestão de porte pelo que já se sabe (número de agentes, trilhas ativas). */
export function suggestTier(agents: number | undefined, trackKeys: string[]): Tier {
  const heavy = trackKeys.some((k) => k === 'usecase.migration' || k === 'usecase.itsm_cmdb') || trackKeys.length >= 3;
  if ((agents ?? 0) > 150 || heavy) return 'G';
  if ((agents ?? 0) > 30 || trackKeys.length >= 1) return 'M';
  return 'P';
}

/** Seções sem etapa definida (o teste acusa): caem em "Operação hoje". */
export function unmappedSections(bank: Bank): string[] {
  return bank.sections.map((s) => s.key).filter((k) => !SECTION_STAGE[k]);
}
