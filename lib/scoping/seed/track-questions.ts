/**
 * Perguntas das trilhas do banco v1 (Apêndice A.3 a A.8): AI Agents, Voz/ZCC,
 * Copilot, ITSM/CMDB, Migração e Varejo.
 */

import { AI_USECASE_COLUMNS } from '../types';
import { U, col, ifYes, opt, perOption, qty, t, tableCount } from './helpers';
import type { SeedQuestion } from './types';

const AI = ['product.ai_agents'];
const VOICE = ['product.voice_zcc'];
const COPILOT = ['product.copilot'];
const ITSM = ['usecase.itsm_cmdb'];
const MIG = ['usecase.migration'];
const RETAIL = ['segment.retail'];

const num = (
  key: string, section: string, tracks: string[], unit: (typeof U)[keyof typeof U], text: ReturnType<typeof t>,
  mappings: SeedQuestion['mappings'] = [], priority: SeedQuestion['priority'] = 'recomendada', extra: Partial<SeedQuestion> = {},
): SeedQuestion => ({ key, section, tracks, type: 'number', unit, min: 0, priority, text, mappings, ...extra });

const yn = (
  key: string, section: string, tracks: string[], text: ReturnType<typeof t>,
  mappings: SeedQuestion['mappings'] = [], priority: SeedQuestion['priority'] = 'recomendada', extra: Partial<SeedQuestion> = {},
): SeedQuestion => ({ key, section, tracks, type: 'yes_no', priority, text, mappings, ...extra });

// ---------------------------------------------------------------------------
// A.3 · AI Agents
// ---------------------------------------------------------------------------

