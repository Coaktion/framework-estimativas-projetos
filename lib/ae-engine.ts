export const AE_DATABASE = {
  fatores_plano: {
    funcoes: { "team": 0.0, "growth": 0.0, "professional": 0.0, "enterprise": 1.0 },
    campos_ticket: { "team": 1.0, "growth": 1.04, "professional": 1.08, "enterprise": 1.12 },
    sla: { "team": 0.0, "growth": 1.0, "professional": 1.0, "enterprise": 1.5 }
  },
  fatores_operacao: {
    campos_usuario: { "B2C": 0, "B2B": 0, "B2E": 3 },
    campos_organizacao: { "B2C": 0, "B2B": 3, "B2E": 3 }
  },
  pesos_canais_ticket: { "web_form": 10, "email": 8, "whatsapp": 8, "voice": 5, "outros": 6 },
  regras_knowledge_horas: [
    { min_artigos: 0, max_artigos: 20, horas: 2 },
    { min_artigos: 21, max_artigos: 100, horas: 10 }
  ],
  valores_fixos_flat: {
    support_team_plus: { encaminhamento_omnichannel: 1, gatilho_webhook_proprio: 1, webhooks: 1, pesquisa_satisfacao: 1 },
    support_professional_plus: { programacao_feriados: 1 },
    wfm: { cenarios_previsao: 2, paineis_desempenho: 1, url_externas_monitoradas: 10 },
    adpp: { programacao_exclusao: 2, gatilhos_supressao_automatica: 5 }
  },
  limites_escalonamento_se: {
    max_artigos: 100, max_agentes: 100, max_marcas: 3, max_canais: 10,
    modulos_obrigatorios: ["itam", "ai_agents", "droz", "call_we", "adpp"],
    flags_obrigatorias: ["personalizacao_codigo_helpcenter", "copilot_acoes_externas_api", "acoes_externas_api"]
  }
};

export interface AEInputData {
  agents: number;
  brands: number;
  areas: number;
  selectedChannels: string[];
  channelQuantities: Record<string, number>;
  selectedModules: string[];
  operationTypes: string[];
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
}

