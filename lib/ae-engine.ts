export const ACTION_FLOW_OPTIONS = [
  'Airtable',
  'Asana',
  'BambooHR',
  'Calendly',
  'Chargebee',
  'Claude',
  'Confluence',
  'Gemini',
  'GitHub',
  'Gmail',
  'Google Calendar',
  'Google Drive',
  'Google Forms',
  'Google Sheets',
  'HubSpot',
  'Incident.io',
  'Jamf',
  'Jira',
  'Klaviyo',
  'Linear',
  'Mailchimp',
  'Microsoft Calendar',
  'Microsoft Dynamics 365 Sales',
  'Microsoft Entra ID',
  'Microsoft Excel',
  'Microsoft Intune',
  'Microsoft OneDrive',
  'Microsoft Outlook',
  'Microsoft Planner',
  'Microsoft SharePoint',
  'Microsoft Teams',
  'New Relic',
  'Notion',
  'Okta',
  'OpenAI',
  'PagerDuty',
  'Recurly',
  'Salesforce',
  'Shopify',
  'Slack',
  'Snowflake',
  'Stripe',
  'SurveyMonkey',
  'Workday'
] as const;

const PLAN_RANK = {
  team: 1,
  growth: 2,
  professional: 3,
  enterprise: 4
} as const;

export const AE_DATABASE = {
  /** Unit hours ('Planilha de horas' column C) */
  horas_unitarias: {
    // Support configuration [rows 7-19]
    funcoes: 0.25,
    grupos: 0.05,
    campos_ticket: 0.08,
    condicionais_campos: 0.02,
    campos_usuario: 0.05,
    campos_organizacao: 0.05,
    visualizacoes: 0.08,
    macros: 0.08,
    gatilhos_simples: 0.08,
    gatilhos_complexos: 0.33,
    automacoes_simples: 0.08,
    automacoes_complexas: 0.33,
    politicas_sla: 0.17,
    // Voice configuration [rows 20-21]
    ivr: 0.59,
    saudacoes: 0.05,
    // Copilot configuration [rows 22-24]
    intencoes: 0.25,
    entidades: 0.33,
    procedimentos: 0.67,
    // WFM configuration [rows 25-32]
    wfm_localizacoes: 0.25,
    wfm_turnos: 0.25,
    wfm_grupos_trabalho: 0.08,
    wfm_equipes: 0.08,
    wfm_motivos_folga: 0.08,
    wfm_tarefas_gerais: 0.08,
    wfm_automacoes: 0.25,
    wfm_funcoes: 0.17,
    // QA configuration [rows 33-44]
    qa_destaques: 0.75,
    qa_quizzes: 0.5,
    qa_filtros: 0.5,
    qa_tabelas_desempenho: 0.5,
    qa_categorias_manuais: 0.17,
    qa_categorias_ia: 0.5,
    qa_usuarios: 0.05,
    qa_bots: 0.17,
    qa_espaco_trabalho: 0.25,
    qa_atribuicoes: 0.5,
    qa_grupos: 0.08,
    qa_hashtags: 0.05,
    // Base setup [rows 45-47]
    membro_equipe: 0.05,
    marca: 0.25,
    canal_email: 0.17,
    canal_web_form: 0.08,
    canal_web_widget: 0.42,
    canal_exige_reuniao: 0.17,
    /** Floor applied to the "channels requiring a meeting" bucket [row 47] */
    canal_exige_reuniao_minimo: 0.5,
    // Misc
    conteudo_dinamico: 0.08, // multi-language [row 110]
    artigo: 0.1, // Knowledge article [row 93]
    integracao_nativa: 2.0, // flat, every native integration [rows 74-79]
    action_flow: 4.5, // per external service [row 111]
    conversa_paralela: 0.5, // Teams / Slack side conversation [rows 94-95]
    sso: 2.0, // [row 51]
  },

  /** Per-module general configuration [row 52] */
  configuracoes_gerais: {
    support: 1.0,
    knowledge: 0.1,
    community: 1.0,
    analytics: 3.5,
    voice: 0.5,
    copilot: 0.5,
    qa: 1.0,
    wfm: 0.33,
    ai_agents: 0.75,
    adpp: 1.5,
  },

  /** Admin + agent training, summed per module [row 53] */
  treinamentos: {
    suite: 3.0, // Support and/or Knowledge and/or Analytics
    analytics_avancado: 6.0, // ADDITIVE on top of `suite`
    community: 1.5,
    voice: 2.5,
    copilot: 2.5,
    qa: 2.0,
    wfm: 3.0,
    ai_agents: 4.0,
    adpp: 1.0,
  },

  /** Fixed line items with hard-coded quantities [rows 54-63] */
  itens_fixos: {
    support: {
      encaminhamento_omnichannel: { qtd: 1, horas: 1.0 }, // [row 54]
      gatilho_webhook_instancia: { qtd: 1, horas: 0.5 }, // [row 55]
      webhooks: { qtd: 1, horas: 0.33 }, // [row 56]
    },
    /** Support items additionally requiring plan !== 'team' [rows 57-58] */
    support_nao_team: {
      pesquisa_satisfacao: { qtd: 1, horas: 0.25 },
      programacao_feriados: { qtd: 1, horas: 0.25 },
    },
    wfm: {
      cenarios_previsao: { qtd: 2, horas: 0.75 }, // [row 59]
      paineis_desempenho: { qtd: 1, horas: 0.75 }, // [row 60]
      urls_monitoradas: { qtd: 10, horas: 0.05 }, // [row 61]
    },
    adpp: {
      programacoes_exclusao: { qtd: 2, horas: 0.25 }, // [row 62]
      gatilhos_supressao: { qtd: 5, horas: 0.08 }, // [row 63]
    },
  },

  /** Aktie Now + marketplace apps [rows 49-50, 96-103] */
  apps: {
    condicionais_avancadas_base: 0.33, // [row 49]
    ticket_manager_base: 0.67, // [row 50]
    woocommerce: 1.5,
    dialpad: 1.5,
    aircall: 2.0,
    vtex: 1.0,
    stripe: 1.0,
    pipedrive: 1.0,
    sweethawk: 2.0, // per app
    other_marketplace: 5.0, // per app
  },

  /** Workshops [rows 104-109] */
  workshops: {
    suite: 1.0,
    voice: 0.5,
    copilot: 0.5,
    ai_agents: 0.5,
    qa: 0.5,
    wfm: 0.5,
  },

  /** Additional-hours block ('Calculadora AE' H3:H7 / I3:I7) */
  percentuais: {
    gerente_projetos: 0.176470588235294,
    comunicacao_tecnica: 0.1,
    discovery: 0.2,
    validacao: 0.15,
    go_live: 0.05,
    /** GP is only charged when the pre-GP total exceeds this, strictly [I3] */
    limite_gerente_projetos: 30,
  },

  /** Plan factors [rows 2-4] */
  fatores_plano: {
    funcoes: { team: 0, growth: 0, professional: 0, enterprise: 1 },
    campos_ticket: { team: 1, growth: 1.04, professional: 1.08, enterprise: 1.12 },
    sla: { team: 0, growth: 1, professional: 1, enterprise: 1.5 },
  },

  /** Operation-type factors [rows 5-6] */
  fatores_operacao: {
    campos_usuario: { B2C: 0, B2B: 0, B2E: 3 },
    campos_organizacao: { B2C: 0, B2B: 3, B2E: 3 },
  },
} as const;