export const AI_AGENTS_QUESTIONS: SeedQuestion[] = [
  {
    key: 'ai.usecases', section: 'ai_agent', tracks: AI, type: 'ai_usecases', priority: 'essencial',
    text: t('Quais casos de uso o assistente virtual (bot) deve resolver sozinho?', 'Which use cases should the virtual assistant (bot) resolve on its own?', '¿Qué casos de uso debe resolver solo el asistente virtual (bot)?'),
    help: t('Cada linha vira um procedimento simples, intermediário ou complexo na estimativa, pela coluna Complexidade.', 'Each row becomes a simple, intermediate or complex procedure in the estimate, by the Complexity column.', 'Cada fila se convierte en un procedimiento simple, intermedio o complejo en la estimación, según la columna Complejidad.'),
    tableColumns: AI_USECASE_COLUMNS,
    mappings: [{
      rule: 'ai_usecase_complexity',
      items: {
        simples: { itemId: 106, itemName: 'Procedimentos / Diálogos simples' },
        intermediario: { itemId: 163, itemName: 'Procedimentos / Diálogos intermediários' },
        complexo: { itemId: 164, itemName: 'Procedimentos / Diálogos complexos' },
      },
    }],
  },
  num('ai.bots', 'ai_agent', AI, U.bots, t('Quantos assistentes virtuais (por marca, idioma ou público)?', 'How many virtual assistants (per brand, language or audience)?', '¿Cuántos asistentes virtuales (por marca, idioma o público)?'),
    [qty(105, 'Configurações gerais (AI Agents)')], 'essencial'),
  {
    key: 'ai.api_endpoints', section: 'ai_agent', tracks: AI, type: 'table', priority: 'essencial',
    text: t('Quais consultas ou ações em outros sistemas o bot vai fazer (endpoints)?', 'Which lookups or actions in other systems will the bot perform (endpoints)?', '¿Qué consultas o acciones en otros sistemas hará el bot (endpoints)?'),
    tableColumns: [
      col('system', 'text', 'Sistema', 'System', 'Sistema'),
      col('endpoint', 'text', 'Endpoint', 'Endpoint', 'Endpoint'),
      col('mode', 'single', 'Leitura ou escrita', 'Read or write', 'Lectura o escritura', {
        options: [opt('read', 'Leitura', 'Read', 'Lectura'), opt('write', 'Escrita', 'Write', 'Escritura')],
      }),
      col('auth', 'text', 'Autenticação', 'Authentication', 'Autenticación'),
    ],
    mappings: [tableCount(175, 'Integrações por API')],
  },
  num('ai.actions', 'ai_agent', AI, U.actions, t('Quantas ações o bot executa, somando todos os bots?', 'How many actions does the bot perform, across all bots?', '¿Cuántas acciones ejecuta el bot, sumando todos los bots?'), [qty(168, 'Ações (AI Agents)')]),
  num('ai.entities', 'ai_agent', AI, U.entities, t('Quantos dados o bot precisa reconhecer na conversa, como número do pedido ou CPF (entidades)?', 'How many data points must the bot recognize in the conversation, such as order number or tax ID (entities)?', '¿Cuántos datos debe reconocer el bot en la conversación, como número de pedido o documento (entidades)?'), [qty(169, 'Entidades (AI Agents)')]),
  num('ai.instructions', 'ai_agent', AI, U.instructions, t('Quantas instruções de comportamento o bot precisa?', 'How many behavior instructions does the bot need?', '¿Cuántas instrucciones de comportamiento necesita el bot?'), [qty(171, 'Instruções')]),
  num('ai.segments', 'ai_agent', AI, U.segments, t('Quantos segmentos de público?', 'How many audience segments?', '¿Cuántos segmentos de público?'), [qty(165, 'Segmentos')]),
  num('ai.hours', 'ai_agent', AI, U.schedules, t('Quantos horários de operação diferentes?', 'How many different operating hours?', '¿Cuántos horarios de operación diferentes?'), [qty(170, 'Horários de operação')]),
  num('ai.search_rules', 'ai_agent', AI, U.rules, t('Quantas regras de busca (mínimo 1 por bot)?', 'How many search rules (at least 1 per bot)?', '¿Cuántas reglas de búsqueda (mínimo 1 por bot)?'), [qty(166, 'Regras de busca')]),
  num('ai.structured_forms', 'ai_agent', AI, U.messages, t('Quantas mensagens com formulário o bot vai enviar?', 'How many form messages will the bot send?', '¿Cuántos mensajes con formulario enviará el bot?'), [qty(172, 'Modelo de mensagem estruturada - formulário')], 'opcional'),
  num('ai.structured_webview', 'ai_agent', AI, U.messages, t('Quantas mensagens que abrem uma página web o bot vai enviar?', 'How many messages that open a web page will the bot send?', '¿Cuántos mensajes que abren una página web enviará el bot?'), [qty(173, 'Modelo de mensagem estruturada - visualização da web')], 'opcional'),
  num('ai.structured_json', 'ai_agent', AI, U.messages, t('Quantas mensagens em formato personalizado (JSON) o bot vai enviar?', 'How many custom-format (JSON) messages will the bot send?', '¿Cuántos mensajes en formato personalizado (JSON) enviará el bot?'), [qty(174, 'Modelo de mensagem estruturada - personalizado (JSON)')], 'opcional',
    { help: t('JSON personalizado: sempre validar com o time de desenvolvimento.', 'Custom JSON: always validate with the development team.', 'JSON personalizado: validar siempre con el equipo de desarrollo.') }),
  yn('ai.custom_crm', 'ai_agent', AI, t('O bot precisa consultar um CRM próprio?', 'Does the bot need to query an in-house CRM?', '¿El bot necesita consultar un CRM propio?'), [ifYes(176, 'Conectar CRM personalizado')]),
  {
    key: 'ai.handoff', section: 'ai_agent', tracks: AI, type: 'long_text', priority: 'essencial',
    text: t('Quando e como o bot transfere para humano, e o que precisa ir junto?', 'When and how does the bot hand off to a human, and what must go along?', '¿Cuándo y cómo transfiere el bot a un humano, y qué debe ir junto?'),
  },
  {
    key: 'ai.auth', section: 'ai_agent', tracks: AI, type: 'single', priority: 'essencial',
    text: t('Como o cliente é identificado antes de consultar dados?', 'How is the customer identified before querying data?', '¿Cómo se identifica al cliente antes de consultar datos?'),
    options: [
      opt('none', 'Sem identificação', 'No identification', 'Sin identificación'),
      opt('email_doc', 'Por e-mail ou CPF', 'By e-mail or tax ID', 'Por e-mail o documento'),
      opt('strong', 'Autenticação forte', 'Strong authentication', 'Autenticación fuerte'),
    ],
  },
  {
    key: 'ai.knowledge_quality', section: 'ai_agent', tracks: AI, type: 'single', priority: 'essencial',
    text: t('A base de conhecimento está pronta para o bot usar?', 'Is the knowledge base ready for the bot to use?', '¿La base de conocimiento está lista para que el bot la use?'),
    options: [
      opt('ready', 'Pronta', 'Ready', 'Lista'),
      opt('review', 'Precisa revisar', 'Needs review', 'Necesita revisión'),
      opt('missing', 'Não existe', "Doesn't exist", 'No existe'),
    ],
  },
  num('ai.success_metric', 'ai_agent', AI, U.percent, t('Qual a meta de resolução sem humano, e em quanto tempo?', 'What is the target resolution rate without a human, and by when?', '¿Cuál es la meta de resolución sin humano y en cuánto tiempo?'), [], 'essencial',
    { max: 100, help: t('Registre o prazo da meta no comentário.', 'Record the target deadline in the note.', 'Registre el plazo de la meta en el comentario.') }),
  {
    key: 'ai.owner', section: 'ai_agent', tracks: AI, type: 'short_text', priority: 'recomendada',
    text: t('Quem vai manter o bot depois que ele entrar em operação?', 'Who will maintain the bot once it is live?', '¿Quién mantendrá el bot una vez que esté en operación?'),
  },
];

