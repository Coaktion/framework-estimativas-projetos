/**
 * Monta o prompt de Escopo Técnico a partir de uma estimativa da Calculadora AE.
 *
 * A montagem depende apenas do RESULTADO DO ENGINE e dos INPUTS, que as duas
 * telas têm. A de cálculo passa o snapshot congelado; a de visualização passa o
 * recálculo feito a partir do JSON salvo. O prompt sai idêntico.
 *
 * As linhas de [ITENS SELECIONADOS] e os subtotais de [DETALHAMENTO POR
 * CATEGORIA] saem de `buildAEResultTable`, a mesma tabela "Itens considerados"
 * da tela — com a função de tradução fixada no idioma do bloco.
 */

import type { AEEstimateResult, AEInputData } from './ae-engine';
import { AE_DATABASE } from './ae-engine';
import { buildAEResultTable } from './ae-result-table';
import { resolveAEFlags } from './scope-flags';
import {
  AE_NUMBERS, buildScopePrompt, normalizeScopeLocale,
  type ScopeExportChannel, type ScopeExportIntegration, type ScopeExportItem,
  type ScopeExportLocale, type ScopeExportVersionRef,
} from './scope-export';

/**
 * Rótulo de exibição de cada canal, na chave que o engine usa (nomes próprios;
 * os dois que se traduzem recebem o texto do idioma no chamador).
 */
export const AE_CHANNEL_LABELS: Record<string, string> = {
  email: 'Email',
  web_form: 'Web Form',
  web_widget: 'Web Widget',
  whatsapp: 'WhatsApp',
  facebook_messenger: 'Facebook Messenger',
  facebook_pages: 'Facebook Page',
  instagram_dm: 'Instagram Direct',
  instagram_page: 'Instagram Page',
  voice: 'Voice (Zendesk Talk)',
  microsoft_teams: 'Microsoft Teams',
  slack: 'Slack',
  x_dm: 'X DMs',
  x_pages: 'X (mensagens públicas)',
  sms: 'SMS / Text',
  ios: 'iOS SDK',
  unity: 'Unity SDK',
  line: 'LINE',
  apple_messages: 'Apple Messages for Business',
  wechat: 'WeChat',
  google_rcs: 'Google RCS',
  google_business_messages: 'Google Business Messages',
  kakaotalk: 'KakaoTalk',
  telegram: 'Telegram',
};

type GroupKey =
  | 'supportConfig' | 'voiceConfig' | 'copilotConfig' | 'wfmConfig' | 'qaConfig' | 'agentSetup'
  | 'brandSetup' | 'channelSetup' | 'appCondicionais' | 'appTicketManager' | 'sso' | 'generalConfig'
  | 'training' | 'supportFixed' | 'wfmFixed' | 'adppFixed' | 'nativeConnections' | 'knowledge'
  | 'sideConversations' | 'thirdPartyApps' | 'workshops' | 'actionFlows';

