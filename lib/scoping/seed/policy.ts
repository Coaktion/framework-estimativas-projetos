/**
 * Política do banco de perguntas: o que é obrigatório, o que é situacional e o
 * que é aprofundamento. Fica num lugar só, separado dos textos, porque é a
 * decisão de produto que mais vai mudar com o uso.
 *
 * Princípio (conversa com a Elisa, 19/11/2026): ninguém faz todas as perguntas.
 * O pré-vendas pergunta o que faz sentido para o cliente. Por isso:
 *  - OBRIGATÓRIAS são poucas: sem elas não dá para montar uma proposta. Só
 *    elas travam a conclusão da sessão.
 *  - SITUACIONAIS só aparecem quando outra resposta as torna relevantes
 *    (showIf). Ex.: metas de SLA só se já existe SLA.
 *  - APROFUNDAMENTO (opcional) fica no Modo completo e sai do Modo reunião.
 *  - O resto é "recomendada": aparece, mas não trava nada.
 */

import type { ShowIf, SuggestRule } from '../types';

/** As únicas perguntas que travam a conclusão (quando visíveis). */
export const REQUIRED_KEYS = new Set<string>([
  // núcleo
  'core.ctx.problem',
  'core.ctx.decision_stage',
  'core.ctx.platforms',
  'core.ctx.decision_criteria',
  'core.ctx.approval',
  'core.channels.list',
  'core.channels.volume',
  'core.users.agents',
  'core.integrations.systems',
  'core.launch.golive_date',
  // trilhas (só contam com a trilha ativa)
  'ai.usecases',
  'ai.handoff',
  'voice.volume',
  'voice.lines',
  'copilot.enabled',
  'itsm.catalog_items',
  'itsm.asset_source',
  'mig.source',
  'mig.objects',
  'retail.platform',
]);

/** Aprofundamento: úteis depois da reunião, fora do Modo reunião. */
export const OPTIONAL_KEYS = new Set<string>([
  'core.business_goals.outcome_response_time',
  'core.business_goals.outcome_cost',
  'core.business_goals.outcome_csat',
  'core.business_goals.outcome_reporting',
  'core.business_goals.outcome_self_service',
  'core.current_process.first_touch',
  'core.current_process.resolution_closure',
  'core.channels.channel_routing',
  'core.teams.shared_or_separate_queues',
  'core.routing.vip_team',
  'core.escalation.technical',
  'core.escalation.manager',
  'core.escalation.engineering',
  'core.integrations.salesforce',
  'core.integrations.jira',
  'core.users.brand_restrictions',
  'core.launch.uat',
]);

/** Perguntas do template que repetem outra do banco: saem a partir da v3. */
export const DROPPED_KEYS = new Set<string>([
  'core.ai_agent.handoff', // = ai.handoff
  'core.ai_agent.systems', // = ai.api_endpoints e core.integrations.systems
  'core.migration.source_platform', // = mig.source
  'core.migration.field_mapping', // = mig.field_mapping
  'core.hidden.agent_lookups', // = core.current_process.agent_lookups
]);

const EVALUATING = ['evaluating', 'shortlist'];

