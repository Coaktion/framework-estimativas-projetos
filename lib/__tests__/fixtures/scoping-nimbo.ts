/**
 * Caso de teste "Nimbo Varejo" (fictício), Apêndice B do documento de
 * requisitos. Respostas transcritas da planilha "Scoping Call - Nimbo Varejo
 * (fictício).xlsx" para as perguntas numéricas do banco v1. A aba Complexity
 * Scoring e qualquer número de horas da planilha ficam de fora de propósito.
 */

import type { SessionAnswer, TableRow } from '../../scoping/types';

const ans = (questionKey: string, v: unknown): SessionAnswer => ({
  questionKey, value: { v: v as any }, status: 'respondida', pendingOwner: null, pendingDue: null, naReason: null,
  source: 'import', sourceRef: null, version: 1,
});

export const NIMBO_TRACKS = ['product.ai_agents', 'product.voice_zcc', 'product.copilot', 'segment.retail'];
export const NIMBO_CONTEXT = { plan: 'professional', sku: 'CS', deploymentType: 'new' };

const usecases = (n: number, complexity: string): TableRow[] =>
  Array.from({ length: n }, (_, i) => ({ name: `${complexity} ${i + 1}`, reason: '', complexity, systems: '', volume: null }));

/** O que a planilha da Nimbo já trazia (sem as perguntas novas do Apêndice B). */
export const NIMBO_BASE: SessionAnswer[] = [
  ans('core.users.agents', 140),
  ans('core.users.light_agents', 20),
  ans('core.users.groups', 12),
  ans('core.users.custom_roles', 2),
  ans('core.forms', 4),
  ans('core.fields.ticket', 40),
  ans('core.fields.conditional', 15),
  ans('core.rules.triggers_simple', 30),
  ans('core.rules.triggers_complex', 10),
  ans('core.rules.automations_simple', 8),
  ans('core.csat', 'sim'),
  ans('core.macros', 80),
  ans('core.skills', 3),
  ans('core.routing.omnichannel', 'sim'),
  ans('core.sla.policies', 6),
  ans('core.schedules', 1),
  ans('core.channels.list', ['whatsapp', 'web_widget', 'email_domain', 'voice']),
  ans('core.channels.whatsapp_numbers', 2),
  ans('core.channels.email_addresses', 3),
  ans('core.knowledge.help_center', 'sim'),
  ans('core.knowledge.articles', 120),
  ans('core.sso', 'sim'),
  ans('core.analytics.dashboards', 4),
  ans('core.training.groups', [{ training: 'support_agent', groups: 3 }, { training: 'support_admin', groups: 1 }]),
  ans('ai.usecases', [...usecases(8, 'simples'), ...usecases(5, 'intermediario'), ...usecases(3, 'complexo')]),
  ans('ai.bots', 1),
  ans('ai.api_endpoints', Array.from({ length: 6 }, (_, i) => ({ system: `S${i + 1}`, endpoint: `/e${i + 1}`, mode: 'read', auth: '' }))),
  ans('voice.lines', 3),
  ans('voice.volume', 14000),
  ans('copilot.enabled', 'sim'),
  ans('retail.platform', 'vtex'),
];

/** As perguntas novas preenchidas como no Apêndice B. */
export const NIMBO_NEW: SessionAnswer[] = [
  ans('core.views', 25),
  ans('voice.ivr', 8),
  ans('copilot.procedures', 6),
  ans('ai.actions', 10),
  ans('ai.entities', 8),
  ans('core.training.groups', [
    { training: 'support_agent', groups: 3 }, { training: 'support_admin', groups: 1 },
    { training: 'voice_agent', groups: 2 }, { training: 'ai_full_admin', groups: 1 },
    { training: 'copilot_agent', groups: 2 }, { training: 'analytics_basic_admin', groups: 1 },
  ]),
];

/** Base + novas (as novas substituem a mesma key da base). */
export function nimboFull(): SessionAnswer[] {
  const map = new Map(NIMBO_BASE.map((a) => [a.questionKey, a]));
  NIMBO_NEW.forEach((a) => map.set(a.questionKey, a));
  return Array.from(map.values());
}