/** Textos fixos do prompt da Calculadora, por idioma do bloco. */
const TEXT: Record<ScopeExportLocale, {
  groups: Record<GroupKey, string>;
  calcHeader: string; effortGroups: string; itemsConsidered: string;
  channelsCategory: string; channelsSub: string; integrationsSub: string;
  kinds: { native: string; marketplace: string; actionFlow: string; aktie: string; sideConv: string };
  others: string;
  hoursIn: (group: string) => string; hoursInBucket: (hours: string) => string;
  impl: string; gp: string;
  calc: { items: string; discovery: string; validation: string; golive: string; techComm: string; gp: string };
  gpNotApplied: (limit: string) => string;
  facts: Record<string, string>;
  ops: Record<string, string>;
  yes: string; no: string; none: string;
  configFactory: string; configActive: string; configNotActive: string; configChanged: string;
  configLine: (id: string, date: string) => string;
}> = {
  pt: {
    groups: {
      supportConfig: 'Configuração Support', voiceConfig: 'Configuração Voice', copilotConfig: 'Configuração Copilot',
      wfmConfig: 'Configuração WFM', qaConfig: 'Configuração QA', agentSetup: 'Cadastro de agentes',
      brandSetup: 'Configuração de marcas', channelSetup: 'Configuração de canais', appCondicionais: 'App Condicionais Avançadas',
      appTicketManager: 'App Ticket Manager', sso: 'Single Sign-On (SSO)', generalConfig: 'Configurações gerais',
      training: 'Treinamento', supportFixed: 'Pacotes fixos Support', wfmFixed: 'Pacotes fixos WFM', adppFixed: 'Pacotes fixos ADPP',
      nativeConnections: 'Integrações nativas', knowledge: 'Configuração geral Knowledge (artigos)',
      sideConversations: 'Conversas paralelas (Side Conversations)', thirdPartyApps: 'Apps de Marketplace',
      workshops: 'Workshop', actionFlows: 'Action Flow',
    },
    calcHeader: 'Calculadora AE', effortGroups: 'Grupos de esforço', itemsConsidered: 'Itens considerados',
    channelsCategory: 'Canais', channelsSub: 'Canais', integrationsSub: 'Integrações',
    kinds: { native: 'Integração nativa', marketplace: 'Marketplace', actionFlow: 'Action Flow', aktie: 'App AktieNow', sideConv: 'Conversas paralelas' },
    others: 'Outros',
    hoursIn: (group) => `horas no grupo "${group}"`,
    hoursInBucket: (hours) => `horas no bloco de canais que exigem reunião (${hours} no total)`,
    impl: 'Implantação', gp: 'Gerente de Projeto',
    calc: { items: 'Itens de configuração', discovery: 'Discovery', validation: 'Validação', golive: 'Go-live', techComm: 'Comunicação técnica', gp: 'GP' },
    gpNotApplied: (limit) => `não aplicado: total abaixo de ${limit}h`,
    facts: {
      agents: 'Agentes', brands: 'Marcas', areas: 'Áreas / times com roteamento próprio', ops: 'Tipos de operação',
      articles: 'Artigos do Knowledge', sso: 'Single Sign-On (SSO)', teams: 'Conversas paralelas via Teams',
      slack: 'Conversas paralelas via Slack', condicionais: 'App Condicionais Avançadas (Aktie Now)',
      ticketManager: 'App Ticket Manager (Aktie Now)', marketplace: 'Apps de Marketplace', otherApps: 'Outros apps do Marketplace (texto livre)',
      native: 'Conexões nativas', actionFlow: 'Action Flow',
    },
    ops: { B2C: 'B2C (consumidor final)', B2B: 'B2B (empresas)', B2E: 'B2E (colaboradores)' },
    yes: 'sim', no: 'não', none: 'nenhum',
    configFactory: 'padrões de fábrica (nenhuma versão salva na época)',
    configActive: 'é a versão ativa hoje', configNotActive: 'NÃO é a versão ativa hoje',
    configChanged: 'as horas da biblioteca mudaram desde o cálculo',
    configLine: (id, date) => `#${id}, de ${date}`,
  },
  en: {
    groups: {
      supportConfig: 'Support configuration', voiceConfig: 'Voice configuration', copilotConfig: 'Copilot configuration',
      wfmConfig: 'WFM configuration', qaConfig: 'QA configuration', agentSetup: 'Agent setup',
      brandSetup: 'Brand setup', channelSetup: 'Channel setup', appCondicionais: 'Advanced Conditions app',
      appTicketManager: 'Ticket Manager app', sso: 'Single Sign-On (SSO)', generalConfig: 'General settings',
      training: 'Training', supportFixed: 'Fixed Support packages', wfmFixed: 'Fixed WFM packages', adppFixed: 'Fixed ADPP packages',
      nativeConnections: 'Native integrations', knowledge: 'Knowledge general configuration (articles)',
      sideConversations: 'Side Conversations', thirdPartyApps: 'Marketplace apps',
      workshops: 'Workshop', actionFlows: 'Action Flow',
    },
    calcHeader: 'AE Calculator', effortGroups: 'Effort groups', itemsConsidered: 'Items considered',
    channelsCategory: 'Channels', channelsSub: 'Channels', integrationsSub: 'Integrations',
    kinds: { native: 'Native integration', marketplace: 'Marketplace', actionFlow: 'Action Flow', aktie: 'Aktie Now app', sideConv: 'Side conversations' },
    others: 'Others',
    hoursIn: (group) => `hours in the "${group}" group`,
    hoursInBucket: (hours) => `hours in the block of channels that need a meeting (${hours} in total)`,
    impl: 'Implementation', gp: 'Project Manager',
    calc: { items: 'Configuration items', discovery: 'Discovery', validation: 'Validation', golive: 'Go-live', techComm: 'Technical communication', gp: 'PM' },
    gpNotApplied: (limit) => `not applied: total below ${limit}h`,
    facts: {
      agents: 'Agents', brands: 'Brands', areas: 'Areas / teams with their own routing', ops: 'Operation types',
      articles: 'Knowledge articles', sso: 'Single Sign-On (SSO)', teams: 'Side conversations via Teams',
      slack: 'Side conversations via Slack', condicionais: 'Advanced Conditions app (Aktie Now)',
      ticketManager: 'Ticket Manager app (Aktie Now)', marketplace: 'Marketplace apps', otherApps: 'Other Marketplace apps (free text)',
      native: 'Native connections', actionFlow: 'Action Flow',
    },
    ops: { B2C: 'B2C (consumers)', B2B: 'B2B (businesses)', B2E: 'B2E (employees)' },
    yes: 'yes', no: 'no', none: 'none',
    configFactory: 'factory defaults (no version saved at the time)',
    configActive: 'it is the active version today', configNotActive: 'it is NOT the active version today',
    configChanged: 'the library hours changed since the calculation',
    configLine: (id, date) => `#${id}, from ${date}`,
  },
  es: {
    groups: {
      supportConfig: 'Configuración de Support', voiceConfig: 'Configuración de Voice', copilotConfig: 'Configuración de Copilot',
      wfmConfig: 'Configuración de WFM', qaConfig: 'Configuración de QA', agentSetup: 'Registro de agentes',
      brandSetup: 'Configuración de marcas', channelSetup: 'Configuración de canales', appCondicionais: 'App Condicionales Avanzadas',
      appTicketManager: 'App Ticket Manager', sso: 'Single Sign-On (SSO)', generalConfig: 'Configuraciones generales',
      training: 'Capacitación', supportFixed: 'Paquetes fijos de Support', wfmFixed: 'Paquetes fijos de WFM', adppFixed: 'Paquetes fijos de ADPP',
      nativeConnections: 'Integraciones nativas', knowledge: 'Configuración general de Knowledge (artículos)',
      sideConversations: 'Conversaciones paralelas (Side Conversations)', thirdPartyApps: 'Apps de Marketplace',
      workshops: 'Workshop', actionFlows: 'Action Flow',
    },
    calcHeader: 'Calculadora AE', effortGroups: 'Grupos de esfuerzo', itemsConsidered: 'Ítems considerados',
    channelsCategory: 'Canales', channelsSub: 'Canales', integrationsSub: 'Integraciones',
    kinds: { native: 'Integración nativa', marketplace: 'Marketplace', actionFlow: 'Action Flow', aktie: 'App de Aktie Now', sideConv: 'Conversaciones paralelas' },
    others: 'Otros',
    hoursIn: (group) => `horas en el grupo "${group}"`,
    hoursInBucket: (hours) => `horas en el bloque de canales que requieren reunión (${hours} en total)`,
    impl: 'Implementación', gp: 'Gerente de Proyecto',
    calc: { items: 'Ítems de configuración', discovery: 'Discovery', validation: 'Validación', golive: 'Go-live', techComm: 'Comunicación técnica', gp: 'GP' },
    gpNotApplied: (limit) => `no aplicado: total por debajo de ${limit}h`,
    facts: {
      agents: 'Agentes', brands: 'Marcas', areas: 'Áreas / equipos con enrutamiento propio', ops: 'Tipos de operación',
      articles: 'Artículos de Knowledge', sso: 'Single Sign-On (SSO)', teams: 'Conversaciones paralelas vía Teams',
      slack: 'Conversaciones paralelas vía Slack', condicionais: 'App Condicionales Avanzadas (Aktie Now)',
      ticketManager: 'App Ticket Manager (Aktie Now)', marketplace: 'Apps de Marketplace', otherApps: 'Otras apps de Marketplace (texto libre)',
      native: 'Conexiones nativas', actionFlow: 'Action Flow',
    },
    ops: { B2C: 'B2C (consumidores)', B2B: 'B2B (empresas)', B2E: 'B2E (colaboradores)' },
    yes: 'sí', no: 'no', none: 'ninguno',
    configFactory: 'valores de fábrica (ninguna versión guardada en ese momento)',
    configActive: 'es la versión activa hoy', configNotActive: 'NO es la versión activa hoy',
    configChanged: 'las horas de la biblioteca cambiaron desde el cálculo',
    configLine: (id, date) => `#${id}, del ${date}`,
  },
};