/** Situacionais: a pergunta só aparece se a condição bater. */
export const SHOW_IF: Record<string, ShowIf> = {
  // decisão
  'core.ctx.platforms': { questionKey: 'core.ctx.decision_stage', in: EVALUATING },
  'core.ctx.decision_criteria': { questionKey: 'core.ctx.decision_stage', in: EVALUATING },
  'core.ctx.approval_mode': { questionKey: 'core.ctx.approval', answered: true },
  'core.ctx.approval_date': { questionKey: 'core.ctx.approval', answered: true },
  'core.ctx.trigger_date': { questionKey: 'core.ctx.trigger', answered: true },
  // canais
  'core.channels.whatsapp_account': { questionKey: 'core.channels.list', includes: 'whatsapp' },
  'core.channels.phone_numbers': { questionKey: 'core.channels.list', includes: 'voice' },
  'core.channels.social_pages': { questionKey: 'core.channels.list', in: ['messenger', 'instagram'] },
  'core.email.templates': { questionKey: 'core.channels.list', in: ['email_domain', 'email_zendesk'] },
  // SLA
  'core.slas.hours_basis': { questionKey: 'core.slas.existing', equals: 'sim' },
  'core.slas.by_tier_or_channel': { questionKey: 'core.slas.existing', equals: 'sim' },
  'core.slas.breach_handling': { questionKey: 'core.slas.existing', equals: 'sim' },
  'core.sla.policies': { questionKey: 'core.slas.existing', equals: 'sim' },
  // respostas prontas
  'core.macros.visibility': { questionKey: 'core.macros.canned_today', equals: 'sim' },
  'core.macros.update_fields': { questionKey: 'core.macros.canned_today', equals: 'sim' },
  // central de ajuda
  'core.knowledge.content_owner': { questionKey: 'core.knowledge.help_center', equals: 'sim' },
  'core.knowledge.languages': { questionKey: 'core.knowledge.help_center', equals: 'sim' },
  'core.knowledge.approval_process': { questionKey: 'core.knowledge.help_center', equals: 'sim' },
  'core.knowledge.access': { questionKey: 'core.knowledge.help_center', equals: 'sim' },
  'core.knowledge.articles': { questionKey: 'core.knowledge.help_center', equals: 'sim' },
  'core.knowledge.external_sources': { questionKey: 'core.knowledge.ai_uses_articles', equals: 'sim' },
  // integrações
  'core.integrations.read_write': { questionKey: 'core.integrations.systems', answered: true },
  'core.integrations.middleware': { questionKey: 'core.integrations.systems', answered: true },
  // Copilot
  'copilot.procedures': { questionKey: 'copilot.enabled', equals: 'sim' },
  'copilot.entities': { questionKey: 'copilot.enabled', equals: 'sim' },
  'copilot.topics': { questionKey: 'copilot.enabled', equals: 'sim' },
  'copilot.auto_assist_actions': { questionKey: 'copilot.enabled', equals: 'sim' },
  // ITSM
  'itsm.change_cab': { questionKey: 'itsm.ticket_types', includes: 'change' },
  'itsm.asset_sync': { questionKey: 'itsm.asset_source', in: ['intune', 'jamf'] },
  // migração
  'mig.tickets_volume': { questionKey: 'mig.objects', includes: 'tickets' },
  'mig.years': { questionKey: 'mig.objects', includes: 'tickets' },
  'mig.searchable': { questionKey: 'mig.objects', includes: 'tickets' },
  'core.migration.reopen_or_archive': { questionKey: 'mig.objects', includes: 'tickets' },
  'mig.field_mapping': { questionKey: 'mig.objects', includes: 'fields' },
  'mig.attachments_size': { questionKey: 'mig.objects', includes: 'attachments' },
};

/** Trilhas sugeridas pela própria conversa, além das regras de contexto (SKU etc.). */
export const TRACK_ANSWER_RULES: Record<string, SuggestRule[]> = {
  'product.voice_zcc': [{ answer: { questionKey: 'core.channels.list', includes: 'voice' } }],
  'product.ai_agents': [
    { answer: { questionKey: 'core.future.wants_bot', equals: 'sim' } },
    { answer: { questionKey: 'core.knowledge.ai_uses_articles', equals: 'sim' } },
    { answer: { questionKey: 'core.business_goals.outcome_self_service', equals: 'sim' } },
  ],
  'usecase.migration': [
    { answer: { questionKey: 'core.future.data_migration', equals: 'sim' } },
    { answer: { questionKey: 'core.business_goals.why_leaving', answered: true } },
  ],
  'product.copilot': [{ answer: { questionKey: 'core.future.agent_ai', equals: 'sim' } }],
  'segment.retail': [{ answer: { questionKey: 'core.integrations.ecommerce', equals: 'sim' } }],
};
