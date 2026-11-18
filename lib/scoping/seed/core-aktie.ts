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
    key: 'core.ctx.decision_stage', section: 'ctx', type: 'single', priority: 'essencial',
    text: t('Em que momento da escolha da plataforma vocês estão?', 'Where are you in choosing the platform?', '¿En qué momento de la elección de la plataforma están?'),
    help: t('Define o tom do restante da conversa: discovery aberto, comparação com concorrentes ou desenho da solução.', 'Sets the tone for the rest of the conversation: open discovery, competitive comparison or solution design.', 'Define el tono del resto de la conversación: discovery abierto, comparación con competidores o diseño de la solución.'),
    options: [
      opt('exploring', 'Ainda entendendo o problema', 'Still understanding the problem', 'Todavía entendiendo el problema'),
      opt('evaluating', 'Avaliando plataformas', 'Evaluating platforms', 'Evaluando plataformas'),
      opt('shortlist', 'Com 2 ou 3 finalistas', 'With 2 or 3 finalists', 'Con 2 o 3 finalistas'),
      opt('chosen_zendesk', 'Já escolheu o Zendesk', 'Has already chosen Zendesk', 'Ya eligió Zendesk'),
      opt('zendesk_customer', 'Já usa Zendesk (otimização)', 'Already uses Zendesk (optimization)', 'Ya usa Zendesk (optimización)'),
    ],
  },
  {
    key: 'core.ctx.platforms', section: 'ctx', type: 'multi', priority: 'essencial',
    text: t('Quais plataformas estão sendo consideradas, incluindo a atual?', 'Which platforms are being considered, including the current one?', '¿Qué plataformas se están considerando, incluida la actual?'),
    help: t('Use o comentário para registrar a plataforma atual e quem é o favorito hoje.', 'Use the note to record the current platform and today\'s favorite.', 'Use el comentario para registrar la plataforma actual y la favorita hoy.'),
    options: [
      opt('zendesk', 'Zendesk', 'Zendesk', 'Zendesk'),
      opt('salesforce', 'Salesforce Service Cloud', 'Salesforce Service Cloud', 'Salesforce Service Cloud'),
      opt('servicenow', 'ServiceNow', 'ServiceNow', 'ServiceNow'),
      opt('freshworks', 'Freshdesk / Freshservice', 'Freshdesk / Freshservice', 'Freshdesk / Freshservice'),
      opt('hubspot', 'HubSpot Service Hub', 'HubSpot Service Hub', 'HubSpot Service Hub'),
      opt('genesys', 'Genesys', 'Genesys', 'Genesys'),
      opt('blip', 'Blip', 'Blip', 'Blip'),
      opt('octadesk', 'Octadesk', 'Octadesk', 'Octadesk'),
      opt('inhouse', 'Sistema próprio', 'In-house system', 'Sistema propio'),
      opt('other', 'Outra', 'Other', 'Otra'),
    ],
  },
  {
    key: 'core.ctx.decision_criteria', section: 'ctx', type: 'long_text', priority: 'essencial',
    text: t('Quais critérios vão decidir a escolha, e qual pesa mais?', 'Which criteria will drive the decision, and which matters most?', '¿Qué criterios decidirán la elección y cuál pesa más?'),
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
  n('core.users.agents', 'teams', U.agents, t('Quantos agentes atendem clientes (licença completa)?', 'How many agents handle customers (full license)?', '¿Cuántos agentes atienden clientes (licencia completa)?'),
    [qty(17, 'Agentes')], 'essencial'),
  n('core.users.light_agents', 'teams', U.agents, t('Quantas pessoas só consultam ou comentam chamados, sem atender (light agents)?', 'How many people only view or comment on tickets, without handling them (light agents)?', '¿Cuántas personas solo consultan o comentan tickets, sin atender (light agents)?'),
    [qty(17, 'Agentes')]),
  n('core.users.groups', 'teams', U.groups, t('Quantos grupos ou filas de atendimento?', 'How many support groups or queues?', '¿Cuántos grupos o colas de atención?'),
    [qty(19, 'Grupos')], 'essencial'),
  n('core.users.custom_roles', 'teams', U.roles, t('Quantos perfis de acesso diferentes os agentes precisam (papéis personalizados)?', 'How many different access profiles do agents need (custom roles)?', '¿Cuántos perfiles de acceso distintos necesitan los agentes (roles personalizados)?'),
    [qty(18, 'Funções')], 'recomendada',
    { help: t('No Customer Service, papéis personalizados exigem o plano Enterprise.', 'In Customer Service, custom roles require the Enterprise plan.', 'En Customer Service, los roles personalizados requieren el plan Enterprise.') }),
  n('core.brands', 'teams', U.brands, t('Quantas marcas são atendidas?', 'How many brands are supported?', '¿Cuántas marcas se atienden?'), [qty(16, 'Marcas')]),

  // Formulários e campos
  n('core.forms', 'forms', U.forms, t('Quantos formulários de abertura de chamado?', 'How many request forms?', '¿Cuántos formularios de apertura de solicitud?'),
    [qty(27, 'Formulários e Catálogos de Serviço', { combine: 'max' })]),
  n('core.fields.ticket', 'fields', U.fields, t('Quantos campos o agente preenche em cada chamado?', 'How many fields does the agent fill in on each ticket?', '¿Cuántos campos completa el agente en cada ticket?'),
    [qty(117, 'Campos de ticket')], 'essencial'),
  n('core.fields.conditional', 'fields', U.fields, t('Quantos campos só aparecem conforme outra resposta (condicionais)?', 'How many fields only appear depending on another answer (conditional)?', '¿Cuántos campos solo aparecen según otra respuesta (condicionales)?'),
    [qty(28, 'Campos de ticket condicionais')]),
  n('core.fields.user', 'fields', U.fields, t('Quantos campos no cadastro do cliente (pessoa)?', 'How many fields in the customer (person) record?', '¿Cuántos campos en el registro del cliente (persona)?'),
    [qty(20, 'Campos do usuário')]),
  n('core.fields.org', 'fields', U.fields, t('Quantos campos no cadastro da empresa cliente (organização)?', 'How many fields in the customer company (organization) record?', '¿Cuántos campos en el registro de la empresa cliente (organización)?'),
    [qty(21, 'Campos da organização')]),
  n('core.statuses.custom', 'fields', U.statuses, t('Quantos status de chamado próprios, além de novo, aberto, pendente e resolvido?', 'How many custom ticket statuses, besides new, open, pending and solved?', '¿Cuántos estados de ticket propios, además de nuevo, abierto, pendiente y resuelto?'),
    [qty(118, 'Status de ticket personalizados')]),

  // Regras de negócio
  n('core.rules.triggers_simple', 'automations', U.triggers, t('Quantas regras automáticas simples, disparadas por um evento (gatilhos)?', 'How many simple event-based automatic rules (triggers)?', '¿Cuántas reglas automáticas simples, disparadas por un evento (disparadores)?'),
    [qty(61, 'Gatilhos Simples')], 'essencial'),
  n('core.rules.triggers_complex', 'automations', U.triggers, t('Quantas regras automáticas complexas, de mensagens ou de cadastros próprios (gatilhos complexos)?', 'How many complex automatic rules, for messaging or custom records (complex triggers)?', '¿Cuántas reglas automáticas complejas, de mensajería o de registros propios (disparadores complejos)?'),
    [qty(62, 'Gatilhos Complexos')], 'essencial'),
  n('core.rules.automations_simple', 'automations', U.automations, t('Quantas regras automáticas simples baseadas em tempo (automações)?', 'How many simple time-based automatic rules (automations)?', '¿Cuántas reglas automáticas simples basadas en tiempo (automatizaciones)?'),
    [qty(66, 'Automações simples')]),
  n('core.rules.automations_complex', 'automations', U.automations, t('Quantas regras automáticas complexas baseadas em tempo (automações)?', 'How many complex time-based automatic rules (automations)?', '¿Cuántas reglas automáticas complejas basadas en tiempo (automatizaciones)?'),
    [qty(122, 'Automações complexas')]),
  yn('core.csat', 'automations', t('Precisa de pesquisa de satisfação depois do atendimento?', 'Is a satisfaction survey needed after each interaction?', '¿Se necesita encuesta de satisfacción después de la atención?'),
    [ifYes(70, 'Pesquisa de satisfação (CSAT)')]),
  n('core.macros', 'macros', U.macros, t('Quantas respostas prontas (macros)?', 'How many canned responses (macros)?', '¿Cuántas respuestas predefinidas (macros)?'),
    [qty(56, 'Macros')], 'essencial'),

  // Roteamento e SLA
  n('core.views', 'routing', U.views, t('Quantas filas ou listas de trabalho os agentes precisam ver (visualizações)?', 'How many work queues or lists do agents need to see (views)?', '¿Cuántas colas o listas de trabajo necesitan ver los agentes (vistas)?'),
    [qty(116, 'Visualizações')], 'essencial'),
  n('core.skills', 'routing', U.skills, t('Quantas habilidades para direcionar o atendimento (assunto, idioma, produto)?', 'How many skills to route interactions (topic, language, product)?', '¿Cuántas habilidades para dirigir la atención (tema, idioma, producto)?'),
    [qty(67, 'Habilidades')]),
  yn('core.routing.omnichannel', 'routing', t('Precisa distribuir os atendimentos automaticamente conforme a capacidade de cada agente (roteamento omnichannel)?', 'Do interactions need to be distributed automatically by each agent\'s capacity (omnichannel routing)?', '¿Se necesita distribuir las atenciones automáticamente según la capacidad de cada agente (enrutamiento omnicanal)?'),
    [ifYes(121, 'Encaminhamento omnichannel')]),
  n('core.sla.policies', 'slas', U.policies, t('Quantos conjuntos de metas de prazo de atendimento (políticas de SLA)?', 'How many sets of response and resolution targets (SLA policies)?', '¿Cuántos conjuntos de metas de plazo de atención (políticas de SLA)?'),
    [qty(68, 'Políticas de SLA')], 'essencial'),
  n('core.schedules', 'slas', U.schedules, t('Quantos horários de atendimento diferentes?', 'How many different business hours schedules?', '¿Cuántos horarios de atención diferentes?'),
    [qty(69, 'Programação e feriados')], 'recomendada',
    { help: t('Mais de uma programação só no plano Enterprise.', 'More than one schedule only on the Enterprise plan.', 'Más de un horario solo en el plan Enterprise.') }),

  // Escalonamento
  yn('core.side_conv.slack', 'escalation', t('Os agentes precisam acionar outras áreas pelo Slack sem sair do chamado (conversas paralelas)?', 'Do agents need to reach other teams via Slack without leaving the ticket (side conversations)?', '¿Los agentes necesitan contactar otras áreas por Slack sin salir del ticket (conversaciones secundarias)?'),
    [ifYes(110, 'Conversas Paralelas via Slack')]),
  yn('core.side_conv.teams', 'escalation', t('Os agentes precisam acionar outras áreas pelo Microsoft Teams sem sair do chamado (conversas paralelas)?', 'Do agents need to reach other teams via Microsoft Teams without leaving the ticket (side conversations)?', '¿Los agentes necesitan contactar otras áreas por Microsoft Teams sin salir del ticket (conversaciones secundarias)?'),
    [ifYes(111, 'Conversas Paralelas via Microsoft Teams')]),

  // Canais
  {
    key: 'core.channels.list', section: 'channels', type: 'multi', priority: 'essencial',
    text: t('Quais canais de atendimento entram na primeira fase?', 'Which support channels are part of the first phase?', '¿Qué canales de atención entran en la primera fase?'),
    options: [
      opt('whatsapp', 'WhatsApp', 'WhatsApp', 'WhatsApp'),
      opt('web_widget', 'Web Widget (chat no site)', 'Web Widget (website chat)', 'Web Widget (chat en el sitio)'),
      opt('email_domain', 'E-mail com domínio do cliente', "E-mail on the customer's domain", 'E-mail con dominio del cliente'),
      opt('email_zendesk', 'E-mail com endereço da própria plataforma', "E-mail on the platform's own address", 'E-mail con dirección de la propia plataforma'),
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
  n('core.email.templates', 'channels', U.templates, t('Quantos modelos visuais de e-mail (HTML)?', 'How many visual e-mail templates (HTML)?', '¿Cuántas plantillas visuales de e-mail (HTML)?'),
    [qty(26, 'Template HTML do e-mail')]),

  // Conhecimento
  yn('core.knowledge.help_center', 'knowledge', t('Precisa de uma central de ajuda ou FAQ para o cliente se autoatender?', 'Is a help center or FAQ needed for customer self-service?', '¿Se necesita un centro de ayuda o FAQ para el autoservicio del cliente?'),
    [ifYes(89, 'Central de ajuda básica')]),
  n('core.knowledge.articles', 'knowledge', U.articles, t('Quantos artigos a central de ajuda terá no início?', 'How many articles will the help center start with?', '¿Cuántos artículos tendrá el centro de ayuda al inicio?'),
    [qty(138, 'Artigos')]),
  n('core.knowledge.external_sources', 'knowledge', U.sources, t('Quantas fontes de conhecimento externas a IA deve consultar (site, planilhas)?', 'How many external knowledge sources should the AI use (website, spreadsheets)?', '¿Cuántas fuentes de conocimiento externas debe consultar la IA (sitio, planillas)?'),
    [qty(167, 'Fontes de conhecimento externas')]),

  // Integrações
  n('core.webhooks', 'integrations', U.webhooks, t('Quantos avisos automáticos para outros sistemas (webhooks)?', 'How many automatic notifications to other systems (webhooks)?', '¿Cuántos avisos automáticos a otros sistemas (webhooks)?'), [qty(64, 'Webhook')]),
  n('core.custom_objects', 'integrations', U.objects, t('Quantos tipos de cadastro próprio a operação precisa, como contratos ou equipamentos (objetos personalizados)?', 'How many custom record types does the operation need, such as contracts or equipment (custom objects)?', '¿Cuántos tipos de registro propio necesita la operación, como contratos o equipos (objetos personalizados)?'),
    [qty(119, 'Objeto personalizado')]),
  n('core.custom_objects_records', 'integrations', U.records, t('Quantos registros desses cadastros próprios precisam ser carregados no início?', 'How many of those custom records need to be loaded at the start?', '¿Cuántos de esos registros propios deben cargarse al inicio?'),
    [qty(120, 'Registros de objeto personalizado')]),
  n('core.action_flows_simple', 'integrations', U.flows, t('Quantos fluxos automáticos simples entre sistemas (fluxos de ação)?', 'How many simple automated flows between systems (action flows)?', '¿Cuántos flujos automáticos simples entre sistemas (flujos de acción)?'),
    [qty(133, 'Fluxos de ação simples')]),
  n('core.action_flows_complex', 'integrations', U.flows, t('Quantos fluxos automáticos complexos entre sistemas (fluxos de ação)?', 'How many complex automated flows between systems (action flows)?', '¿Cuántos flujos automáticos complejos entre sistemas (flujos de acción)?'),
    [qty(134, 'Fluxos de ação complexos')]),
  n('core.action_flows_external', 'integrations', U.systems, t('Quantos sistemas externos esses fluxos automáticos vão conectar?', 'How many external systems will those automated flows connect?', '¿Cuántos sistemas externos conectarán esos flujos automáticos?'),
    [qty(135, 'Fluxos de ação: sistemas externos')]),
  n('core.apps.builder_no_api', 'integrations', U.apps, t('Quantas telas próprias na área do agente, sem integração com outro sistema (apps)?', 'How many custom panels in the agent workspace, without integration with another system (apps)?', '¿Cuántas pantallas propias en el área del agente, sin integración con otro sistema (apps)?'),
    [qty(74, 'Criador de aplicativos: sem conexão API externa')]),
  n('core.apps.builder_api', 'integrations', U.apps, t('Quantas telas próprias na área do agente, com integração com outro sistema (apps)?', 'How many custom panels in the agent workspace, integrated with another system (apps)?', '¿Cuántas pantallas propias en el área del agente, integradas con otro sistema (apps)?'),
    [qty(75, 'Criador de aplicativos: com conexão API externa')]),
  {
    key: 'core.apps.marketplace', section: 'integrations', type: 'table', priority: 'recomendada',
    text: t('Quais aplicativos prontos de mercado a operação quer usar?', 'Which off-the-shelf apps does the operation want to use?', '¿Qué aplicaciones listas del mercado quiere usar la operación?'),
    tableColumns: [col('app', 'text', 'App', 'App', 'App'), col('link', 'text', 'Link', 'Link', 'Enlace')],
    mappings: [tableCount(73, 'App Marketplace')],
  },

  // Segurança e usuários
  yn('core.sso', 'security', t('Os agentes entram com o login único da empresa (SSO)?', 'Do agents sign in with the company\'s single sign-on (SSO)?', '¿Los agentes ingresan con el inicio de sesión único de la empresa (SSO)?'), [ifYes(14, 'Single Sign-On (SSO)')]),
  n('core.data_deletion', 'security', U.schedules, t('Quantas regras de exclusão automática de dados (LGPD)?', 'How many automatic data deletion rules (privacy/LGPD)?', '¿Cuántas reglas de eliminación automática de datos (privacidad)?'),
    [qty(15, 'Programações de exclusão de dados')]),
  n('core.import.users', 'users', U.files, t('Quantos arquivos com cadastro de clientes (pessoas) precisam ser carregados no início?', 'How many customer (person) files need to be loaded at the start?', '¿Cuántos archivos de clientes (personas) deben cargarse al inicio?'),
    [qty(22, 'Importação de usuários')]),
  n('core.import.orgs', 'users', U.files, t('Quantos arquivos com cadastro de empresas clientes precisam ser carregados no início?', 'How many customer company files need to be loaded at the start?', '¿Cuántos archivos de empresas clientes deben cargarse al inicio?'),
    [qty(23, 'Importação de organizações')]),

  // Analytics
  n('core.analytics.dashboards', 'reporting', U.dashboards, t('Quantos painéis de indicadores personalizados?', 'How many custom KPI dashboards?', '¿Cuántos paneles de indicadores personalizados?'),
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
  n('core.golive.hypercare_days', 'launch', U.days, t('Quantos dias de suporte reforçado depois que a nova plataforma entrar em operação?', 'How many days of extra support after the new platform goes live?', '¿Cuántos días de soporte reforzado después de que la nueva plataforma entre en operación?'),
    [qty(224, 'Suporte Pós Go-Live')]),
  yn('core.golive.followup', 'launch', t('Precisa de acompanhamento (presencial ou remoto) no dia da virada?', 'Is on-site or remote support needed on cutover day?', '¿Se necesita acompañamiento (presencial o remoto) el día del cambio?'),
    [ifYes(223, 'Acompanhamento de Go-Live')]),
];