/** Apps cobrados por quantidade; os demais contam 1 quando selecionados. */
const COUNTED_APP_LABELS = new Set(['SweetHawk', 'Outros', 'App Marketplace', 'Outro Marketplace', 'other_marketplace']);

/**
 * Apps de Marketplace como entram no prompt — IGUAL na tela de cálculo e na
 * de visualização: quantidade real (só SweetHawk e "Outros" têm quantidade) e
 * app com quantidade 0 fora, porque não gerou hora.
 */
export function marketplaceAppsForPrompt(
  selectedApps: unknown,
  appQuantities: Record<string, number> | null | undefined,
): Array<{ label: string; quantity: number }> {
  return (Array.isArray(selectedApps) ? selectedApps : [])
    .filter(Boolean)
    .map((label: string) => ({
      label: String(label),
      quantity: COUNTED_APP_LABELS.has(String(label))
        ? Math.max(0, Number(appQuantities?.[label] ?? 1) || 0)
        : 1,
    }))
    .filter((app) => app.quantity > 0);
}

const PLAN_LABEL: Record<string, string> = {
  team: 'Suite Team',
  growth: 'Suite Growth',
  professional: 'Suite Professional',
  enterprise: 'Suite Enterprise',
};

type TFunc = (key: string, params?: Record<string, any>) => string;

