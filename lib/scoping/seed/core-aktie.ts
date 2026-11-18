/**
 * Perguntas da Aktie no núcleo: Bloco 0 consultivo (Apêndice A.1) e as
 * quantidades que faltavam no template (A.2). IDs de item conferidos contra o
 * catálogo de produção em 18/11/2026.
 */

import { U, col, ifPositive, ifYes, opt, perOption, qty, t, tableCount } from './helpers';
import type { SeedQuestion } from './types';

const YES_NO = 'yes_no' as const;

// ---------------------------------------------------------------------------
// A.1 · Bloco 0 · Contexto consultivo (todas essenciais)
// ---------------------------------------------------------------------------

export const CORE_CONTEXT: SeedQuestion[] = [
  {
    key: 'core.ctx.problem', section: 'ctx', type: 'long_text', priority: 'essencial',
    text: t('Qual é o problema central do cliente, em até 3 linhas?', "What is the customer's core problem, in up to 3 lines?", '¿Cuál es el problema central del cliente, en hasta 3 líneas?'),
    help: t('Ancora a proposta e o dossiê: tudo o que vier depois precisa resolver isto.', 'Anchors the proposal and the dossier: everything else must solve this.', 'Ancla la propuesta y el dossier: todo lo demás debe resolver esto.'),
  },
  {
    key: 'core.ctx.kpis_current', section: 'ctx', type: 'table', priority: 'essencial', dataKey: 'ops.kpi.*',
    text: t('Quais indicadores a operação acompanha hoje e quais são os valores atuais?', 'Which KPIs does the operation track today and what are the current values?', '¿Qué indicadores sigue hoy la operación y cuáles son los valores actuales?'),
    help: t('Sem linha de base não há comparativo atual × proposto.', 'Without a baseline there is no current vs. proposed comparison.', 'Sin línea base no hay comparativo actual vs. propuesto.'),
    tableColumns: [
      col('kpi', 'text', 'Indicador', 'KPI', 'Indicador'),
      col('value', 'text', 'Valor atual', 'Current value', 'Valor actual'),
      col('period', 'text', 'Período', 'Period', 'Período'),
      col('source', 'text', 'Fonte', 'Source', 'Fuente'),
    ],
  },
  {
    key: 'core.ctx.current_spend', section: 'ctx', type: 'table', priority: 'essencial',
    text: t('Quanto a empresa gasta hoje com a ferramenta e o processo atuais, e quando vencem os contratos?', 'How much does the company spend today on the current tool and process, and when do the contracts expire?', '¿Cuánto gasta hoy la empresa en la herramienta y el proceso actuales, y cuándo vencen los contratos?'),
    tableColumns: [
      col('item', 'text', 'Item', 'Item', 'Ítem'),
      col('monthly', 'number', 'Valor mensal', 'Monthly amount', 'Valor mensual'),
      col('expires', 'text', 'Vencimento do contrato', 'Contract expiry', 'Vencimiento del contrato'),
    ],
  },
  {
    key: 'core.ctx.trigger', section: 'ctx', type: 'long_text', priority: 'essencial',
    text: t('O que motivou a mudança agora, e existe uma data que força a decisão?', 'What triggered the change now, and is there a date forcing the decision?', '¿Qué motivó el cambio ahora y existe una fecha que obliga a decidir?'),
  },
  {
    key: 'core.ctx.trigger_date', section: 'ctx', type: 'date', priority: 'recomendada',
    text: t('Data que força a decisão (se houver)', 'Date forcing the decision (if any)', 'Fecha que obliga a decidir (si existe)'),
  },
  {
    key: 'core.ctx.comparison_owner', section: 'ctx', type: 'short_text', priority: 'essencial',
    text: t('Quem vai pedir o comparativo atual × proposto, e para quem?', 'Who will ask for the current vs. proposed comparison, and for whom?', '¿Quién pedirá el comparativo actual vs. propuesto, y para quién?'),
  },
  {
    key: 'core.ctx.roi_expectation', section: 'ctx', type: 'multi', priority: 'essencial',
    text: t('O que o cliente espera ver justificado em retorno, e com qual meta numérica?', 'What return does the customer expect to see justified, and with what numeric target?', '¿Qué retorno espera el cliente ver justificado y con qué meta numérica?'),
    help: t('Use o comentário para registrar a meta numérica de cada item.', 'Use the note to record the numeric target for each item.', 'Use el comentario para registrar la meta numérica de cada ítem.'),
    options: [
      opt('custo', 'Custo', 'Cost', 'Costo'),
      opt('receita', 'Receita', 'Revenue', 'Ingresos'),
      opt('csat_nps', 'CSAT/NPS', 'CSAT/NPS', 'CSAT/NPS'),
      opt('produtividade', 'Produtividade', 'Productivity', 'Productividad'),
      opt('compliance', 'Compliance', 'Compliance', 'Cumplimiento'),
      opt('outro', 'Outro', 'Other', 'Otro'),
    ],
  },
  {
    key: 'core.ctx.approval', section: 'ctx', type: 'table', priority: 'essencial',
    text: t('Quem aprova a compra (cargo e área)?', 'Who approves the purchase (role and area)?', '¿Quién aprueba la compra (cargo y área)?'),
    tableColumns: [
      col('role', 'text', 'Cargo', 'Role', 'Cargo'),
      col('area', 'text', 'Área', 'Area', 'Área'),
    ],
  },
  {
    key: 'core.ctx.approval_mode', section: 'ctx', type: 'single', priority: 'essencial',
    text: t('Como a aprovação acontece?', 'How does the approval happen?', '¿Cómo se da la aprobación?'),
    options: [
      opt('one', '1 pessoa', '1 person', '1 persona'),
      opt('two_three', '2 a 3 pessoas', '2 to 3 people', '2 a 3 personas'),
      opt('committee', 'Comitê', 'Committee', 'Comité'),
    ],
  },
  {
    key: 'core.ctx.approval_date', section: 'ctx', type: 'date', priority: 'essencial',
    text: t('Até quando a aprovação precisa sair?', 'By when must the approval happen?', '¿Hasta cuándo debe salir la aprobación?'),
  },
];