// ---------------------------------------------------------------------------
// A.4 · Voz e Zendesk Contact Center
// ---------------------------------------------------------------------------

export const VOICE_QUESTIONS: SeedQuestion[] = [
  num('voice.volume', 'voice', VOICE, U.calls, t('Quantas chamadas por mês, entrantes e saintes?', 'How many calls per month, inbound and outbound?', '¿Cuántas llamadas por mes, entrantes y salientes?'), [], 'essencial',
    { dataKey: 'ops.volume.monthly.voice' }),
  num('voice.lines', 'voice', VOICE, U.lines, t('Quantas linhas ou números?', 'How many lines or numbers?', '¿Cuántas líneas o números?'), [qty(50, 'Linhas / Números')], 'essencial'),
  {
    key: 'voice.porting', section: 'voice', tracks: VOICE, type: 'yes_no', priority: 'recomendada',
    text: t('Os números atuais serão portados?', 'Will the current numbers be ported?', '¿Se portarán los números actuales?'),
  },
  num('voice.ivr', 'voice', VOICE, U.menus, t('Quantos menus e níveis de URA, somados?', 'How many IVR menus and levels, combined?', '¿Cuántos menús y niveles de IVR, sumados?'), [qty(53, 'URA')], 'essencial'),
  num('voice.greetings', 'voice', VOICE, U.greetings, t('Quantas saudações gravadas?', 'How many recorded greetings?', '¿Cuántos saludos grabados?'), [qty(51, 'Saudações')]),
  num('voice.blocked', 'voice', VOICE, U.numbers, t('Quantos números bloqueados?', 'How many blocked numbers?', '¿Cuántos números bloqueados?'), [qty(52, 'Números bloqueados')], 'opcional'),
  num('voice.concurrency', 'voice', VOICE, U.agents, t('Quantos agentes de voz simultâneos no pico?', 'How many concurrent voice agents at peak?', '¿Cuántos agentes de voz simultáneos en el pico?')),
  {
    key: 'voice.recording', section: 'voice', tracks: VOICE, type: 'single', priority: 'recomendada',
    text: t('Regras de gravação e por quanto tempo guardar?', 'Recording rules and how long to keep them?', '¿Reglas de grabación y por cuánto tiempo conservarlas?'),
    help: t('Registre o prazo de retenção no comentário.', 'Record the retention period in the note.', 'Registre el plazo de retención en el comentario.'),
    options: [
      opt('all', 'Todas', 'All', 'Todas'),
      opt('rule', 'Por regra', 'By rule', 'Por regla'),
      opt('none', 'Nenhuma', 'None', 'Ninguna'),
    ],
  },
  yn('voice.crm_lookup', 'voice', VOICE, t('O agente precisa ver dados do cliente ao atender (identificação pelo número ou CPF)?', 'Does the agent need to see customer data when answering (identified by number or tax ID)?', '¿El agente necesita ver datos del cliente al atender (identificación por número o documento)?')),
  yn('voice.callback', 'voice', VOICE, t('Precisa de retorno de chamada (callback)?', 'Is callback needed?', '¿Se necesita devolución de llamada (callback)?')),
  num('voice.outbound', 'voice', VOICE, U.campaigns, t('Quantas campanhas de discagem ativa?', 'How many outbound dialing campaigns?', '¿Cuántas campañas de marcación saliente?'),
    [qty(211, 'Campanhas (discador)', { requiresTrack: 'product.callwe' })], 'recomendada',
    { help: t('Conta horas só com a trilha CallWe ativa.', 'Counts hours only with the CallWe track active.', 'Cuenta horas solo con la ruta CallWe activa.') }),
  yn('voice.realtime', 'voice', VOICE, t('Precisa de painel em tempo real (wallboard)?', 'Is a real-time wallboard needed?', '¿Se necesita panel en tiempo real (wallboard)?')),
  {
    key: 'voice.carrier_contract', section: 'voice', tracks: VOICE, type: 'short_text', priority: 'recomendada',
    text: t('Qual o provedor de telefonia atual e quando vence o contrato?', 'Who is the current telephony provider and when does the contract expire?', '¿Cuál es el proveedor de telefonía actual y cuándo vence el contrato?'),
  },
  num('zcc.contact_flows', 'voice', VOICE, U.flows, t('Quantos fluxos de atendimento telefônico (contact flows)?', 'How many phone contact flows?', '¿Cuántos flujos de atención telefónica (contact flows)?'), [], 'recomendada', { noCatalogItem: true }),
  num('zcc.queues', 'voice', VOICE, U.queues, t('Quantas filas de atendimento telefônico?', 'How many phone queues?', '¿Cuántas colas de atención telefónica?'), [], 'recomendada', { noCatalogItem: true }),
  num('zcc.routing_profiles', 'voice', VOICE, U.profiles, t('Quantos perfis de direcionamento das ligações?', 'How many call routing profiles?', '¿Cuántos perfiles de enrutamiento de llamadas?'), [], 'recomendada', { noCatalogItem: true }),
];

