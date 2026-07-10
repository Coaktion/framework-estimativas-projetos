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
  fatores_plano: {
    funcoes: { team: 0.0, growth: 0.0, professional: 0.0, enterprise: 1.0 },
    campos_ticket: { team: 1.0, growth: 1.04, professional: 1.08, enterprise: 1.12 },
    sla: { team: 0.0, growth: 1.0, professional: 1.0, enterprise: 1.5 }
  },
  fatores_operacao: {
    campos_usuario: { B2C: 0, B2B: 0, B2E: 3 },
    campos_organizacao: { B2C: 0, B2B: 3, B2E: 3 }
  },
  limites_escalonamento_se: {
    max_artigos: 100,
    max_agentes: 100,
    max_marcas: 3,
    max_canais: 10
  },
  horas_base_modulos: {
    support: 1,
    voice: 0.5,
    knowledge: 2,
    analytics: 3.5,
    copilot: 0.5,
    wfm: 0.33,
    qa: 1,
    adpp: 1.5
  },
  horas_marketplace: {
    woocommerce: 1.5,
    dialpad: 1.5,
    aircall: 2,
    vtex: 1,
    stripe: 1,
    pipedrive: 1,
    sweethawk: 2,
    outros: 5,
    app_marketplace: 5
  },
  horas_adpp_setup: {
    programacoes_exclusao: 2 * 0.25,
    gatilhos_simples: 5 * 0.08
  }
} as const;

export interface AEInputData {
  agents: number;
  brands: number;
  areas: number;
  selectedChannels: string[];
  channelQuantities: Record<string, number>;
  selectedModules: string[];
  operationTypes: string[];
  skuType: string;
  zendeskPlan: string;
  knowledgeArticles: number;
  hasCommunity: boolean;
  hasHCCustomization: boolean;
  hasQA: boolean;
  hasWFM: boolean;
  hasCopilot: boolean;
  copilotType: string;
  hasAIAgents: boolean;
  hasIntegration: boolean;
  hasAppsMarketplace: boolean;
  deploymentType: string;
  selectedApps: string[];
  appQuantities: Record<string, number>;
  selectedNativeConnections: string[];
  connectionQuantities: Record<string, number>;
  selectedActionFlows?: string[];
  analyticsTrainingType: 'standard' | 'advanced';
  hasSSO: boolean;
  hasITAM: boolean;
  hasTeamsSideConv: boolean;
  hasSlackSideConv: boolean;
  operationLanguages: number;
}

export function isSideConversationEligible(skuType: string, zendeskPlan: string) {
  const planRank = PLAN_RANK[zendeskPlan as keyof typeof PLAN_RANK] || 0;

  if (skuType === 'employee_service') {
    return planRank >= PLAN_RANK.growth;
  }

  return planRank >= PLAN_RANK.professional;
}

function round2(value: number) {
  return parseFloat(value.toFixed(2));
}

function getMarketplaceHours(app: string, qty: number) {
  const normalized = app.trim().toLowerCase();

  if (normalized.includes('woocommerce')) return qty * AE_DATABASE.horas_marketplace.woocommerce;
  if (normalized.includes('dialpad')) return qty * AE_DATABASE.horas_marketplace.dialpad;
  if (normalized.includes('aircall')) return qty * AE_DATABASE.horas_marketplace.aircall;
  if (normalized.includes('vtex')) return qty * AE_DATABASE.horas_marketplace.vtex;
  if (normalized.includes('stripe')) return qty * AE_DATABASE.horas_marketplace.stripe;
  if (normalized.includes('pipedrive')) return qty * AE_DATABASE.horas_marketplace.pipedrive;
  if (normalized.includes('sweethawk')) return qty * AE_DATABASE.horas_marketplace.sweethawk;
  if (normalized.includes('outros')) return qty * AE_DATABASE.horas_marketplace.outros;
  if (normalized.includes('app marketplace')) return qty * AE_DATABASE.horas_marketplace.app_marketplace;

  return qty * AE_DATABASE.horas_marketplace.outros;
}

