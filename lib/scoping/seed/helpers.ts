/** Atalhos para escrever o seed com menos ruído. */

import type { CatalogMapping, ChoiceOption, I18nText, TableColumn, TableColumnType } from '../types';

export const t = (pt: string, en: string, es: string): I18nText => ({ pt, en, es });

export const opt = (value: string, pt: string, en: string, es: string): ChoiceOption => ({ value, label: t(pt, en, es) });

export const col = (
  key: string, type: TableColumnType, pt: string, en: string, es: string,
  extra: Partial<TableColumn> = {},
): TableColumn => ({ key, type, label: t(pt, en, es), ...extra });

type Extra = { combine?: 'sum' | 'max'; requiresTrack?: string };

export const qty = (itemId: number, itemName: string, extra: Extra & { factor?: number } = {}): CatalogMapping =>
  ({ rule: 'quantity', itemId, itemName, ...extra });

export const ifYes = (itemId: number, itemName: string, quantity = 1, extra: Extra = {}): CatalogMapping =>
  ({ rule: 'fixed_if_yes', itemId, itemName, quantity, ...extra });

export const ifPositive = (itemId: number, itemName: string, quantity = 1, extra: Extra = {}): CatalogMapping =>
  ({ rule: 'fixed_if_positive', itemId, itemName, quantity, ...extra });

export const perOption = (
  option: string, itemId: number, itemName: string,
  extra: Extra & { quantity?: number; quantityFrom?: string } = {},
): CatalogMapping => ({ rule: 'per_option', option, itemId, itemName, ...extra });

export const tableCount = (itemId: number, itemName: string, extra: Extra & { factor?: number } = {}): CatalogMapping =>
  ({ rule: 'table_count', itemId, itemName, ...extra });

/** Unidades usadas nas perguntas numéricas. */
export const U = {
  agents: t('agentes', 'agents', 'agentes'),
  groups: t('grupos', 'groups', 'grupos'),
  roles: t('papéis', 'roles', 'roles'),
  brands: t('marcas', 'brands', 'marcas'),
  forms: t('formulários', 'forms', 'formularios'),
  fields: t('campos', 'fields', 'campos'),
  statuses: t('status', 'statuses', 'estados'),
  triggers: t('gatilhos', 'triggers', 'disparadores'),
  automations: t('automações', 'automations', 'automatizaciones'),
  macros: t('macros', 'macros', 'macros'),
  views: t('visualizações', 'views', 'vistas'),
  policies: t('políticas', 'policies', 'políticas'),
  schedules: t('programações', 'schedules', 'horarios'),
  skills: t('habilidades', 'skills', 'habilidades'),
  templates: t('templates', 'templates', 'plantillas'),
  webhooks: t('webhooks', 'webhooks', 'webhooks'),
  objects: t('objetos', 'objects', 'objetos'),
  records: t('registros', 'records', 'registros'),
  flows: t('fluxos', 'flows', 'flujos'),
  systems: t('sistemas', 'systems', 'sistemas'),
  apps: t('apps', 'apps', 'apps'),
  files: t('arquivos', 'files', 'archivos'),
  numbers: t('números', 'numbers', 'números'),
  addresses: t('endereços', 'addresses', 'direcciones'),
  articles: t('artigos', 'articles', 'artículos'),
  sources: t('fontes', 'sources', 'fuentes'),
  dashboards: t('painéis', 'dashboards', 'paneles'),
  reports: t('relatórios', 'reports', 'informes'),
  days: t('dias', 'days', 'días'),
  bots: t('bots', 'bots', 'bots'),
  actions: t('ações', 'actions', 'acciones'),
  entities: t('entidades', 'entities', 'entidades'),
  instructions: t('instruções', 'instructions', 'instrucciones'),
  segments: t('segmentos', 'segments', 'segmentos'),
  rules: t('regras', 'rules', 'reglas'),
  messages: t('mensagens', 'messages', 'mensajes'),
  percent: t('%', '%', '%'),
  calls: t('chamadas/mês', 'calls/month', 'llamadas/mes'),
  lines: t('linhas', 'lines', 'líneas'),
  menus: t('menus e níveis', 'menus and levels', 'menús y niveles'),
  greetings: t('saudações', 'greetings', 'saludos'),
  campaigns: t('campanhas', 'campaigns', 'campañas'),
  procedures: t('procedimentos', 'procedures', 'procedimientos'),
  topics: t('tópicos', 'topics', 'temas'),
  items: t('itens', 'items', 'ítems'),
  types: t('tipos', 'types', 'tipos'),
  locations: t('locais', 'locations', 'ubicaciones'),
  assets: t('ativos', 'assets', 'activos'),
  tickets: t('tickets', 'tickets', 'tickets'),
  years: t('anos', 'years', 'años'),
  gb: t('GB', 'GB', 'GB'),
  hours: t('horas', 'hours', 'horas'),
  stores: t('lojas', 'stores', 'tiendas'),
  queues: t('filas', 'queues', 'colas'),
  profiles: t('perfis', 'profiles', 'perfiles'),
} as const;
