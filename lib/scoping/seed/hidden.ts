/**
 * Seed: "Hidden Requirements" da planilha "Zendesk Scoping Call Template".
 *
 * Perguntas abertas que revelam o que o cliente esquece de contar. A coluna
 * "What It Uncovers" virou o `help` de cada pergunta. Todas opcionais.
 */

import type { I18nText } from '../types';
import type { SeedQuestion } from './types';

const TR = { en: 'reviewed', pt: 'machine', es: 'machine' } as const;

export const HIDDEN_SECTION: { key: string; title: I18nText; deliverable: I18nText } = {
  key: 'hidden',
  title: {
    pt: 'Requisitos ocultos',
    en: 'Hidden Requirements',
    es: 'Requisitos ocultos',
  },
  deliverable: {
    pt: 'Perguntas-chave que revelam o que o cliente esquece de mencionar',
    en: 'Power questions that uncover what clients forget to mention',
    es: 'Preguntas clave que revelan lo que el cliente olvida mencionar',
  },
};

export const HIDDEN_QUESTIONS: SeedQuestion[] = [
  {
    key: 'core.hidden.work_outside_zendesk',
    section: 'hidden',
    type: 'long_text',
    text: {
      pt: 'O que os agentes fazem hoje fora da ferramenta de atendimento?',
      en: 'What are your agents doing outside your customer service tool today?',
      es: '¿Qué hacen hoy los agentes fuera de la herramienta de atención?',
    },
    help: {
      pt: 'Revela planilhas de controle, caixas de e-mail compartilhadas, gambiarras no Slack e relatórios manuais.',
      en: 'Uncovers Excel trackers, shared inboxes, Slack workarounds, manual reporting.',
      es: 'Revela planillas de seguimiento, buzones compartidos, soluciones improvisadas en Slack y reportes manuales.',
    },
    configImpact: {
      pt: 'Automação com gatilhos/macros; integração com Slack; campos personalizados para substituir planilhas.',
      en: 'Automation via triggers/macros; Slack integration; custom fields to replace spreadsheets.',
      es: 'Automatización con disparadores/macros; integración con Slack; campos personalizados para reemplazar planillas.',
    },
    priority: 'opcional',
    complexity: 'alta',
    translation: { en: 'machine', pt: 'machine', es: 'machine' },
  },
  {
    key: 'core.hidden.agent_lookups',
    section: 'hidden',
    type: 'long_text',
    text: {
      pt: 'Que informações os agentes consultam antes de resolver um ticket?',
      en: 'What information do agents look up before resolving a ticket?',
      es: '¿Qué información consultan los agentes antes de resolver un ticket?',
    },
    help: {
      pt: 'Revela necessidades de dados de CRM, ERP, faturamento e visão 360º do cliente.',
      en: 'Uncovers CRM, ERP, billing data, customer 360 needs.',
      es: 'Revela necesidades de datos de CRM, ERP, facturación y vista 360 del cliente.',
    },
    configImpact: {
      pt: 'Integração via API com app na barra lateral; Lookup Relationships; Customer 360 no painel de contexto.',
      en: 'API integration via sidebar app; Lookup Relationships; Customer 360 in context panel.',
      es: 'Integración vía API con app en la barra lateral; Lookup Relationships; Customer 360 en el panel de contexto.',
    },
    priority: 'opcional',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.hidden.best_agent_vacation',
    section: 'hidden',
    type: 'long_text',
    text: {
      pt: 'O que acontece quando o seu melhor agente sai de férias?',
      en: 'What happens when your best agent is on vacation?',
      es: '¿Qué pasa cuando su mejor agente se va de vacaciones?',
    },
    help: {
      pt: 'Revela conhecimento concentrado em poucas pessoas, procedimentos não documentados e oportunidades de IA.',
      en: 'Uncovers tribal knowledge, missing SOPs, AI opportunities.',
      es: 'Revela conocimiento concentrado en pocas personas, procedimientos sin documentar y oportunidades de IA.',
    },
    configImpact: {
      pt: 'Biblioteca de macros, artigos da Central de Ajuda, procedimentos de AI Agents, roteamento por habilidades como contingência.',
      en: 'Macro library, Help Center articles, AI Agent procedures, skills-based routing backup.',
      es: 'Biblioteca de macros, artículos del Centro de ayuda, procedimientos de AI Agents, enrutamiento por habilidades como respaldo.',
    },
    priority: 'opcional',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.hidden.automate_half',
    section: 'hidden',
    type: 'long_text',
    text: {
      pt: 'Se fosse possível automatizar 50% dos chamados amanhã, quais 50% você escolheria?',
      en: 'If 50% of tickets could be automated tomorrow, which 50% would you choose?',
      es: 'Si se pudiera automatizar el 50 % de los tickets mañana, ¿qué 50 % elegiría?',
    },
    help: {
      pt: 'Caminho mais rápido para identificar procedimentos de AI Agents, regras de automação e integrações necessárias.',
      en: 'Fastest path to identifying AI Agent procedures, automation rules, and integration needs.',
      es: 'El camino más rápido para identificar procedimientos de AI Agents, reglas de automatización e integraciones necesarias.',
    },
    configImpact: {
      pt: 'Lista de intenções do AI Agent, mapa de gatilhos e automações, lacunas de artigos na Central de Ajuda.',
      en: 'AI Agent intent list, trigger automation map, Help Center article gaps.',
      es: 'Lista de intenciones del AI Agent, mapa de disparadores y automatizaciones, artículos faltantes en el Centro de ayuda.',
    },
    priority: 'opcional',
    complexity: 'alta',
    translation: { en: 'machine', pt: 'machine', es: 'machine' },
  },
  {
    key: 'core.hidden.before_first_reply',
    section: 'hidden',
    type: 'long_text',
    text: {
      pt: 'O que a equipe faz entre receber um ticket e enviar a primeira resposta?',
      en: 'What does your team do between receiving a ticket and first reply?',
      es: '¿Qué hace el equipo entre recibir un ticket y enviar la primera respuesta?',
    },
    help: {
      pt: 'Revela consultas manuais, fluxos de copiar e colar e integrações que faltam.',
      en: 'Reveals manual lookup steps, copy-paste workflows, missing integrations.',
      es: 'Revela consultas manuales, flujos de copiar y pegar e integraciones faltantes.',
    },
    configImpact: {
      pt: 'Integrações por app, macros com dados pré-preenchidos, rascunhos assistidos por IA (Copilot).',
      en: 'App integrations, macros with pre-filled data, AI-assisted drafts (Zendesk AI Copilot).',
      es: 'Integraciones con apps, macros con datos precargados, borradores asistidos por IA (Copilot).',
    },
    priority: 'opcional',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.hidden.unhappy_signals',
    section: 'hidden',
    type: 'long_text',
    text: {
      pt: 'Como vocês sabem que um cliente está insatisfeito antes que ele escale?',
      en: 'How do you know when a customer is unhappy before they escalate?',
      es: '¿Cómo saben que un cliente está insatisfecho antes de que escale?',
    },
    help: {
      pt: 'Revela lacunas no monitoramento de sentimento e necessidade de contato proativo.',
      en: 'Reveals sentiment monitoring gaps and proactive outreach needs.',
      es: 'Revela brechas en el monitoreo de sentimiento y necesidades de contacto proactivo.',
    },
    configImpact: {
      pt: 'Triagem inteligente (detecção de sentimento), gatilhos de CSAT, mensagens proativas.',
      en: 'Zendesk Intelligent Triage (sentiment detection), CSAT triggers, proactive messaging.',
      es: 'Clasificación inteligente (detección de sentimiento), disparadores de CSAT, mensajes proactivos.',
    },
    priority: 'opcional',
    complexity: 'alta',
    translation: TR,
  },
  {
    key: 'core.hidden.agent_friction',
    section: 'hidden',
    type: 'long_text',
    text: {
      pt: 'O que faria seus agentes pedirem demissão amanhã? (maiores pontos de atrito)',
      en: 'What would make your agents quit tomorrow? (Biggest friction points)',
      es: '¿Qué haría que sus agentes renunciaran mañana? (mayores puntos de fricción)',
    },
    help: {
      pt: 'Revela dores de interface, ferramentas que faltam e ineficiências de processo.',
      en: 'Reveals UI pain points, missing tools, process inefficiencies.',
      es: 'Revela problemas de interfaz, herramientas faltantes e ineficiencias de proceso.',
    },
    configImpact: {
      pt: 'Personalização do espaço de trabalho do agente, painéis laterais, macros, treinamento de atalhos de teclado.',
      en: 'Agent workspace customization, side panels, macros, keyboard shortcuts training.',
      es: 'Personalización del espacio de trabajo del agente, paneles laterales, macros, capacitación en atajos de teclado.',
    },
    priority: 'opcional',
    complexity: 'media',
    translation: TR,
  },
  {
    key: 'core.hidden.ceo_monday_report',
    section: 'hidden',
    type: 'long_text',
    text: {
      pt: 'Qual é o relatório que o CEO pede toda segunda-feira?',
      en: "What's the one report your CEO asks for every Monday?",
      es: '¿Cuál es el reporte que el CEO pide todos los lunes?',
    },
    help: {
      pt: 'Revela KPIs que hoje não são reportados e lacunas no painel executivo.',
      en: 'Reveals unreported KPIs and executive dashboard gaps.',
      es: 'Revela KPIs que hoy no se reportan y brechas en el tablero ejecutivo.',
    },
    configImpact: {
      pt: 'Painel personalizado no Explore; envio agendado por e-mail toda segunda de manhã.',
      en: 'Explore custom dashboard; scheduled email delivery every Monday morning.',
      es: 'Panel personalizado en Explore; envío programado por correo todos los lunes por la mañana.',
    },
    priority: 'opcional',
    complexity: 'media',
    translation: TR,
  },
];