export interface AEScopePromptInput {
  /** Saída crua do engine. Sem ela não há prompt. */
  estimate: AEEstimateResult | null | undefined;
  /** Inputs normalizados que geraram `estimate`. */
  inputs: Partial<AEInputData> | null | undefined;

  clientName: string;
  versionLabel?: string | null;
  /** Posição da versão entre as versões da estimativa ("7 de 7"). */
  versionPosition?: { index: number; total: number } | null;
  versionCreatedAt?: Date | string | null;
  estimateId?: number | null;
  /** Origem do site (https://...) para o link da estimativa. */
  baseUrl?: string | null;
  /** Versão da configuração da Calculadora usada (painel "AE Calculator version"). */
  configInfo?: { usedId: number | null; usedAt: string | null; activeId: number | null; valuesChanged: boolean } | null;
  otherVersions?: ScopeExportVersionRef[] | null;

  zohoLink?: string | null;
  preSalesName?: string | null;

  /** Texto livre digitado pelo AE — vira o bloco [CONTEXTO DO CLIENTE]. */
  clientObjectives?: string | null;
  successIndicators?: string | null;

  deploymentType?: 'new' | 'optimization' | null;

  /** Apps de Marketplace, com o rótulo tal como aparece na tela. */
  marketplaceApps?: Array<{ label: string; quantity?: number | null }>;
  /** Texto livre "Quais outros apps?" (app "Outros"). */
  otherApp?: string | null;
  hasAppCondicionais?: boolean;
  hasAppTicketManager?: boolean;