// ---------------------------------------------------------------------------
// A.5 · Copilot
// ---------------------------------------------------------------------------

export const COPILOT_QUESTIONS: SeedQuestion[] = [
  yn('copilot.enabled', 'copilot', COPILOT, t('Os agentes vão contar com assistência de IA (sugestão de resposta, resumo, procedimentos guiados)?', 'Will agents have AI assistance (reply suggestions, summaries, guided procedures)?', '¿Los agentes contarán con asistencia de IA (sugerencia de respuesta, resumen, procedimientos guiados)?'), [ifYes(95, 'Configurações gerais (Copilot)')], 'essencial'),
  num('copilot.procedures', 'copilot', COPILOT, U.procedures, t('Quantos procedimentos guiados a IA deve sugerir aos agentes?', 'How many guided procedures should the AI suggest to agents?', '¿Cuántos procedimientos guiados debe sugerir la IA a los agentes?'), [qty(98, 'Procedimentos')], 'essencial'),
  num('copilot.entities', 'copilot', COPILOT, U.entities, t('Quantos dados a IA deve extrair dos chamados, como número do pedido (entidades)?', 'How many data points should the AI extract from tickets, such as order number (entities)?', '¿Cuántos datos debe extraer la IA de los tickets, como número de pedido (entidades)?'), [qty(97, 'Entidades (Copilot)')]),
  num('copilot.topics', 'copilot', COPILOT, U.topics, t('Quantos assuntos próprios a IA deve usar para classificar os chamados (tópicos)?', 'How many custom topics should the AI use to classify tickets?', '¿Cuántos temas propios debe usar la IA para clasificar los tickets?'), [qty(96, 'Tópicos personalizados')]),
  {
    key: 'copilot.auto_assist_actions', section: 'copilot', tracks: COPILOT, type: 'table', priority: 'recomendada',
    text: t('Quais ações a assistência automática deve executar em outros sistemas?', 'Which actions should auto assist execute in other systems?', '¿Qué acciones debe ejecutar la asistencia automática en otros sistemas?'),
    help: t('Cada ação usa um fluxo de ação ou uma integração por API: quantifique-os em Integrações.', 'Each action uses an action flow or an API integration: quantify them under Integrations.', 'Cada acción usa un flujo de acción o una integración por API: cuantifíquelos en Integraciones.'),
    tableColumns: [col('action', 'text', 'Ação', 'Action', 'Acción'), col('system', 'text', 'Sistema', 'System', 'Sistema')],
  },
];

