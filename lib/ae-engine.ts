import { CHANNEL_KEYS, type ChannelKey } from './ae-engine-keys';
import { DEFAULT_AE_CONFIG, DEFAULT_AE_NUMBERS, QUANTITY_FORMULAS, quantityEvaluationOrder, type AEConfig } from './ae-config';
import { runFormula } from './formula';

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

/**
 * Números do engine (horas unitárias, percentuais, fatores...).
 *
 * Os valores agora vivem em `ae-config.ts` e são editáveis no painel Admin
 * (aba "Calculadora AE"). `AE_DATABASE` continua exportado com os PADRÕES de
 * fábrica para quem só precisa deles.
 */
export const AE_DATABASE = DEFAULT_AE_NUMBERS;

// ---------------------------------------------------------------------------
// Channel taxonomy — 'Calculadora AE' rows 13-35, in sheet order
// ---------------------------------------------------------------------------

export { CHANNEL_KEYS };
export type { ChannelKey };

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
/**
 * Módulos que a Calculadora AE dimensiona.
 *
 * 'AI Agents' NÃO está na lista: a Calculadora não estima AI Agents (nem
 * configuração geral, nem treinamento, nem workshop). O módulo continua
 * existindo no Framework e no painel administrativo — a exclusão vale só aqui.
 * Estimativas antigas que gravaram 'AI Agents' são higienizadas em
 * `modulesAllowedOnPlan` (ver AE_UNSUPPORTED_MODULES).
 */
export type ModuleKey =
  | 'Support'
  | 'Knowledge'
  | 'Community'
  | 'Analytics'
  | 'Voice'
  | 'Copilot'
  | 'QA'
  | 'WFM'
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

  /**
   * Artigos de Knowledge. Alimenta a configuração geral de Knowledge —
   * 0,1 h por artigo, com piso de 2 h. Não há mais nenhuma outra linha de
   * Knowledge no cálculo.
   */
  knowledgeArticles: number;

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

/**
 * Um problema de validação, em forma TRADUZÍVEL.
 *
 * A UI monta a mensagem com `t('aeValidation.' + code, params)`. Antes a
 * validação devolvia só frases em inglês cravadas no engine, que apareciam em
 * inglês mesmo com a interface em português. `message` continua existindo como
 * texto de último recurso (logs, chamadas fora da UI).
 */
export interface AEValidationIssue {
  code: string;
  params?: Record<string, string | number>;
  message: string;
}

export interface AEValidationResult {
  valid: boolean;
  /** Frases em inglês — mantidas para quem já consumia este campo. */
  errors: string[];
  issues: AEValidationIssue[];
}

/** Limite de marcas por plano. `null` = sem limite. */
export const BRAND_LIMIT_BY_PLAN: Record<ZendeskPlan, number | null> = {
  team: 1,
  growth: 5,
  professional: 5,
  enterprise: null,
};

/** Limite de formulários web por plano. `null` = sem limite. */
export const WEB_FORM_LIMIT_BY_PLAN: Record<ZendeskPlan, number | null> = {
  team: 1,
  growth: null,
  professional: null,
  enterprise: null,
};

export const PLAN_DISPLAY_NAME: Record<ZendeskPlan, string> = {
  team: 'Suite Team',
  growth: 'Suite Growth',
  professional: 'Suite Professional',
  enterprise: 'Suite Enterprise',
};

