import { AE_DATABASE, type AEEstimateResult, type AEInputData } from './ae-engine';

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
  const modules = new Set(inputs?.selectedModules || []);
  const sections: AETableSection[] = [];

  // ---------------------------------------------------------------- Support
  sections.push(
    section('support', t('aeReport.supportConfig'), [
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
  if (modules.has('Voice') || b.voiceConfig) {
    sections.push(
      section('voice', t('aeReport.voiceConfig'), [
        row('IVR', q.ivr, UH.ivr),
        row(t('cfg.greetings'), q.saudacoes, UH.saudacoes),
      ], b.voiceConfig),
    );
  }

  // ---------------------------------------------------------------- Copilot
  if (modules.has('Copilot') || b.copilotConfig) {
    sections.push(
      section('copilot', t('aeReport.copilotConfig'), [
        row(t('cfg.intents'), q.intencoes, UH.intencoes),
        row(t('cfg.entities'), q.entidades, UH.entidades),
        row(t('cfg.procedures'), q.procedimentos, UH.procedimentos),
      ], b.copilotConfig),
    );
  }

  // -------------------------------------------------------------------- WFM
  if (modules.has('WFM') || b.wfmConfig) {
    sections.push(
      section('wfm', t('aeReport.wfmConfig'), [
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
  if (modules.has('QA') || b.qaConfig) {
    sections.push(
      section('qa', t('aeReport.qaConfig'), [
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
  const channelQuantities = inputs?.channelQuantities || {};
  const channelTotal = Object.values(channelQuantities).reduce(
    (acc: number, v) => acc + (Number(v) || 0),
    0,
  );
  sections.push(
    section('baseSetup', t('aeReport.section4'), [
      row(t('report.agents'), agents, UH.membro_equipe),
      row(t('report.brands'), brands, UH.marca),
      row(t('aeReport.channel'), channelTotal, UH.canal_exige_reuniao),
    ], (b.agentSetup || 0) + (b.brandSetup || 0) + (b.channelSetup || 0)),
  );

  // ---------------------------------------------- Integrações, apps e extras
  const nativeCount = inputs?.selectedNativeConnections?.length || 0;
  const actionFlowCount = inputs?.selectedActionFlows?.length || 0;
  const marketplaceCount = inputs?.selectedApps?.length || 0;
  const sideConvCount =
    (inputs?.hasTeamsSideConv ? 1 : 0) + (inputs?.hasSlackSideConv ? 1 : 0);

  sections.push(
    section('integrations', t('aeReport.section5'), [
      row(t('aeReport.integration'), nativeCount, UH.integracao_nativa),
      row(t('report.actionFlows'), actionFlowCount, UH.action_flow),
      row(t('editor.marketplaceApps'), marketplaceCount, 0),
      row(t('aeReport.sideConvRow'), sideConvCount, UH.conversa_paralela),
      row('SSO', inputs?.hasSSO ? 1 : 0, UH.sso),
      row(t('aeReport.advancedConditionals'), inputs?.hasAppCondicionais ? 1 : 0, 0),
      row(t('ae.ticketManager'), inputs?.hasAppTicketManager ? 1 : 0, 0),
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
    section('general', t('aeReport.section6'), [
      row(t('aeReport.generalConfigRow'), modules.size, 0),
      row(t('aeReport.trainingRow'), modules.size, 0),
      row(t('aeReport.workshopsRow'), modules.size, 0),
      row(t('aeReport.articles'), knowledgeArticles, UH.artigo),
      row(t('aeReport.operationLanguages'), extraLanguages, 0),
      row(t('aeReport.fixedPackagesRow'), 1, 0),
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
    title: t('report.section7'),
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