// ---------------------------------------------------------------------------
// A.6 · ITSM/ESM com CMDB e gestão de ativos
// ---------------------------------------------------------------------------

export const ITSM_QUESTIONS: SeedQuestion[] = [
  num('itsm.catalog_items', 'itsm', ITSM, U.items, t('Quantos itens no catálogo de serviços (formulários de solicitação)?', 'How many service catalog items (request forms)?', '¿Cuántos ítems en el catálogo de servicios (formularios de solicitud)?'),
    [qty(27, 'Formulários e Catálogos de Serviço', { combine: 'max' })], 'essencial'),
  {
    key: 'itsm.ticket_types', section: 'itsm', tracks: ITSM, type: 'multi', priority: 'essencial',
    text: t('Quais tipos ITIL serão tratados?', 'Which ITIL types will be handled?', '¿Qué tipos ITIL se atenderán?'),
    options: [
      opt('incident', 'Incidente', 'Incident', 'Incidente'),
      opt('request', 'Requisição', 'Request', 'Requerimiento'),
      opt('problem', 'Problema', 'Problem', 'Problema'),
      opt('change', 'Mudança', 'Change', 'Cambio'),
    ],
  },
  yn('itsm.change_cab', 'itsm', ITSM, t('Gestão de mudança tem aprovação por comitê (CAB)?', 'Does change management require committee (CAB) approval?', '¿La gestión de cambios tiene aprobación por comité (CAB)?')),
  {
    key: 'itsm.approvals', section: 'itsm', tracks: ITSM, type: 'table', priority: 'recomendada',
    text: t('Quais solicitações exigem aprovação e com quantos níveis?', 'Which requests require approval and with how many levels?', '¿Qué solicitudes requieren aprobación y con cuántos niveles?'),
    tableColumns: [
      col('request', 'text', 'Solicitação', 'Request', 'Solicitud'),
      col('levels', 'single', 'Níveis de aprovação', 'Approval levels', 'Niveles de aprobación', {
        options: [opt('one', '1 nível', '1 level', '1 nivel'), opt('many', '2 ou mais', '2 or more', '2 o más')],
      }),
      col('approver', 'text', 'Aprovador', 'Approver', 'Aprobador'),
    ],
    mappings: [{
      rule: 'table_item_qty', itemColumn: 'levels', qtyColumn: '_qty',
      items: { one: { itemId: 133, itemName: 'Fluxos de ação simples' }, many: { itemId: 134, itemName: 'Fluxos de ação complexos' } },
    }],
  },
  num('itsm.asset_types', 'itsm', ITSM, U.types, t('Quantos tipos de ativo?', 'How many asset types?', '¿Cuántos tipos de activo?'), [qty(84, 'Tipos de ativo')], 'essencial'),
  num('itsm.asset_fields', 'itsm', ITSM, U.fields, t('Quantos campos de ativo, somando todos os tipos?', 'How many asset fields, across all types?', '¿Cuántos campos de activo, sumando todos los tipos?'), [qty(86, 'Campos de ativos')]),
  num('itsm.locations', 'itsm', ITSM, U.locations, t('Quantos locais?', 'How many locations?', '¿Cuántas ubicaciones?'), [qty(85, 'Locais (assets)')]),
  num('itsm.asset_records', 'itsm', ITSM, U.assets, t('Quantos ativos existem hoje (volume)?', 'How many assets exist today (volume)?', '¿Cuántos activos existen hoy (volumen)?'), [qty(87, 'Registros (Assets)')]),
  num('itsm.asset_import', 'itsm', ITSM, U.files, t('Quantos arquivos de importação de ativos?', 'How many asset import files?', '¿Cuántos archivos de importación de activos?'), [qty(88, 'Importação de Assets por .csv')]),
  {
    key: 'itsm.asset_source', section: 'itsm', tracks: ITSM, type: 'single', priority: 'essencial',
    text: t('Onde está o inventário hoje, e ele é a fonte de verdade?', 'Where is the inventory today, and is it the source of truth?', '¿Dónde está hoy el inventario y es la fuente de verdad?'),
    options: [
      opt('spreadsheet', 'Planilha', 'Spreadsheet', 'Planilla'),
      opt('servicenow', 'ServiceNow', 'ServiceNow', 'ServiceNow'),
      opt('intune', 'Intune', 'Intune', 'Intune'),
      opt('jamf', 'Jamf', 'Jamf', 'Jamf'),
      opt('lansweeper', 'Lansweeper', 'Lansweeper', 'Lansweeper'),
      opt('other', 'Outro', 'Other', 'Otro'),
    ],
  },
  yn('itsm.asset_sync', 'itsm', ITSM, t('Vai sincronizar com Intune ou Jamf?', 'Will it sync with Intune or Jamf?', '¿Se sincronizará con Intune o Jamf?'), [ifYes(83, 'Ativar sincronização nativa (Intune/Jamf)')]),
  yn('itsm.asset_ticket_link', 'itsm', ITSM, t('O ativo precisa estar vinculado ao ticket e ao usuário?', 'Must the asset be linked to the ticket and the user?', '¿El activo debe estar vinculado al ticket y al usuario?')),
  {
    key: 'itsm.asset_lifecycle', section: 'itsm', tracks: ITSM, type: 'multi', priority: 'recomendada',
    text: t('Quais etapas do ciclo de vida do ativo devem passar pela plataforma de atendimento?', 'Which asset lifecycle stages should go through the service platform?', '¿Qué etapas del ciclo de vida del activo deben pasar por la plataforma de atención?'),
    options: [
      opt('acquisition', 'Aquisição', 'Acquisition', 'Adquisición'),
      opt('allocation', 'Alocação', 'Allocation', 'Asignación'),
      opt('maintenance', 'Manutenção', 'Maintenance', 'Mantenimiento'),
      opt('return', 'Devolução', 'Return', 'Devolución'),
      opt('disposal', 'Descarte', 'Disposal', 'Descarte'),
    ],
  },
  {
    key: 'itsm.identity', section: 'itsm', tracks: ITSM, type: 'single', priority: 'recomendada',
    text: t('Qual o diretório de usuários, e haverá provisionamento automático?', 'Which user directory, and will there be automatic provisioning?', '¿Cuál es el directorio de usuarios y habrá aprovisionamiento automático?'),
    options: [
      opt('entra', 'Entra ID', 'Entra ID', 'Entra ID'),
      opt('google', 'Google', 'Google', 'Google'),
      opt('okta', 'Okta', 'Okta', 'Okta'),
      opt('other', 'Outro', 'Other', 'Otro'),
    ],
  },
  {
    key: 'itsm.channels_internal', section: 'itsm', tracks: ITSM, type: 'multi', priority: 'recomendada',
    text: t('Por onde os colaboradores abrem chamados?', 'Where do employees open requests?', '¿Por dónde abren solicitudes los colaboradores?'),
    options: [
      opt('portal', 'Portal', 'Portal', 'Portal'),
      opt('email', 'E-mail', 'E-mail', 'E-mail'),
      opt('teams', 'Microsoft Teams', 'Microsoft Teams', 'Microsoft Teams'),
      opt('slack', 'Slack', 'Slack', 'Slack'),
    ],
    mappings: [
      perOption('teams', 31, 'Microsoft Teams (canal)', { combine: 'max' }),
      perOption('slack', 78, 'Slack'),
    ],
  },
  {
    key: 'itsm.sensitive_areas', section: 'itsm', tracks: ITSM, type: 'multi', priority: 'recomendada',
    text: t('Há áreas com dados sensíveis que exigem acesso restrito?', 'Are there areas with sensitive data requiring restricted access?', '¿Hay áreas con datos sensibles que requieren acceso restringido?'),
    options: [
      opt('hr', 'RH', 'HR', 'RR. HH.'),
      opt('legal', 'Jurídico', 'Legal', 'Jurídico'),
      opt('finance', 'Financeiro', 'Finance', 'Finanzas'),
    ],
  },
];