// ---------------------------------------------------------------------------
// Channel taxonomy — 'Calculadora AE' rows 13-35, in sheet order
// ---------------------------------------------------------------------------

export const CHANNEL_KEYS = [
  'email', // B13
  'web_form', // B14
  'facebook_pages', // B15
  'x_pages', // B16
  'microsoft_teams', // B17
  'web_widget', // B18
  'facebook_messenger', // B19
  'slack', // B20
  'x_dm', // B21
  'sms', // B22
  'voice', // B23
  'ios', // B24
  'unity', // B25
  'line', // B26
  'apple_messages', // B27
  'wechat', // B28
  'google_rcs', // B29
  'google_business_messages', // B30
  'kakaotalk', // B31
  'telegram', // B32
  'whatsapp', // B33
  'instagram_page', // B34
  'instagram_dm', // B35
] as const;

export type ChannelKey = (typeof CHANNEL_KEYS)[number];

/**
 * Channels billed individually in [row 47]; everything else falls into the
 * "channels requiring a meeting" bucket. Voice is excluded because voice effort is
 * billed through the Voice module (IVR + greetings + general config) instead.
 */
const CHANNELS_BILLED_SEPARATELY = new Set<string>(['email', 'web_form', 'web_widget', 'voice']);

/**
 * Channels with their own dedicated weight in the ticket-fields formula [row 9].
 * Everything else contributes 6 points as an "other channel type". WhatsApp belongs
 * here — it has a dedicated weight of 8 and must NOT also be counted as an other type.
 */
const CHANNELS_WITH_OWN_TICKET_FIELD_WEIGHT = new Set<string>([
  'email',
  'web_form',
  'voice',
  'whatsapp',
]);

export type ZendeskPlan = 'team' | 'growth' | 'professional' | 'enterprise';
export type SkuType = 'CS' | 'ES';
export type OperationType = 'B2C' | 'B2B' | 'B2E';
export type ModuleKey =
  | 'Support'
  | 'Knowledge'
  | 'Community'
  | 'Analytics'
  | 'Voice'
  | 'Copilot'
  | 'QA'
  | 'WFM'
  | 'AI Agents'
  | 'ADPP';
export type MarketplaceAppKey =
  | 'woocommerce'
  | 'dialpad'
  | 'aircall'
  | 'vtex'
  | 'stripe'
  | 'pipedrive'
  | 'sweethawk'
  | 'other_marketplace';

export interface AEInputData {
  agents: number;
  brands: number;
  areas: number;
  skuType: SkuType;
  zendeskPlan: ZendeskPlan;
  operationTypes: OperationType[];

  /** Must be non-empty — see validateAEInputs */
  selectedModules: ModuleKey[];
  /** Must be non-empty — see validateAEInputs */
  selectedChannels: ChannelKey[];
  /** Per-channel quantity. A selected channel with no entry defaults to 1. */
  channelQuantities: Partial<Record<ChannelKey, number>>;

  knowledgeArticles: number;
  operationLanguages: number;
  analyticsTrainingType: 'basic' | 'advanced';

  /** Native Zendesk integrations — flat 2 h each, no quantity */
  selectedNativeConnections: string[];
  /** External services reached through Action Flow — 4.5 h each */
  selectedActionFlows?: string[];

  selectedApps: MarketplaceAppKey[];
  /** Only read for 'sweethawk' and 'other_marketplace', which are counts */
  appQuantities?: Partial<Record<MarketplaceAppKey, number>>;

