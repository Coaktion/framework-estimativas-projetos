/**
 * Seed: as 20 seções da planilha "Zendesk Scoping Call Template" (original em inglês).
 *
 * `en` é o texto da planilha; `pt` e `es` são tradução de máquina a revisar.
 * Perguntas que só pediam uma quantidade já coberta por outro arquivo do seed
 * foram omitidas (RF-04: quantidade nunca fica em texto); o lugar delas está
 * marcado com `// substituída por <key>`.
 */

import type { ChoiceOption, I18nText } from '../types';
import type { SeedQuestion } from './types';

const TR = { en: 'reviewed', pt: 'machine', es: 'machine' } as const;

export const TEMPLATE_SECTIONS: { key: string; title: I18nText; deliverable: I18nText }[] = [
  {
    key: 'business_goals',
    title: { pt: 'Objetivos de negócio', en: 'Business Goals', es: 'Objetivos de negocio' },
    deliverable: {
      pt: 'Objetivos do projeto • Métricas de sucesso • Prioridades de negócio',
      en: 'Project objectives • Success metrics • Business priorities',
      es: 'Objetivos del proyecto • Métricas de éxito • Prioridades de negocio',
    },
  },
  {
    key: 'current_process',
    title: { pt: 'Processo atual', en: 'Current Process', es: 'Proceso actual' },
    deliverable: {
      pt: 'Mapa do fluxo atual • Requisitos do fluxo futuro',
      en: 'Current-state workflow map • Future-state workflow requirements',
      es: 'Mapa del flujo actual • Requisitos del flujo futuro',
    },
  },
  {
    key: 'teams',
    title: { pt: 'Times e estrutura', en: 'Teams & Structure', es: 'Equipos y estructura' },
    deliverable: {
      pt: 'Quantidade de agentes • Hierarquia de papéis • Estrutura de grupos',
      en: 'Agent count • Role hierarchy • Groups structure',
      es: 'Cantidad de agentes • Jerarquía de roles • Estructura de grupos',
    },
  },
  {
    key: 'channels',
    title: { pt: 'Canais', en: 'Channels', es: 'Canales' },
    deliverable: {
      pt: 'Inventário de canais • Requisitos de roteamento por canal',
      en: 'Channel inventory • Routing requirements per channel',
      es: 'Inventario de canales • Requisitos de enrutamiento por canal',
    },
  },
  {
    key: 'ticket_types',
    title: { pt: 'Tipos de ticket e casos de uso', en: 'Ticket Types & Use Cases', es: 'Tipos de ticket y casos de uso' },
    deliverable: {
      pt: 'Taxonomia de tickets • Oportunidades de automação • Casos de uso de IA',
      en: 'Ticket taxonomy • Automation opportunities • AI use cases',
      es: 'Taxonomía de tickets • Oportunidades de automatización • Casos de uso de IA',
    },
  },
  {
    key: 'forms',
    title: { pt: 'Formulários de ticket', en: 'Ticket Forms', es: 'Formularios de ticket' },
    deliverable: {
      pt: 'Inventário de formulários • Matriz de campos obrigatórios por formulário',
      en: 'Forms inventory • Required fields matrix per form',
      es: 'Inventario de formularios • Matriz de campos obligatorios por formulario',
    },
  },
  {
    key: 'fields',
    title: { pt: 'Campos de ticket', en: 'Ticket Fields', es: 'Campos de ticket' },
    deliverable: {
      pt: 'Catálogo completo de campos personalizados com tipo, obrigatoriedade e uso em relatórios',
      en: 'Complete custom field catalog with type, mandatory flag, and reporting flag',
      es: 'Catálogo completo de campos personalizados con tipo, obligatoriedad y uso en reportes',
    },
  },
  {
    key: 'routing',
    title: { pt: 'Roteamento e atribuição', en: 'Routing & Assignment', es: 'Enrutamiento y asignación' },
    deliverable: {
      pt: 'Documento da lógica de roteamento • Regras de atribuição',
      en: 'Routing logic document • Assignment rules',
      es: 'Documento de la lógica de enrutamiento • Reglas de asignación',
    },
  },
  {
    key: 'slas',
    title: { pt: 'SLAs', en: 'SLAs', es: 'SLA' },
    deliverable: {
      pt: 'Requisitos de política de SLA por prioridade',
      en: 'SLA policy requirements per priority level',
      es: 'Requisitos de política de SLA por prioridad',
    },
  },
  {
    key: 'escalation',
    title: { pt: 'Processo de escalonamento', en: 'Escalation Process', es: 'Proceso de escalamiento' },
    deliverable: {
      pt: 'Matriz de escalonamento (gatilho → time → ação)',
      en: 'Escalation matrix (trigger → team → action)',
      es: 'Matriz de escalamiento (disparador → equipo → acción)',
    },
  },
  {
    key: 'automations',
    title: { pt: 'Automações', en: 'Automations', es: 'Automatizaciones' },
    deliverable: {
      pt: 'Lista de gatilhos • Lista de automações com condições e ações',
      en: 'Trigger list • Automation list with conditions and actions',
      es: 'Lista de disparadores • Lista de automatizaciones con condiciones y acciones',
    },
  },
  {
    key: 'macros',
    title: { pt: 'Macros', en: 'Macros', es: 'Macros' },
    deliverable: {
      pt: 'Inventário de macros (nome, caso de uso, lista de ações)',
      en: 'Macro inventory (name, use case, action list)',
      es: 'Inventario de macros (nombre, caso de uso, lista de acciones)',
    },
  },
  {
    key: 'knowledge',
    title: { pt: 'Base de conhecimento e Central de Ajuda', en: 'Knowledge Base & Help Center', es: 'Base de conocimiento y Centro de ayuda' },
    deliverable: {
      pt: 'Escopo da migração de conteúdo • Arquitetura do conhecimento • Fluxo de aprovação',
      en: 'Content migration scope • Knowledge architecture • Approval workflow',
      es: 'Alcance de la migración de contenido • Arquitectura del conocimiento • Flujo de aprobación',
    },
  },
  {
    key: 'ai_agent',
    title: { pt: 'AI Agents (bot)', en: 'AI Agent (Bot)', es: 'AI Agents (bot)' },
    deliverable: {
      pt: 'Lista de casos de uso de IA • Lista de procedimentos • Lista de integrações via API para a IA',
      en: 'AI use cases list • Procedures list • API integration list for AI',
      es: 'Lista de casos de uso de IA • Lista de procedimientos • Lista de integraciones vía API para la IA',
    },
  },
  {
    key: 'integrations',
    title: { pt: 'Integrações', en: 'Integrations', es: 'Integraciones' },
    deliverable: {
      pt: 'Inventário de integrações • Complexidade de cada integração',
      en: 'Integration inventory • Complexity rating per integration',
      es: 'Inventario de integraciones • Complejidad de cada integración',
    },
  },
  {
    key: 'migration',
    title: { pt: 'Migração de dados', en: 'Data Migration', es: 'Migración de datos' },
    deliverable: {
      pt: 'Documento de escopo da migração (objetos, volume, anos, plataforma de origem)',
      en: 'Migration scope document (objects, volume, years, source platform)',
      es: 'Documento de alcance de la migración (objetos, volumen, años, plataforma de origen)',
    },
  },
  {
    key: 'reporting',
    title: { pt: 'Relatórios e Analytics', en: 'Reporting & Analytics', es: 'Reportes y Analytics' },
    deliverable: {
      pt: 'Requisitos de painéis • Lista de KPIs por público',
      en: 'Dashboard requirements • KPI list per audience',
      es: 'Requisitos de tableros • Lista de KPIs por audiencia',
    },
  },
  {
    key: 'security',
    title: { pt: 'Segurança e conformidade', en: 'Security & Compliance', es: 'Seguridad y cumplimiento' },
    deliverable: {
      pt: 'Documento de requisitos de segurança',
      en: 'Security requirements document',
      es: 'Documento de requisitos de seguridad',
    },
  },
  {
    key: 'users',
    title: { pt: 'Gestão de usuários', en: 'User Management', es: 'Gestión de usuarios' },
    deliverable: {
      pt: 'Requisitos de provisionamento de usuários',
      en: 'User provisioning requirements',
      es: 'Requisitos de aprovisionamiento de usuarios',
    },
  },
  {
    key: 'launch',
    title: { pt: 'Lançamento e gestão da mudança', en: 'Launch & Change Management', es: 'Lanzamiento y gestión del cambio' },
    deliverable: {
      pt: 'Cronograma de implantação • Escopo de treinamento • Plano de hypercare',
      en: 'Implementation timeline • Training scope • Hypercare plan',
      es: 'Cronograma de implementación • Alcance de la capacitación • Plan de hypercare',
    },
  },
];

const PRIORITY_OPTIONS: ChoiceOption[] = [
  { value: 'urgent', label: { pt: 'Urgente', en: 'Urgent', es: 'Urgente' } },
  { value: 'high', label: { pt: 'Alta', en: 'High', es: 'Alta' } },
  { value: 'normal', label: { pt: 'Normal', en: 'Normal', es: 'Normal' } },
  { value: 'low', label: { pt: 'Baixa', en: 'Low', es: 'Baja' } },
];

const CHANNEL_OPTIONS: ChoiceOption[] = [
  { value: 'email', label: { pt: 'E-mail', en: 'Email', es: 'Correo electrónico' } },
  { value: 'web_form', label: { pt: 'Formulário web', en: 'Web form', es: 'Formulario web' } },
  { value: 'chat', label: { pt: 'Chat / Messaging', en: 'Chat / Messaging', es: 'Chat / Messaging' } },
  { value: 'whatsapp', label: { pt: 'WhatsApp', en: 'WhatsApp', es: 'WhatsApp' } },
  { value: 'voice', label: { pt: 'Voz', en: 'Voice', es: 'Voz' } },
  { value: 'sms', label: { pt: 'SMS', en: 'SMS', es: 'SMS' } },
  { value: 'social', label: { pt: 'Redes sociais', en: 'Social', es: 'Redes sociales' } },
  { value: 'other', label: { pt: 'Outro', en: 'Other', es: 'Otro' } },
];