export function calculateAEEstimate(inputs: AEInputData) {
  const {
    agents, brands, areas, selectedChannels, channelQuantities,
    selectedModules, operationTypes, zendeskPlan, knowledgeArticles,
    hasCommunity, hasHCCustomization, hasQA, hasWFM, hasCopilot,
    copilotType, hasAIAgents, hasIntegration, hasAppsMarketplace, deploymentType
  } = inputs;

  // 1. Auxiliary Variables
  const qtdOperacoes = operationTypes.length || 1;
  const somaTotalCanais = Object.values(channelQuantities).reduce((a, b) => a + b, 0);
  const somaTotalTiposDeCanais = selectedChannels.length;
  const somaTiposDeOutrosCanais = selectedChannels.filter(c => !['web_form', 'email', 'voice'].includes(c)).length;
  
  const webFormsPresente = selectedChannels.includes('web_form') ? 1 : 0;
  const emailPresente = selectedChannels.includes('email') ? 1 : 0;
  const whatsAppPresente = selectedChannels.includes('whatsapp') ? 1 : 0;
  const vozPresente = selectedChannels.includes('voice') ? 1 : 0;

  const fatorPlanoFuncoes = AE_DATABASE.fatores_plano.funcoes[zendeskPlan as keyof typeof AE_DATABASE.fatores_plano.funcoes] || 0;
  const fatorPlanoCamposTicket = AE_DATABASE.fatores_plano.campos_ticket[zendeskPlan as keyof typeof AE_DATABASE.fatores_plano.campos_ticket] || 1;
  const fatorPlanoSLA = AE_DATABASE.fatores_plano.sla[zendeskPlan as keyof typeof AE_DATABASE.fatores_plano.sla] || 0;

  const somaFatorOperacaoUsuario = operationTypes.reduce((acc, op) => acc + (AE_DATABASE.fatores_operacao.campos_usuario[op as keyof typeof AE_DATABASE.fatores_operacao.campos_usuario] || 0), 0);
  const somaFatorOperacaoOrganizacao = operationTypes.reduce((acc, op) => acc + (AE_DATABASE.fatores_operacao.campos_organizacao[op as keyof typeof AE_DATABASE.fatores_operacao.campos_organizacao] || 0), 0);

  // 2. Sequential Formulas - Support Block
  let supportFuncoes = (((0.1 * agents) + areas) * (0.25 + (0.75 * brands))) * fatorPlanoFuncoes;
  supportFuncoes = Math.min(supportFuncoes, agents);

  const supportGrupos = ((0.1 * agents) + 0.3 * areas) * (0.25 + (0.75 * brands)) * (0.4 + (qtdOperacoes * 0.6));
  const supportCamposTicket = ((webFormsPresente * 10) + (emailPresente * 8) + (whatsAppPresente * 8) + (vozPresente * 5) + (somaTiposDeOutrosCanais * 6)) * (0.7 + (0.3 * brands)) * fatorPlanoCamposTicket;
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

  // Knowledge Block
  let knowledgeHoras = 0;
  if (selectedModules.includes('Knowledge')) {
    const rule = AE_DATABASE.regras_knowledge_horas.find(r => knowledgeArticles >= r.min_artigos && knowledgeArticles <= r.max_artigos);
    knowledgeHoras = rule ? rule.horas : (knowledgeArticles > 100 ? 10 : 0);
    if (hasCommunity) knowledgeHoras += 3;
    if (hasHCCustomization) knowledgeHoras += 12;
  }

  // Voice Block
  const voiceQty = channelQuantities['voice'] || 0;
  const voiceIVR = 6 * voiceQty;
  const voiceSaudacoes = 6 * voiceIVR;

  // Copilot Block
  let copilotIntencoes = 0, copilotEntidades = 0, copilotProcedimentos = 0;
  if (hasCopilot) {
    copilotIntencoes = supportCamposTicket * 0.1 * ((hasQA ? 0.2 : 0) + 1) * qtdOperacoes;
    copilotEntidades = supportCamposTicket * 0.1;
    copilotProcedimentos = (areas + supportGrupos) * 0.5 * brands * qtdOperacoes;
  }

  // WFM Block
  let wfmLocalizacoes = 0, wfmTurnos = 0, wfmGruposTrabalho = 0, wfmEquipes = 0, wfmMotivosFolga = 0, wfmTarefasGerais = 0, wfmAutomacoes = 0, wfmFuncoes = 0;
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

  // QA Block
  let qaDestaques = 0, qaQuizzes = 0, qaFiltros = 0, qaTabelasDesempenho = 0, qaCategoriasManuais = 0, qaCategoriasIA = 0, qaUsuarios = 0, qaBots = 0, qaEspacoTrabalho = 0, qaAtribuicoes = 0, qaGrupos = 0, qaHashtags = 0;
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

  // Apps Block
  let appsCondicionaisHoras = 0, appsTicketManagerHoras = 0;
  if (hasAppsMarketplace) {
    appsCondicionaisHoras = 0.33 + (((supportVisualizacoes * 0.1) + (supportGatilhosSimples * 0.125)) * 0.25);
    appsTicketManagerHoras = 0.67 + ((supportCamposTicket * 0.02) * qtdOperacoes);
  }

  // 3. Escalation Logic (SE)
  const seLimits = AE_DATABASE.limites_escalonamento_se;
  let escalationRequired = false;
  let escalationMessage = "";

  if (knowledgeArticles > seLimits.max_artigos) escalationRequired = true;
  if (agents > seLimits.max_agentes) escalationRequired = true;
  if (brands > seLimits.max_marcas) escalationRequired = true;
  if (somaTotalTiposDeCanais > seLimits.max_canais) escalationRequired = true;
  
  const mandatoryModules = ['itam', 'ai_agents', 'droz', 'call_we', 'adpp'];
  if (selectedModules.some(m => mandatoryModules.includes(m.toLowerCase()))) escalationRequired = true;
  if (hasAIAgents || selectedModules.includes('Droz') || selectedModules.includes('Callwe') || selectedModules.includes('ADPP')) escalationRequired = true;

  if (hasHCCustomization) escalationRequired = true;
  if (copilotType === 'with_api') escalationRequired = true;
  if (hasIntegration) escalationRequired = true;

  if (escalationRequired) {
    escalationMessage = "⚠️ ATENÇÃO: Este projeto possui complexidade que exige escalonamento obrigatório para um Sales Engineer.";
  }

  // 4. Final Aggregation
  let techHours = knowledgeHoras + appsCondicionaisHoras + appsTicketManagerHoras;
  if (selectedModules.includes('Support')) {
     techHours += (supportFuncoes * 0.5) + (supportGrupos * 0.2) + (supportCamposTicket * 0.1);
  }
  if (hasWFM) techHours += 4;
  if (hasQA) techHours += 4;
  if (hasCopilot) techHours += 5;
  if (selectedModules.includes('Droz')) techHours += 15;
  if (selectedModules.includes('Callwe')) techHours += 5;

  if (deploymentType === 'optimization') techHours *= 0.7;

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
    knowledge: { horas_estimadas: knowledgeHoras },
    voice: { ivr: Math.round(voiceIVR), saudacoes: Math.round(voiceSaudacoes) },
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
      condicionais_avancadas_horas: parseFloat(appsCondicionaisHoras.toFixed(2)),
      ticket_manager_horas: parseFloat(appsTicketManagerHoras.toFixed(2))
    }
  };

  return {
    techHours,
    results,
    escalationRequired,
    escalationMessage
  };
}