  /** Aktie Now apps — each gated on its own checkbox */
  hasAppCondicionais: boolean;
  hasAppTicketManager: boolean;

  hasSSO: boolean;
  hasTeamsSideConv: boolean;
  hasSlackSideConv: boolean;
}

// ---------------------------------------------------------------------------
// Validation — the Calculate button should be disabled while this returns errors
// ---------------------------------------------------------------------------

export interface AEValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateAEInputs(inputs: Partial<AEInputData>): AEValidationResult {
  const errors: string[] = [];

  if (!inputs.selectedModules?.length) {
    errors.push('Select at least one Zendesk module.');
  }
  if (!inputs.selectedChannels?.length) {
    errors.push('Select at least one channel.');
  }
  if (!inputs.operationTypes?.length) {
    errors.push('Select at least one operation type (B2C, B2B or B2E).');
  }
  if (!inputs.zendeskPlan) {
    errors.push('Select a Zendesk plan.');
  }
  if (!inputs.skuType) {
    errors.push('Select an instance type (Customer Service or Employee Service).');
  }
  if (!inputs.agents || inputs.agents < 1) {
    errors.push('Number of agents must be at least 1.');
  }
  if (!inputs.brands || inputs.brands < 1) {
    errors.push('Number of brands must be at least 1.');
  }
  if (!inputs.areas || inputs.areas < 1) {
    errors.push('Number of areas must be at least 1.');
  }
  if (inputs.operationLanguages !== undefined && inputs.operationLanguages < 1) {
    errors.push('Number of operation languages must be at least 1.');
  }

