/**
 * Trilhas do banco v1 e seções próprias da Aktie (as 20 do template ficam em template.ts).
 */

import { t } from './helpers';
import type { SeedSection, SeedTrack } from './types';

export const TRACKS: SeedTrack[] = [
  {
    key: 'core', type: 'core',
    name: t('Núcleo', 'Core', 'Núcleo'),
    description: t(
      'Contexto consultivo, as 20 seções do template Zendesk, as quantidades do catálogo e os requisitos ocultos. Sempre presente.',
      'Consultative context, the 20 Zendesk template sections, catalog quantities and hidden requirements. Always included.',
      'Contexto consultivo, las 20 secciones de la plantilla Zendesk, las cantidades del catálogo y los requisitos ocultos. Siempre presente.',
    ),
    fixedItems: [
      { itemId: 1, itemName: 'Configurações gerais (Support)', quantity: 1 },
      { itemId: 228, itemName: 'Workshop - Suite', quantity: 1 },
    ],
  },
  {
    key: 'product.ai_agents', type: 'product',
    name: t('AI Agents', 'AI Agents', 'AI Agents'),
    description: t(
      'Casos de uso do bot, integrações por API, ações, entidades, transbordo e meta de resolução.',
      'Bot use cases, API integrations, actions, entities, handoff and resolution target.',
      'Casos de uso del bot, integraciones por API, acciones, entidades, transferencia y meta de resolución.',
    ),
    fixedItems: [{ itemId: 231, itemName: 'Workshop AI Agents', quantity: 1 }],
  },
  {
    key: 'product.voice_zcc', type: 'product',
    name: t('Voz e Contact Center', 'Voice and Contact Center', 'Voz y Contact Center'),
    description: t(
      'Volume de chamadas, linhas, URA, gravação, discagem ativa e Zendesk Contact Center.',
      'Call volume, lines, IVR, recording, outbound dialing and Zendesk Contact Center.',
      'Volumen de llamadas, líneas, IVR, grabación, marcación saliente y Zendesk Contact Center.',
    ),
    fixedItems: [
      { itemId: 49, itemName: 'Configurações gerais (Voice)', quantity: 1 },
      { itemId: 229, itemName: 'Workshop - Voice', quantity: 1 },
    ],
  },
  {
    key: 'product.copilot', type: 'product',
    name: t('Copilot', 'Copilot', 'Copilot'),
    description: t(
      'Procedimentos guiados, entidades, tópicos e ações da assistência automática.',
      'Guided procedures, entities, topics and auto assist actions.',
      'Procedimientos guiados, entidades, temas y acciones de la asistencia automática.',
    ),
    fixedItems: [{ itemId: 230, itemName: 'Workshop Copilot', quantity: 1 }],
  },
  {
    key: 'usecase.itsm_cmdb', type: 'usecase',
    name: t('ITSM/ESM com CMDB e ativos', 'ITSM/ESM with CMDB and assets', 'ITSM/ESM con CMDB y activos'),
    description: t(
      'Catálogo de serviços, tipos ITIL, aprovações, gestão de ativos e diretório de usuários.',
      'Service catalog, ITIL types, approvals, asset management and user directory.',
      'Catálogo de servicios, tipos ITIL, aprobaciones, gestión de activos y directorio de usuarios.',
    ),
    suggestRules: [{ sku: 'ES' }],
  },
  {
    key: 'usecase.migration', type: 'usecase',
    name: t('Migração de plataforma', 'Platform migration', 'Migración de plataforma'),
    description: t(
      'Plataforma de origem, objetos e volume a migrar, histórico consultável e janela de corte.',
      'Source platform, objects and volume to migrate, searchable history and cutover window.',
      'Plataforma de origen, objetos y volumen a migrar, histórico consultable y ventana de corte.',
    ),
  },
  {
    key: 'segment.retail', type: 'segment',
    name: t('Varejo e e-commerce', 'Retail and e-commerce', 'Retail y e-commerce'),
    description: t(
      'Plataforma de e-commerce, motivos de contato, transportadoras, marketplaces, picos e Reclame Aqui.',
      'E-commerce platform, contact reasons, carriers, marketplaces, peaks and Reclame Aqui.',
      'Plataforma de e-commerce, motivos de contacto, transportadoras, marketplaces, picos y Reclame Aqui.',
    ),
  },
];

/** Seções criadas pela Aktie, além das 20 do template e dos requisitos ocultos. */
export const AKTIE_SECTIONS: Record<string, SeedSection> = {
  ctx: {
    key: 'ctx',
    title: t('Bloco 0 · Contexto consultivo', 'Block 0 · Consultative context', 'Bloque 0 · Contexto consultivo'),
    deliverable: t(
      'Problema central, indicadores e custo atuais, gatilho da mudança, expectativa de retorno e processo de aprovação.',
      'Core problem, current KPIs and spend, change trigger, return expectation and approval process.',
      'Problema central, indicadores y costo actuales, detonante del cambio, expectativa de retorno y proceso de aprobación.',
    ),
  },
  voice: {
    key: 'voice',
    title: t('Voz e Contact Center', 'Voice and Contact Center', 'Voz y Contact Center'),
    deliverable: t(
      'Linhas, URA, saudações, gravação, retorno de chamada e desenho do Contact Center.',
      'Lines, IVR, greetings, recording, callback and Contact Center design.',
      'Líneas, IVR, saludos, grabación, devolución de llamada y diseño del Contact Center.',
    ),
  },
  copilot: {
    key: 'copilot',
    title: t('Copilot', 'Copilot', 'Copilot'),
    deliverable: t(
      'Procedimentos, entidades, tópicos e ações da assistência automática.',
      'Procedures, entities, topics and auto assist actions.',
      'Procedimientos, entidades, temas y acciones de la asistencia automática.',
    ),
  },
  itsm: {
    key: 'itsm',
    title: t('ITSM/ESM e gestão de ativos', 'ITSM/ESM and asset management', 'ITSM/ESM y gestión de activos'),
    deliverable: t(
      'Catálogo de serviços, aprovações, tipos e campos de ativo, inventário e sincronização.',
      'Service catalog, approvals, asset types and fields, inventory and sync.',
      'Catálogo de servicios, aprobaciones, tipos y campos de activo, inventario y sincronización.',
    ),
  },
  retail: {
    key: 'retail',
    title: t('Varejo e e-commerce', 'Retail and e-commerce', 'Retail y e-commerce'),
    deliverable: t(
      'Integração com a plataforma de e-commerce, motivos de contato e sazonalidade.',
      'E-commerce platform integration, contact reasons and seasonality.',
      'Integración con la plataforma de e-commerce, motivos de contacto y estacionalidad.',
    ),
  },
};

/**
 * Ordem das seções no banco. Keys sem definição aqui vêm de template.ts / hidden.ts.
 */
export const SECTION_ORDER = [
  'ctx',
  'business_goals', 'current_process', 'teams', 'channels', 'voice',
  'ticket_types', 'retail', 'forms', 'fields', 'routing', 'slas', 'escalation',
  'automations', 'macros', 'knowledge', 'ai_agent', 'copilot', 'integrations', 'itsm',
  'migration', 'reporting', 'security', 'users', 'launch',
  'hidden',
];