// ---------------------------------------------------------------------------
// A.7 · Migração de plataforma
// ---------------------------------------------------------------------------

export const MIGRATION_QUESTIONS: SeedQuestion[] = [
  {
    key: 'mig.source', section: 'migration', tracks: MIG, type: 'short_text', priority: 'essencial',
    text: t('De qual plataforma (e versão ou plano) os dados viriam?', 'Which platform (and version or plan) would the data come from?', '¿De qué plataforma (y versión o plan) vendrían los datos?'),
  },
  {
    key: 'mig.objects', section: 'migration', tracks: MIG, type: 'multi', priority: 'essencial',
    text: t('O que migra?', 'What is migrated?', '¿Qué se migra?'),
    options: [
      opt('tickets', 'Tickets', 'Tickets', 'Tickets'),
      opt('users', 'Usuários', 'Users', 'Usuarios'),
      opt('orgs', 'Organizações', 'Organizations', 'Organizaciones'),
      opt('articles', 'Artigos', 'Articles', 'Artículos'),
      opt('attachments', 'Anexos', 'Attachments', 'Adjuntos'),
      opt('macros', 'Macros', 'Macros', 'Macros'),
      opt('fields', 'Campos', 'Fields', 'Campos'),
    ],
  },
  num('mig.tickets_volume', 'migration', MIG, U.tickets, t('Quantos tickets no período a migrar?', 'How many tickets in the period to migrate?', '¿Cuántos tickets en el período a migrar?'), [], 'essencial'),
  num('mig.years', 'migration', MIG, U.years, t('Quantos anos de histórico?', 'How many years of history?', '¿Cuántos años de histórico?')),
  yn('mig.searchable', 'migration', MIG, t('O histórico precisa ficar consultável na nova plataforma, ou basta um arquivo exportado?', 'Must the history be searchable in the new platform, or is an exported file enough?', '¿El histórico debe ser consultable en la nueva plataforma o basta un archivo exportado?'), [], 'essencial',
    { help: t('Sim = consultável no Zendesk; Não = basta o arquivo exportado.', 'Yes = searchable in Zendesk; No = an exported file is enough.', 'Sí = consultable en Zendesk; No = basta el archivo exportado.') }),
  num('mig.field_mapping', 'migration', MIG, U.fields, t('Quantos campos personalizados precisam de mapeamento?', 'How many custom fields need mapping?', '¿Cuántos campos personalizados necesitan mapeo?')),
  num('mig.attachments_size', 'migration', MIG, U.gb, t('Qual o volume de anexos?', 'What is the attachments volume?', '¿Cuál es el volumen de adjuntos?')),
  {
    key: 'mig.cutover_window', section: 'migration', tracks: MIG, type: 'long_text', priority: 'recomendada',
    text: t('Janela de corte e período de convivência das duas plataformas?', 'Cutover window and period with both platforms running?', '¿Ventana de corte y período de convivencia de las dos plataformas?'),
  },
  num('mig.hours', 'migration', MIG, U.hours, t('Horas de desenvolvimento estimadas para a migração (preenchido pela Aktie)', 'Estimated development hours for the migration (filled in by Aktie)', 'Horas de desarrollo estimadas para la migración (completado por Aktie)'),
    [qty(234, 'Desenvolvimento')], 'recomendada',
    { help: t('Não há item específico de migração no catálogo: a quantidade entra como horas de Desenvolvimento, estimadas com o time de dev.', 'There is no specific migration item in the catalog: the quantity goes in as Development hours, estimated with the dev team.', 'No hay un ítem específico de migración en el catálogo: la cantidad entra como horas de Desarrollo, estimadas con el equipo de desarrollo.') }),
];