export function calculateAEEstimate(inputs: AEInputData) {
  const sanitizedAgents = Math.max(1, inputs.agents || 0);
  const sanitizedBrands = Math.max(1, inputs.brands || 0);
  const sanitizedAreas = Math.max(1, inputs.areas || 0);
  const sanitizedSelectedChannels = inputs.selectedChannels.length > 0 ? inputs.selectedChannels : ['web_form'];
  const sanitizedSelectedModules = inputs.selectedModules.length > 0 ? inputs.selectedModules : ['Support'];
  const sanitizedChannelQuantities = Object.fromEntries(
    Object.entries(inputs.channelQuantities || {}).map(([key, value]) => [key, Math.max(1, value || 0)])
  );
  const sanitizedAppQuantities = Object.fromEntries(
    Object.entries(inputs.appQuantities || {}).map(([key, value]) => [key, Math.max(1, value || 0)])
  );
  const sanitizedConnectionQuantities = Object.fromEntries(
    Object.entries(inputs.connectionQuantities || {}).map(([key, value]) => [key, Math.max(1, value || 0)])
  );
  const sanitizedKnowledgeArticles = Math.max(0, inputs.knowledgeArticles || 0);
  const sanitizedOperationLanguages = Math.max(1, inputs.operationLanguages || 0);

  const {
    operationTypes,
    skuType,
    zendeskPlan,
    hasCommunity,
    hasHCCustomization,
    hasQA,
    hasWFM,
    hasCopilot,
    hasAIAgents,
    hasAppsMarketplace,
    selectedApps,
    selectedNativeConnections,
    selectedActionFlows = [],
    analyticsTrainingType,
    hasSSO,
    hasTeamsSideConv,
    hasSlackSideConv
  } = inputs;

  const agents = sanitizedAgents;
  const brands = sanitizedBrands;
  const areas = sanitizedAreas;
  const selectedChannels = sanitizedSelectedChannels;
  const channelQuantities = sanitizedChannelQuantities;
  const selectedModules = sanitizedSelectedModules;
  const knowledgeArticles = sanitizedKnowledgeArticles;
  const appQuantities = sanitizedAppQuantities;
  const connectionQuantities = sanitizedConnectionQuantities;
  const operationLanguages = sanitizedOperationLanguages;

  const qtdOperacoes = operationTypes.length || 1;
  const somaTotalCanais = Object.values(channelQuantities).reduce((acc, value) => acc + (value || 0), 0);
  const somaTotalTiposDeCanais = selectedChannels.length;
  const somaTiposDeOutrosCanais = selectedChannels.filter((channel) => !['web_form', 'email', 'voice'].includes(channel)).length;

  const webFormsPresente = selectedChannels.includes('web_form') ? 1 : 0;
  const emailPresente = selectedChannels.includes('email') ? 1 : 0;
  const whatsAppPresente = selectedChannels.includes('whatsapp') ? 1 : 0;
  const vozPresente = selectedChannels.includes('voice') ? 1 : 0;

  const fatorPlanoFuncoes =
    AE_DATABASE.fatores_plano.funcoes[zendeskPlan as keyof typeof AE_DATABASE.fatores_plano.funcoes] || 0;
  const fatorPlanoCamposTicket =
    AE_DATABASE.fatores_plano.campos_ticket[zendeskPlan as keyof typeof AE_DATABASE.fatores_plano.campos_ticket] || 1;
  const fatorPlanoSLA =
    AE_DATABASE.fatores_plano.sla[zendeskPlan as keyof typeof AE_DATABASE.fatores_plano.sla] || 0;

  const somaFatorOperacaoUsuario = operationTypes.reduce(
    (acc, op) => acc + (AE_DATABASE.fatores_operacao.campos_usuario[op as keyof typeof AE_DATABASE.fatores_operacao.campos_usuario] || 0),
    0
  );
  const somaFatorOperacaoOrganizacao = operationTypes.reduce(
    (acc, op) =>
      acc + (AE_DATABASE.fatores_operacao.campos_organizacao[op as keyof typeof AE_DATABASE.fatores_operacao.campos_organizacao] || 0),
    0
  );

  let supportFuncoes = (((0.1 * agents) + areas) * (0.25 + (0.75 * brands))) * fatorPlanoFuncoes;
  supportFuncoes = Math.min(supportFuncoes, agents);

  const supportGrupos = ((0.1 * agents) + (0.3 * areas)) * (0.25 + (0.75 * brands)) * (0.4 + (qtdOperacoes * 0.6));
  const supportCamposTicket =
    ((webFormsPresente * 10) + (emailPresente * 8) + (whatsAppPresente * 8) + (vozPresente * 5) + (somaTiposDeOutrosCanais * 6)) *
    (0.7 + (0.3 * brands)) *
    fatorPlanoCamposTicket;
  const supportCondicionaisCampos = supportCamposTicket * 0.5;
  const supportCamposUsuario = ((2 * supportGrupos) + (2 * areas)) * (1 + somaFatorOperacaoUsuario);
  const supportCamposOrganizacao = 2 * areas * (1 + somaFatorOperacaoOrganizacao);
  const supportVisualizacoes = 12 + (0.1 * supportCamposTicket * areas) + (5 * (hasCopilot ? 1 : 0));
  const supportMacros = supportCamposTicket * 0.5;
  const supportGatilhosSimples = 3 + ((supportCamposTicket * 0.2) + (somaTotalTiposDeCanais * (3 + (2 * (hasCopilot ? 1 : 0)))));
  const supportGatilhosComplexos = supportGatilhosSimples * 0.25;
  const supportAutomacoesSimples = 3 + ((supportGatilhosSimples + supportGatilhosComplexos) * 0.3);
  const supportAutomacoesComplexas = supportAutomacoesSimples * 0.25;
  const supportPoliticasSLA = ((somaTotalCanais * (0.3 + (0.7 * brands))) + supportGrupos) * fatorPlanoSLA;

  let knowledgeHoras = 0;
  if (selectedModules.includes('Knowledge')) {
    knowledgeHoras = Math.max(AE_DATABASE.horas_base_modulos.knowledge, knowledgeArticles * 0.1);
    if (hasCommunity) knowledgeHoras += 1;
  }

  const voiceQty = channelQuantities.voice || 0;
  const voiceIVR = ['team', 'growth'].includes(zendeskPlan) ? 0 : 6 * voiceQty;
  const voiceSaudacoes = 6 * voiceIVR;

  let copilotIntencoes = 0;
  let copilotEntidades = 0;
  let copilotProcedimentos = 0;
  if (hasCopilot) {
    copilotIntencoes = supportCamposTicket * 0.2 * ((hasQA ? 0.2 : 0) + 1) * qtdOperacoes;
    copilotEntidades = supportCamposTicket * 0.1;
    copilotProcedimentos = (areas + supportGrupos) * 0.5 * brands * qtdOperacoes;
  }

  let wfmLocalizacoes = 0;
  let wfmTurnos = 0;
  let wfmGruposTrabalho = 0;
  let wfmEquipes = 0;
  let wfmMotivosFolga = 0;
  let wfmTarefasGerais = 0;
  let wfmAutomacoes = 0;
  let wfmFuncoes = 0;
  if (hasWFM) {
    wfmLocalizacoes = brands * qtdOperacoes;
    wfmTurnos = wfmLocalizacoes * 2;
    wfmGruposTrabalho = supportGrupos + (brands * qtdOperacoes) + somaTotalTiposDeCanais;
    wfmEquipes = supportGrupos;
    wfmMotivosFolga = 5 + (agents * 0.1);
    wfmTarefasGerais = (2 + supportGrupos + areas + brands) * qtdOperacoes * 0.5;
    wfmAutomacoes = 2 + (wfmEquipes * 0.5 * wfmTurnos);
    wfmFuncoes = 2 + supportFuncoes;
  }

  let qaDestaques = 0;
  let qaQuizzes = 0;
  let qaFiltros = 0;
  let qaTabelasDesempenho = 0;
  let qaCategoriasManuais = 0;
  let qaCategoriasIA = 0;
  let qaUsuarios = 0;
  let qaBots = 0;
  let qaEspacoTrabalho = 0;
  let qaAtribuicoes = 0;
  let qaGrupos = 0;
  let qaHashtags = 0;
  if (hasQA) {
    qaDestaques = Math.min(10, Math.max(0, brands + qtdOperacoes + areas));
    qaQuizzes = areas + brands + qtdOperacoes;
    qaFiltros = (1 + (0.05 * supportGrupos)) * qaDestaques;
    qaTabelasDesempenho = areas * qtdOperacoes * brands;
    qaCategoriasManuais = qaTabelasDesempenho * 3;
    qaCategoriasIA = Math.min(10, Math.max(0, 10 - qaDestaques));
    qaUsuarios = agents * 0.9;
    qaBots = brands;
    qaEspacoTrabalho = brands;
    qaAtribuicoes = 0.5 * supportGrupos;
    qaGrupos = supportGrupos;
    qaHashtags = supportCamposTicket * 0.05;
  }

  let appsCondicionaisHoras = 0;
  let appsTicketManagerHoras = 0;
  let marketplaceAppsHoras = 0;
  if (hasAppsMarketplace) {
    appsCondicionaisHoras = 0.33 + (((supportVisualizacoes * 0.1) + (supportGatilhosSimples * 0.125)) * 0.25);
    appsTicketManagerHoras = 0.67 + (0.5 * (qtdOperacoes + areas));

    selectedApps.forEach((app) => {
      const qty = appQuantities[app] || 1;
      marketplaceAppsHoras += getMarketplaceHours(app, qty);
    });
  }

  let nativeConnectionsHoras = 0;
  if (selectedNativeConnections.length > 0) {
    selectedNativeConnections.forEach((connection) => {
      nativeConnectionsHoras += (connectionQuantities[connection] || 1) * 2;
    });
  }

  const actionFlowHoras = selectedActionFlows.length * 4.5;

  const hasSupportModule = selectedModules.includes('Support');
  const hasKnowledgeModule = selectedModules.includes('Knowledge');
  const sideConversationEligible = hasSupportModule && isSideConversationEligible(skuType, zendeskPlan);
  const teamsSideConvHoras = sideConversationEligible && hasTeamsSideConv ? 0.5 : 0;
  const slackSideConvHoras = sideConversationEligible && hasSlackSideConv ? 0.5 : 0;

  const idiomasAdicionais = Math.max(0, operationLanguages - 1);
  const idiomasHorasBase =
    supportFuncoes +
    supportGrupos +
    (supportCamposTicket * 1.73) +
    (supportCamposUsuario * 1.8) +
    (supportCamposOrganizacao * 1.8) +
    supportVisualizacoes +
    supportMacros +
    (supportGatilhosSimples * 0.1) +
    (supportGatilhosComplexos * 0.1) +
    (supportAutomacoesSimples * 0.1) +
    (supportAutomacoesComplexas * 0.1) +
    copilotIntencoes +
    copilotEntidades +
    copilotProcedimentos;
  const operationLanguagesHoras = idiomasHorasBase * idiomasAdicionais;

  const agentSetupHoras = agents * 0.05;
  const brandSetupHoras = brands * 0.25;
  const channelSetupHoras = selectedChannels.reduce((acc, channel) => {
    const qty = channelQuantities[channel] || 1;

    if (channel === 'web_form') return acc + (qty * 0.08);
    if (channel === 'web_widget') return acc + (qty * 0.42);
    return acc + (qty * 0.17);
  }, 0);

  const supportImplementationHoras = hasSupportModule
    ? (supportFuncoes * 0.5) + (supportGrupos * 0.2) + (supportCamposTicket * 0.2) + AE_DATABASE.horas_base_modulos.support
    : 0;
  const voiceBaseHoras = selectedChannels.includes('voice') ? AE_DATABASE.horas_base_modulos.voice : 0;
  const analyticsHoras = selectedModules.includes('Analytics') ? AE_DATABASE.horas_base_modulos.analytics : 0;
  const copilotBaseHoras = hasCopilot ? AE_DATABASE.horas_base_modulos.copilot : 0;
  const wfmBaseHoras = hasWFM ? AE_DATABASE.horas_base_modulos.wfm : 0;
  const qaBaseHoras = hasQA ? AE_DATABASE.horas_base_modulos.qa : 0;
  const adppBaseHoras = selectedModules.includes('ADPP') ? AE_DATABASE.horas_base_modulos.adpp : 0;
  const adppSetupHoras = selectedModules.includes('ADPP')
    ? AE_DATABASE.horas_adpp_setup.programacoes_exclusao + AE_DATABASE.horas_adpp_setup.gatilhos_simples
    : 0;

  const additionalServicesHoras =
    (hasSupportModule && hasSSO ? 2 : 0) +
    teamsSideConvHoras +
    slackSideConvHoras +
    (hasSupportModule ? operationLanguagesHoras : 0);

  const techHours =
    supportImplementationHoras +
    knowledgeHoras +
    voiceBaseHoras +
    analyticsHoras +
    copilotBaseHoras +
    wfmBaseHoras +
    qaBaseHoras +
    adppBaseHoras +
    adppSetupHoras +
    appsCondicionaisHoras +
    appsTicketManagerHoras +
    marketplaceAppsHoras +
    nativeConnectionsHoras +
    actionFlowHoras +
    additionalServicesHoras +
    agentSetupHoras +
    brandSetupHoras +
    channelSetupHoras;

  const workshopHoras =
    (selectedModules.some((module) => ['Support', 'Knowledge', 'Analytics'].includes(module)) ? 1 : 0) +
    (selectedChannels.includes('voice') ? 0.5 : 0) +
    (hasCopilot ? 0.5 : 0) +
    (hasAIAgents ? 0.5 : 0) +
    (hasQA ? 0.5 : 0) +
    (hasWFM ? 0.5 : 0);

  let trainingHorasBase = 0;
  if (selectedModules.includes('Analytics') && analyticsTrainingType === 'advanced') {
    trainingHorasBase = 6;
  } else if (selectedModules.some((module) => ['Support', 'Knowledge', 'Analytics'].includes(module))) {
    trainingHorasBase = 4;
  }

  const trainingHoras =
    trainingHorasBase +
    (hasKnowledgeModule ? 1 : 0) +
    (hasKnowledgeModule && hasCommunity ? 1.5 : 0) +
    (selectedChannels.includes('voice') ? 2.5 : 0) +
    (hasCopilot ? 2.5 : 0) +
    (hasWFM ? 3 : 0) +
    (hasQA ? 2 : 0) +
    (hasAIAgents ? 4 : 0) +
    (selectedModules.includes('ADPP') ? 1 : 0);

  const baseCommonVariables = techHours;
  const commTechBase = techHours + workshopHoras;
  const discoveryHours = baseCommonVariables * 0.2;
  const validationHours = baseCommonVariables * 0.15;
  const goLiveHours = baseCommonVariables * 0.05;
  const commTechHours = commTechBase * 0.1;
  const gpBase = techHours + discoveryHours + validationHours + goLiveHours + workshopHoras + trainingHoras;

  let gpHours = gpBase * 0.176470588235294;
  const totalBeforeGP = techHours + discoveryHours + validationHours + goLiveHours + commTechHours;
  if (totalBeforeGP < 30) {
    gpHours = 0;
  }

  const seLimits = AE_DATABASE.limites_escalonamento_se;
  let escalationRequired = false;
  let escalationMessage = '';

  if (knowledgeArticles > seLimits.max_artigos) escalationRequired = true;
  if (agents > seLimits.max_agentes) escalationRequired = true;
  if (brands > seLimits.max_marcas) escalationRequired = true;
  if (somaTotalTiposDeCanais > seLimits.max_canais) escalationRequired = true;
  if (hasAIAgents || selectedModules.includes('AI Agents')) escalationRequired = true;
  if (hasHCCustomization) escalationRequired = true;

  if (escalationRequired) {
    escalationMessage = 'ATENCAO: Este projeto possui complexidade que exige escalonamento obrigatorio para um Sales Engineer.';
  }

  const results = {
    support: {
      funcoes: Math.round(supportFuncoes),
      grupos: Math.round(supportGrupos),
      campos_ticket: Math.round(supportCamposTicket),
      condicionais_campos: Math.round(supportCondicionaisCampos),
      campos_usuario: Math.round(supportCamposUsuario),
      campos_organizacao: Math.round(supportCamposOrganizacao),
      visualizacoes: Math.round(supportVisualizacoes),
      macros: Math.round(supportMacros),
      gatilhos_simples: Math.round(supportGatilhosSimples),
      gatilhos_complexos: Math.round(supportGatilhosComplexos),
      automacoes_simples: Math.round(supportAutomacoesSimples),
      automacoes_complexas: Math.round(supportAutomacoesComplexas),
      politicas_sla: Math.round(supportPoliticasSLA)
    },
    knowledge: {
      horas_estimadas: round2(knowledgeHoras)
    },
    voice: {
      ivr: Math.round(voiceIVR),
      saudacoes: Math.round(voiceSaudacoes)
    },
    copilot: {
      intencoes_personalizadas: Math.round(copilotIntencoes),
      entidades: Math.round(copilotEntidades),
      procedimentos: Math.round(copilotProcedimentos)
    },
    wfm: {
      localizacoes: Math.round(wfmLocalizacoes),
      turnos: Math.round(wfmTurnos),
      grupos_trabalho: Math.round(wfmGruposTrabalho),
      equipes: Math.round(wfmEquipes),
      motivos_folga: Math.round(wfmMotivosFolga),
      tarefas_gerais: Math.round(wfmTarefasGerais),
      automacoes: Math.round(wfmAutomacoes),
      funcoes: Math.round(wfmFuncoes)
    },
    qa: {
      destaques: Math.round(qaDestaques),
      quizzes: Math.round(qaQuizzes),
      filtros: Math.round(qaFiltros),
      tabelas_desempenho: Math.round(qaTabelasDesempenho),
      categorias_manuais: Math.round(qaCategoriasManuais),
      categorias_ia: Math.round(qaCategoriasIA),
      usuarios: Math.round(qaUsuarios),
      bots: Math.round(qaBots),
      espaco_trabalho: Math.round(qaEspacoTrabalho),
      atribuicoes: Math.round(qaAtribuicoes),
      grupos: Math.round(qaGrupos),
      hashtags: Math.round(qaHashtags)
    },
    apps_aktie_now: {
      condicionais_avancadas_horas: round2(appsCondicionaisHoras),
      ticket_manager_horas: round2(appsTicketManagerHoras)
    },
    marketplace_apps: {
      horas_estimadas: round2(marketplaceAppsHoras)
    },
    native_connections: {
      horas_estimadas: round2(nativeConnectionsHoras)
    },
    action_flows: {
      horas_estimadas: round2(actionFlowHoras),
      quantidade: selectedActionFlows.length
    },
    analytics: {
      horas_estimadas: round2(analyticsHoras),
      treinamento: analyticsTrainingType,
      treinamento_horas: round2(trainingHorasBase)
    },
    workshops: {
      horas_estimadas: round2(workshopHoras)
    },
    trainings: {
      horas_estimadas: round2(trainingHoras)
    },
    setup: {
      agentes_horas: round2(agentSetupHoras),
      marcas_horas: round2(brandSetupHoras),
      canais_horas: round2(channelSetupHoras),
      idiomas_horas: round2(operationLanguagesHoras),
      side_conversations_horas: round2(teamsSideConvHoras + slackSideConvHoras),
      sso_horas: hasSupportModule && hasSSO ? 2 : 0,
      adpp_setup_horas: round2(adppSetupHoras)
    },
    variables: {
      gp: round2(gpHours),
      discovery: round2(discoveryHours),
      validation: round2(validationHours),
      go_live: round2(goLiveHours),
      comunicacao_tecnica: round2(commTechHours),
      base_implantacao: round2(techHours),
      base_comunicacao_tecnica: round2(commTechBase),
      base_gp: round2(gpBase)
    }
  };

  const totalFinal = techHours + gpHours + discoveryHours + validationHours + goLiveHours + commTechHours;

  return {
    techHours: round2(techHours),
    totalFinal: parseFloat(totalFinal.toFixed(1)),
    results,
    escalationRequired,
    escalationMessage
  };
}