export function validateAEInputs(inputs: Partial<AEInputData>): AEValidationResult {
  const issues: AEValidationIssue[] = [];
  const add = (
    code: string,
    message: string,
    params?: Record<string, string | number>,
  ) => issues.push({ code, message, params });

  if (!inputs.selectedModules?.length) {
    add('selectModule', 'Select at least one Zendesk module.');
  }
  if (!inputs.selectedChannels?.length) {
    add('selectChannel', 'Select at least one channel.');
  }
  if (!inputs.operationTypes?.length) {
    add('selectOperation', 'Select at least one operation type (B2C, B2B or B2E).');
  }
  if (!inputs.zendeskPlan) {
    add('selectPlan', 'Select a Zendesk plan.');
  }
  if (!inputs.skuType) {
    add('selectSku', 'Select an instance type (Customer Service or Employee Service).');
  }
  if (!inputs.agents || inputs.agents < 1) {
    add('minAgents', 'Number of agents must be at least 1.');
  }
  if (!inputs.brands || inputs.brands < 1) {
    add('minBrands', 'Number of brands must be at least 1.');
  }
  if (!inputs.areas || inputs.areas < 1) {
    add('minAreas', 'Number of areas must be at least 1.');
  }

  /* ---------------------------------------------------------------------- *
   * TETOS DO PLANO ZENDESK                                                  *
   *                                                                         *
   * São limites do produto, não escolhas de dimensionamento: um Suite Team  *
   * não tem como ter duas marcas. Sem estas travas a calculadora produzia   *
   * felizmente uma estimativa para um cenário impossível de contratar.      *
   * ---------------------------------------------------------------------- */
  let planKey: ZendeskPlan | null = null;
  try {
    if (inputs.zendeskPlan) planKey = normalizePlan(inputs.zendeskPlan);
  } catch {
    planKey = null;
  }

  if (planKey) {
    const planName = PLAN_DISPLAY_NAME[planKey];

    const brandLimit = BRAND_LIMIT_BY_PLAN[planKey];
    if (brandLimit !== null && Number(inputs.brands || 0) > brandLimit) {
      if (brandLimit === 1) {
        add('teamSingleBrand', `${planName} only allows a single Brand.`, {
          plan: planName,
        });
      } else {
        add(
          'planBrandLimit',
          `${planName} only allows for up to ${brandLimit} Brands.`,
          { plan: planName, limit: brandLimit },
        );
      }
    }

    const webFormLimit = WEB_FORM_LIMIT_BY_PLAN[planKey];
    if (webFormLimit !== null) {
      const webFormQty = Number(inputs.channelQuantities?.web_form ?? 0);
      const webFormSelected = (inputs.selectedChannels || []).includes('web_form');
      if (webFormSelected && webFormQty > webFormLimit) {
        add('teamSingleWebForm', `${planName} only allows a single web form.`, {
          plan: planName,
        });
      }
    }
  }

  // A selected channel whose quantity is explicitly 0 contributes nothing, so a
  // selection made entirely of zeroes is the same as selecting no channel at all.
  if (inputs.selectedChannels?.length) {
    const anyActive = inputs.selectedChannels.some(
      (channel) => (inputs.channelQuantities?.[channel] ?? 1) > 0
    );
    if (!anyActive) {
      add(
        'channelQtyZero',
        'At least one selected channel must have a quantity greater than zero.',
      );
    }
  }

  return {
    valid: issues.length === 0,
    errors: issues.map((i) => i.message),
    issues,
  };
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
  /** Horas unitárias usadas neste cálculo (vêm da configuração do Admin). */
  unitHours: Record<string, number>;
  /** Tarifas de apps usadas neste cálculo. */
  appRates: Record<string, number>;
  /** Base de Discovery/Validação/Go-live/Comunicação técnica (fórmula base_percentuais). */
  percentBase: number;
  /** Gatilho do GP (comparado a limite_gerente_projetos) e base sobre a qual o GP incide. */
  gpTrigger: number;
  gpBase: number;
  /** Percentuais usados neste cálculo (frações: 0.2 = 20%). */
  percents: {
    discovery: number;
    validacao: number;
    go_live: number;
    comunicacao_tecnica: number;
    gerente_projetos: number;
    limite_gerente_projetos: number;
  };
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

/**
 * Módulos que a Calculadora AE não dimensiona, ainda que apareçam em dados
 * gravados antes desta mudança.
 *
 * Descartá-los aqui — e não só na UI — garante que reabrir uma estimativa
 * antiga recalcule SEM as horas de AI Agents, em vez de exibir uma tabela que
 * não fecha com o total salvo.
 */
const AE_UNSUPPORTED_MODULES = new Set<string>(['AI Agents']);

function modulesAllowedOnPlan(selected: ModuleKey[], plan: ZendeskPlan): Set<string> {
  const allowed = new Set<string>();
  for (const mod of selected) {
    if (AE_UNSUPPORTED_MODULES.has(mod as string)) continue;
    const min = MODULE_MIN_PLAN[mod];
    if (!min || PLAN_RANK[plan] >= PLAN_RANK[min]) allowed.add(mod);
  }
  return allowed;
}

/**
 * Calcula a estimativa com a configuração informada (padrão de fábrica quando
 * omitida). Números e fórmulas vêm de `config` — editável no painel Admin.
 */
export function calculateAEEstimate(
  inputs: AEInputData,
  config: AEConfig = DEFAULT_AE_CONFIG,
): AEEstimateResult {
  const validation = validateAEInputs(inputs);
  if (!validation.valid) {
    throw new Error(`Invalid AE inputs: ${validation.errors.join(' ')}`);
  }

  const N = config.numbers;
  const F = config.formulas;
  const UH = N.horas_unitarias;
  const CFG = N.configuracoes_gerais;
  const TR = N.treinamentos;
  const FIX = N.itens_fixos;
  const APPS = N.apps;
  const WS = N.workshops;
  const PCT = N.percentuais;
  const SE = N.sales_engineer;

  // --- Sanitised scalars ---------------------------------------------------
  const agents = Math.max(1, inputs.agents || 0);
  const brands = Math.max(1, inputs.brands || 0);
  const areas = Math.max(1, inputs.areas || 0);
  const knowledgeArticles = Math.max(0, inputs.knowledgeArticles || 0);
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
  const fatorPlanoFuncoes = N.fatores_plano.funcoes[plan] ?? 0;
  const fatorPlanoCamposTicket = N.fatores_plano.campos_ticket[plan] ?? 1;
  const fatorPlanoSLA = N.fatores_plano.sla[plan] ?? 1;

  const somaFatorOperacaoUsuario = inputs.operationTypes.reduce(
    (acc, op) => acc + (N.fatores_operacao.campos_usuario[op] ?? 0),
    0
  );
  const somaFatorOperacaoOrganizacao = inputs.operationTypes.reduce(
    (acc, op) => acc + (N.fatores_operacao.campos_organizacao[op] ?? 0),
    0
  );

  // --- Quantities [rows 7-44] ---------------------------------------------
  // Computed unconditionally, exactly as the sheet's column B does. The module
  // gates live on the hour totals below, not here.
  //
  // As fórmulas vêm da configuração (painel Admin › Calculadora AE), na ordem
  // de QUANTITY_FORMULAS: cada uma enxerga as variáveis de entrada abaixo e as
  // quantidades calculadas antes dela.
  const formulaVars: Record<string, number> = {
    agentes: agents,
    marcas: brands,
    areas,
    artigos_knowledge: knowledgeArticles,
    qtd_operacoes: qtdOperacoes,
    total_qtd_canais: totalChannelQuantity,
    tipos_canais: totalChannelTypes,
    outros_tipos_canais: otherChannelTypes,
    fator_plano_funcoes: fatorPlanoFuncoes,
    fator_plano_campos_ticket: fatorPlanoCamposTicket,
    fator_plano_sla: fatorPlanoSLA,
    soma_fator_operacao_usuario: somaFatorOperacaoUsuario,
    soma_fator_operacao_organizacao: somaFatorOperacaoOrganizacao,
    plano_team: plan === 'team' ? 1 : 0,
    plano_growth: plan === 'growth' ? 1 : 0,
    plano_professional: plan === 'professional' ? 1 : 0,
    plano_enterprise: plan === 'enterprise' ? 1 : 0,
    sku_cs: sku === 'CS' ? 1 : 0,
    sku_es: sku === 'ES' ? 1 : 0,
    tem_support: hasSupport ? 1 : 0,
    tem_knowledge: hasKnowledge ? 1 : 0,
    tem_community: hasCommunity ? 1 : 0,
    tem_analytics: hasAnalytics ? 1 : 0,
    tem_voice: hasVoice ? 1 : 0,
    tem_copilot: hasCopilot ? 1 : 0,
    tem_qa: hasQA ? 1 : 0,
    tem_wfm: hasWFM ? 1 : 0,
    tem_adpp: hasADPP ? 1 : 0,
  };
  for (const channel of CHANNEL_KEYS) {
    formulaVars[`canal_${channel}`] = channelQty(channel);
    formulaVars[`tem_canal_${channel}`] = hasChannel(channel) ? 1 : 0;
  }

  // Ordem de cálculo pelas dependências entre fórmulas; o objeto final mantém
  // a ordem de exibição padrão das quantidades.
  const computed: Record<string, number> = {};
  const defaults = new Map(QUANTITY_FORMULAS.map((spec) => [spec.key, spec.default]));
  for (const key of quantityEvaluationOrder(F).order) {
    computed[key] = runFormula(F[key] || defaults.get(key) || '0', { ...formulaVars, ...computed });
  }
  const q: Record<string, number> = {};
  for (const spec of QUANTITY_FORMULAS) q[spec.key] = computed[spec.key] ?? 0;

  const billed = (keys: string[]) =>
    keys.reduce((acc, key) => acc + q[key] * (UH as Record<string, number>)[key], 0);

  // --- Module configuration hours -----------------------------------------
  const supportConfigHoras = hasSupport
    ? billed([
        'funcoes',
        'grupos',
        'campos_ticket',
        // Formulários entram na configuração de Support: deixaram de ser um
        // item de canal e passaram a ser um item de estrutura do escopo.
        'formularios',
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
        // O canal Formulário web NÃO é mais cobrado aqui: virou o item
        // "Formulários" na configuração de Support, que mede o total de
        // formulários criados e não só os publicados ao usuário final.
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
  const appVars = {
    ...formulaVars,
    ...q,
    base_condicionais_avancadas: APPS.condicionais_avancadas_base,
    base_ticket_manager: APPS.ticket_manager_base,
  };
  const appCondicionaisHoras = inputs.hasAppCondicionais
    ? runFormula(F.horas_app_condicionais, appVars)
    : 0;
  const appTicketManagerHoras = inputs.hasAppTicketManager
    ? runFormula(F.horas_app_ticket_manager, appVars)
    : 0;

  // --- SSO [row 51] --------------------------------------------------------
  const ssoHoras = inputs.hasSSO ? UH.sso : 0;

  // --- General configuration [row 52] -------------------------------------
  // Montado como lista para que a tabela mostre "Configuração geral: Support",
  // "…: Knowledge" etc. O total continua sendo a soma da própria lista — não há
  // uma segunda expressão que possa divergir dela.
  // Knowledge não entra aqui — a configuração geral dele é a linha de artigos
  // (`knowledgeLines`), que já é exibida como "Configuração geral: Knowledge".
  const generalConfigLines: AEDetailLine[] = [
    ['support', hasSupport, CFG.support],
    ['community', hasCommunity, CFG.community],
    ['analytics', hasAnalytics, CFG.analytics],
    ['voice', hasVoice, CFG.voice],
    ['copilot', hasCopilot, CFG.copilot],
    ['qa', hasQA, CFG.qa],
    ['wfm', hasWFM, CFG.wfm],
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
  // Analytics entra pelo treinamento de Suite. A linha adicional de
  // "Analytics avançado" (+6 h) foi removida da Calculadora AE.
  const trainingLines: AEDetailLine[] = [
    ['suite', hasSupport || hasKnowledge || hasAnalytics, TR.suite],
    ['community', hasCommunity, TR.community],
    ['voice', hasVoice, TR.voice],
    ['copilot', hasCopilot, TR.copilot],
    ['qa', hasQA, TR.qa],
    ['wfm', hasWFM, TR.wfm],
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

  // --- Configuração geral de Knowledge [row 93] ---------------------------
  /*
   * A configuração geral de Knowledge É esta conta, e nada mais:
   *   0,1 h por artigo, com piso de 2 h mesmo quando o AE informa 0 artigos.
   *
   * Antes existiam DUAS linhas — uma "Configuração geral: Knowledge" fixa de
   * 0,1 h (vinda de `configuracoes_gerais`) e a linha de artigos. A primeira
   * não representava esforço nenhum e poluía a tabela; foi removida.
   *
   * PROPOSTA (não aplicada): o pedido descreve a faixa "de 0 a 100 artigos".
   * A conta aqui é linear e NÃO tem teto — 150 artigos geram 15 h. Mantive
   * assim porque truncar em 10 h subestimaria silenciosamente o esforço, e
   * porque acima de 100 artigos a estimativa já cai na trava de revisão por
   * Sales Engineer (ver `requiresSalesEngineer`). Se a intenção for travar o
   * INPUT em 100, o lugar é a validação do formulário, não esta fórmula.
   */
  const knowledgeHoras = hasKnowledge
    ? Math.max(UH.knowledge_minimo, knowledgeArticles * UH.artigo)
    : 0;
  /*
   * Uma única linha, sempre. O piso faz a tarifa efetiva subir quando há
   * poucos artigos, então a hora unitária exibida é a EFETIVA — do contrário a
   * linha não fecharia com as próprias horas. Com 0 artigos a quantidade
   * exibida vira 1 (um pacote mínimo), porque "0 × 2 h = 2 h" não se sustenta
   * na tela; o número real de artigos vai no rótulo, montado na tabela.
   */
  const knowledgeLines: AEDetailLine[] = knowledgeHoras > 0
    ? [
        {
          key: 'general_config',
          qty: knowledgeArticles > 0 ? knowledgeArticles : 1,
          unitHours:
            knowledgeArticles > 0 ? knowledgeHoras / knowledgeArticles : knowledgeHoras,
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

  // Multi-idioma / conteúdo dinâmico foi REMOVIDO da Calculadora AE.
  // A calculadora não dimensiona mais tradução de conteúdo; a linha voltará
  // quando houver uma regra fechada para ela.

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
    actionFlowHoras;

  // --- Additional hours ('Calculadora AE' I3:I7) --------------------------
  // Discovery / Validation / Go-live / Comm. Técnica all share ONE base: the
  // line-item total less training, native integrations and third-party apps.
  // Workshops and the Aktie Now apps ARE included; that is deliberate.
  // As três bases (percentuais, gatilho e base do GP) são fórmulas da
  // configuração; os padrões reproduzem exatamente a planilha.
  const baseVars: Record<string, number> = {
    ...formulaVars,
    ...q,
    horas_itens: lineItemHours,
    horas_treinamento: trainingHoras,
    horas_workshops: workshopHoras,
    horas_integracoes_nativas: nativeConnectionsHoras,
    horas_apps_marketplace: thirdPartyAppsHoras,
    horas_action_flow: actionFlowHoras,
  };
  const percentBase = runFormula(F.base_percentuais, baseVars);

  const discoveryHours = percentBase * PCT.discovery;
  const validationHours = percentBase * PCT.validacao;
  const goLiveHours = percentBase * PCT.go_live;
  const commTechHours = percentBase * PCT.comunicacao_tecnica;

  // GP has its own base: training is INCLUDED, Comm. Técnica is EXCLUDED, and the
  // other three percentage lines are added in.
  const gpVars = {
    ...baseVars,
    horas_discovery: discoveryHours,
    horas_validacao: validationHours,
    horas_golive: goLiveHours,
    horas_comunicacao_tecnica: commTechHours,
  };
  const gpTrigger = runFormula(F.gatilho_gp, gpVars);
  const gpBase = runFormula(F.base_gp, gpVars);
  const gpHours =
    gpTrigger > PCT.limite_gerente_projetos
      ? PCT.gerente_projetos * gpBase
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
  //
  // A cláusula "módulo AI Agents selecionado" saiu junto com o módulo: a
  // Calculadora não oferece mais AI Agents, então a condição nunca seria
  // verdadeira e só confundiria quem lesse a regra.
  // Limites configuráveis no painel Admin (Calculadora AE › Sales Engineer).
  const requiresSalesEngineer =
    totalHours > SE.total_horas ||
    knowledgeArticles > SE.artigos_knowledge ||
    agents > SE.agentes ||
    brands > SE.marcas ||
    totalChannelQuantity > SE.quantidade_canais;

  return {
    unitHours: { ...UH },
    appRates: { ...APPS },
    percentBase,
    gpTrigger,
    gpBase,
    percents: {
      discovery: PCT.discovery,
      validacao: PCT.validacao,
      go_live: PCT.go_live,
      comunicacao_tecnica: PCT.comunicacao_tecnica,
      gerente_projetos: PCT.gerente_projetos,
      limite_gerente_projetos: PCT.limite_gerente_projetos,
    },
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