  // A selected channel whose quantity is explicitly 0 contributes nothing, so a
  // selection made entirely of zeroes is the same as selecting no channel at all.
  if (inputs.selectedChannels?.length) {
    const anyActive = inputs.selectedChannels.some(
      (channel) => (inputs.channelQuantities?.[channel] ?? 1) > 0
    );
    if (!anyActive) {
      errors.push('At least one selected channel must have a quantity greater than zero.');
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

/** Uma linha detalhada, com quantidade e valor unitário reais. */
export interface AEDetailLine {
  /** Chave estável para tradução na UI (não é texto exibível). */
  key: string;
  qty: number;
  unitHours: number;
  hours: number;
}

export interface AEEstimateResult {
  /** Sum of every line item — the sheet's SUM('Validação de Fórmulas'!D:D) */
  lineItemHours: number;
  discoveryHours: number;
  validationHours: number;
  goLiveHours: number;
  commTechHours: number;
  gpHours: number;
  totalHours: number;
  /** Whether the estimate needs Sales Engineer review ('Calculadora AE'!C3) */
  requiresSalesEngineer: boolean;
  breakdown: Record<string, number>;
  quantities: Record<string, number>;
  /**
   * Abertura, item a item, dos grupos que `breakdown` só entrega somados.
   *
   * Existe porque a tabela de resultado precisa mostrar quantidade e horas de
   * cada linha, e antes ela tentava recompor esses números por conta própria —
   * com valores unitários fixados em 0, o que fazia linhas reais aparecerem
   * como "0.00h" enquanto o subtotal da seção vinha correto do `breakdown`.
   * Publicando a abertura aqui, a tabela apenas exibe o que o engine calculou e
   * não há como divergir.
   */
  details: {
    generalConfig: AEDetailLine[];
    training: AEDetailLine[];
    workshops: AEDetailLine[];
    fixedItems: AEDetailLine[];
    marketplaceApps: AEDetailLine[];
    aktieApps: AEDetailLine[];
    channelSetup: AEDetailLine[];
    dynamicContent: AEDetailLine[];
    baseSetup: AEDetailLine[];
    knowledge: AEDetailLine[];
    sideConversations: AEDetailLine[];
  };
  /**
   * Módulos que o plano de fato permite — e portanto os únicos que geraram
   * horas. `inputs.selectedModules` pode conter módulos acima do plano, que o
   * engine descarta em silêncio; a UI precisa saber disso para não desenhar uma
   * seção cujo subtotal é zero.
   */
  allowedModules: string[];
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Plano mínimo de cada módulo. Antes essa regra vivia só nos clientes, o que
 * deixava o engine incoerente consigo mesmo: com Analytics em Team, o
 * treinamento de Suite era cobrado mas o workshop não (`workshopSuite` exigia
 * Professional+). Aplicando o filtro aqui, engine e UI concordam sempre — e
 * estimativas antigas com módulos acima do plano recalculam sem eles.
 */
const MODULE_MIN_PLAN: Partial<Record<ModuleKey, ZendeskPlan>> = {
  Analytics: 'professional',
  Community: 'professional',
  Copilot: 'professional',
  QA: 'professional',
  WFM: 'professional',
  ADPP: 'enterprise',
};

function modulesAllowedOnPlan(selected: ModuleKey[], plan: ZendeskPlan): Set<string> {
  const allowed = new Set<string>();
  for (const mod of selected) {
    const min = MODULE_MIN_PLAN[mod];
    if (!min || PLAN_RANK[plan] >= PLAN_RANK[min]) allowed.add(mod);
  }
  return allowed;
}

export function calculateAEEstimate(inputs: AEInputData): AEEstimateResult {
  const validation = validateAEInputs(inputs);
  if (!validation.valid) {
    throw new Error(`Invalid AE inputs: ${validation.errors.join(' ')}`);
  }

  const UH = AE_DATABASE.horas_unitarias;
  const CFG = AE_DATABASE.configuracoes_gerais;
  const TR = AE_DATABASE.treinamentos;
  const FIX = AE_DATABASE.itens_fixos;
  const APPS = AE_DATABASE.apps;
  const WS = AE_DATABASE.workshops;
  const PCT = AE_DATABASE.percentuais;

  // --- Sanitised scalars ---------------------------------------------------
  const agents = Math.max(1, inputs.agents || 0);
  const brands = Math.max(1, inputs.brands || 0);
  const areas = Math.max(1, inputs.areas || 0);
  const knowledgeArticles = Math.max(0, inputs.knowledgeArticles || 0);
  const operationLanguages = Math.max(1, inputs.operationLanguages || 1);
  const plan = normalizePlan(inputs.zendeskPlan);
  const sku = normalizeSku(inputs.skuType);

  // --- Modules -------------------------------------------------------------
  // Módulos acima do plano contratado são descartados aqui, não só na UI.
  const modules = modulesAllowedOnPlan(inputs.selectedModules, plan);
  const hasSupport = modules.has('Support');
  const hasKnowledge = modules.has('Knowledge');
  const hasCommunity = modules.has('Community');
  const hasAnalytics = modules.has('Analytics');
  const hasVoice = modules.has('Voice');
  const hasCopilot = modules.has('Copilot');
  const hasQA = modules.has('QA');
  const hasWFM = modules.has('WFM');
  const hasAIAgents = modules.has('AI Agents');
  const hasADPP = modules.has('ADPP');

  // --- Channels ------------------------------------------------------------
  // A channel counts only when it is selected AND its quantity is > 0. Quantities
  // are NOT floored at 1, and unselected channels left over in form state are
  // ignored entirely, so `totalChannelQuantity` cannot be inflated by stale zeroes.
  const activeChannels = new Map<ChannelKey, number>();
  for (const channel of inputs.selectedChannels) {
    const qty = Math.max(0, inputs.channelQuantities?.[channel] ?? 1);
    if (qty > 0) activeChannels.set(channel, qty);
  }

  const channelQty = (channel: ChannelKey) => activeChannels.get(channel) ?? 0;
  const hasChannel = (channel: ChannelKey) => activeChannels.has(channel);

  /** SUM(B13:B35) */
  let totalChannelQuantity = 0;
  for (const qty of activeChannels.values()) totalChannelQuantity += qty;

  /** COUNTIF(B13:B35, ">0") */
  const totalChannelTypes = activeChannels.size;

  /** Channel types contributing 6 points each to ticket fields [row 9] */
  let otherChannelTypes = 0;
  for (const channel of activeChannels.keys()) {
    if (!CHANNELS_WITH_OWN_TICKET_FIELD_WEIGHT.has(channel)) otherChannelTypes += 1;
  }

  // --- Factors -------------------------------------------------------------
  const qtdOperacoes = inputs.operationTypes.length || 1;
  const fatorPlanoFuncoes = AE_DATABASE.fatores_plano.funcoes[plan] ?? 0;
  const fatorPlanoCamposTicket = AE_DATABASE.fatores_plano.campos_ticket[plan] ?? 1;
  const fatorPlanoSLA = AE_DATABASE.fatores_plano.sla[plan] ?? 1;

  const somaFatorOperacaoUsuario = inputs.operationTypes.reduce(
    (acc, op) => acc + (AE_DATABASE.fatores_operacao.campos_usuario[op] ?? 0),
    0
  );
  const somaFatorOperacaoOrganizacao = inputs.operationTypes.reduce(
    (acc, op) => acc + (AE_DATABASE.fatores_operacao.campos_organizacao[op] ?? 0),
    0
  );

  // --- Quantities [rows 7-44] ---------------------------------------------
  // Computed unconditionally, exactly as the sheet's column B does. The module
  // gates live on the hour totals below, not here, because the multi-language
  // base [row 110] reads several of these regardless of which modules are on.
  const q = {
    funcoes: Math.min(
      ((0.1 * agents + areas) * (0.25 + 0.75 * brands)) * fatorPlanoFuncoes,
      agents
    ),
    grupos:
      (0.1 * agents + 0.3 * areas) * (0.25 + 0.75 * brands) * (0.4 + qtdOperacoes * 0.6),
  } as Record<string, number>;

  q.campos_ticket =
    ((hasChannel('web_form') ? 10 : 0) +
      (hasChannel('email') ? 8 : 0) +
      (hasChannel('whatsapp') ? 8 : 0) +
      (hasChannel('voice') ? 5 : 0) +
      otherChannelTypes * 6) *
    (0.7 + 0.3 * brands) *
    fatorPlanoCamposTicket;

  q.condicionais_campos = q.campos_ticket * 0.5;
  q.campos_usuario = (2 * q.grupos + 2 * areas) * (1 + somaFatorOperacaoUsuario);
  q.campos_organizacao = 2 * areas * (1 + somaFatorOperacaoOrganizacao);
  q.visualizacoes = 12 + 0.1 * q.campos_ticket * areas + (hasCopilot ? 5 : 0);
  q.macros = q.campos_ticket * 0.5;
  q.gatilhos_simples =
    3 + (q.campos_ticket * 0.2 + totalChannelTypes * (3 + (hasCopilot ? 2 : 0)));
  q.gatilhos_complexos = q.gatilhos_simples * 0.25;
  q.automacoes_simples = 3 + (q.gatilhos_simples + q.gatilhos_complexos) * 0.3;
  q.automacoes_complexas = q.automacoes_simples * 0.25;
  q.politicas_sla =
    (totalChannelQuantity * (0.3 + 0.7 * brands) + q.grupos) * fatorPlanoSLA;

  q.ivr = plan === 'team' || plan === 'growth' ? 0 : 6 * channelQty('voice');
  q.saudacoes = 6 * q.ivr;

  q.intencoes =
    4 + q.campos_ticket * 0.1 * ((hasQA ? 0.2 : 0) + 1) * qtdOperacoes;
  q.entidades = q.campos_ticket * 0.1;
  q.procedimentos = (areas + q.grupos) * 0.5 * brands * qtdOperacoes;

  q.wfm_localizacoes = brands * qtdOperacoes;
  q.wfm_turnos = q.wfm_localizacoes * 2;
  q.wfm_grupos_trabalho = q.grupos + brands * qtdOperacoes + totalChannelTypes;
  q.wfm_equipes = q.grupos;
  q.wfm_motivos_folga = 5 + agents * 0.1;
  q.wfm_tarefas_gerais = (2 + q.grupos + areas + brands) * qtdOperacoes * 0.5;
  q.wfm_automacoes = 2 + q.wfm_equipes * 0.5 * q.wfm_turnos;
  q.wfm_funcoes = 2 + q.funcoes;

  q.qa_destaques = Math.min(10, Math.max(0, brands + qtdOperacoes + areas));
  q.qa_quizzes = areas + brands + qtdOperacoes;
  q.qa_filtros = (1 + 0.05 * q.grupos) * q.qa_destaques;
  q.qa_tabelas_desempenho = areas * qtdOperacoes * brands;
  q.qa_categorias_manuais = q.qa_tabelas_desempenho * 3;
  q.qa_categorias_ia = Math.max(0, 10 - q.qa_destaques);
  q.qa_usuarios = agents * 0.9;
  q.qa_bots = brands;
  q.qa_espaco_trabalho = brands;
  q.qa_atribuicoes = 0.5 * q.grupos;
  q.qa_grupos = q.grupos;
  q.qa_hashtags = q.campos_ticket * 0.05;

  const billed = (keys: string[]) =>
    keys.reduce((acc, key) => acc + q[key] * (UH as Record<string, number>)[key], 0);

  // --- Module configuration hours -----------------------------------------
  const supportConfigHoras = hasSupport
    ? billed([
        'funcoes',
        'grupos',
        'campos_ticket',
        'condicionais_campos',
        'campos_usuario',
        'campos_organizacao',
        'visualizacoes',
        'macros',
        'gatilhos_simples',
        'gatilhos_complexos',
        'automacoes_simples',
        'automacoes_complexas',
        'politicas_sla',
      ])
    : 0;

  const voiceConfigHoras = hasVoice ? billed(['ivr', 'saudacoes']) : 0;
  const copilotConfigHoras = hasCopilot
    ? billed(['intencoes', 'entidades', 'procedimentos'])
    : 0;
  const wfmConfigHoras = hasWFM
    ? billed([
        'wfm_localizacoes',
        'wfm_turnos',
        'wfm_grupos_trabalho',
        'wfm_equipes',
        'wfm_motivos_folga',
        'wfm_tarefas_gerais',
        'wfm_automacoes',
        'wfm_funcoes',
      ])
    : 0;
  const qaConfigHoras = hasQA
    ? billed([
        'qa_destaques',
        'qa_quizzes',
        'qa_filtros',
        'qa_tabelas_desempenho',
        'qa_categorias_manuais',
        'qa_categorias_ia',
        'qa_usuarios',
        'qa_bots',
        'qa_espaco_trabalho',
        'qa_atribuicoes',
        'qa_grupos',
        'qa_hashtags',
      ])
    : 0;

  // --- Base setup [rows 45-47] — all three gated on Support ---------------
  const agentSetupHoras = hasSupport ? agents * UH.membro_equipe : 0;
  const brandSetupHoras = hasSupport ? brands * UH.marca : 0;
  // Agentes e marcas só são cobrados com Support no escopo; sem essa trava a
  // tabela mostrava horas que o cálculo não somou.
  const baseSetupLines: AEDetailLine[] = hasSupport
    ? [
        { key: 'agents', qty: agents, unitHours: UH.membro_equipe, hours: agentSetupHoras },
        { key: 'brands', qty: brands, unitHours: UH.marca, hours: brandSetupHoras },
      ].filter((l) => l.qty > 0)
    : [];

  let meetingChannelQuantity = 0;
  for (const [channel, qty] of activeChannels) {
    if (!CHANNELS_BILLED_SEPARATELY.has(channel)) meetingChannelQuantity += qty;
  }

  /**
   * Canais têm tarifas DIFERENTES por tipo: e-mail, formulário web e widget são
   * cobrados individualmente, e todos os demais entram num bloco único sujeito
   * a um piso. Uma linha só de "Canais" multiplicada por uma tarifa média não
   * fecha com o cálculo — daí a abertura por tipo.
   */
  const meetingChannelHoras =
    meetingChannelQuantity > 0
      ? Math.max(
          UH.canal_exige_reuniao_minimo,
          meetingChannelQuantity * UH.canal_exige_reuniao,
        )
      : 0;

  const channelSetupLines: AEDetailLine[] = hasSupport
    ? [
        { key: 'email', qty: channelQty('email'), unitHours: UH.canal_email,
          hours: channelQty('email') * UH.canal_email },
        { key: 'web_form', qty: channelQty('web_form'), unitHours: UH.canal_web_form,
          hours: channelQty('web_form') * UH.canal_web_form },
        { key: 'web_widget', qty: channelQty('web_widget'), unitHours: UH.canal_web_widget,
          hours: channelQty('web_widget') * UH.canal_web_widget },
        {
          key: 'meeting_channels',
          qty: meetingChannelQuantity,
          // Com o piso ativo, a tarifa efetiva sobe: exibir a nominal faria a
          // linha não fechar com as próprias horas.
          unitHours: meetingChannelQuantity > 0 ? meetingChannelHoras / meetingChannelQuantity : 0,
          hours: meetingChannelHoras,
        },
      ].filter((l) => l.qty > 0)
    : [];

  const channelSetupHoras = channelSetupLines.reduce((acc, l) => acc + l.hours, 0);

  // --- Aktie Now apps [rows 49-50] — each on its own checkbox -------------
  const appCondicionaisHoras = inputs.hasAppCondicionais
    ? APPS.condicionais_avancadas_base +
      (q.visualizacoes * 0.1 + q.gatilhos_simples * 0.125) * 0.25
    : 0;
  const appTicketManagerHoras = inputs.hasAppTicketManager
    ? APPS.ticket_manager_base + q.campos_ticket * 0.02 * qtdOperacoes
    : 0;

  // --- SSO [row 51] --------------------------------------------------------
  const ssoHoras = inputs.hasSSO ? UH.sso : 0;

  // --- General configuration [row 52] -------------------------------------
  // Montado como lista para que a tabela mostre "Configuração geral: Support",
  // "…: Knowledge" etc. O total continua sendo a soma da própria lista — não há
  // uma segunda expressão que possa divergir dela.
  const generalConfigLines: AEDetailLine[] = [
    ['support', hasSupport, CFG.support],
    ['knowledge', hasKnowledge, CFG.knowledge],
    ['community', hasCommunity, CFG.community],
    ['analytics', hasAnalytics, CFG.analytics],
    ['voice', hasVoice, CFG.voice],
    ['copilot', hasCopilot, CFG.copilot],
    ['qa', hasQA, CFG.qa],
    ['wfm', hasWFM, CFG.wfm],
    ['ai_agents', hasAIAgents, CFG.ai_agents],
    ['adpp', hasADPP, CFG.adpp],
  ]
    .filter(([, on]) => on)
    .map(([key, , hours]) => ({
      key: key as string,
      qty: 1,
      unitHours: hours as number,
      hours: hours as number,
    }));
  const generalConfigHoras = generalConfigLines.reduce((acc, l) => acc + l.hours, 0);

  // --- Training [row 53] ---------------------------------------------------
  // `analytics_avancado` is additive on top of `suite`, matching the sheet.
  const trainingLines: AEDetailLine[] = [
    ['suite', hasSupport || hasKnowledge || hasAnalytics, TR.suite],
    [
      'analytics_avancado',
      hasAnalytics && inputs.analyticsTrainingType === 'advanced',
      TR.analytics_avancado,
    ],
    ['community', hasCommunity, TR.community],
    ['voice', hasVoice, TR.voice],
    ['copilot', hasCopilot, TR.copilot],
    ['qa', hasQA, TR.qa],
    ['wfm', hasWFM, TR.wfm],
    ['ai_agents', hasAIAgents, TR.ai_agents],
    ['adpp', hasADPP, TR.adpp],
  ]
    .filter(([, on]) => on)
    .map(([key, , hours]) => ({
      key: key as string,
      qty: 1,
      unitHours: hours as number,
      hours: hours as number,
    }));
  const trainingHoras = trainingLines.reduce((acc, l) => acc + l.hours, 0);

  // --- Fixed items [rows 54-63] -------------------------------------------
  const sumFixed = (group: Record<string, { qtd: number; horas: number }>) =>
    Object.values(group).reduce((acc, item) => acc + item.qtd * item.horas, 0);

  const supportNaoTeamQty = hasSupport && plan !== 'team' ? 1 : 0;

  /** Expande um grupo de itens fixos em linhas, preservando qtd × horas. */
  const fixedLines = (
    group: Record<string, { qtd: number; horas: number }>,
    active: boolean,
    multiplier = 1,
  ): AEDetailLine[] =>
    active
      ? Object.entries(group).map(([key, item]) => ({
          key,
          qty: item.qtd * multiplier,
          unitHours: item.horas,
          hours: item.qtd * multiplier * item.horas,
        }))
      : [];

  const fixedItemLines: AEDetailLine[] = [
    ...fixedLines(FIX.support, hasSupport),
    ...fixedLines(FIX.support_nao_team, supportNaoTeamQty > 0),
    ...fixedLines(FIX.wfm, hasWFM),
    ...fixedLines(FIX.adpp, hasADPP),
  ];

  const supportFixedHoras =
    (hasSupport ? sumFixed(FIX.support) : 0) +
    supportNaoTeamQty * sumFixed(FIX.support_nao_team);
  const wfmFixedHoras = hasWFM ? sumFixed(FIX.wfm) : 0;
  const adppFixedHoras = hasADPP ? sumFixed(FIX.adpp) : 0;

  // --- Native integrations [rows 74-79] — flat 2 h each -------------------
  const nativeConnectionsHoras =
    inputs.selectedNativeConnections.length * UH.integracao_nativa;

  // --- Knowledge articles [row 93] ----------------------------------------
  const knowledgeHoras = hasKnowledge
    ? Math.max(2, knowledgeArticles * UH.artigo)
    : 0;
  // O piso de 2 h faz a tarifa efetiva subir quando há poucos artigos; exibir a
  // nominal deixaria a linha sem fechar com as próprias horas. Sem artigo
  // nenhum, a linha vira um pacote mínimo de quantidade 1 — com quantidade 0 a
  // conta "0 × 2 h = 2 h" não se sustentaria na tela.
  const knowledgeLines: AEDetailLine[] = knowledgeHoras > 0
    ? [
        knowledgeArticles > 0
          ? {
              key: 'articles',
              qty: knowledgeArticles,
              unitHours: knowledgeHoras / knowledgeArticles,
              hours: knowledgeHoras,
            }
          : {
              key: 'articles_minimum',
              qty: 1,
              unitHours: knowledgeHoras,
              hours: knowledgeHoras,
            },
      ]
    : [];

  // --- Side conversations [rows 94-95] ------------------------------------
  const sideConvEligible = !(
    (sku === 'CS' && (plan === 'team' || plan === 'growth')) ||
    (sku === 'ES' && plan === 'team')
  );
  const sideConversationLines: AEDetailLine[] = sideConvEligible
    ? [
        ['teams', inputs.hasTeamsSideConv],
        ['slack', inputs.hasSlackSideConv],
      ]
        .filter(([, on]) => on)
        .map(([key]) => ({
          key: key as string,
          qty: 1,
          unitHours: UH.conversa_paralela,
          hours: UH.conversa_paralela,
        }))
    : [];
  const sideConversationHoras = sideConversationLines.reduce((acc, l) => acc + l.hours, 0);

  // --- Third-party apps [rows 96-103] -------------------------------------
  // Only sweethawk and other_marketplace are quantities; the rest are one-offs.
  const COUNTED_APPS = new Set<string>(['sweethawk', 'other_marketplace']);
  const marketplaceLines: AEDetailLine[] = inputs.selectedApps.map((app) => {
    const rate = (APPS as Record<string, number>)[app] ?? 0;
    const qty = COUNTED_APPS.has(app)
      ? Math.max(0, inputs.appQuantities?.[app] ?? 1)
      : 1;
    return { key: app, qty, unitHours: rate, hours: rate * qty };
  });
  const thirdPartyAppsHoras = marketplaceLines.reduce((acc, l) => acc + l.hours, 0);

  // --- Workshops [rows 104-109] -------------------------------------------
  const workshopSuite =
    hasSupport ||
    hasKnowledge ||
    ((hasCommunity || hasAnalytics) && (plan === 'professional' || plan === 'enterprise'));
  const workshopLines: AEDetailLine[] = [
    ['suite', workshopSuite, WS.suite],
    ['voice', hasVoice, WS.voice],
    ['copilot', hasCopilot, WS.copilot],
    ['ai_agents', hasAIAgents, WS.ai_agents],
    ['qa', hasQA, WS.qa],
    ['wfm', hasWFM, WS.wfm],
  ]
    .filter(([, on]) => on)
    .map(([key, , hours]) => ({
      key: key as string,
      qty: 1,
      unitHours: hours as number,
      hours: hours as number,
    }));
  const workshopHoras = workshopLines.reduce((acc, l) => acc + l.hours, 0);

  // --- Multi-language [row 110] -------------------------------------------
  // The sum below is a QUANTITY of dynamic-content items; it is converted to hours
  // by UH.conteudo_dinamico. Not gated on any module, matching the sheet.
  const additionalLanguages = Math.max(0, operationLanguages - 1);
  const dynamicContentQty =
    (q.funcoes +
      q.grupos +
      q.campos_ticket * 1.73 +
      q.campos_usuario * 1.8 +
      q.campos_organizacao * 1.8 +
      q.visualizacoes +
      q.macros +
      (q.gatilhos_simples +
        q.gatilhos_complexos +
        q.automacoes_simples +
        q.automacoes_complexas) *
        0.1 +
      q.intencoes +
      q.entidades +
      supportNaoTeamQty) *
    additionalLanguages;
  const operationLanguagesHoras = dynamicContentQty * UH.conteudo_dinamico;

  // --- Action Flow [row 111] ----------------------------------------------
  const actionFlowHoras = (inputs.selectedActionFlows?.length ?? 0) * UH.action_flow;

  // --- Line-item total = SUM('Validação de Fórmulas'!D:D) -----------------
  const lineItemHours =
    supportConfigHoras +
    voiceConfigHoras +
    copilotConfigHoras +
    wfmConfigHoras +
    qaConfigHoras +
    agentSetupHoras +
    brandSetupHoras +
    channelSetupHoras +
    appCondicionaisHoras +
    appTicketManagerHoras +
    ssoHoras +
    generalConfigHoras +
    trainingHoras +
    supportFixedHoras +
    wfmFixedHoras +
    adppFixedHoras +
    nativeConnectionsHoras +
    knowledgeHoras +
    sideConversationHoras +
    thirdPartyAppsHoras +
    workshopHoras +
    operationLanguagesHoras +
    actionFlowHoras;

  // --- Additional hours ('Calculadora AE' I3:I7) --------------------------
  // Discovery / Validation / Go-live / Comm. Técnica all share ONE base: the
  // line-item total less training, native integrations and third-party apps.
  // Workshops and the Aktie Now apps ARE included; that is deliberate.
  const percentBase =
    lineItemHours - trainingHoras - nativeConnectionsHoras - thirdPartyAppsHoras;

  const discoveryHours = percentBase * PCT.discovery;
  const validationHours = percentBase * PCT.validacao;
  const goLiveHours = percentBase * PCT.go_live;
  const commTechHours = percentBase * PCT.comunicacao_tecnica;

  // GP has its own base: training is INCLUDED, Comm. Técnica is EXCLUDED, and the
  // other three percentage lines are added in.
  const gpTrigger =
    lineItemHours + commTechHours + discoveryHours + validationHours + goLiveHours;
  const gpHours =
    gpTrigger > PCT.limite_gerente_projetos
      ? PCT.gerente_projetos *
        (lineItemHours -
          nativeConnectionsHoras -
          thirdPartyAppsHoras +
          discoveryHours +
          validationHours +
          goLiveHours)
      : 0;

  const totalHours =
    lineItemHours +
    discoveryHours +
    validationHours +
    goLiveHours +
    commTechHours +
    gpHours;

  // --- Sales Engineer flag ('Calculadora AE'!C3) --------------------------
  // The sheet also tests ITAM (E24), Help Center code customization (E31), Copilot
  // external actions (E33) and a deprecated vendor module (E12). All four are
  // intentionally out of scope, so those clauses are omitted rather than stubbed false.
  const requiresSalesEngineer =
    totalHours > 60 ||
    knowledgeArticles > 100 ||
    agents > 100 ||
    brands > 3 ||
    totalChannelQuantity > 10 ||
    hasAIAgents;

  return {
    lineItemHours,
    discoveryHours,
    validationHours,
    goLiveHours,
    commTechHours,
    gpHours,
    totalHours,
    requiresSalesEngineer,
    breakdown: {
      supportConfig: supportConfigHoras,
      voiceConfig: voiceConfigHoras,
      copilotConfig: copilotConfigHoras,
      wfmConfig: wfmConfigHoras,
      qaConfig: qaConfigHoras,
      agentSetup: agentSetupHoras,
      brandSetup: brandSetupHoras,
      channelSetup: channelSetupHoras,
      appCondicionais: appCondicionaisHoras,
      appTicketManager: appTicketManagerHoras,
      sso: ssoHoras,
      generalConfig: generalConfigHoras,
      training: trainingHoras,
      supportFixed: supportFixedHoras,
      wfmFixed: wfmFixedHoras,
      adppFixed: adppFixedHoras,
      nativeConnections: nativeConnectionsHoras,
      knowledge: knowledgeHoras,
      sideConversations: sideConversationHoras,
      thirdPartyApps: thirdPartyAppsHoras,
      workshops: workshopHoras,
      operationLanguages: operationLanguagesHoras,
      actionFlows: actionFlowHoras,
    },
    quantities: q,
    allowedModules: [...modules],
    details: {
      generalConfig: generalConfigLines,
      training: trainingLines,
      workshops: workshopLines,
      fixedItems: fixedItemLines,
      marketplaceApps: marketplaceLines,
      // Os apps da Aktie Now têm base fixa + parcela variável, então a hora
      // unitária É o próprio total: não há quantidade a multiplicar.
      aktieApps: [
        ...(appCondicionaisHoras > 0
          ? [{ key: 'condicionais_avancadas', qty: 1, unitHours: appCondicionaisHoras, hours: appCondicionaisHoras }]
          : []),
        ...(appTicketManagerHoras > 0
          ? [{ key: 'ticket_manager', qty: 1, unitHours: appTicketManagerHoras, hours: appTicketManagerHoras }]
          : []),
      ],
      channelSetup: channelSetupLines,
      baseSetup: baseSetupLines,
      knowledge: knowledgeLines,
      sideConversations: sideConversationLines,
      // A quantidade aqui é de ITENS de conteúdo dinâmico (derivada do escopo e
      // do número de idiomas extras), não de idiomas — por isso a linha mostrava
      // "1 idioma × nada".
      dynamicContent:
        operationLanguagesHoras > 0
          ? [{
              key: 'conteudo_dinamico',
              // Sem arredondar: `qty × unitHours` tem de bater exatamente com
              // `hours`, senão a linha exibida não fecha com ela mesma. O
              // arredondamento é responsabilidade da formatação na UI.
              qty: dynamicContentQty,
              unitHours: UH.conteudo_dinamico,
              hours: operationLanguagesHoras,
            }]
          : [],
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Tolerates 'Suite Professional' as well as 'professional'. A silent plan-key
 * mismatch would zero out the SLA factor without any error, so it is worth guarding.
 */
function normalizePlan(plan: string): ZendeskPlan {
  const key = String(plan).toLowerCase().replace(/^suite\s+/, '').trim();
  if (key === 'team' || key === 'growth' || key === 'professional' || key === 'enterprise') {
    return key;
  }
  throw new Error(`Unknown Zendesk plan: ${plan}`);
}

function normalizeSku(sku: string): SkuType {
  const key = String(sku).toUpperCase();
  if (key.includes('ES') || key.includes('EMPLOYEE')) return 'ES';
  return 'CS';
}
