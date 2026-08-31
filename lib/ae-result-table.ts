import {
  AE_DATABASE,
  type AEDetailLine,
  type AEEstimateResult,
  type AEInputData,
} from './ae-engine';

/**
 * Monta a tabela de resultado da Calculadora AE a partir da SAÍDA DO ENGINE.
 *
 * Nada aqui é gravado no banco: a tabela é reconstruída a cada visualização, a
 * partir dos inputs salvos. É isso que permite um Sales Engineer abrir uma
 * estimativa criada por um AE e ver as quantidades e horas, mesmo que o AE só
 * tenha visto a lista de itens.
 *
 * As horas por unidade vêm de AE_DATABASE, e não de números repetidos aqui, para
 * que a tabela nunca divirja do cálculo.
 */

const UH = AE_DATABASE.horas_unitarias;

export interface AETableRow {
  /** Rótulo já traduzido. */
  label: string;
  qty: number;
  unitHours: number;
  hours: number;
}

export interface AETableSection {
  key: string;
  title: string;
  rows: AETableRow[];
  subtotal: number;
}

type TFunc = (key: string, params?: Record<string, any>) => string;

/** Uma linha só entra na tabela quando a quantidade é relevante. */
function row(label: string, qty: number, unitHours: number): AETableRow {
  const q = Number(qty) || 0;
  return { label, qty: q, unitHours, hours: q * unitHours };
}

/**
 * Converte as linhas detalhadas do engine em linhas de tabela.
 *
 * A quantidade e a hora unitária vêm PRONTAS do engine — a tabela não recalcula
 * nada. Era justamente a recomposição local, com valores unitários fixados em
 * zero, que fazia linhas reais aparecerem como "0.00h" enquanto o subtotal da
 * seção (que vem do breakdown) mostrava o valor certo.
 */
function detailRows(
  lines: AEDetailLine[] | undefined,
  label: (key: string) => string,
): AETableRow[] {
  return (lines || []).map((line) => ({
    label: label(line.key),
    qty: line.qty,
    unitHours: line.unitHours,
    hours: line.hours,
  }));
}

/** Nome comercial do módulo a partir da chave usada pelo engine. */
function moduleLabel(key: string, t: TFunc): string {
  return t(`aeModules.${key}`, { defaultValue: key });
}

function section(
  key: string,
  title: string,
  rows: AETableRow[],
  subtotalOverride?: number,
): AETableSection {
  const kept = rows.filter((r) => r.qty > 0 || r.hours > 0);
  const subtotal =
    subtotalOverride !== undefined
      ? subtotalOverride
      : kept.reduce((acc, r) => acc + r.hours, 0);
  return { key, title, rows: kept, subtotal };
}