  /** Linhas da seção [ZOHO CRM], quando a consulta ao Zoho foi feita. */
  zohoSection?: string[] | null;

  /** Idioma do bloco (o da interface). */
  locale?: ScopeExportLocale | string | null;
  /** Tradução FIXADA no idioma do bloco (i18n.getFixedT), para a tabela de itens. */
  t?: TFunc | null;
  /** Rótulos de canal já traduzidos, quando o chamador tiver melhores. */
  channelLabels?: Record<string, string>;
  skuLabel: string;
  generatedAt?: Date | null;
}

export function buildAEScopePrompt(input: AEScopePromptInput): string {
  const { estimate, inputs } = input;
  if (!estimate || !inputs) return '';
  const locale = normalizeScopeLocale(input.locale);
  const T = TEXT[locale];
  const t: TFunc = input.t || ((key: string, params?: Record<string, any>) => String(params?.defaultValue ?? key));

  const breakdown = (estimate.breakdown || {}) as Record<string, number>;
  const details = (estimate.details || {}) as Partial<NonNullable<AEEstimateResult['details']>>;
  const UH = { ...AE_DATABASE.horas_unitarias, ...((estimate as any).unitHours || {}) } as Record<string, number>;
  const labelFor = (key: string) => input.channelLabels?.[key] || AE_CHANNEL_LABELS[key] || String(key);
  const fmt2 = (n: number) => `${(Math.round(n * 100) / 100).toFixed(2).replace('.', locale === 'pt' ? ',' : '.')}h`;

  const modules: string[] = (
    estimate.allowedModules?.length ? estimate.allowedModules : inputs.selectedModules || []
  ).filter(Boolean) as string[];
  const moduleSet = new Set(modules);

  // Só canais que o engine de fato contou: selecionados E com quantidade > 0.
  const channelEntries = (inputs.selectedChannels || [])
    .map((key) => ({ key: String(key), quantity: Math.max(0, Number(inputs.channelQuantities?.[key] ?? 1)) }))
    .filter((c) => c.quantity > 0);
  const channels: ScopeExportChannel[] = channelEntries.map((c) => ({ label: labelFor(c.key), quantity: c.quantity }));

  const otherApp = String(input.otherApp || '').trim();
  const appLabel = (label: string) => (label === 'Outros' && otherApp ? `${T.others} (${otherApp})` : label === 'Outros' ? T.others : label);
  const marketplace = (input.marketplaceApps || []).filter((app) => app && app.label);
  const nativeNames = (inputs.selectedNativeConnections || []).filter(Boolean).map(String);
  const actionFlows = (inputs.selectedActionFlows || []).filter(Boolean).map(String);
  const sideConvs = [
    ...(inputs.hasSlackSideConv ? ['Slack'] : []),
    ...(inputs.hasTeamsSideConv ? ['Microsoft Teams'] : []),
  ];

  const integrations: ScopeExportIntegration[] = [
    ...nativeNames.map((name) => ({ kind: T.kinds.native, label: name, quantity: 1 })),
    ...marketplace.map((app) => ({ kind: T.kinds.marketplace, label: appLabel(String(app.label)), quantity: Math.max(1, Number(app.quantity ?? 1)) })),
    ...actionFlows.map((name) => ({ kind: T.kinds.actionFlow, label: name, quantity: 1 })),
    ...(input.hasAppCondicionais ? [{ kind: T.kinds.aktie, label: 'Condicionais Avançadas', quantity: 1 }] : []),
    ...(input.hasAppTicketManager ? [{ kind: T.kinds.aktie, label: 'Ticket Manager', quantity: 1 }] : []),
    ...sideConvs.map((name) => ({ kind: T.kinds.sideConv, label: name, quantity: 1 })),
  ];

  // ---- Itens -------------------------------------------------------------
  // 1) Grupos de esforço (formato da v2, mantido).
  const items: ScopeExportItem[] = Object.entries(breakdown)
    .filter(([, hours]) => Number(hours) > 0)
    .map(([key, hours]) => ({
      category: T.calcHeader,
      subcategory: T.effortGroups,
      label: T.groups[key as GroupKey] || key,
      quantity: 1,
      hours: Number(hours) || 0,
      totalOnly: true,
    }));

  // 2) Canais e integrações, com as horas reais (ou onde elas estão).
  const channelLine = (key: string) => (details.channelSetup || []).find((l) => l.key === key);
  const meeting = channelLine('meeting_channels');
  channelEntries.forEach((c) => {
    const own = channelLine(c.key);
    let hoursNote: string | null = null;
    if (!own) {
      if (c.key === 'web_form') hoursNote = T.hoursIn(T.groups.supportConfig);
      else if (c.key === 'voice') hoursNote = T.hoursIn(T.groups.voiceConfig);
      else if (meeting) hoursNote = T.hoursInBucket(fmt2(meeting.hours));
    }
    items.push({
      category: T.channelsCategory,
      subcategory: T.channelsSub,
      label: labelFor(c.key),
      quantity: c.quantity,
      hours: own ? own.hours : 0,
      unitHours: own ? own.unitHours : null,
      hoursNote,
    });
  });
  const nativeLines = details.nativeConnections || [];
  nativeNames.forEach((name) => {
    const line = nativeLines.find((l) => l.key === name);
    const hours = line ? line.hours : Number(UH.integracao_nativa) || 0;
    items.push({ category: T.kinds.native, subcategory: T.integrationsSub, label: name, quantity: 1, hours, unitHours: line ? line.unitHours : hours });
  });
  const appLines = details.marketplaceApps || [];
  marketplace.forEach((app) => {
    const line = appLines.find((l) => l.key === String(app.label) || t(`aeApps.${l.key}`, { defaultValue: l.key }) === String(app.label));
    items.push({
      category: T.kinds.marketplace,
      subcategory: T.integrationsSub,
      label: appLabel(String(app.label)),
      quantity: Math.max(1, Number(app.quantity ?? 1)),
      hours: line ? line.hours : 0,
      unitHours: line ? line.unitHours : null,
      hoursNote: line ? null : T.hoursIn(T.groups.thirdPartyApps),
    });
  });
  actionFlows.forEach((name) => {
    const unit = Number(UH.action_flow) || 0;
    items.push({ category: T.kinds.actionFlow, subcategory: T.integrationsSub, label: name, quantity: 1, hours: unit, unitHours: unit });
  });

  // 3) Itens considerados: as linhas da tabela da tela, por grupo.
  const table = buildAEResultTable(estimate, inputs, t);
  const estimatedGroups: string[] = [];
  table.sections
    .filter((s) => s.key !== 'variables')
    .forEach((section) => {
      const sub = `${T.itemsConsidered} — ${section.title}`;
      estimatedGroups.push(`${T.calcHeader} / ${sub}`);
      section.rows.forEach((row) => items.push({
        category: T.calcHeader,
        subcategory: sub,
        label: row.label,
        quantity: row.qty,
        hours: row.hours,
        unitHours: row.unitHours,
      }));
    });

  // ---- Flags (dos mesmos inputs e linhas) ---------------------------------
  const fixed = details.fixedItems || [];
  const fixedQty = (key: string) => Number(fixed.find((l) => l.key === key)?.qty) || 0;
  const quantities = (estimate.quantities || {}) as Record<string, number>;
  const flags = resolveAEFlags({
    modules: moduleSet,
    channels: Object.fromEntries(channelEntries.map((c) => [c.key, c.quantity])),
    nativeConnections: nativeNames.length,
    actionFlows: actionFlows.length,
    marketplaceApps: marketplace.length,
    aktieApps: (input.hasAppCondicionais ? 1 : 0) + (input.hasAppTicketManager ? 1 : 0),
    sso: Boolean(inputs.hasSSO),
    sideConversations: sideConvs.length > 0,
    slaPolicies: moduleSet.has('Support') && Number(breakdown.supportConfig) > 0 ? Number(quantities.politicas_sla) || 0 : 0,
    csat: fixedQty('pesquisa_satisfacao'),
  });

  // ---- Dimensionamento ---------------------------------------------------
  const pct = estimate.percents || {
    discovery: 0.2, validacao: 0.15, go_live: 0.05, comunicacao_tecnica: 0.1,
    gerente_projetos: 0.176470588235294, limite_gerente_projetos: 30,
  };
  const asPercent = (fraction: number) => Math.round(Number(fraction || 0) * 10000) / 100;
  const gpApplied = Number(estimate.gpHours) > 0;
  const gpNote = gpApplied ? undefined : T.gpNotApplied(String(pct.limite_gerente_projetos));
  const percentLines = [
    { label: T.calc.discovery, value: asPercent(pct.discovery) },
    { label: T.calc.validation, value: asPercent(pct.validacao) },
    { label: T.calc.golive, value: asPercent(pct.go_live) },
    { label: T.calc.techComm, value: asPercent(pct.comunicacao_tecnica) },
    { label: T.calc.gp, value: gpApplied ? asPercent(pct.gerente_projetos) : 0, note: gpNote },
  ];
  const percentBase = Number(estimate.percentBase);
  const gpBase = Number(estimate.gpBase);
  const percentBases = Number.isFinite(percentBase)
    ? [
        { label: T.calc.discovery, percent: asPercent(pct.discovery), base: percentBase, hours: Number(estimate.discoveryHours) || 0 },
        { label: T.calc.validation, percent: asPercent(pct.validacao), base: percentBase, hours: Number(estimate.validationHours) || 0 },
        { label: T.calc.golive, percent: asPercent(pct.go_live), base: percentBase, hours: Number(estimate.goLiveHours) || 0 },
        { label: T.calc.techComm, percent: asPercent(pct.comunicacao_tecnica), base: percentBase, hours: Number(estimate.commTechHours) || 0 },
        ...(Number.isFinite(gpBase)
          ? [{ label: T.calc.gp, percent: gpApplied ? asPercent(pct.gerente_projetos) : 0, base: gpBase, hours: Number(estimate.gpHours) || 0, note: gpNote }]
          : []),
      ]
    : null;
  const calculatedHours = [
    { label: T.calc.items, hours: Number(estimate.lineItemHours) || 0 },
    { label: T.calc.discovery, hours: Number(estimate.discoveryHours) || 0 },
    { label: T.calc.validation, hours: Number(estimate.validationHours) || 0 },
    { label: T.calc.golive, hours: Number(estimate.goLiveHours) || 0 },
    { label: T.calc.techComm, hours: Number(estimate.commTechHours) || 0 },
    { label: T.calc.gp, hours: Number(estimate.gpHours) || 0 },
  ];

  // ---- Detalhamento por categoria: os grupos da tela ---------------------
  const categories = table.sections.map((s) => ({ label: s.title, hours: s.subtotal, subcategories: [] }));

  // ---- Dados informados: TODOS os inputs, inclusive os vazios ------------
  const F = T.facts;
  const yesNo = (v: unknown) => (v ? T.yes : T.no);
  const list = (values: string[]) => (values.length ? values.join(', ') : T.none);
  const knowledgeArticles = Number(inputs.knowledgeArticles) || 0;
  const facts = [
    { label: F.agents, value: String(Number(inputs.agents) || 0) },
    { label: F.brands, value: String(Number(inputs.brands) || 0) },
    { label: F.areas, value: String(Number(inputs.areas) || 0) },
    { label: F.ops, value: list((inputs.operationTypes || []).map((o) => T.ops[String(o)] || String(o))) },
    { label: F.articles, value: moduleSet.has('Knowledge') ? String(knowledgeArticles) : '' },
    { label: F.sso, value: yesNo(inputs.hasSSO) },
    { label: F.teams, value: yesNo(inputs.hasTeamsSideConv) },
    { label: F.slack, value: yesNo(inputs.hasSlackSideConv) },
    { label: F.native, value: list(nativeNames) },
    { label: F.actionFlow, value: list(actionFlows) },
    { label: F.marketplace, value: list(marketplace.map((app) => appLabel(String(app.label)))) },
    { label: F.condicionais, value: yesNo(input.hasAppCondicionais) },
    { label: F.ticketManager, value: yesNo(input.hasAppTicketManager) },
    { label: F.otherApps, value: otherApp },
  ];

  // ---- Versão da configuração da Calculadora ------------------------------
  let calculatorVersion: string | null = null;
  if (input.configInfo) {
    const info = input.configInfo;
    const when = info.usedAt ? new Date(info.usedAt) : null;
    const date = when && !Number.isNaN(when.getTime())
      ? (locale === 'en'
          ? `${String(when.getMonth() + 1).padStart(2, '0')}/${String(when.getDate()).padStart(2, '0')}/${when.getFullYear()}`
          : `${String(when.getDate()).padStart(2, '0')}/${String(when.getMonth() + 1).padStart(2, '0')}/${when.getFullYear()}`)
      : '---';
    const head = info.usedId == null ? T.configFactory : T.configLine(String(info.usedId), date);
    const status = info.usedId === info.activeId ? T.configActive : T.configNotActive;
    calculatorVersion = `${head} — ${status}${info.valuesChanged ? `; ${T.configChanged}` : ''}`;
  }

  const planKey = String(inputs.zendeskPlan || 'professional').toLowerCase();
  const base = String(input.baseUrl || '').replace(/\/+$/, '');

  return buildScopePrompt({
    origin: 'calculadora-ae',
    locale,
    numbers: AE_NUMBERS,
    clientName: input.clientName,
    projectName: input.clientName,
    versionName: input.versionLabel || 'v1',
    versionPosition: input.versionPosition || null,
    versionCreatedAt: input.versionCreatedAt || null,
    estimateId: input.estimateId ?? null,
    toolCenterUrl: base && input.estimateId ? `${base}/ae/${input.estimateId}` : null,
    calculatorVersion,
    generatedAt: input.generatedAt || new Date(),
    zohoLink: input.zohoLink || null,
    preSalesName: input.preSalesName || null,
    totalHours: estimate.totalHours,
    // A Calculadora não separa horas por skill: tudo o que não é GP é
    // Implantação (itens + Discovery + Validação + Go-live + Comunicação
    // técnica), de modo que Implantação + GP fecham com o total.
    skillHours: {
      'Implantação': (Number(estimate.totalHours) || 0) - (Number(estimate.gpHours) || 0),
      'GP': Number(estimate.gpHours) || 0,
    },
    skillLabels: { 'Implantação': T.impl, 'GP': T.gp, 'Solution Design': 'Solution Design', 'Desenvolvimento': locale === 'pt' ? 'Desenvolvimento' : locale === 'es' ? 'Desarrollo' : 'Development', 'Design': locale === 'es' ? 'Diseño' : 'Design' },
    percentLines,
    percentBases,
    calculatedHours,
    planTierLabel: PLAN_LABEL[planKey] || `Suite ${planKey}`,
    skuLabel: input.skuLabel,
    deploymentType: input.deploymentType || null,
    modules,
    channels,
    integrations,
    flags,
    categories,
    categoryFooter: { lineItems: Number(estimate.lineItemHours) || 0, total: Number(estimate.totalHours) || 0 },
    items,
    estimatedItemGroups: estimatedGroups,
    clientObjectives: input.clientObjectives || null,
    successIndicators: input.successIndicators || null,
    facts,
    includeEmptyFacts: true,
    zohoSection: input.zohoSection || null,
    otherVersions: input.otherVersions || null,
  });
}