// ---------------------------------------------------------------------------
// A.8 · Varejo e e-commerce
// ---------------------------------------------------------------------------

export const RETAIL_QUESTIONS: SeedQuestion[] = [
  {
    key: 'retail.platform', section: 'retail', tracks: RETAIL, type: 'single', priority: 'essencial',
    text: t('Plataforma de e-commerce?', 'E-commerce platform?', '¿Plataforma de e-commerce?'),
    options: [
      opt('vtex', 'VTEX', 'VTEX', 'VTEX'),
      opt('shopify', 'Shopify', 'Shopify', 'Shopify'),
      opt('woocommerce', 'WooCommerce', 'WooCommerce', 'WooCommerce'),
      opt('other', 'Outra', 'Other', 'Otra'),
    ],
    mappings: [
      perOption('vtex', 128, 'VTEX'),
      perOption('shopify', 77, 'Shopify'),
      perOption('woocommerce', 125, 'WooCommerce'),
    ],
  },
  {
    key: 'retail.top_reasons', section: 'retail', tracks: RETAIL, type: 'table', priority: 'essencial',
    text: t('Quais são os 5 principais motivos de contato e o peso de cada um?', 'What are the top 5 contact reasons and the share of each?', '¿Cuáles son los 5 principales motivos de contacto y el peso de cada uno?'),
    tableColumns: [col('reason', 'text', 'Motivo', 'Reason', 'Motivo'), col('share', 'number', '% do volume', '% of volume', '% del volumen')],
  },
  {
    key: 'retail.carriers', section: 'retail', tracks: RETAIL, type: 'table', priority: 'recomendada',
    text: t('Quais transportadoras, e elas oferecem API de rastreio?', 'Which carriers, and do they offer a tracking API?', '¿Qué transportadoras y ofrecen API de rastreo?'),
    tableColumns: [col('carrier', 'text', 'Transportadora', 'Carrier', 'Transportadora'), col('api', 'yes_no', 'Tem API?', 'Has API?', '¿Tiene API?')],
  },
  {
    key: 'retail.marketplaces', section: 'retail', tracks: RETAIL, type: 'multi', priority: 'recomendada',
    text: t('Vende em marketplaces? Quais?', 'Do you sell on marketplaces? Which ones?', '¿Vende en marketplaces? ¿Cuáles?'),
    options: [
      opt('mercado_livre', 'Mercado Livre', 'Mercado Libre', 'Mercado Libre'),
      opt('amazon', 'Amazon', 'Amazon', 'Amazon'),
      opt('magalu', 'Magalu', 'Magalu', 'Magalu'),
      opt('shopee', 'Shopee', 'Shopee', 'Shopee'),
      opt('americanas', 'Americanas', 'Americanas', 'Americanas'),
      opt('other', 'Outro', 'Other', 'Otro'),
    ],
  },
  {
    key: 'retail.peaks', section: 'retail', tracks: RETAIL, type: 'long_text', priority: 'recomendada',
    text: t('Picos sazonais (Black Friday, Natal) e quanto o volume cresce?', 'Seasonal peaks (Black Friday, Christmas) and how much the volume grows?', '¿Picos estacionales (Black Friday, Navidad) y cuánto crece el volumen?'),
  },
  num('retail.stores', 'retail', RETAIL, U.stores, t('Quantas lojas físicas, e elas entram no atendimento?', 'How many physical stores, and are they part of support?', '¿Cuántas tiendas físicas y entran en la atención?'), [], 'recomendada',
    { help: t('Use o comentário para dizer se as lojas entram no atendimento.', 'Use the note to say whether the stores are part of support.', 'Use el comentario para indicar si las tiendas entran en la atención.') }),
  {
    key: 'retail.reclame_aqui', section: 'retail', tracks: RETAIL, type: 'long_text', priority: 'recomendada',
    text: t('Nota e status no Reclame Aqui, e quem responde hoje?', 'Reclame Aqui score and status, and who responds today?', '¿Nota y estado en Reclame Aqui, y quién responde hoy?'),
  },
];

export const TRACK_QUESTIONS: SeedQuestion[] = [
  ...AI_AGENTS_QUESTIONS, ...VOICE_QUESTIONS, ...COPILOT_QUESTIONS,
  ...ITSM_QUESTIONS, ...MIGRATION_QUESTIONS, ...RETAIL_QUESTIONS,
];