export const TEMPLATE_QUESTIONS: SeedQuestion[] = [
  // ---------------------------------------------------------------------------
  // 1. Business Goals
  // ---------------------------------------------------------------------------
  {
    key: 'core.business_goals.why_zendesk',
    section: 'business_goals',
    type: 'long_text',
    text: {
      pt: 'Por que vocês estão implantando o Zendesk?',
      en: 'Why are you implementing Zendesk?',
      es: '¿Por qué están implementando Zendesk?',
    },
    configImpact: {
      pt: 'Define o escopo do projeto e a priorização das fases de configuração.',
      en: 'Defines project scope and prioritization of configuration phases.',
      es: 'Define el alcance del proyecto y la priorización de las fases de configuración.',
    },
    priority: 'essencial',
    complexity: 'baixa',
    translation: TR,
  },
  {
    key: 'core.business_goals.problems',
    section: 'business_goals',
    type: 'long_text',
    text: {
      pt: 'Quais problemas vocês querem resolver hoje?',
      en: 'What problems are you trying to solve today?',
      es: '¿Qué problemas quieren resolver hoy?',
    },
    configImpact: {
      pt: 'Orienta o desenho de gatilhos/automações e a estratégia de canais.',
      en: 'Shapes trigger/automation design and channel strategy.',
      es: 'Orienta el diseño de disparadores/automatizaciones y la estrategia de canales.',
    },
    priority: 'essencial',
    complexity: 'baixa',
    translation: TR,
  },
  {
    key: 'core.business_goals.success_90_days',
    section: 'business_goals',
    type: 'long_text',
    text: {
      pt: 'Como é o sucesso 90 dias após o go-live?',
      en: 'What does success look like 90 days post-go-live?',
      es: '¿Cómo se ve el éxito 90 días después del go-live?',
    },
    configImpact: {
      pt: 'Direciona a configuração de KPIs nos painéis do Explore.',
      en: 'Drives KPI setup in Zendesk Explore dashboards.',
      es: 'Orienta la configuración de KPIs en los tableros de Explore.',
    },
    priority: 'essencial',
    complexity: 'baixa',
    translation: TR,
  },
  {
    key: 'core.business_goals.top_pain_points',
    section: 'business_goals',
    type: 'long_text',
    text: {
      pt: 'Quais são as 3 maiores dores com a solução atual?',
      en: 'What are your top 3 pain points with the current solution?',
      es: '¿Cuáles son los 3 principales problemas con la solución actual?',
    },
    configImpact: {
      pt: 'Informa o redesenho de fluxos, regras de automação e políticas de SLA.',
      en: 'Informs workflow redesign, automation rules, and SLA policies.',
      es: 'Informa el rediseño de flujos, reglas de automatización y políticas de SLA.',
    },
    priority: 'essencial',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.business_goals.why_leaving',
    section: 'business_goals',
    type: 'long_text',
    text: {
      pt: 'Por que vocês estão saindo da plataforma atual?',
      en: 'Why are you moving away from your current platform?',
      es: '¿Por qué están dejando la plataforma actual?',
    },
    configImpact: {
      pt: 'Sinaliza a complexidade da migração e lacunas de funcionalidade a tratar na configuração.',
      en: 'Flags migration complexity and feature gaps to address in config.',
      es: 'Señala la complejidad de la migración y las brechas de funcionalidad a resolver en la configuración.',
    },
    priority: 'recomendada',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.business_goals.outcome_response_time',
    section: 'business_goals',
    type: 'yes_no',
    text: {
      pt: 'Resultado esperado: tempos de resposta menores?',
      en: 'Expected outcome: Faster response times?',
      es: 'Resultado esperado: ¿tiempos de respuesta más rápidos?',
    },
    configImpact: {
      pt: 'Políticas de SLA, gatilhos de atribuição automática, roteamento por habilidades.',
      en: 'SLA policies, auto-assignment triggers, skills-based routing.',
      es: 'Políticas de SLA, disparadores de asignación automática, enrutamiento por habilidades.',
    },
    priority: 'recomendada',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.business_goals.outcome_cost',
    section: 'business_goals',
    type: 'yes_no',
    text: {
      pt: 'Resultado esperado: redução de custos / quadro de pessoal?',
      en: 'Expected outcome: Reduced costs / headcount?',
      es: 'Resultado esperado: ¿reducción de costos / personal?',
    },
    configImpact: {
      pt: 'Procedimentos de AI Agents (bot), biblioteca de macros, regras de automação.',
      en: 'AI Agent (bot) procedures, macro library, automation rules.',
      es: 'Procedimientos de AI Agents (bot), biblioteca de macros, reglas de automatización.',
    },
    priority: 'recomendada',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.business_goals.outcome_csat',
    section: 'business_goals',
    type: 'yes_no',
    text: {
      pt: 'Resultado esperado: melhorar o CSAT?',
      en: 'Expected outcome: Improved CSAT?',
      es: 'Resultado esperado: ¿mejorar el CSAT?',
    },
    configImpact: {
      pt: 'Pesquisa de CSAT, avaliações de satisfação, painel de CSAT no Explore.',
      en: 'CSAT survey setup, satisfaction ratings, Explore CSAT dashboard.',
      es: 'Encuesta de CSAT, calificaciones de satisfacción, tablero de CSAT en Explore.',
    },
    priority: 'recomendada',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.business_goals.outcome_reporting',
    section: 'business_goals',
    type: 'yes_no',
    text: {
      pt: 'Resultado esperado: relatórios e análises melhores?',
      en: 'Expected outcome: Better reporting & analytics?',
      es: 'Resultado esperado: ¿mejores reportes y análisis?',
    },
    configImpact: {
      pt: 'Explore: painéis personalizados, relatórios agendados, acompanhamento de KPIs.',
      en: 'Zendesk Explore — custom dashboards, scheduled reports, KPI tracking.',
      es: 'Explore: tableros personalizados, reportes programados, seguimiento de KPIs.',
    },
    priority: 'recomendada',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.business_goals.outcome_self_service',
    section: 'business_goals',
    type: 'yes_no',
    text: {
      pt: 'Resultado esperado: autoatendimento / deflexão?',
      en: 'Expected outcome: Self-service / deflection?',
      es: 'Resultado esperado: ¿autoservicio / deflexión?',
    },
    configImpact: {
      pt: 'Central de Ajuda (Guide), AI Agents, recomendação de artigos.',
      en: 'Help Center (Guide) setup, AI Agent, article recommendations.',
      es: 'Centro de ayuda (Guide), AI Agents, recomendación de artículos.',
    },
    priority: 'recomendada',
    complexity: 'alta',
    translation: TR,
  },

  // ---------------------------------------------------------------------------
  // 2. Current Process
  // ---------------------------------------------------------------------------
  {
    key: 'core.current_process.ticket_lifecycle',
    section: 'current_process',
    type: 'long_text',
    text: {
      pt: 'Descreva o ciclo de vida de um ticket do início ao fim.',
      en: 'Walk me through the lifecycle of a ticket from start to finish.',
      es: 'Describa el ciclo de vida de un ticket de principio a fin.',
    },
    configImpact: {
      pt: 'Mapeia status de ticket, grupos, gatilhos e automações no Zendesk.',
      en: 'Maps to Zendesk ticket statuses, groups, triggers, and automations.',
      es: 'Se traduce en estados de ticket, grupos, disparadores y automatizaciones en Zendesk.',
    },
    priority: 'essencial',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.current_process.contact_today',
    section: 'current_process',
    type: 'long_text',
    text: {
      pt: 'Como os clientes entram em contato com vocês hoje?',
      en: 'How do customers contact you today?',
      es: '¿Cómo los contactan los clientes hoy?',
    },
    help: {
      pt: 'Retrato do cenário atual; os canais do go-live ficam na seção Canais.',
      en: 'Current-state picture; go-live channels are captured in the Channels section.',
      es: 'Panorama actual; los canales del go-live se registran en la sección Canales.',
    },
    configImpact: {
      pt: 'Configuração de canais (e-mail, widget, telefone, redes sociais, Messaging).',
      en: 'Channel configuration (email, widget, phone, social, messaging).',
      es: 'Configuración de canales (correo, widget, teléfono, redes sociales, Messaging).',
    },
    priority: 'recomendada',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.current_process.first_touch',
    section: 'current_process',
    type: 'long_text',
    text: {
      pt: 'O que acontece no momento em que uma solicitação chega — quem a vê primeiro?',
      en: 'What happens the moment a request arrives — who sees it first?',
      es: '¿Qué pasa en el momento en que llega una solicitud? ¿Quién la ve primero?',
    },
    configImpact: {
      pt: 'Roteamento da caixa de entrada padrão, gatilhos de atribuição a grupos.',
      en: 'Default inbox routing, group assignment triggers.',
      es: 'Enrutamiento de la bandeja predeterminada, disparadores de asignación a grupos.',
    },
    priority: 'recomendada',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.current_process.escalation_today',
    section: 'current_process',
    type: 'long_text',
    text: {
      pt: 'Como os tickets são escalados hoje?',
      en: 'How are tickets escalated today?',
      es: '¿Cómo se escalan los tickets hoy?',
    },
    configImpact: {
      pt: 'Gatilhos de escalonamento, campo de prioridade do ticket, regras de roteamento por grupo.',
      en: 'Escalation triggers, ticket priority fields, group routing rules.',
      es: 'Disparadores de escalamiento, campo de prioridad del ticket, reglas de enrutamiento por grupo.',
    },
    priority: 'recomendada',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.current_process.resolution_closure',
    section: 'current_process',
    type: 'long_text',
    text: {
      pt: 'Como os tickets são resolvidos e encerrados?',
      en: 'How are tickets resolved and closed?',
      es: '¿Cómo se resuelven y cierran los tickets?',
    },
    configImpact: {
      pt: 'Regras dos status Resolvido/Fechado, automação de fechamento após N dias.',
      en: 'Solved/Closed status rules, automation for auto-close after N days.',
      es: 'Reglas de los estados Resuelto/Cerrado, automatización de cierre después de N días.',
    },
    priority: 'recomendada',
    complexity: 'baixa',
    translation: TR,
  },
  {
    key: 'core.current_process.manual_steps',
    section: 'current_process',
    type: 'long_text',
    text: {
      pt: 'Há etapas manuais que os agentes fazem fora da ferramenta atual?',
      en: 'Are there any manual steps agents do outside your current tool?',
      es: '¿Hay pasos manuales que los agentes hacen fuera de la herramienta actual?',
    },
    configImpact: {
      pt: 'Oportunidades de automação: gatilhos, macros, integrações, conversas paralelas.',
      en: 'Automation opportunities — triggers, macros, integrations, side conversations.',
      es: 'Oportunidades de automatización: disparadores, macros, integraciones, conversaciones secundarias.',
    },
    priority: 'recomendada',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.current_process.agent_lookups',
    section: 'current_process',
    type: 'long_text',
    text: {
      pt: 'Que informações os agentes consultam antes de resolver um ticket? Em quais sistemas?',
      en: 'What information do agents look up before resolving a ticket? In which systems?',
      es: '¿Qué información consultan los agentes antes de resolver un ticket? ¿En qué sistemas?',
    },
    configImpact: {
      pt: 'Integração com CRM/ERP, app na barra lateral, Lookup Relationships, Customer 360.',
      en: 'CRM/ERP integration, app sidebar, Lookup Relationships, Customer 360.',
      es: 'Integración con CRM/ERP, app en la barra lateral, Lookup Relationships, Customer 360.',
    },
    priority: 'essencial',
    complexity: 'alta',
    translation: TR,
  },

  // ---------------------------------------------------------------------------
  // 3. Teams & Structure
  // ---------------------------------------------------------------------------
  {
    key: 'core.teams.which_teams',
    section: 'teams',
    type: 'long_text',
    text: {
      pt: 'Quais times vão usar o Zendesk? (Suporte, Técnico, Financeiro, Vendas, TI, RH…)',
      en: 'Which teams will use Zendesk? (Support, Technical, Billing, Sales, IT, HR…)',
      es: '¿Qué equipos usarán Zendesk? (Soporte, Técnico, Facturación, Ventas, TI, RR. HH.…)',
    },
    configImpact: {
      pt: 'Criação de grupos — um grupo por time; regras de roteamento por grupo.',
      en: 'Group creation — one Zendesk Group per team; routing rules per group.',
      es: 'Creación de grupos: un grupo por equipo; reglas de enrutamiento por grupo.',
    },
    priority: 'essencial',
    complexity: 'media',
    translation: TR,
  },
  // "Number of agents per team?" — substituída por core.users.agents
  {
    key: 'core.teams.supervisors',
    section: 'teams',
    type: 'number',
    unit: { pt: 'supervisores', en: 'supervisors', es: 'supervisores' },
    min: 0,
    text: {
      pt: 'Quantos supervisores/líderes de equipe no total?',
      en: 'Number of supervisors/team leads (total)?',
      es: '¿Cuántos supervisores/líderes de equipo en total?',
    },
    configImpact: {
      pt: 'Papéis personalizados com permissões de supervisor (gerenciar visualizações, relatórios).',
      en: 'Custom roles with supervisor permissions (manage views, reports).',
      es: 'Roles personalizados con permisos de supervisor (gestionar vistas, reportes).',
    },
    priority: 'recomendada',
    complexity: 'baixa',
    translation: TR,
  },
  // "Number of admins needed?" — substituída por core.users.admins (seção Gestão de usuários)
  {
    key: 'core.teams.hours',
    section: 'teams',
    type: 'long_text',
    text: {
      pt: 'Qual o horário de atendimento de cada time?',
      en: 'Hours of operation per team?',
      es: '¿Cuál es el horario de atención de cada equipo?',
    },
    configImpact: {
      pt: 'Programações de horário comercial — uma por combinação de fuso horário/time.',
      en: 'Business Hours schedules — one schedule per timezone/team combo.',
      es: 'Horarios comerciales: uno por combinación de zona horaria/equipo.',
    },
    priority: 'essencial',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.teams.regions_languages',
    section: 'teams',
    type: 'long_text',
    text: {
      pt: 'Quais regiões ou idiomas cada time atende?',
      en: 'Regions or languages supported per team?',
      es: '¿Qué regiones o idiomas atiende cada equipo?',
    },
    configImpact: {
      pt: 'Roteamento por habilidades (idioma), Central de Ajuda multilíngue, conteúdo dinâmico.',
      en: 'Skills-based routing (language skill), multilingual Help Center, dynamic content.',
      es: 'Enrutamiento por habilidades (idioma), Centro de ayuda multilingüe, contenido dinámico.',
    },
    priority: 'essencial',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.teams.shared_or_separate_queues',
    section: 'teams',
    type: 'single',
    options: [
      { value: 'shared', label: { pt: 'Mesma fila', en: 'Same queue', es: 'Misma cola' } },
      { value: 'separate', label: { pt: 'Filas separadas', en: 'Different queues', es: 'Colas separadas' } },
      { value: 'mixed', label: { pt: 'Misto', en: 'Mixed', es: 'Mixto' } },
    ],
    text: {
      pt: 'Os times atendem os mesmos tickets ou filas diferentes?',
      en: 'Do teams handle the same tickets or different queues?',
      es: '¿Los equipos atienden los mismos tickets o colas diferentes?',
    },
    configImpact: {
      pt: 'Formulários de ticket e visualizações separados por time; grupos compartilhados ou dedicados.',
      en: 'Separate ticket forms and views per team; shared vs. dedicated groups.',
      es: 'Formularios de ticket y vistas separados por equipo; grupos compartidos o dedicados.',
    },
    priority: 'recomendada',
    complexity: 'media',
    translation: TR,
  },

  // ---------------------------------------------------------------------------
  // 4. Channels
  // ---------------------------------------------------------------------------
  // "Which channels will be connected at launch?" — substituída por core.channels.list
  // "Existing support email address(es) to connect?" — substituída por core.channels.email_addresses
  {
    key: 'core.channels.phone_numbers',
    section: 'channels',
    type: 'long_text',
    text: {
      pt: 'Números de telefone existentes para o Zendesk Talk? Portabilidade ou números novos?',
      en: 'Existing phone number(s) for Zendesk Talk? Port or new numbers?',
      es: '¿Números de teléfono existentes para Zendesk Talk? ¿Portabilidad o números nuevos?',
    },
    configImpact: {
      pt: 'Zendesk Talk — portar números existentes ou provisionar novos.',
      en: 'Zendesk Talk — port existing numbers or provision new ones.',
      es: 'Zendesk Talk: portar números existentes o aprovisionar nuevos.',
    },
    priority: 'recomendada',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.channels.whatsapp_account',
    section: 'channels',
    type: 'yes_no',
    text: {
      pt: 'Já existe conta do WhatsApp Business para conectar?',
      en: 'WhatsApp Business account connected?',
      es: '¿Ya existe una cuenta de WhatsApp Business para conectar?',
    },
    help: {
      pt: 'A conexão depende de aprovação da Meta, que pode atrasar o go-live.',
      en: 'The connection requires Meta approval, which can delay go-live.',
      es: 'La conexión requiere aprobación de Meta, lo que puede retrasar el go-live.',
    },
    configImpact: {
      pt: 'Messaging — conector do canal WhatsApp, exige aprovação da Meta.',
      en: 'Zendesk Messaging — WhatsApp channel connector, requires Meta approval.',
      es: 'Messaging: conector del canal WhatsApp, requiere aprobación de Meta.',
    },
    priority: 'essencial',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.channels.social_pages',
    section: 'channels',
    type: 'long_text',
    text: {
      pt: 'Páginas do Facebook / Instagram a conectar?',
      en: 'Facebook / Instagram pages to connect?',
      es: '¿Páginas de Facebook / Instagram para conectar?',
    },
    configImpact: {
      pt: 'Canais de mensagens sociais na Central de administração.',
      en: 'Social Messaging channels in Admin Center.',
      es: 'Canales de mensajería social en el Centro de administración.',
    },
    priority: 'recomendada',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.channels.volume',
    section: 'channels',
    type: 'table',
    tableColumns: [
      {
        key: 'channel', type: 'single', options: CHANNEL_OPTIONS,
        label: { pt: 'Canal', en: 'Channel', es: 'Canal' },
      },
      {
        key: 'current_monthly', type: 'number',
        label: { pt: 'Volume mensal atual', en: 'Current monthly volume', es: 'Volumen mensual actual' },
      },
      {
        key: 'expected_monthly', type: 'number',
        label: { pt: 'Volume mensal esperado após go-live', en: 'Expected monthly volume after go-live', es: 'Volumen mensual esperado tras el go-live' },
      },
    ],
    text: {
      pt: 'Volume de tickets por canal: mensal atual e esperado após o go-live.',
      en: 'Ticket volume per channel: current monthly and expected after go-live.',
      es: 'Volumen de tickets por canal: mensual actual y esperado tras el go-live.',
    },
    configImpact: {
      pt: 'Dimensiona visualizações, capacidade de roteamento e metas de SLA por canal; gatilhos por volume e visões de capacidade no Explore.',
      en: 'Sizing for views, routing capacity, and SLA targets per channel; volume-based routing triggers and Explore capacity planning.',
      es: 'Dimensiona vistas, capacidad de enrutamiento y metas de SLA por canal; disparadores por volumen y planificación de capacidad en Explore.',
    },
    priority: 'essencial',
    complexity: 'baixa',
    translation: TR,
  },
  // "Expected volume after go-live per channel?" — incorporada em core.channels.volume (coluna própria)
  {
    key: 'core.channels.channel_routing',
    section: 'channels',
    type: 'long_text',
    text: {
      pt: 'Canais diferentes devem ser roteados para times diferentes?',
      en: 'Should different channels route to different teams?',
      es: '¿Canales diferentes deben enrutarse a equipos diferentes?',
    },
    configImpact: {
      pt: 'Condições de gatilho por canal (ex.: canal = e-mail → atribuir ao Grupo A).',
      en: 'Channel-based trigger conditions (e.g., ticket.via = email → assign Group A).',
      es: 'Condiciones de disparador por canal (p. ej., canal = correo → asignar al Grupo A).',
    },
    priority: 'essencial',
    complexity: 'alta',
    translation: TR,
  },

  // ---------------------------------------------------------------------------
  // 5. Ticket Types & Use Cases
  // ---------------------------------------------------------------------------
  {
    key: 'core.ticket_types.top_categories',
    section: 'ticket_types',
    type: 'long_text',
    text: {
      pt: 'Quais são as 10 categorias de solicitação mais comuns?',
      en: 'What are the top 10 most common customer request categories?',
      es: '¿Cuáles son las 10 categorías de solicitud más comunes?',
    },
    configImpact: {
      pt: 'Campo suspenso de categoria/tipo no formulário de ticket, gatilhos de marcação automática, visualizações.',
      en: 'Ticket form drop-down field (Category/Type), auto-tagging triggers, views.',
      es: 'Campo desplegable de categoría/tipo en el formulario de ticket, disparadores de etiquetado automático, vistas.',
    },
    priority: 'essencial',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.ticket_types.top_contact_reasons',
    section: 'ticket_types',
    type: 'long_text',
    text: {
      pt: 'Quais são os 10 principais motivos de contato (mais detalhados)?',
      en: 'What are the top 10 contact reasons (more granular)?',
      es: '¿Cuáles son los 10 principales motivos de contacto (más detallados)?',
    },
    configImpact: {
      pt: 'Campo personalizado de motivo de contato, campos condicionais de subcategoria.',
      en: 'Custom ticket field (Contact Reason), sub-category conditional fields.',
      es: 'Campo personalizado de motivo de contacto, campos condicionales de subcategoría.',
    },
    priority: 'recomendada',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.ticket_types.repetitive',
    section: 'ticket_types',
    type: 'long_text',
    text: {
      pt: 'Quais tipos de solicitação são mais repetitivos / de baixa complexidade?',
      en: 'Which request types are most repetitive / low complexity?',
      es: '¿Qué tipos de solicitud son más repetitivos / de baja complejidad?',
    },
    configImpact: {
      pt: 'Procedimentos de AI Agents para deflexão; biblioteca de macros para os agentes.',
      en: 'AI Agent (bot) procedures for deflection; macro library for agents.',
      es: 'Procedimientos de AI Agents para deflexión; biblioteca de macros para los agentes.',
    },
    priority: 'essencial',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.ticket_types.common_examples',
    section: 'ticket_types',
    type: 'multi',
    options: [
      { value: 'password_reset', label: { pt: 'Redefinição de senha', en: 'Password reset', es: 'Restablecimiento de contraseña' } },
      { value: 'refund', label: { pt: 'Reembolso', en: 'Refund', es: 'Reembolso' } },
      { value: 'order_status', label: { pt: 'Status do pedido', en: 'Order status', es: 'Estado del pedido' } },
      { value: 'billing', label: { pt: 'Cobrança / faturamento', en: 'Billing', es: 'Facturación' } },
      { value: 'other', label: { pt: 'Outro', en: 'Other', es: 'Otro' } },
    ],
    text: {
      pt: 'Exemplos: redefinição de senha, reembolso, status do pedido, cobrança — quais se aplicam?',
      en: 'Examples: password reset, refund, order status, billing — which apply?',
      es: 'Ejemplos: restablecimiento de contraseña, reembolso, estado del pedido, facturación — ¿cuáles aplican?',
    },
    configImpact: {
      pt: 'Intenções/procedimentos de AI Agents; gatilhos de automação para cada caso de uso.',
      en: 'AI Agent intents/procedures; automation triggers for each use case.',
      es: 'Intenciones/procedimientos de AI Agents; disparadores de automatización para cada caso de uso.',
    },
    priority: 'recomendada',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.ticket_types.team_specific',
    section: 'ticket_types',
    type: 'long_text',
    text: {
      pt: 'Há tipos de solicitação que só determinados times podem atender?',
      en: 'Are there request types only certain teams can handle?',
      es: '¿Hay tipos de solicitud que solo ciertos equipos pueden atender?',
    },
    configImpact: {
      pt: 'Gatilhos de roteamento para grupos com base no valor do campo de tipo/categoria.',
      en: 'Group routing triggers based on ticket type/category field value.',
      es: 'Disparadores de enrutamiento a grupos según el valor del campo de tipo/categoría.',
    },
    priority: 'recomendada',
    complexity: 'media',
    translation: TR,
  },

  // ---------------------------------------------------------------------------
  // 6. Ticket Forms
  // ---------------------------------------------------------------------------
  // "Do different request types require different intake forms?" — substituída por core.forms
  {
    key: 'core.forms.names_purpose',
    section: 'forms',
    type: 'long_text',
    text: {
      pt: 'Nome e finalidade de cada formulário?',
      en: 'Form names and their purpose?',
      es: '¿Nombre y propósito de cada formulario?',
    },
    configImpact: {
      pt: 'Nome de cada formulário — exibido a usuários finais e agentes; ligado ao roteamento dos tickets.',
      en: 'Name each form — shown to end users and agents; maps to ticket routing.',
      es: 'Nombre de cada formulario: visible para usuarios finales y agentes; vinculado al enrutamiento.',
    },
    priority: 'recomendada',
    complexity: 'baixa',
    translation: TR,
  },
  {
    key: 'core.forms.required_fields',
    section: 'forms',
    type: 'long_text',
    text: {
      pt: 'Quais campos são obrigatórios e quais opcionais em cada formulário?',
      en: 'Which fields are required vs. optional per form?',
      es: '¿Qué campos son obligatorios y cuáles opcionales en cada formulario?',
    },
    configImpact: {
      pt: 'Obrigatoriedade por campo e formulário; obrigatório para agente ou para usuário final.',
      en: 'Field-level required setting per form; agent vs. end-user requirement toggle.',
      es: 'Obligatoriedad por campo y formulario; obligatorio para el agente o para el usuario final.',
    },
    priority: 'opcional',
    complexity: 'media',
    translation: TR,
  },
  // "Are there conditional fields (field B appears only if field A = X)?" — substituída por core.fields.conditional
  {
    key: 'core.forms.internal_fields',
    section: 'forms',
    type: 'yes_no',
    text: {
      pt: 'Há campos apenas internos (visíveis para agentes, não para clientes)?',
      en: "Are any fields internal-only (agents see, customers don't)?",
      es: '¿Hay campos solo internos (visibles para agentes, no para clientes)?',
    },
    configImpact: {
      pt: 'Campos só para agentes — ocultos no portal e nos formulários do widget.',
      en: 'Agent-only fields — hidden from end-user portal and web widget forms.',
      es: 'Campos solo para agentes: ocultos en el portal y en los formularios del widget.',
    },
    priority: 'opcional',
    complexity: 'media',
    translation: TR,
  },

  // ---------------------------------------------------------------------------
  // 7. Ticket Fields
  // ---------------------------------------------------------------------------
  {
    key: 'core.fields.data_to_capture',
    section: 'fields',
    type: 'long_text',
    text: {
      pt: 'Quais dados os agentes precisam registrar em todo ticket? (ID do cliente, nº do pedido, produto, região…)',
      en: 'What data must agents capture on every ticket? (Customer ID, Order #, Product, Region…)',
      es: '¿Qué datos deben registrar los agentes en cada ticket? (ID de cliente, n.º de pedido, producto, región…)',
    },
    configImpact: {
      pt: 'Campos personalizados de ticket — um por dado; definir o tipo (texto, suspenso, data).',
      en: 'Custom Ticket Fields — one field per data point; define type (text, drop-down, date).',
      es: 'Campos personalizados de ticket: uno por dato; definir el tipo (texto, desplegable, fecha).',
    },
    priority: 'recomendada',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.fields.field_types',
    section: 'fields',
    type: 'long_text',
    text: {
      pt: 'Tipo de cada campo? (Texto, Suspenso, Caixa de seleção, Data, Número, Lookup)',
      en: 'Field type for each? (Text, Drop-down, Checkbox, Date, Number, Lookup)',
      es: '¿Tipo de cada campo? (Texto, Desplegable, Casilla, Fecha, Número, Búsqueda)',
    },
    configImpact: {
      pt: 'O tipo define a capacidade de busca/filtro e as dimensões de relatório no Explore.',
      en: 'Field type determines search/filter capability and Explore reporting dimensions.',
      es: 'El tipo define la capacidad de búsqueda/filtro y las dimensiones de reporte en Explore.',
    },
    priority: 'opcional',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.fields.required_to_solve',
    section: 'fields',
    type: 'long_text',
    text: {
      pt: 'Quais campos são obrigatórios antes de o agente resolver o ticket?',
      en: 'Which fields are mandatory before agents can solve a ticket?',
      es: '¿Qué campos son obligatorios antes de que el agente resuelva el ticket?',
    },
    configImpact: {
      pt: 'Opção "Obrigatório para resolver" por campo — validada ao resolver o ticket.',
      en: "'Required to solve' toggle per field — enforced at ticket solve time.",
      es: 'Opción "Obligatorio para resolver" por campo: se valida al resolver el ticket.',
    },
    priority: 'recomendada',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.fields.editable_after_creation',
    section: 'fields',
    type: 'long_text',
    text: {
      pt: 'Quais campos os agentes podem editar depois da criação do ticket?',
      en: 'Which fields should agents be able to edit after ticket creation?',
      es: '¿Qué campos pueden editar los agentes después de crear el ticket?',
    },
    configImpact: {
      pt: 'Campo editável ou somente leitura; alguns campos bloqueados após a criação.',
      en: 'Editable vs. read-only field setting; some fields locked post-creation.',
      es: 'Campo editable o de solo lectura; algunos campos bloqueados tras la creación.',
    },
    priority: 'opcional',
    complexity: 'baixa',
    translation: TR,
  },
  {
    key: 'core.fields.reporting_fields',
    section: 'fields',
    type: 'long_text',
    text: {
      pt: 'Quais campos serão usados em painéis e relatórios?',
      en: 'Which fields will be reported on in dashboards?',
      es: '¿Qué campos se usarán en tableros y reportes?',
    },
    configImpact: {
      pt: 'Os campos precisam estar disponíveis no Explore — via tags ou atributos personalizados.',
      en: 'Fields must be indexed for Explore — tag-based or custom attribute setup.',
      es: 'Los campos deben estar disponibles en Explore: vía etiquetas o atributos personalizados.',
    },
    priority: 'recomendada',
    complexity: 'media',
    translation: TR,
  },

  // ---------------------------------------------------------------------------
  // 8. Routing & Assignment
  // ---------------------------------------------------------------------------
  {
    key: 'core.routing.criteria',
    section: 'routing',
    type: 'multi',
    options: [
      { value: 'product', label: { pt: 'Produto', en: 'Product', es: 'Producto' } },
      { value: 'language', label: { pt: 'Idioma', en: 'Language', es: 'Idioma' } },
      { value: 'country', label: { pt: 'País', en: 'Country', es: 'País' } },
      { value: 'priority', label: { pt: 'Prioridade', en: 'Priority', es: 'Prioridad' } },
      { value: 'customer_tier', label: { pt: 'Segmento do cliente', en: 'Customer tier', es: 'Segmento del cliente' } },
      { value: 'other', label: { pt: 'Outro', en: 'Other', es: 'Otro' } },
    ],
    text: {
      pt: 'Como os tickets devem ser roteados — por produto, idioma, país, prioridade ou segmento do cliente?',
      en: 'How should tickets be routed — by product, language, country, priority, or customer tier?',
      es: '¿Cómo deben enrutarse los tickets: por producto, idioma, país, prioridad o segmento del cliente?',
    },
    configImpact: {
      pt: 'Condições de gatilho (tags, campos da organização, campos personalizados) → atribuição a grupo.',
      en: 'Trigger conditions (ticket.tags, org fields, custom fields) → Group assignment.',
      es: 'Condiciones de disparador (etiquetas, campos de organización, campos personalizados) → asignación a grupo.',
    },
    priority: 'essencial',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.routing.assignment_model',
    section: 'routing',
    type: 'single',
    options: [
      { value: 'round_robin', label: { pt: 'Distribuição automática (round robin)', en: 'Round robin', es: 'Distribución automática (round robin)' } },
      { value: 'direct', label: { pt: 'Atribuição direta a um agente', en: 'Direct assignment to a specific agent', es: 'Asignación directa a un agente' } },
      { value: 'manual', label: { pt: 'Agente puxa da fila', en: 'Agents pick from the queue', es: 'El agente toma de la cola' } },
      { value: 'mixed', label: { pt: 'Misto', en: 'Mixed', es: 'Mixto' } },
    ],
    text: {
      pt: 'Distribuição automática (round robin) ou atribuição direta a um agente específico?',
      en: 'Round robin assignment or direct assignment to a specific agent?',
      es: '¿Distribución automática (round robin) o asignación directa a un agente específico?',
    },
    configImpact: {
      pt: 'Roteamento omnicanal (round robin) ou atribuição direta por gatilho.',
      en: 'Omnichannel Routing (round robin) or trigger-based direct assignment.',
      es: 'Enrutamiento omnicanal (round robin) o asignación directa por disparador.',
    },
    priority: 'essencial',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.routing.skills_detail',
    section: 'routing',
    type: 'long_text',
    text: {
      pt: 'É preciso roteamento por habilidades? Quais (ex.: idioma, especialidade em produto)?',
      en: 'Skill-based routing needed? Which skills (e.g., language, product expertise)?',
      es: '¿Se necesita enrutamiento por habilidades? ¿Cuáles (p. ej., idioma, especialidad en producto)?',
    },
    help: {
      pt: 'A quantidade de habilidades fica em core.skills; aqui, quais são.',
      en: 'The number of skills is captured in core.skills; here, which ones.',
      es: 'La cantidad de habilidades se registra en core.skills; aquí, cuáles son.',
    },
    configImpact: {
      pt: 'Habilidades do Zendesk — atribuídas aos agentes; o roteamento casa a habilidade exigida.',
      en: 'Zendesk Skills — assign skills to agents; routing uses skill-match logic.',
      es: 'Habilidades de Zendesk: se asignan a los agentes; el enrutamiento busca coincidencia de habilidades.',
    },
    priority: 'recomendada',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.routing.vip_team',
    section: 'routing',
    type: 'yes_no',
    text: {
      pt: 'Clientes VIP/corporativos devem ir sempre para um time dedicado?',
      en: 'Should VIP/enterprise customers always go to a dedicated team?',
      es: '¿Los clientes VIP/corporativos deben ir siempre a un equipo dedicado?',
    },
    configImpact: {
      pt: 'Campo de organização (segmento) + gatilho: se segmento = VIP → atribuir ao grupo premium.',
      en: 'Organization field (Customer Tier) + trigger: if tier = VIP → assign premium group.',
      es: 'Campo de organización (segmento) + disparador: si segmento = VIP → asignar al grupo premium.',
    },
    priority: 'recomendada',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.routing.account_ownership',
    section: 'routing',
    type: 'yes_no',
    text: {
      pt: 'Existe modelo de carteira (um agente é dono da conta)?',
      en: 'Any dedicated ownership model (one agent owns an account)?',
      es: '¿Existe un modelo de cartera (un agente es dueño de la cuenta)?',
    },
    configImpact: {
      pt: 'Campo de agente responsável na organização; gatilho atribui automaticamente pela organização.',
      en: 'Organization → Assigned Agent field; trigger auto-assigns on org match.',
      es: 'Campo de agente responsable en la organización; el disparador asigna automáticamente según la organización.',
    },
    priority: 'opcional',
    complexity: 'media',
    translation: TR,
  },

  // ---------------------------------------------------------------------------
  // 9. SLAs
  // ---------------------------------------------------------------------------
  {
    key: 'core.slas.existing',
    section: 'slas',
    type: 'yes_no',
    text: {
      pt: 'Vocês têm compromissos de SLA hoje (contratuais ou internos)?',
      en: 'Do you have SLA commitments today (contractual or internal)?',
      es: '¿Tienen compromisos de SLA hoy (contractuales o internos)?',
    },
    configImpact: {
      pt: 'Políticas de SLA na Central de administração; várias políticas para diferentes segmentos de cliente.',
      en: 'SLA Policies in Admin Center; multiple policies for different customer tiers.',
      es: 'Políticas de SLA en el Centro de administración; varias políticas para distintos segmentos de cliente.',
    },
    priority: 'essencial',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.slas.targets',
    section: 'slas',
    type: 'table',
    tableColumns: [
      {
        key: 'priority', type: 'single', options: PRIORITY_OPTIONS,
        label: { pt: 'Prioridade', en: 'Priority', es: 'Prioridad' },
      },
      {
        key: 'first_reply', type: 'text', maxLength: 60,
        label: { pt: 'Meta de primeira resposta', en: 'First reply time target', es: 'Meta de primera respuesta' },
      },
      {
        key: 'resolution', type: 'text', maxLength: 60,
        label: { pt: 'Meta de resolução', en: 'Resolution time target', es: 'Meta de resolución' },
      },
    ],
    text: {
      pt: 'Metas de primeira resposta e de resolução por prioridade (Urgente / Alta / Normal / Baixa)?',
      en: 'First Reply Time and Resolution Time targets per priority? (Urgent / High / Normal / Low)',
      es: '¿Metas de primera respuesta y de resolución por prioridad (Urgente / Alta / Normal / Baja)?',
    },
    configImpact: {
      pt: 'Métricas de primeira resposta (inicia na criação do ticket) e de resolução (pausa em Pendente) na política de SLA.',
      en: 'FRT metric in SLA policy (clock starts on ticket creation); Resolution Time metric (pauses on Pending status).',
      es: 'Métricas de primera respuesta (inicia al crear el ticket) y de resolución (se pausa en Pendiente) en la política de SLA.',
    },
    showIf: { questionKey: 'core.slas.existing', equals: 'sim' },
    priority: 'recomendada',
    complexity: 'media',
    translation: TR,
  },
  // "Resolution Time target per priority?" — incorporada em core.slas.targets (coluna própria)
  {
    key: 'core.slas.hours_basis',
    section: 'slas',
    type: 'single',
    options: [
      { value: 'business', label: { pt: 'Horário comercial', en: 'Business hours', es: 'Horario comercial' } },
      { value: 'calendar', label: { pt: 'Horas corridas (24/7)', en: 'Calendar hours (24/7)', es: 'Horas corridas (24/7)' } },
      { value: 'mixed', label: { pt: 'Depende da política', en: 'Depends on the policy', es: 'Depende de la política' } },
    ],
    text: {
      pt: 'O SLA é medido em horário comercial ou em horas corridas?',
      en: 'Business hours or calendar hours for SLA measurement?',
      es: '¿El SLA se mide en horario comercial o en horas corridas?',
    },
    configImpact: {
      pt: 'Política de SLA ligada a uma programação de horário comercial ou a horas corridas 24/7.',
      en: 'SLA policy linked to Business Hours schedule or 24/7 calendar hours.',
      es: 'Política de SLA vinculada a un horario comercial o a horas corridas 24/7.',
    },
    priority: 'recomendada',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.slas.by_tier_or_channel',
    section: 'slas',
    type: 'long_text',
    text: {
      pt: 'Há metas de SLA diferentes por segmento de cliente ou por canal?',
      en: 'Different SLA targets for different customer tiers or channels?',
      es: '¿Hay metas de SLA diferentes por segmento de cliente o por canal?',
    },
    configImpact: {
      pt: 'Várias políticas de SLA com condições (segmento da organização, canal, prioridade).',
      en: 'Multiple SLA policies with trigger conditions (org tier, channel, priority).',
      es: 'Varias políticas de SLA con condiciones (segmento de la organización, canal, prioridad).',
    },
    priority: 'recomendada',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.slas.breach_handling',
    section: 'slas',
    type: 'multi',
    options: [
      { value: 'alert', label: { pt: 'Alertar', en: 'Alert', es: 'Alertar' } },
      { value: 'escalate', label: { pt: 'Escalar', en: 'Escalate', es: 'Escalar' } },
      { value: 'auto_prioritize', label: { pt: 'Aumentar a prioridade', en: 'Auto-prioritize', es: 'Aumentar la prioridad' } },
      { value: 'nothing', label: { pt: 'Nada', en: 'Nothing', es: 'Nada' } },
    ],
    text: {
      pt: 'O que fazer quando o SLA for violado — alertar, escalar, aumentar a prioridade?',
      en: 'How should SLA breach be handled — alert, escalate, auto-prioritize?',
      es: '¿Qué hacer cuando se incumple el SLA: alertar, escalar, aumentar la prioridad?',
    },
    configImpact: {
      pt: 'Gatilhos de violação de SLA → notificar supervisor, mudar prioridade, enviar alerta.',
      en: 'SLA breach triggers → notify supervisor, change priority, send alert.',
      es: 'Disparadores por incumplimiento de SLA → notificar al supervisor, cambiar prioridad, enviar alerta.',
    },
    priority: 'recomendada',
    complexity: 'alta',
    translation: TR,
  },

  // ---------------------------------------------------------------------------
  // 10. Escalation Process
  // ---------------------------------------------------------------------------
  {
    key: 'core.escalation.triggers',
    section: 'escalation',
    type: 'multi',
    options: [
      { value: 'sla_breach', label: { pt: 'Violação de SLA', en: 'SLA breach', es: 'Incumplimiento de SLA' } },
      { value: 'complexity', label: { pt: 'Complexidade', en: 'Complexity', es: 'Complejidad' } },
      { value: 'customer_tier', label: { pt: 'Segmento do cliente', en: 'Customer tier', es: 'Segmento del cliente' } },
      { value: 'sentiment', label: { pt: 'Sentimento', en: 'Sentiment', es: 'Sentimiento' } },
      { value: 'other', label: { pt: 'Outro', en: 'Other', es: 'Otro' } },
    ],
    text: {
      pt: 'O que dispara um escalonamento? (violação de SLA, complexidade, segmento do cliente, sentimento)',
      en: 'What triggers an escalation? (SLA breach, complexity, customer tier, sentiment)',
      es: '¿Qué provoca un escalamiento? (incumplimiento de SLA, complejidad, segmento del cliente, sentimiento)',
    },
    configImpact: {
      pt: 'Condições dos gatilhos de escalonamento — mudança de prioridade, tag adicionada, tempo decorrido.',
      en: 'Escalation trigger conditions — priority change, tag added, time elapsed.',
      es: 'Condiciones de los disparadores de escalamiento: cambio de prioridad, etiqueta agregada, tiempo transcurrido.',
    },
    priority: 'essencial',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.escalation.technical',
    section: 'escalation',
    type: 'long_text',
    text: {
      pt: 'Escalonamento técnico — quem recebe e como é notificado?',
      en: 'Technical escalation — who receives and how are they notified?',
      es: 'Escalamiento técnico: ¿quién lo recibe y cómo se le notifica?',
    },
    configImpact: {
      pt: 'Atribuição a grupo de nível 2/3; gatilho de notificação por e-mail ou conversa paralela.',
      en: 'Group assignment to Tier 2/3 group; email notification trigger or side conversation.',
      es: 'Asignación a grupo de nivel 2/3; disparador de notificación por correo o conversación secundaria.',
    },
    priority: 'recomendada',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.escalation.manager',
    section: 'escalation',
    type: 'long_text',
    text: {
      pt: 'Escalonamento para gestor — critérios e forma de notificação?',
      en: 'Manager escalation — criteria and notification method?',
      es: 'Escalamiento a gerente: ¿criterios y forma de notificación?',
    },
    configImpact: {
      pt: 'Gatilho: se tag = escalonamento-gestor → notificar supervisor por e-mail/Slack.',
      en: 'Trigger: if tag = manager-escalation → notify supervisor via email/Slack.',
      es: 'Disparador: si etiqueta = escalamiento-gerente → notificar al supervisor por correo/Slack.',
    },
    priority: 'recomendada',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.escalation.engineering',
    section: 'escalation',
    type: 'long_text',
    text: {
      pt: 'Escalonamento para engenharia/produto — envolve Jira ou ferramenta interna?',
      en: 'Engineering / product escalation — Jira or internal tool involved?',
      es: 'Escalamiento a ingeniería/producto: ¿involucra Jira o una herramienta interna?',
    },
    configImpact: {
      pt: 'Integração com Jira (ou conversa paralela para ticket interno) para escalonamento de bugs.',
      en: 'Jira integration (or side conversation to internal ticket) for bug escalations.',
      es: 'Integración con Jira (o conversación secundaria a ticket interno) para escalamiento de errores.',
    },
    priority: 'recomendada',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.escalation.formal_sla',
    section: 'escalation',
    type: 'yes_no',
    text: {
      pt: 'Existe um SLA formal de escalonamento (ex.: reconhecer em até 1 h)?',
      en: 'Is there a formal escalation SLA (e.g., must acknowledge within 1hr)?',
      es: '¿Existe un SLA formal de escalamiento (p. ej., confirmar en menos de 1 h)?',
    },
    configImpact: {
      pt: 'Política de SLA separada para tickets escalados; exige tag de escalonamento.',
      en: 'Nested SLA policy or separate SLA for escalated tickets; escalation tag required.',
      es: 'Política de SLA separada para tickets escalados; requiere etiqueta de escalamiento.',
    },
    priority: 'opcional',
    complexity: 'alta',
    translation: TR,
  },

  // ---------------------------------------------------------------------------
  // 11. Automations
  // ---------------------------------------------------------------------------
  {
    key: 'core.automations.repetitive_work',
    section: 'automations',
    type: 'long_text',
    text: {
      pt: 'Que trabalho repetitivo o Zendesk deve automatizar?',
      en: 'What repetitive work should Zendesk automate?',
      es: '¿Qué trabajo repetitivo debe automatizar Zendesk?',
    },
    configImpact: {
      pt: 'Gatilhos (tempo real) e automações (por tempo) — um por caso de uso.',
      en: 'Zendesk Triggers (real-time) and Automations (time-based) — one per use case.',
      es: 'Disparadores (tiempo real) y automatizaciones (por tiempo): uno por caso de uso.',
    },
    priority: 'recomendada',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.automations.auto_assign',
    section: 'automations',
    type: 'yes_no',
    text: {
      pt: 'Atribuir tickets automaticamente conforme o canal ou o formulário de entrada?',
      en: 'Auto-assign tickets based on incoming channel or form?',
      es: '¿Asignar tickets automáticamente según el canal o el formulario de entrada?',
    },
    configImpact: {
      pt: 'Gatilho: ticket criado + condição de canal/formulário → definir grupo/responsável.',
      en: 'Trigger: ticket created + channel/form condition → set group/assignee.',
      es: 'Disparador: ticket creado + condición de canal/formulario → definir grupo/responsable.',
    },
    priority: 'recomendada',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.automations.auto_tag',
    section: 'automations',
    type: 'yes_no',
    text: {
      pt: 'Marcar tickets automaticamente com base em palavras-chave ou no assunto?',
      en: 'Auto-tag tickets based on keywords or subject line?',
      es: '¿Etiquetar tickets automáticamente según palabras clave o el asunto?',
    },
    configImpact: {
      pt: 'Gatilho: assunto contém palavra-chave → adicionar tag; permite roteamento posterior.',
      en: 'Trigger: subject contains keyword → add tag; enables downstream routing.',
      es: 'Disparador: el asunto contiene una palabra clave → agregar etiqueta; habilita el enrutamiento posterior.',
    },
    priority: 'opcional',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.automations.auto_close',
    section: 'automations',
    type: 'yes_no',
    text: {
      pt: 'Fechar tickets automaticamente após X dias sem atividade? Quantos dias?',
      en: 'Auto-close tickets after X days of inactivity? How many days?',
      es: '¿Cerrar tickets automáticamente tras X días sin actividad? ¿Cuántos días?',
    },
    configImpact: {
      pt: 'Automação: status = pendente + horas desde a atualização > X → resolver/fechar.',
      en: 'Automation: ticket status = pending + hours since update > X → solve/close.',
      es: 'Automatización: estado = pendiente + horas desde la actualización > X → resolver/cerrar.',
    },
    priority: 'recomendada',
    complexity: 'baixa',
    translation: TR,
  },
  {
    key: 'core.automations.auto_escalate',
    section: 'automations',
    type: 'yes_no',
    text: {
      pt: 'Escalar automaticamente por tempo ou por violação de prioridade?',
      en: 'Auto-escalate based on time or priority breach?',
      es: '¿Escalar automáticamente por tiempo o por incumplimiento de prioridad?',
    },
    configImpact: {
      pt: 'Automação: prioridade = urgente + horas desde a criação > X → notificar/escalar.',
      en: 'Automation: ticket priority = urgent + hours since creation > X → notify/escalate.',
      es: 'Automatización: prioridad = urgente + horas desde la creación > X → notificar/escalar.',
    },
    priority: 'recomendada',
    complexity: 'alta',
    translation: TR,
  },
  // "Auto-send satisfaction survey on solve?" — substituída por core.csat
  {
    key: 'core.automations.auto_prioritize',
    section: 'automations',
    type: 'yes_no',
    text: {
      pt: 'Priorizar automaticamente com base no segmento do cliente ou em palavras-chave?',
      en: 'Auto-prioritize based on customer tier or keywords?',
      es: '¿Priorizar automáticamente según el segmento del cliente o palabras clave?',
    },
    configImpact: {
      pt: 'Gatilho: campo da organização segmento = Enterprise → prioridade = Alta.',
      en: 'Trigger: org field customer_tier = Enterprise → set priority = High.',
      es: 'Disparador: campo de organización segmento = Enterprise → prioridad = Alta.',
    },
    priority: 'opcional',
    complexity: 'media',
    translation: TR,
  },

  // ---------------------------------------------------------------------------
  // 12. Macros
  // ---------------------------------------------------------------------------
  {
    key: 'core.macros.canned_today',
    section: 'macros',
    type: 'yes_no',
    text: {
      pt: 'Os agentes usam respostas prontas ou modelos de e-mail hoje?',
      en: 'Do agents use canned responses or email templates today?',
      es: '¿Los agentes usan respuestas predefinidas o plantillas de correo hoy?',
    },
    configImpact: {
      pt: 'Macros no Zendesk — uma por modelo; podem definir campos e enviar resposta.',
      en: 'Macros in Zendesk — one macro per template; can set fields + send reply.',
      es: 'Macros en Zendesk: una por plantilla; pueden definir campos y enviar respuesta.',
    },
    priority: 'recomendada',
    complexity: 'baixa',
    translation: TR,
  },
  {
    key: 'core.macros.top_replies',
    section: 'macros',
    type: 'long_text',
    text: {
      pt: 'Quais são as respostas mais comuns que os agentes enviam? (Top 10)',
      en: 'What are the most common replies agents send? (Top 10)',
      es: '¿Cuáles son las respuestas más comunes que envían los agentes? (Top 10)',
    },
    configImpact: {
      pt: 'Montar a biblioteca de macros; agrupar por time/categoria para facilitar a busca.',
      en: 'Build macro library; group macros by team/category for easy lookup.',
      es: 'Armar la biblioteca de macros; agruparlas por equipo/categoría para facilitar la búsqueda.',
    },
    priority: 'recomendada',
    complexity: 'baixa',
    translation: TR,
  },
  {
    key: 'core.macros.sops_to_migrate',
    section: 'macros',
    type: 'yes_no',
    text: {
      pt: 'Existem procedimentos (SOPs) ou roteiros de resposta a migrar?',
      en: 'Do you have existing SOPs or response scripts to migrate?',
      es: '¿Existen procedimientos (SOP) o guiones de respuesta para migrar?',
    },
    configImpact: {
      pt: 'Converter SOPs em macros + modelos de nota interna; vincular a artigos da Central de Ajuda.',
      en: 'Convert SOPs to macros + internal note templates; link to Help Center articles.',
      es: 'Convertir SOP en macros + plantillas de nota interna; vincular a artículos del Centro de ayuda.',
    },
    priority: 'recomendada',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.macros.visibility',
    section: 'macros',
    type: 'single',
    options: [
      { value: 'all', label: { pt: 'Todos os agentes', en: 'All agents', es: 'Todos los agentes' } },
      { value: 'team', label: { pt: 'Por time', en: 'Team-specific', es: 'Por equipo' } },
      { value: 'mixed', label: { pt: 'Misto', en: 'Mixed', es: 'Mixto' } },
    ],
    text: {
      pt: 'As macros devem estar disponíveis para todos os agentes ou por time?',
      en: 'Should some macros be available to all agents, or team-specific?',
      es: '¿Las macros deben estar disponibles para todos los agentes o por equipo?',
    },
    configImpact: {
      pt: 'Visibilidade da macro: pessoal, por grupo ou todos os agentes.',
      en: 'Macro visibility: personal, group-specific, or all agents.',
      es: 'Visibilidad de la macro: personal, por grupo o todos los agentes.',
    },
    priority: 'opcional',
    complexity: 'baixa',
    translation: TR,
  },
  {
    key: 'core.macros.update_fields',
    section: 'macros',
    type: 'yes_no',
    text: {
      pt: 'Há macros que também devem atualizar campos ou tags do ticket?',
      en: 'Are there macros that should also update ticket fields or tags?',
      es: '¿Hay macros que también deben actualizar campos o etiquetas del ticket?',
    },
    configImpact: {
      pt: 'Ações da macro: definir valor de campo, adicionar tag, mudar status — encadear com gatilhos.',
      en: 'Macro actions: set field value, add tag, change status — chain with triggers.',
      es: 'Acciones de la macro: definir valor de campo, agregar etiqueta, cambiar estado; encadenar con disparadores.',
    },
    priority: 'opcional',
    complexity: 'media',
    translation: TR,
  },

  // ---------------------------------------------------------------------------
  // 13. Knowledge Base & Help Center
  // ---------------------------------------------------------------------------
  {
    key: 'core.knowledge.existing_docs',
    section: 'knowledge',
    type: 'yes_no',
    text: {
      pt: 'Existe documentação a migrar? (artigos, FAQs, PDFs, conteúdo do site)',
      en: 'Do you have existing documentation to migrate? (Articles, FAQs, PDFs, website content)',
      es: '¿Existe documentación para migrar? (artículos, preguntas frecuentes, PDF, contenido del sitio)',
    },
    configImpact: {
      pt: 'Configuração do Guide; ferramenta de migração de conteúdo ou importação manual; formatação dos artigos.',
      en: 'Guide setup; content migration tool or manual import; article formatting.',
      es: 'Configuración de Guide; herramienta de migración de contenido o importación manual; formato de artículos.',
    },
    priority: 'recomendada',
    complexity: 'media',
    translation: TR,
  },
  // "How many articles approximately?" — substituída por core.knowledge.articles
  {
    key: 'core.knowledge.content_owner',
    section: 'knowledge',
    type: 'short_text',
    text: {
      pt: 'Quem é dono e mantém o conteúdo da Central de Ajuda?',
      en: 'Who owns and maintains Help Center content?',
      es: '¿Quién es dueño y mantiene el contenido del Centro de ayuda?',
    },
    configImpact: {
      pt: 'Atribuição do papel de gerente do Guide; fluxo de publicação (rascunho → revisão → publicado).',
      en: 'Guide Manager role assignment; publishing workflow (draft → review → publish).',
      es: 'Asignación del rol de administrador de Guide; flujo de publicación (borrador → revisión → publicado).',
    },
    priority: 'recomendada',
    complexity: 'baixa',
    translation: TR,
  },
  {
    key: 'core.knowledge.languages',
    section: 'knowledge',
    type: 'long_text',
    text: {
      pt: 'Quais idiomas a Central de Ajuda precisa ter?',
      en: 'Languages needed for Help Center?',
      es: '¿Qué idiomas necesita el Centro de ayuda?',
    },
    configImpact: {
      pt: 'Central de Ajuda multilíngue; conteúdo dinâmico para e-mails automáticos.',
      en: 'Multilingual Help Center setup; dynamic content for automated emails.',
      es: 'Centro de ayuda multilingüe; contenido dinámico para correos automáticos.',
    },
    priority: 'recomendada',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.knowledge.approval_process',
    section: 'knowledge',
    type: 'yes_no',
    text: {
      pt: 'Existe processo de aprovação antes de os artigos serem publicados?',
      en: 'Is there an approval process before articles go live?',
      es: '¿Existe un proceso de aprobación antes de publicar los artículos?',
    },
    configImpact: {
      pt: 'Fluxo de artigos do Guide — rascunho, aguardando revisão, publicado; papel de revisor.',
      en: 'Guide article workflow — draft, pending review, published states; reviewer role.',
      es: 'Flujo de artículos de Guide: borrador, pendiente de revisión, publicado; rol de revisor.',
    },
    priority: 'opcional',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.knowledge.access',
    section: 'knowledge',
    type: 'single',
    options: [
      { value: 'public', label: { pt: 'Pública', en: 'Public', es: 'Público' } },
      { value: 'gated', label: { pt: 'Restrita (exige login)', en: 'Gated (login required)', es: 'Restringido (requiere inicio de sesión)' } },
      { value: 'mixed', label: { pt: 'Mista (parte pública, parte restrita)', en: 'Mixed', es: 'Mixto (parte pública, parte restringida)' } },
    ],
    text: {
      pt: 'A Central de Ajuda deve ser pública ou restrita (exigir login)?',
      en: 'Should Help Center be public or gated (login required)?',
      es: '¿El Centro de ayuda debe ser público o restringido (requerir inicio de sesión)?',
    },
    configImpact: {
      pt: 'Configuração de acesso da Central de Ajuda — aberta a todos ou só usuários conectados.',
      en: 'Help Center access settings — open to anyone vs. signed-in users only.',
      es: 'Configuración de acceso del Centro de ayuda: abierto a todos o solo usuarios registrados.',
    },
    priority: 'recomendada',
    complexity: 'baixa',
    translation: TR,
  },
  {
    key: 'core.knowledge.ai_uses_articles',
    section: 'knowledge',
    type: 'yes_no',
    text: {
      pt: 'A IA vai usar os artigos da Central de Ajuda para responder clientes?',
      en: 'Will AI use Help Center articles to answer customer questions?',
      es: '¿La IA usará los artículos del Centro de ayuda para responder a los clientes?',
    },
    configImpact: {
      pt: 'AI Agents conectados ao Guide — artigos precisam estar publicados e bem marcados.',
      en: 'AI Agent connected to Guide — articles must be published and tagged correctly.',
      es: 'AI Agents conectados a Guide: los artículos deben estar publicados y bien etiquetados.',
    },
    priority: 'recomendada',
    complexity: 'alta',
    translation: TR,
  },

  // ---------------------------------------------------------------------------
  // 14. AI Agent (Bot) — trilha product.ai_agents
  // ---------------------------------------------------------------------------
  // "What customer questions could AI resolve without a human agent?" — substituída por ai.usecases
  // "Top repetitive questions: order status, password reset, billing, scheduling?" — substituída por ai.usecases
  {
    key: 'core.ai_agent.systems',
    section: 'ai_agent',
    tracks: ['product.ai_agents'],
    type: 'long_text',
    text: {
      pt: 'Quais sistemas a IA precisaria acessar? (Shopify, Salesforce, NetSuite, ERP, CRM)',
      en: 'What systems would AI need to access? (Shopify, Salesforce, NetSuite, ERP, CRM)',
      es: '¿Qué sistemas necesitaría consultar la IA? (Shopify, Salesforce, NetSuite, ERP, CRM)',
    },
    configImpact: {
      pt: 'Integrações via API do AI Agent — cada sistema exige uma ação de API configurada.',
      en: 'AI Agent API integrations — each system needs an API action configured.',
      es: 'Integraciones vía API del AI Agent: cada sistema requiere una acción de API configurada.',
    },
    priority: 'essencial',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.ai_agent.handoff',
    section: 'ai_agent',
    tracks: ['product.ai_agents'],
    type: 'long_text',
    text: {
      pt: 'O que deve acontecer quando a IA não resolver — transferência para um agente?',
      en: 'What should happen when AI cannot resolve — handoff to agent?',
      es: '¿Qué debe pasar cuando la IA no resuelva? ¿Transferencia a un agente?',
    },
    configImpact: {
      pt: 'Fluxo de transbordo: intenção "falar com atendente" → criar ticket → atribuir ao grupo.',
      en: "AI escalation flow: 'Talk to agent' intent → create ticket → assign group.",
      es: 'Flujo de transferencia: intención "hablar con un agente" → crear ticket → asignar al grupo.',
    },
    priority: 'essencial',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.ai_agent.persona',
    section: 'ai_agent',
    tracks: ['product.ai_agents'],
    type: 'long_text',
    text: {
      pt: 'Que tom/persona o bot deve usar?',
      en: 'What tone/persona should the AI bot use?',
      es: '¿Qué tono/persona debe usar el bot?',
    },
    configImpact: {
      pt: 'Configuração de persona do AI Agent — nome do bot, saudação, mensagem de fallback.',
      en: 'AI Agent persona settings — bot name, greeting, fallback message.',
      es: 'Configuración de persona del AI Agent: nombre del bot, saludo, mensaje de respaldo.',
    },
    priority: 'opcional',
    complexity: 'baixa',
    translation: TR,
  },
  {
    key: 'core.ai_agent.bot_before_form',
    section: 'ai_agent',
    tracks: ['product.ai_agents'],
    type: 'yes_no',
    text: {
      pt: 'O bot deve tentar responder antes de exibir o formulário de contato?',
      en: 'Should the bot attempt to answer before showing the contact form?',
      es: '¿El bot debe intentar responder antes de mostrar el formulario de contacto?',
    },
    configImpact: {
      pt: 'Fluxo do widget da Central de Ajuda: buscar artigos → bot → formulário como último recurso.',
      en: 'Help Center widget flow: search articles → show bot → offer form as last resort.',
      es: 'Flujo del widget del Centro de ayuda: buscar artículos → bot → formulario como último recurso.',
    },
    priority: 'recomendada',
    complexity: 'media',
    translation: TR,
  },

  // ---------------------------------------------------------------------------
  // 15. Integrations
  // ---------------------------------------------------------------------------
  {
    key: 'core.integrations.systems',
    section: 'integrations',
    type: 'long_text',
    text: {
      pt: 'Quais sistemas precisam se integrar ao Zendesk? (CRM, ERP, cobrança, e-commerce…)',
      en: 'Which systems need to integrate with Zendesk? (CRM, ERP, billing, e-commerce…)',
      es: '¿Qué sistemas deben integrarse con Zendesk? (CRM, ERP, facturación, e-commerce…)',
    },
    configImpact: {
      pt: 'App do Marketplace ou integração personalizada via API para cada sistema.',
      en: 'Zendesk Marketplace app or custom API integration per system.',
      es: 'App del Marketplace o integración personalizada vía API para cada sistema.',
    },
    priority: 'essencial',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.integrations.salesforce',
    section: 'integrations',
    type: 'yes_no',
    text: {
      pt: 'Salesforce — ler dados do CRM na barra lateral do Zendesk? Sincronizar tickets com casos do SF?',
      en: 'Salesforce — read CRM data in Zendesk sidebar? Sync tickets to SF cases?',
      es: 'Salesforce: ¿leer datos del CRM en la barra lateral de Zendesk? ¿Sincronizar tickets con casos de SF?',
    },
    configImpact: {
      pt: 'App Zendesk for Salesforce; configuração de sincronização bidirecional.',
      en: 'Zendesk for Salesforce app; bi-directional sync configuration.',
      es: 'App Zendesk for Salesforce; configuración de sincronización bidireccional.',
    },
    priority: 'recomendada',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.integrations.hubspot',
    section: 'integrations',
    type: 'yes_no',
    text: {
      pt: 'HubSpot — exibir dados de contato/negócio na barra lateral do ticket?',
      en: 'HubSpot — surface contact/deal data in ticket sidebar?',
      es: 'HubSpot: ¿mostrar datos de contacto/negocio en la barra lateral del ticket?',
    },
    configImpact: {
      pt: 'App HubSpot for Zendesk do Marketplace ou app de barra lateral personalizado via API.',
      en: 'HubSpot for Zendesk Marketplace app or custom API sidebar app.',
      es: 'App HubSpot for Zendesk del Marketplace o app de barra lateral personalizada vía API.',
    },
    priority: 'opcional',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.integrations.ecommerce',
    section: 'integrations',
    type: 'yes_no',
    text: {
      pt: 'Shopify / e-commerce — exibir dados do pedido no ticket?',
      en: 'Shopify / e-commerce — show order data in ticket?',
      es: 'Shopify / e-commerce: ¿mostrar datos del pedido en el ticket?',
    },
    configImpact: {
      pt: 'App Shopify for Zendesk; agentes veem o pedido sem sair do ticket.',
      en: 'Shopify for Zendesk app; agents see order details without leaving ticket.',
      es: 'App Shopify for Zendesk; los agentes ven el pedido sin salir del ticket.',
    },
    priority: 'opcional',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.integrations.jira',
    section: 'integrations',
    type: 'yes_no',
    text: {
      pt: 'Jira — criar issues no Jira a partir de tickets para escalonamentos à engenharia?',
      en: 'Jira — create Jira issues from tickets for engineering escalations?',
      es: 'Jira: ¿crear incidencias en Jira desde los tickets para escalamientos a ingeniería?',
    },
    configImpact: {
      pt: 'App Zendesk for Jira; vincular ticket ↔ issue; sincronizar o status de volta no ticket.',
      en: 'Zendesk for Jira app; link ticket ↔ Jira issue; sync status back to ticket.',
      es: 'App Zendesk for Jira; vincular ticket ↔ incidencia; sincronizar el estado de vuelta al ticket.',
    },
    priority: 'recomendada',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.integrations.read_write',
    section: 'integrations',
    type: 'table',
    tableColumns: [
      { key: 'system', type: 'text', maxLength: 80, label: { pt: 'Sistema', en: 'System', es: 'Sistema' } },
      {
        key: 'direction', type: 'single',
        label: { pt: 'Direção', en: 'Direction', es: 'Dirección' },
        options: [
          { value: 'read', label: { pt: 'Leitura', en: 'Read', es: 'Lectura' } },
          { value: 'write', label: { pt: 'Escrita', en: 'Write', es: 'Escritura' } },
          { value: 'both', label: { pt: 'Ambos', en: 'Both', es: 'Ambos' } },
        ],
      },
      { key: 'notes', type: 'long_text', maxLength: 300, label: { pt: 'Observações', en: 'Notes', es: 'Observaciones' } },
    ],
    text: {
      pt: 'Cada integração precisa LER dados, ESCREVER dados ou ambos?',
      en: 'Does each integration need to READ data, WRITE data, or both?',
      es: '¿Cada integración necesita LEER datos, ESCRIBIR datos o ambos?',
    },
    configImpact: {
      pt: 'Leitura = app de exibição na barra lateral; Escrita = ações de API; Ambos = sincronização bidirecional completa.',
      en: 'Read = sidebar display app; Write = API actions; Both = full bi-directional sync.',
      es: 'Lectura = app de visualización en la barra lateral; Escritura = acciones de API; Ambos = sincronización bidireccional completa.',
    },
    priority: 'essencial',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.integrations.middleware',
    section: 'integrations',
    type: 'long_text',
    text: {
      pt: 'Existe middleware em uso (Zapier, Make, MuleSoft, próprio)?',
      en: 'Is there existing middleware (Zapier, Make, MuleSoft, custom)?',
      es: '¿Existe middleware en uso (Zapier, Make, MuleSoft, propio)?',
    },
    configImpact: {
      pt: 'Middleware existente pode reduzir o esforço; documentar endpoints e autenticação.',
      en: 'Existing middleware may reduce build effort; document endpoints and auth.',
      es: 'El middleware existente puede reducir el esfuerzo; documentar endpoints y autenticación.',
    },
    priority: 'recomendada',
    complexity: 'media',
    translation: TR,
  },

  // ---------------------------------------------------------------------------
  // 16. Data Migration — trilha usecase.migration
  // ---------------------------------------------------------------------------
  {
    key: 'core.migration.source_platform',
    section: 'migration',
    tracks: ['usecase.migration'],
    type: 'short_text',
    text: {
      pt: 'Vocês estão migrando de outra plataforma? Qual?',
      en: 'Are you migrating from another platform? Which one?',
      es: '¿Están migrando desde otra plataforma? ¿Cuál?',
    },
    configImpact: {
      pt: 'Escolha da ferramenta de migração (ex.: Help Desk Migration, script próprio).',
      en: 'Migration tooling selection (e.g., Help Desk Migration, Stitch, custom script).',
      es: 'Selección de la herramienta de migración (p. ej., Help Desk Migration, script propio).',
    },
    priority: 'essencial',
    complexity: 'alta',
    translation: TR,
  },
  // "What data objects to migrate?" — substituída por mig.objects
  // "How many total tickets to migrate?" — substituída por mig.tickets_volume
  // "How many years of historical data are needed?" — substituída por mig.years
  {
    key: 'core.migration.field_mapping',
    section: 'migration',
    tracks: ['usecase.migration'],
    type: 'yes_no',
    text: {
      pt: 'Os valores de campos personalizados precisam ser mapeados para novos campos no Zendesk?',
      en: 'Do custom field values need to be mapped to new Zendesk fields?',
      es: '¿Los valores de campos personalizados deben mapearse a nuevos campos en Zendesk?',
    },
    configImpact: {
      pt: 'Documento de mapeamento de campos antes da migração; divergências causam perda de dados.',
      en: 'Field mapping document required before migration; mismatches cause data loss.',
      es: 'Documento de mapeo de campos antes de la migración; las diferencias causan pérdida de datos.',
    },
    priority: 'recomendada',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.migration.reopen_or_archive',
    section: 'migration',
    tracks: ['usecase.migration'],
    type: 'single',
    options: [
      { value: 'reopen', label: { pt: 'Poderão ser reabertos', en: 'May be re-opened', es: 'Podrán reabrirse' } },
      { value: 'archive', label: { pt: 'Arquivo somente leitura', en: 'Read-only archive', es: 'Archivo de solo lectura' } },
      { value: 'mixed', label: { pt: 'Abertos reabrem, fechados ficam arquivados', en: 'Open ones re-open, closed ones archived', es: 'Los abiertos se reabren, los cerrados quedan archivados' } },
    ],
    text: {
      pt: 'Os tickets migrados poderão ser reabertos ou ficam como arquivo somente leitura?',
      en: 'Will migrated tickets need to be re-opened or are they read-only archive?',
      es: '¿Los tickets migrados podrán reabrirse o quedan como archivo de solo lectura?',
    },
    configImpact: {
      pt: 'Tickets fechados/arquivados e tickets abertos têm tratamentos diferentes no Zendesk.',
      en: 'Closed/archived tickets vs. open tickets — different handling in Zendesk.',
      es: 'Los tickets cerrados/archivados y los abiertos se tratan de forma distinta en Zendesk.',
    },
    priority: 'recomendada',
    complexity: 'baixa',
    translation: TR,
  },

  // ---------------------------------------------------------------------------
  // 17. Reporting & Analytics
  // ---------------------------------------------------------------------------
  {
    key: 'core.reporting.leadership',
    section: 'reporting',
    type: 'long_text',
    text: {
      pt: 'De quais relatórios a liderança/diretoria precisa hoje?',
      en: 'What reports does leadership/exec need today?',
      es: '¿Qué reportes necesita hoy la dirección?',
    },
    configImpact: {
      pt: 'Explore — painel executivo: tendência de volume, CSAT, cumprimento de SLA, backlog.',
      en: 'Explore — executive dashboard: volume trend, CSAT, SLA compliance, backlog.',
      es: 'Explore: tablero ejecutivo con tendencia de volumen, CSAT, cumplimiento de SLA, backlog.',
    },
    priority: 'essencial',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.reporting.supervisors',
    section: 'reporting',
    type: 'long_text',
    text: {
      pt: 'De quais relatórios os supervisores/gestores precisam?',
      en: 'What reports do supervisors/managers need?',
      es: '¿Qué reportes necesitan los supervisores/gerentes?',
    },
    configImpact: {
      pt: 'Explore — painel de supervisão: desempenho dos agentes, primeira resposta, tempo de resolução, saúde da fila.',
      en: 'Explore — supervisor dashboard: agent performance, FRT, resolution time, queue health.',
      es: 'Explore: tablero de supervisión con desempeño de agentes, primera respuesta, tiempo de resolución, estado de la cola.',
    },
    priority: 'recomendada',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.reporting.agents',
    section: 'reporting',
    type: 'long_text',
    text: {
      pt: 'De quais relatórios os agentes precisam?',
      en: 'What reports do agents need?',
      es: '¿Qué reportes necesitan los agentes?',
    },
    configImpact: {
      pt: 'Explore — painel pessoal do agente ou visualizações com métricas da própria fila.',
      en: 'Explore — agent personal dashboard or views for personal queue metrics.',
      es: 'Explore: tablero personal del agente o vistas con métricas de su propia cola.',
    },
    priority: 'opcional',
    complexity: 'baixa',
    translation: TR,
  },
  {
    key: 'core.reporting.kpis',
    section: 'reporting',
    type: 'multi',
    options: [
      { value: 'csat', label: { pt: 'CSAT', en: 'CSAT', es: 'CSAT' } },
      { value: 'frt', label: { pt: 'Tempo de primeira resposta', en: 'First reply time', es: 'Tiempo de primera respuesta' } },
      { value: 'resolution_time', label: { pt: 'Tempo de resolução', en: 'Resolution time', es: 'Tiempo de resolución' } },
      { value: 'backlog', label: { pt: 'Backlog', en: 'Backlog', es: 'Backlog' } },
      { value: 'sla', label: { pt: 'Cumprimento de SLA', en: 'SLA compliance', es: 'Cumplimiento de SLA' } },
      { value: 'volume', label: { pt: 'Volume', en: 'Volume', es: 'Volumen' } },
      { value: 'other', label: { pt: 'Outro', en: 'Other', es: 'Otro' } },
    ],
    text: {
      pt: 'Quais KPIs são mais críticos? (CSAT, primeira resposta, tempo de resolução, backlog, SLA, volume)',
      en: 'Which KPIs are most critical? (CSAT, FRT, Resolution Time, Backlog, SLA, Volume)',
      es: '¿Qué KPIs son más críticos? (CSAT, primera respuesta, tiempo de resolución, backlog, SLA, volumen)',
    },
    configImpact: {
      pt: 'Conjuntos de dados do Explore (Support, Talk, Chat) — cada KPI exige o conjunto e a métrica certos.',
      en: 'Explore datasets: Support, Talk, Chat — each KPI needs correct dataset + metric.',
      es: 'Conjuntos de datos de Explore (Support, Talk, Chat): cada KPI requiere el conjunto y la métrica correctos.',
    },
    priority: 'recomendada',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.reporting.scheduled',
    section: 'reporting',
    type: 'yes_no',
    text: {
      pt: 'Há relatórios agendados a enviar por e-mail para as partes interessadas?',
      en: 'Are there scheduled reports to be emailed to stakeholders?',
      es: '¿Hay reportes programados para enviar por correo a las partes interesadas?',
    },
    configImpact: {
      pt: 'Envio agendado do Explore — destinatários, frequência e painel.',
      en: 'Explore scheduled delivery — set recipient list, frequency, and dashboard.',
      es: 'Envío programado de Explore: destinatarios, frecuencia y tablero.',
    },
    priority: 'opcional',
    complexity: 'baixa',
    translation: TR,
  },
  {
    key: 'core.reporting.custom_metrics',
    section: 'reporting',
    type: 'long_text',
    text: {
      pt: 'Há métricas próprias do negócio que não estão nos relatórios padrão?',
      en: 'Any custom metrics specific to your business not in standard reports?',
      es: '¿Hay métricas propias del negocio que no están en los reportes estándar?',
    },
    configImpact: {
      pt: 'Atributos personalizados e métricas calculadas no Explore — exige acesso de editor do Explore.',
      en: 'Explore custom attributes and calculated metrics — requires Explore Editor access.',
      es: 'Atributos personalizados y métricas calculadas en Explore: requiere acceso de editor de Explore.',
    },
    priority: 'recomendada',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.reporting.realtime',
    section: 'reporting',
    type: 'yes_no',
    text: {
      pt: 'Precisa de painéis em tempo real (telão para a operação)?',
      en: 'Real-time dashboards needed (wallboard for floor)?',
      es: '¿Se necesitan tableros en tiempo real (pantalla para la operación)?',
    },
    configImpact: {
      pt: 'Painéis ao vivo do Explore; Zendesk WFM para monitoramento dos agentes em tempo real.',
      en: 'Explore live dashboards; Zendesk WFM (Tymeshift) for real-time agent monitoring.',
      es: 'Tableros en vivo de Explore; Zendesk WFM para monitoreo de agentes en tiempo real.',
    },
    priority: 'recomendada',
    complexity: 'alta',
    translation: TR,
  },

  // ---------------------------------------------------------------------------
  // 18. Security & Compliance
  // ---------------------------------------------------------------------------
  {
    key: 'core.security.compliance',
    section: 'security',
    type: 'multi',
    options: [
      { value: 'lgpd', label: { pt: 'LGPD', en: 'LGPD', es: 'LGPD' } },
      { value: 'gdpr', label: { pt: 'GDPR', en: 'GDPR', es: 'GDPR' } },
      { value: 'hipaa', label: { pt: 'HIPAA', en: 'HIPAA', es: 'HIPAA' } },
      { value: 'pci_dss', label: { pt: 'PCI-DSS', en: 'PCI-DSS', es: 'PCI-DSS' } },
      { value: 'soc2', label: { pt: 'SOC 2', en: 'SOC 2', es: 'SOC 2' } },
      { value: 'iso27001', label: { pt: 'ISO 27001', en: 'ISO 27001', es: 'ISO 27001' } },
      { value: 'none', label: { pt: 'Nenhum', en: 'None', es: 'Ninguno' } },
      { value: 'other', label: { pt: 'Outro', en: 'Other', es: 'Otro' } },
    ],
    text: {
      pt: 'Vocês têm requisitos de conformidade? (LGPD, GDPR, HIPAA, PCI-DSS, SOC 2, ISO 27001)',
      en: 'Do you have compliance requirements? (HIPAA, PCI-DSS, SOC 2, GDPR, ISO 27001)',
      es: '¿Tienen requisitos de cumplimiento? (GDPR, HIPAA, PCI-DSS, SOC 2, ISO 27001)',
    },
    configImpact: {
      pt: 'Complemento Advanced Compliance; escolha da região de dados (EUA/UE/AU); BAA para HIPAA.',
      en: 'Zendesk Advanced Compliance add-on; data region selection (US/EU/AU); BAA for HIPAA.',
      es: 'Complemento Advanced Compliance; elección de la región de datos (EE. UU./UE/AU); BAA para HIPAA.',
    },
    priority: 'essencial',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.security.idp',
    section: 'security',
    type: 'single',
    options: [
      { value: 'okta', label: { pt: 'Okta', en: 'Okta', es: 'Okta' } },
      { value: 'azure_ad', label: { pt: 'Microsoft Entra ID (Azure AD)', en: 'Microsoft Entra ID (Azure AD)', es: 'Microsoft Entra ID (Azure AD)' } },
      { value: 'google', label: { pt: 'Google', en: 'Google', es: 'Google' } },
      { value: 'other', label: { pt: 'Outro', en: 'Other', es: 'Otro' } },
    ],
    text: {
      pt: 'Qual provedor de identidade será usado no SSO dos agentes?',
      en: 'Which identity provider for agent SSO? (Okta, Azure AD, Google)',
      es: '¿Qué proveedor de identidad se usará para el SSO de los agentes?',
    },
    help: {
      pt: 'Se o SSO é necessário fica em core.sso; aqui, qual o provedor.',
      en: 'Whether SSO is required is captured in core.sso; here, which provider.',
      es: 'Si se requiere SSO se registra en core.sso; aquí, cuál es el proveedor.',
    },
    configImpact: {
      pt: 'Configuração SSO/SAML 2.0 na Central de administração; testar com o IdP antes do go-live.',
      en: 'SSO/SAML 2.0 configuration in Admin Center; test with IdP before go-live.',
      es: 'Configuración SSO/SAML 2.0 en el Centro de administración; probar con el IdP antes del go-live.',
    },
    showIf: { questionKey: 'core.sso', equals: 'sim' },
    priority: 'recomendada',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.security.mfa',
    section: 'security',
    type: 'yes_no',
    text: {
      pt: 'MFA obrigatório para os agentes?',
      en: 'MFA required for agents?',
      es: '¿MFA obligatorio para los agentes?',
    },
    configImpact: {
      pt: 'MFA exigido pelo provedor de SSO ou pela autenticação em dois fatores nativa do Zendesk.',
      en: "MFA enforced via SSO provider or Zendesk's built-in 2FA setting.",
      es: 'MFA exigido por el proveedor de SSO o por la autenticación en dos pasos nativa de Zendesk.',
    },
    priority: 'opcional',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.security.data_retention',
    section: 'security',
    type: 'long_text',
    text: {
      pt: 'Política de retenção de dados — por quanto tempo manter os tickets?',
      en: 'Data retention policy — how long to keep ticket data?',
      es: 'Política de retención de datos: ¿cuánto tiempo conservar los tickets?',
    },
    configImpact: {
      pt: 'Complemento de retenção de dados; regras de exclusão automática para conformidade de dados pessoais.',
      en: 'Zendesk data retention add-on; automated deletion rules for PII compliance.',
      es: 'Complemento de retención de datos; reglas de eliminación automática para cumplimiento de datos personales.',
    },
    priority: 'recomendada',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.security.audit_log',
    section: 'security',
    type: 'yes_no',
    text: {
      pt: 'Há requisitos de log de auditoria?',
      en: 'Audit log requirements?',
      es: '¿Hay requisitos de registro de auditoría?',
    },
    configImpact: {
      pt: 'Log de auditoria na Central de administração (plano Enterprise); exportável para revisões de conformidade.',
      en: 'Zendesk Audit Log in Admin Center (Enterprise plan); exportable for compliance reviews.',
      es: 'Registro de auditoría en el Centro de administración (plan Enterprise); exportable para revisiones de cumplimiento.',
    },
    priority: 'opcional',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.security.ip_allowlist',
    section: 'security',
    type: 'yes_no',
    text: {
      pt: 'Restringir o acesso dos agentes por lista de IPs permitidos?',
      en: 'IP allowlisting for agent access?',
      es: '¿Restringir el acceso de los agentes por lista de IP permitidas?',
    },
    configImpact: {
      pt: 'Restrições de IP nas configurações de segurança da Central de administração.',
      en: 'IP restrictions in Admin Center Security settings.',
      es: 'Restricciones de IP en la configuración de seguridad del Centro de administración.',
    },
    priority: 'opcional',
    complexity: 'media',
    translation: TR,
  },

  // ---------------------------------------------------------------------------
  // 19. User Management
  // ---------------------------------------------------------------------------
  // "Total agent count (full Zendesk Agent seats)?" — substituída por core.users.agents
  // "Light Agent / Contributor seats needed?" — substituída por core.users.light_agents
  {
    key: 'core.users.admins',
    section: 'users',
    type: 'number',
    unit: { pt: 'administradores', en: 'admins', es: 'administradores' },
    min: 0,
    text: {
      pt: 'Quantos administradores são necessários?',
      en: 'How many admins needed?',
      es: '¿Cuántos administradores se necesitan?',
    },
    help: {
      pt: 'Boa prática: 2 a 3 administradores no máximo, para reduzir o risco de configuração indevida.',
      en: 'Best practice: 2–3 admins max to reduce config risk.',
      es: 'Buena práctica: 2 a 3 administradores como máximo, para reducir el riesgo de configuraciones indebidas.',
    },
    configImpact: {
      pt: 'Atribuição do papel de administrador; limitar administradores reduz o risco de configuração errada.',
      en: 'Admin role assignment; limit admins to minimize misconfiguration risk.',
      es: 'Asignación del rol de administrador; limitar administradores reduce el riesgo de configuraciones erróneas.',
    },
    priority: 'recomendada',
    complexity: 'baixa',
    translation: TR,
  },
  {
    key: 'core.users.scim',
    section: 'users',
    type: 'yes_no',
    text: {
      pt: 'Provisionamento via SCIM a partir do sistema de RH / IdP?',
      en: 'SCIM provisioning from HR system / IdP?',
      es: '¿Aprovisionamiento vía SCIM desde el sistema de RR. HH. / IdP?',
    },
    configImpact: {
      pt: 'SCIM 2.0 para criar/desativar agentes automaticamente via Okta/Azure AD.',
      en: 'SCIM 2.0 setup for auto-provisioning/deprovisioning agents via Okta/Azure AD.',
      es: 'SCIM 2.0 para crear/desactivar agentes automáticamente vía Okta/Azure AD.',
    },
    priority: 'opcional',
    complexity: 'alta',
    translation: TR,
  },
  // "Custom roles needed beyond default Agent/Admin?" — substituída por core.users.custom_roles
  {
    key: 'core.users.brand_restrictions',
    section: 'users',
    type: 'yes_no',
    text: {
      pt: 'Restrições de permissão por departamento ou por marca?',
      en: 'Department-level or brand-level permission restrictions?',
      es: '¿Restricciones de permisos por departamento o por marca?',
    },
    configImpact: {
      pt: 'Restrições de visibilidade por grupo e marca; agentes podem ficar limitados a marcas específicas.',
      en: 'Group + Brand visibility restrictions; agents can be limited to specific brands.',
      es: 'Restricciones de visibilidad por grupo y marca; los agentes pueden limitarse a marcas específicas.',
    },
    priority: 'recomendada',
    complexity: 'media',
    translation: TR,
  },

  // ---------------------------------------------------------------------------
  // 20. Launch & Change Management
  // ---------------------------------------------------------------------------
  {
    key: 'core.launch.golive_date',
    section: 'launch',
    type: 'date',
    text: {
      pt: 'Data-alvo do go-live?',
      en: 'Target go-live date?',
      es: '¿Fecha objetivo del go-live?',
    },
    configImpact: {
      pt: 'Ancora o plano do projeto e o cronograma dos sprints de configuração.',
      en: 'Anchors the implementation project plan and configuration sprint schedule.',
      es: 'Ancla el plan del proyecto y el cronograma de los sprints de configuración.',
    },
    priority: 'essencial',
    complexity: 'baixa',
    translation: TR,
  },
  {
    key: 'core.launch.rollout',
    section: 'launch',
    type: 'single',
    options: [
      { value: 'phased', label: { pt: 'Em fases (time a time)', en: 'Phased rollout (team by team)', es: 'Por fases (equipo por equipo)' } },
      { value: 'big_bang', label: { pt: 'Big-bang (todos os times de uma vez)', en: 'Big-bang (all teams at once)', es: 'Big-bang (todos los equipos a la vez)' } },
    ],
    text: {
      pt: 'Implantação em fases (time a time) ou big-bang (todos os times de uma vez)?',
      en: 'Phased rollout (team by team) or big-bang launch (all teams at once)?',
      es: '¿Implementación por fases (equipo por equipo) o big-bang (todos los equipos a la vez)?',
    },
    configImpact: {
      pt: 'Em fases: configurar o time A, testar e depois incluir os demais; afeta a sequência de grupos/roteamento.',
      en: 'Phased: configure team A first, test, then add teams; affects group/routing sequence.',
      es: 'Por fases: configurar el equipo A, probar y luego sumar equipos; afecta la secuencia de grupos/enrutamiento.',
    },
    priority: 'essencial',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.launch.training_needs',
    section: 'launch',
    type: 'long_text',
    text: {
      pt: 'Necessidades de treinamento — quais times e perfis (administradores, supervisores, agentes)?',
      en: 'Agent training requirements — which teams and profiles (admins, supervisors, agents)?',
      es: 'Necesidades de capacitación: ¿qué equipos y perfiles (administradores, supervisores, agentes)?',
    },
    help: {
      pt: 'O número de turmas fica em core.training.groups; aqui, quem precisa de qual treinamento.',
      en: 'The number of training groups is captured in core.training.groups; here, who needs which training.',
      es: 'La cantidad de grupos de capacitación se registra en core.training.groups; aquí, quién necesita qué capacitación.',
    },
    configImpact: {
      pt: 'Plano de treinamento: administradores, supervisores e onboarding de agentes.',
      en: 'Training plan: Admin training, Supervisor training, Agent onboarding sessions.',
      es: 'Plan de capacitación: administradores, supervisores y onboarding de agentes.',
    },
    priority: 'recomendada',
    complexity: 'media',
    translation: TR,
  },
  // "Hypercare period needed after go-live?" — substituída por core.golive.hypercare_days
  {
    key: 'core.launch.project_owner',
    section: 'launch',
    type: 'short_text',
    text: {
      pt: 'Quem é o dono interno do projeto, com autoridade final de aprovação?',
      en: 'Who is the internal project owner with final sign-off authority?',
      es: '¿Quién es el responsable interno del proyecto con autoridad final de aprobación?',
    },
    configImpact: {
      pt: 'Responsável nomeado para o caminho de escalonamento e a aprovação de mudanças.',
      en: 'Named stakeholder for escalation path and change approval process.',
      es: 'Responsable designado para la ruta de escalamiento y la aprobación de cambios.',
    },
    priority: 'essencial',
    complexity: 'baixa',
    translation: TR,
  },
  {
    key: 'core.launch.uat',
    section: 'launch',
    type: 'long_text',
    text: {
      pt: 'Processo de UAT (teste de aceitação) — como vocês vão validar a configuração?',
      en: 'UAT (User Acceptance Testing) process — how will you validate configuration?',
      es: 'Proceso de UAT (pruebas de aceptación): ¿cómo validarán la configuración?',
    },
    configImpact: {
      pt: 'Checklist de UAT: testar canais, roteamento, SLAs, macros e integrações antes da virada.',
      en: 'UAT checklist: test all channels, routing rules, SLAs, macros, integrations before cutover.',
      es: 'Checklist de UAT: probar canales, enrutamiento, SLA, macros e integraciones antes del cambio.',
    },
    priority: 'recomendada',
    complexity: 'alta',
    translation: TR,
  },
];