// ---------------------------------------------------------------------------
// A.2 · Núcleo · quantidades que faltavam no template
// ---------------------------------------------------------------------------

const n = (
  key: string, section: string, unit: (typeof U)[keyof typeof U],
  text: ReturnType<typeof t>, mappings: SeedQuestion['mappings'], priority: SeedQuestion['priority'] = 'recomendada',
  extra: Partial<SeedQuestion> = {},
): SeedQuestion => ({ key, section, type: 'number', unit, min: 0, priority, text, mappings, ...extra });

const yn = (
  key: string, section: string, text: ReturnType<typeof t>, mappings: SeedQuestion['mappings'],
  priority: SeedQuestion['priority'] = 'recomendada', extra: Partial<SeedQuestion> = {},
): SeedQuestion => ({ key, section, type: YES_NO, priority, text, mappings, ...extra });

const TRAINING_ITEMS: Record<string, { itemId: number; itemName: string; label: ReturnType<typeof t> }> = {
  support_admin: { itemId: 178, itemName: 'Support - Admin', label: t('Support · admin', 'Support · admin', 'Support · admin') },
  support_agent: { itemId: 193, itemName: 'Support - agente', label: t('Support · agente', 'Support · agent', 'Support · agente') },
  knowledge_admin: { itemId: 179, itemName: 'Knowledge - Admin', label: t('Knowledge · admin', 'Knowledge · admin', 'Knowledge · admin') },
  knowledge_agent: { itemId: 194, itemName: 'Knowledge - agente', label: t('Knowledge · agente', 'Knowledge · agent', 'Knowledge · agente') },
  voice_admin: { itemId: 181, itemName: 'Voice - Admin', label: t('Voice · admin', 'Voice · admin', 'Voice · admin') },
  voice_agent: { itemId: 196, itemName: 'Voice - agente', label: t('Voice · agente', 'Voice · agent', 'Voice · agente') },
  analytics_basic_admin: { itemId: 182, itemName: 'Analytics básico - admin', label: t('Analytics básico · admin', 'Analytics basic · admin', 'Analytics básico · admin') },
  analytics_full_admin: { itemId: 183, itemName: 'Analytics completo - admin', label: t('Analytics completo · admin', 'Analytics full · admin', 'Analytics completo · admin') },
  copilot_admin: { itemId: 184, itemName: 'Copilot - admin', label: t('Copilot · admin', 'Copilot · admin', 'Copilot · admin') },
  copilot_agent: { itemId: 197, itemName: 'Copilot - agente', label: t('Copilot · agente', 'Copilot · agent', 'Copilot · agente') },
  ai_basic_admin: { itemId: 187, itemName: 'AI Agents básico - admin', label: t('AI Agents básico · admin', 'AI Agents basic · admin', 'AI Agents básico · admin') },
  ai_full_admin: { itemId: 188, itemName: 'AI Agents completo - admin', label: t('AI Agents completo · admin', 'AI Agents full · admin', 'AI Agents completo · admin') },
  wfm_admin: { itemId: 185, itemName: 'WFM - admin', label: t('WFM · admin', 'WFM · admin', 'WFM · admin') },
  qa_admin: { itemId: 186, itemName: 'QA - admin', label: t('QA · admin', 'QA · admin', 'QA · admin') },
};