export function buildAEResultTable(
  estimation: AEEstimateResult | null | undefined,
  inputs: Partial<AEInputData> | null | undefined,
  t: TFunc,
): { sections: AETableSection[]; lineItemTotal: number; grandTotal: number } {
  if (!estimation) return { sections: [], lineItemTotal: 0, grandTotal: 0 };

  const q = (estimation.quantities || {}) as Record<string, number>;
  const b = (estimation.breakdown || {}) as Record<string, number>;
  // Estimativas gravadas antes da abertura por item não têm `details`; o
  // fallback vazio faz a tabela simplesmente omitir essas linhas em vez de
  // quebrar.
  const d = estimation.details || {
    generalConfig: [], training: [], workshops: [],
    fixedItems: [], marketplaceApps: [], aktieApps: [],
    channelSetup: [], dynamicContent: [],
    baseSetup: [], knowledge: [], sideConversations: [],
  };
  /**
   * Os módulos que realmente geraram horas. O engine descarta os que estão
   * acima do plano; usar `inputs.selectedModules` fazia a tabela desenhar, por
   * exemplo, a seção de WFM em plano Growth — com linhas somando horas e
   * subtotal zero.
   */
  const modules = new Set(
    estimation.allowedModules && estimation.allowedModules.length
      ? estimation.allowedModules
      : inputs?.selectedModules || [],
  );
  const sections: AETableSection[] = [];

  // ---------------------------------------------------------------- Support
  sections.push(
    section('support', t('aeTable.supportConfig'), [
      row(t('cfg.roles'), q.funcoes, UH.funcoes),
      row(t('cfg.groups'), q.grupos, UH.grupos),
      row(t('cfg.ticketFields'), q.campos_ticket, UH.campos_ticket),
      row(t('cfg.fieldConditions'), q.condicionais_campos, UH.condicionais_campos),
      row(t('cfg.userFields'), q.campos_usuario, UH.campos_usuario),
      row(t('cfg.orgFields'), q.campos_organizacao, UH.campos_organizacao),
      row(t('cfg.views'), q.visualizacoes, UH.visualizacoes),
      row(t('cfg.macros'), q.macros, UH.macros),
      row(t('cfg.simpleTriggers'), q.gatilhos_simples, UH.gatilhos_simples),
      row(t('cfg.complexTriggers'), q.gatilhos_complexos, UH.gatilhos_complexos),
      row(t('cfg.simpleAutomations'), q.automacoes_simples, UH.automacoes_simples),
      row(t('cfg.complexAutomations'), q.automacoes_complexas, UH.automacoes_complexas),
      row(t('cfg.slaPolicies'), q.politicas_sla, UH.politicas_sla),
    ], b.supportConfig),
  );

  // ------------------------------------------------------------------ Voice
  if (modules.has('Voice') && b.voiceConfig) {
    sections.push(
      section('voice', t('aeTable.voiceConfig'), [
        row('IVR', q.ivr, UH.ivr),
        row(t('cfg.greetings'), q.saudacoes, UH.saudacoes),
      ], b.voiceConfig),
    );
  }

  // ---------------------------------------------------------------- Copilot
  if (modules.has('Copilot') && b.copilotConfig) {
    sections.push(
      section('copilot', t('aeTable.copilotConfig'), [
        row(t('cfg.intents'), q.intencoes, UH.intencoes),
        row(t('cfg.entities'), q.entidades, UH.entidades),
        row(t('cfg.procedures'), q.procedimentos, UH.procedimentos),
      ], b.copilotConfig),
    );
  }

  // -------------------------------------------------------------------- WFM
  if (modules.has('WFM') && b.wfmConfig) {
    sections.push(
      section('wfm', t('aeTable.wfmConfig'), [
        row(t('cfg.locations'), q.wfm_localizacoes, UH.wfm_localizacoes),
        row(t('cfg.shifts'), q.wfm_turnos, UH.wfm_turnos),
        row(t('cfg.workGroups'), q.wfm_grupos_trabalho, UH.wfm_grupos_trabalho),
        row(t('cfg.teams'), q.wfm_equipes, UH.wfm_equipes),
        row(t('cfg.timeOffReasons'), q.wfm_motivos_folga, UH.wfm_motivos_folga),
        row(t('cfg.generalTasks'), q.wfm_tarefas_gerais, UH.wfm_tarefas_gerais),
        row(t('cfg.wfmAutomations'), q.wfm_automacoes, UH.wfm_automacoes),
        row(t('cfg.wfmRoles'), q.wfm_funcoes, UH.wfm_funcoes),
      ], b.wfmConfig),
    );
  }

  // --------------------------------------------------------------------- QA
  if (modules.has('QA') && b.qaConfig) {
    sections.push(
      section('qa', t('aeTable.qaConfig'), [
        row(t('cfg.highlights'), q.qa_destaques, UH.qa_destaques),
        row(t('cfg.quizzes'), q.qa_quizzes, UH.qa_quizzes),
        row(t('cfg.filters'), q.qa_filtros, UH.qa_filtros),
        row(t('cfg.scorecards'), q.qa_tabelas_desempenho, UH.qa_tabelas_desempenho),
        row(t('cfg.manualCategories'), q.qa_categorias_manuais, UH.qa_categorias_manuais),
        row(t('cfg.aiCategories'), q.qa_categorias_ia, UH.qa_categorias_ia),
        row(t('cfg.users'), q.qa_usuarios, UH.qa_usuarios),
        row(t('cfg.bots'), q.qa_bots, UH.qa_bots),
        row(t('cfg.workspace'), q.qa_espaco_trabalho, UH.qa_espaco_trabalho),
        row(t('cfg.assignments'), q.qa_atribuicoes, UH.qa_atribuicoes),
        row(t('cfg.qaGroups'), q.qa_grupos, UH.qa_grupos),
        row(t('cfg.hashtags'), q.qa_hashtags, UH.qa_hashtags),
      ], b.qaConfig),
    );
  }

  // --------------------------------------------------------------- Base setup
  const agents = Number(inputs?.agents) || 0;
  const brands = Number(inputs?.brands) || 0;

  sections.push(
    section('baseSetup', t('aeTable.section4'), [
      ...detailRows(d.baseSetup, (key) =>
        key === 'agents' ? t('report.agents') : t('report.brands')),
      // Canais por TIPO: e-mail, formulário e widget têm tarifas próprias e os
      // demais entram num bloco com piso. Somar tudo numa linha só com a tarifa
      // de "canal que exige reunião" não fechava com o subtotal.
      ...detailRows(d.channelSetup, (key) =>
        t(`aeChannels.${key}`, { defaultValue: key })),
    ], (b.agentSetup || 0) + (b.brandSetup || 0) + (b.channelSetup || 0)),
  );

  // ---------------------------------------------- Integrações, apps e extras
  const nativeCount = inputs?.selectedNativeConnections?.length || 0;
  const actionFlowCount = inputs?.selectedActionFlows?.length || 0;
  const sideConvCount =
    (inputs?.hasTeamsSideConv ? 1 : 0) + (inputs?.hasSlackSideConv ? 1 : 0);

  sections.push(
    section('integrations', t('aeTable.section5'), [
      row(t('aeTable.nativeIntegration'), nativeCount, UH.integracao_nativa),
      row(t('aeTable.actionFlows'), actionFlowCount, UH.action_flow),
      // Cada app de Marketplace tem a sua própria tarifa (SweetHawk 2h, outros
      // 5h, e assim por diante); antes vinham somados numa linha só com hora
      // unitária zerada, o que exibia "0.00h" para um grupo que de fato pesa.
      ...detailRows(d.marketplaceApps, (key) => t(`aeApps.${key}`, { defaultValue: key })),
      ...detailRows(d.sideConversations, (key) =>
        `${t('aeTable.sideConversations')}: ${key === 'teams' ? 'Microsoft Teams' : 'Slack'}`),
      row('SSO', inputs?.hasSSO ? 1 : 0, UH.sso),
      // Apps da Aktie Now: base fixa + parcela que varia com o escopo, então a
      // hora unitária é o próprio total da linha.
      ...detailRows(d.aktieApps, (key) => t(`aeApps.${key}`, { defaultValue: key })),
    ],
    (b.nativeConnections || 0) +
      (b.actionFlows || 0) +
      (b.thirdPartyApps || 0) +
      (b.sideConversations || 0) +
      (b.sso || 0) +
      (b.appCondicionais || 0) +
      (b.appTicketManager || 0)),
  );

  // ------------------------------- Configs gerais, treinamentos e conteúdos
  const knowledgeArticles = Number(inputs?.knowledgeArticles) || 0;
  const extraLanguages = Math.max(0, (Number(inputs?.operationLanguages) || 1) - 1);

  sections.push(
    section('general', t('aeTable.section6'), [
      // Configuração geral, treinamento e workshop são abertos POR MÓDULO: cada
      // módulo tem a sua própria tarifa e uma linha agregada com "10 módulos"
      // não dizia nada sobre de onde vinham as horas.
      ...detailRows(d.generalConfig, (key) =>
        t('aeTable.generalConfigOf', { module: moduleLabel(key, t) })),
      ...detailRows(d.training, (key) =>
        t('aeTable.trainingOf', { module: moduleLabel(key, t) })),
      ...detailRows(d.workshops, (key) =>
        t('aeTable.workshopOf', { module: moduleLabel(key, t) })),
      ...detailRows(d.fixedItems, (key) => t(`aeFixed.${key}`, { defaultValue: key })),
      ...detailRows(d.knowledge, (key) =>
        key === 'articles_minimum' ? t('aeTable.articlesMinimum') : t('aeTable.articles')),
      ...detailRows(d.dynamicContent, () =>
        t('aeTable.dynamicContent', { count: extraLanguages })),
    ],
    (b.generalConfig || 0) +
      (b.training || 0) +
      (b.workshops || 0) +
      (b.knowledge || 0) +
      (b.operationLanguages || 0) +
      (b.supportFixed || 0) +
      (b.wfmFixed || 0) +
      (b.adppFixed || 0)),
  );

  // ------------------------------------------------- Camadas percentuais
  sections.push({
    key: 'variables',
    title: t('aeTable.section7'),
    rows: [
      { label: t('ae.discovery'), qty: 1, unitHours: estimation.discoveryHours, hours: estimation.discoveryHours },
      { label: t('ae.validation'), qty: 1, unitHours: estimation.validationHours, hours: estimation.validationHours },
      { label: t('ae.goLive'), qty: 1, unitHours: estimation.goLiveHours, hours: estimation.goLiveHours },
      { label: t('report.techComm'), qty: 1, unitHours: estimation.commTechHours, hours: estimation.commTechHours },
      { label: t('report.projectMgmt'), qty: 1, unitHours: estimation.gpHours, hours: estimation.gpHours },
    ].filter((r) => r.hours > 0),
    subtotal:
      estimation.discoveryHours +
      estimation.validationHours +
      estimation.goLiveHours +
      estimation.commTechHours +
      estimation.gpHours,
  });

  return {
    sections: sections.filter((s) => s.rows.length > 0),
    lineItemTotal: estimation.lineItemHours,
    grandTotal: estimation.totalHours,
  };
}