export const CORE_QUANTITIES: SeedQuestion[] = [
  // Times e estrutura
  n('core.users.agents', 'teams', U.agents, t('Quantos agentes com licença completa?', 'How many full-license agents?', '¿Cuántos agentes con licencia completa?'),
    [qty(17, 'Agentes')], 'essencial'),
  n('core.users.light_agents', 'teams', U.agents, t('Quantos light agents?', 'How many light agents?', '¿Cuántos light agents?'),
    [qty(17, 'Agentes')]),
  n('core.users.groups', 'teams', U.groups, t('Quantos grupos?', 'How many groups?', '¿Cuántos grupos?'),
    [qty(19, 'Grupos')], 'essencial'),
  n('core.users.custom_roles', 'teams', U.roles, t('Quantos papéis personalizados?', 'How many custom roles?', '¿Cuántos roles personalizados?'),
    [qty(18, 'Funções')], 'recomendada',
    { help: t('No Customer Service, papéis personalizados exigem o plano Enterprise.', 'In Customer Service, custom roles require the Enterprise plan.', 'En Customer Service, los roles personalizados requieren el plan Enterprise.') }),
  n('core.brands', 'teams', U.brands, t('Quantas marcas?', 'How many brands?', '¿Cuántas marcas?'), [qty(16, 'Marcas')]),

  // Formulários e campos
  n('core.forms', 'forms', U.forms, t('Quantos formulários de ticket?', 'How many ticket forms?', '¿Cuántos formularios de ticket?'),
    [qty(27, 'Formulários e Catálogos de Serviço', { combine: 'max' })]),
  n('core.fields.ticket', 'fields', U.fields, t('Quantos campos de ticket?', 'How many ticket fields?', '¿Cuántos campos de ticket?'),
    [qty(117, 'Campos de ticket')], 'essencial'),
  n('core.fields.conditional', 'fields', U.fields, t('Quantos campos condicionais?', 'How many conditional fields?', '¿Cuántos campos condicionales?'),
    [qty(28, 'Campos de ticket condicionais')]),
  n('core.fields.user', 'fields', U.fields, t('Quantos campos de usuário?', 'How many user fields?', '¿Cuántos campos de usuario?'),
    [qty(20, 'Campos do usuário')]),
  n('core.fields.org', 'fields', U.fields, t('Quantos campos de organização?', 'How many organization fields?', '¿Cuántos campos de organización?'),
    [qty(21, 'Campos da organização')]),
  n('core.statuses.custom', 'fields', U.statuses, t('Quantos status de ticket personalizados?', 'How many custom ticket statuses?', '¿Cuántos estados de ticket personalizados?'),
    [qty(118, 'Status de ticket personalizados')]),

  // Regras de negócio
  n('core.rules.triggers_simple', 'automations', U.triggers, t('Quantos gatilhos simples?', 'How many simple triggers?', '¿Cuántos disparadores simples?'),
    [qty(61, 'Gatilhos Simples')], 'essencial'),
  n('core.rules.triggers_complex', 'automations', U.triggers, t('Quantos gatilhos complexos (de mensagem ou de objeto)?', 'How many complex triggers (messaging or object triggers)?', '¿Cuántos disparadores complejos (de mensajería o de objeto)?'),
    [qty(62, 'Gatilhos Complexos')], 'essencial'),
  n('core.rules.automations_simple', 'automations', U.automations, t('Quantas automações simples?', 'How many simple automations?', '¿Cuántas automatizaciones simples?'),
    [qty(66, 'Automações simples')]),
  n('core.rules.automations_complex', 'automations', U.automations, t('Quantas automações complexas?', 'How many complex automations?', '¿Cuántas automatizaciones complejas?'),
    [qty(122, 'Automações complexas')]),
  yn('core.csat', 'automations', t('Vai usar pesquisa de satisfação?', 'Will you use a satisfaction survey?', '¿Se usará encuesta de satisfacción?'),
    [ifYes(70, 'Pesquisa de satisfação (CSAT)')]),
  n('core.macros', 'macros', U.macros, t('Quantas macros?', 'How many macros?', '¿Cuántas macros?'),
    [qty(56, 'Macros')], 'essencial'),

  // Roteamento e SLA
  n('core.views', 'routing', U.views, t('Quantas visualizações?', 'How many views?', '¿Cuántas vistas?'),
    [qty(116, 'Visualizações')], 'essencial'),
  n('core.skills', 'routing', U.skills, t('Quantas habilidades para roteamento?', 'How many routing skills?', '¿Cuántas habilidades para enrutamiento?'),
    [qty(67, 'Habilidades')]),
  yn('core.routing.omnichannel', 'routing', t('Vai usar roteamento omnichannel?', 'Will you use omnichannel routing?', '¿Se usará enrutamiento omnicanal?'),
    [ifYes(121, 'Encaminhamento omnichannel')]),
  n('core.sla.policies', 'slas', U.policies, t('Quantas políticas de SLA?', 'How many SLA policies?', '¿Cuántas políticas de SLA?'),
    [qty(68, 'Políticas de SLA')], 'essencial'),
  n('core.schedules', 'slas', U.schedules, t('Quantas programações de horário?', 'How many business hours schedules?', '¿Cuántos horarios de atención?'),
    [qty(69, 'Programação e feriados')], 'recomendada',
    { help: t('Mais de uma programação só no plano Enterprise.', 'More than one schedule only on the Enterprise plan.', 'Más de un horario solo en el plan Enterprise.') }),

  // Escalonamento
  yn('core.side_conv.slack', 'escalation', t('Vai usar conversas paralelas via Slack?', 'Will you use side conversations via Slack?', '¿Se usarán conversaciones secundarias vía Slack?'),
    [ifYes(110, 'Conversas Paralelas via Slack')]),
  yn('core.side_conv.teams', 'escalation', t('Vai usar conversas paralelas via Microsoft Teams?', 'Will you use side conversations via Microsoft Teams?', '¿Se usarán conversaciones secundarias vía Microsoft Teams?'),
    [ifYes(111, 'Conversas Paralelas via Microsoft Teams')]),

  // Canais
  {
    key: 'core.channels.list', section: 'channels', type: 'multi', priority: 'essencial',
    text: t('Quais canais entram no go-live?', 'Which channels go live?', '¿Qué canales entran en el go-live?'),
    options: [
      opt('whatsapp', 'WhatsApp', 'WhatsApp', 'WhatsApp'),
      opt('web_widget', 'Web Widget (chat no site)', 'Web Widget (website chat)', 'Web Widget (chat en el sitio)'),
      opt('email_domain', 'E-mail com domínio do cliente', "E-mail on the customer's domain", 'E-mail con dominio del cliente'),
      opt('email_zendesk', 'E-mail Zendesk', 'Zendesk e-mail', 'E-mail Zendesk'),
      opt('voice', 'Voz', 'Voice', 'Voz'),
      opt('messenger', 'Facebook Messenger', 'Facebook Messenger', 'Facebook Messenger'),
      opt('instagram', 'Instagram Direct', 'Instagram Direct', 'Instagram Direct'),
      opt('sms', 'SMS', 'SMS', 'SMS'),
      opt('teams', 'Microsoft Teams', 'Microsoft Teams', 'Microsoft Teams'),
      opt('ios', 'App iOS (SDK)', 'iOS app (SDK)', 'App iOS (SDK)'),
      opt('android', 'App Android (SDK)', 'Android app (SDK)', 'App Android (SDK)'),
    ],
    mappings: [
      perOption('whatsapp', 222, 'WhatsApp', { quantityFrom: 'core.channels.whatsapp_numbers' }),
      perOption('web_widget', 32, 'Web Widget'),
      perOption('email_domain', 112, 'Email com domínio do cliente', { quantityFrom: 'core.channels.email_addresses' }),
      perOption('email_zendesk', 25, 'Email Zendesk'),
      perOption('messenger', 33, 'Facebook Messenger'),
      perOption('instagram', 34, 'Instagram Direct (DM)'),
      perOption('sms', 47, 'Mensagens de texto / SMS'),
      perOption('teams', 31, 'Microsoft Teams (canal)', { combine: 'max' }),
      perOption('ios', 36, 'iOS'),
      perOption('android', 35, 'Android SDK'),
    ],
  },
  n('core.channels.whatsapp_numbers', 'channels', U.numbers, t('Quantos números de WhatsApp?', 'How many WhatsApp numbers?', '¿Cuántos números de WhatsApp?'),
    [], 'recomendada',
    { showIf: { questionKey: 'core.channels.list', includes: 'whatsapp' }, help: t('A quantidade vai para o item WhatsApp marcado nos canais.', 'The quantity feeds the WhatsApp item selected in channels.', 'La cantidad alimenta el ítem WhatsApp marcado en canales.') }),
  n('core.channels.email_addresses', 'channels', U.addresses, t('Quantos endereços de e-mail com domínio do cliente?', "How many e-mail addresses on the customer's domain?", '¿Cuántas direcciones de e-mail con dominio del cliente?'),
    [], 'recomendada',
    { showIf: { questionKey: 'core.channels.list', includes: 'email_domain' } }),
  n('core.email.templates', 'channels', U.templates, t('Quantos templates HTML de e-mail?', 'How many HTML e-mail templates?', '¿Cuántas plantillas HTML de e-mail?'),
    [qty(26, 'Template HTML do e-mail')]),

  // Conhecimento
  yn('core.knowledge.help_center', 'knowledge', t('Vai ter Central de Ajuda?', 'Will there be a Help Center?', '¿Habrá Centro de ayuda?'),
    [ifYes(89, 'Central de ajuda básica')]),
  n('core.knowledge.articles', 'knowledge', U.articles, t('Quantos artigos entram na implantação?', 'How many articles are part of the implementation?', '¿Cuántos artículos entran en la implementación?'),
    [qty(138, 'Artigos')]),
  n('core.knowledge.external_sources', 'knowledge', U.sources, t('Quantas fontes de conhecimento externas (web crawl, csv)?', 'How many external knowledge sources (web crawl, csv)?', '¿Cuántas fuentes de conocimiento externas (web crawl, csv)?'),
    [qty(167, 'Fontes de conhecimento externas')]),

  // Integrações
  n('core.webhooks', 'integrations', U.webhooks, t('Quantos webhooks?', 'How many webhooks?', '¿Cuántos webhooks?'), [qty(64, 'Webhook')]),
  n('core.custom_objects', 'integrations', U.objects, t('Quantos tipos de objeto personalizado?', 'How many custom object types?', '¿Cuántos tipos de objeto personalizado?'),
    [qty(119, 'Objeto personalizado')]),
  n('core.custom_objects_records', 'integrations', U.records, t('Quantos registros de objeto personalizado serão criados na implantação?', 'How many custom object records will be created during the implementation?', '¿Cuántos registros de objeto personalizado se crearán en la implementación?'),
    [qty(120, 'Registros de objeto personalizado')]),
  n('core.action_flows_simple', 'integrations', U.flows, t('Quantos fluxos de ação simples?', 'How many simple action flows?', '¿Cuántos flujos de acción simples?'),
    [qty(133, 'Fluxos de ação simples')]),
  n('core.action_flows_complex', 'integrations', U.flows, t('Quantos fluxos de ação complexos?', 'How many complex action flows?', '¿Cuántos flujos de acción complejos?'),
    [qty(134, 'Fluxos de ação complexos')]),
  n('core.action_flows_external', 'integrations', U.systems, t('Quantos sistemas externos os fluxos de ação vão conectar?', 'How many external systems will the action flows connect?', '¿Cuántos sistemas externos conectarán los flujos de acción?'),
    [qty(135, 'Fluxos de ação: sistemas externos')]),
  n('core.apps.builder_no_api', 'integrations', U.apps, t('Quantos apps do criador de aplicativos, sem API externa?', 'How many App Builder apps without an external API?', '¿Cuántas apps del creador de aplicaciones, sin API externa?'),
    [qty(74, 'Criador de aplicativos: sem conexão API externa')]),
  n('core.apps.builder_api', 'integrations', U.apps, t('Quantos apps do criador de aplicativos, com API externa?', 'How many App Builder apps with an external API?', '¿Cuántas apps del creador de aplicaciones, con API externa?'),
    [qty(75, 'Criador de aplicativos: com conexão API externa')]),
  {
    key: 'core.apps.marketplace', section: 'integrations', type: 'table', priority: 'recomendada',
    text: t('Quais apps do Marketplace serão instalados?', 'Which Marketplace apps will be installed?', '¿Qué apps del Marketplace se instalarán?'),
    tableColumns: [col('app', 'text', 'App', 'App', 'App'), col('link', 'text', 'Link', 'Link', 'Enlace')],
    mappings: [tableCount(73, 'App Marketplace')],
  },

  // Segurança e usuários
  yn('core.sso', 'security', t('Vai usar SSO?', 'Will you use SSO?', '¿Se usará SSO?'), [ifYes(14, 'Single Sign-On (SSO)')]),
  n('core.data_deletion', 'security', U.schedules, t('Quantas programações de exclusão de dados?', 'How many data deletion schedules?', '¿Cuántas programaciones de eliminación de datos?'),
    [qty(15, 'Programações de exclusão de dados')]),
  n('core.import.users', 'users', U.files, t('Quantos arquivos de importação de usuários?', 'How many user import files?', '¿Cuántos archivos de importación de usuarios?'),
    [qty(22, 'Importação de usuários')]),
  n('core.import.orgs', 'users', U.files, t('Quantos arquivos de importação de organizações?', 'How many organization import files?', '¿Cuántos archivos de importación de organizaciones?'),
    [qty(23, 'Importação de organizações')]),

  // Analytics
  n('core.analytics.dashboards', 'reporting', U.dashboards, t('Quantos painéis personalizados?', 'How many custom dashboards?', '¿Cuántos paneles personalizados?'),
    [qty(94, 'Painéis personalizados'), ifPositive(92, 'Configurações gerais (Analytics)', 1, { combine: 'max' })]),
  n('core.analytics.reports', 'reporting', U.reports, t('Quantos relatórios personalizados?', 'How many custom reports?', '¿Cuántos informes personalizados?'),
    [qty(93, 'Relatórios personalizados'), ifPositive(92, 'Configurações gerais (Analytics)', 1, { combine: 'max' })]),

  // Treinamento e go-live
  {
    key: 'core.training.groups', section: 'launch', type: 'table', priority: 'recomendada',
    text: t('Quantas turmas de treinamento por módulo e público?', 'How many training groups per module and audience?', '¿Cuántos grupos de capacitación por módulo y público?'),
    tableColumns: [
      col('training', 'single', 'Treinamento (módulo · público)', 'Training (module · audience)', 'Capacitación (módulo · público)', {
        options: Object.entries(TRAINING_ITEMS).map(([value, i]) => ({ value, label: i.label })),
      }),
      col('groups', 'number', 'Nº de turmas', 'No. of groups', 'Nº de grupos'),
    ],
    mappings: [{
      rule: 'table_item_qty', itemColumn: 'training', qtyColumn: 'groups',
      items: Object.fromEntries(Object.entries(TRAINING_ITEMS).map(([value, i]) => [value, { itemId: i.itemId, itemName: i.itemName }])),
    }],
  },
  n('core.golive.hypercare_days', 'launch', U.days, t('Quantos dias de suporte pós go-live?', 'How many days of post go-live support?', '¿Cuántos días de soporte post go-live?'),
    [qty(224, 'Suporte Pós Go-Live')]),
  yn('core.golive.followup', 'launch', t('Vai ter acompanhamento (presencial ou remoto) no dia do go-live?', 'Will there be go-live day support (onsite or remote)?', '¿Habrá acompañamiento (presencial o remoto) el día del go-live?'),
    [ifYes(223, 'Acompanhamento de Go-Live')]),
];
