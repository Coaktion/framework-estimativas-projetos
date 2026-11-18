/**
 * Calculadora AE → quantidades de uma estimativa do Framework.
 *
 * Cada linha que a Calculadora contou (a mesma tabela "Itens considerados")
 * vira a quantidade de um item da biblioteca:
 *  1. pelo vínculo da configuração da Calculadora (Admin › Calculadora AE ›
 *     Números) — a mesma ligação que já faz a hora da Calculadora sair da
 *     biblioteca;
 *  2. sem vínculo salvo, pela sugestão por nome (`suggestBindings`);
 *  3. para o que não tem número vinculável (canais por tipo, linhas de Voice,
 *     conversas paralelas, integrações nativas, treinamentos agrupados), pelo
 *     nome do item na biblioteca.
 *
 * Quantidades da Calculadora são estimativas fracionárias (ex.: 24,84 campos):
 * arredondadas para o inteiro mais próximo, com ,5 para cima. Linha que
 * arredonda para 0 não entra. O que não tem item correspondente volta em
 * `unmapped`, para a tela avisar.
 */

import type { AEEstimateResult, AEInputData } from './ae-engine';
import { DEFAULT_AE_NUMBERS, suggestBindings, type AEBinding, type AEConfig, type AELibraryItem } from './ae-config';

export interface AEFrameworkItem { id: number; quantity: number; source: string }
export interface AEUnmappedLine { source: string; quantity: number }

export interface AEToFrameworkResult {
  items: AEFrameworkItem[];
  unmapped: AEUnmappedLine[];
  plan: 'team' | 'growth' | 'professional' | 'enterprise';
  sku: 'CS' | 'ES';
  deploymentType: 'new' | 'optimization';
}

/** Arredondamento para o inteiro mais próximo, com ,5 para cima. */
export function roundHalfUpInt(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n + 0.5 + 1e-9);
}

const fold = (value: unknown) => String(value ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

/** Quantidades da tabela por seção (as mesmas regras de buildAEResultTable). */
const SUPPORT_KEYS = ['funcoes', 'grupos', 'campos_ticket', 'formularios', 'condicionais_campos', 'campos_usuario', 'campos_organizacao',
  'visualizacoes', 'macros', 'gatilhos_simples', 'gatilhos_complexos', 'automacoes_simples', 'automacoes_complexas', 'politicas_sla'];
const SECTION_KEYS: Array<{ module: string | null; breakdown: string; keys: string[] }> = [
  { module: null, breakdown: 'supportConfig', keys: SUPPORT_KEYS },
  { module: 'Voice', breakdown: 'voiceConfig', keys: ['ivr', 'saudacoes'] },
  { module: 'Copilot', breakdown: 'copilotConfig', keys: ['intencoes', 'entidades', 'procedimentos'] },
  { module: 'WFM', breakdown: 'wfmConfig', keys: ['wfm_localizacoes', 'wfm_turnos', 'wfm_grupos_trabalho', 'wfm_equipes', 'wfm_motivos_folga', 'wfm_tarefas_gerais', 'wfm_automacoes', 'wfm_funcoes'] },
  { module: 'QA', breakdown: 'qaConfig', keys: ['qa_destaques', 'qa_quizzes', 'qa_filtros', 'qa_tabelas_desempenho', 'qa_categorias_manuais', 'qa_categorias_ia', 'qa_usuarios', 'qa_bots', 'qa_espaco_trabalho', 'qa_atribuicoes', 'qa_grupos', 'qa_hashtags'] },
];

/** Nomes da biblioteca para o que a Calculadora conta sem número vinculável. */
const CHANNEL_ITEM_NAMES: Record<string, string[]> = {
  whatsapp: ['WhatsApp'],
  facebook_messenger: ['Facebook Messenger'],
  facebook_pages: ['Facebook (página)'],
  instagram_dm: ['Instagram Direct (DM)'],
  microsoft_teams: ['Microsoft Teams (canal)'],
  x_dm: ['Mensagem Direta (DM) do X (Twitter)'],
  x_pages: ['Páginas do X (Twitter)'],
  sms: ['Mensagens de texto / SMS'],
  ios: ['iOS'],
  unity: ['Unity'],
  line: ['LINE'],
  apple_messages: ['Apple Messages for Business'],
  wechat: ['WeChat'],
  google_rcs: ['Google RCS'],
  google_business_messages: ['Google Business Messages'],
  kakaotalk: ['KakaoTalk'],
  voice: ['Linhas / Números'],
};
const TRAINING_ITEM_NAMES: Record<string, string[]> = {
  suite: ['Support - Admin', 'Support - agente'],
  community: ['Community - Admin', 'Community - agente'],
  voice: ['Voice - Admin', 'Voice - agente'],
  copilot: ['Copilot - admin', 'Copilot - agente'],
  qa: ['QA - admin'],
  wfm: ['WFM - admin'],
  adpp: ['ADPP - admin'],
};
const SIDE_CONVERSATION_NAMES: Record<string, string> = {
  slack: 'Conversas Paralelas via Slack',
  teams: 'Conversas Paralelas via Microsoft Teams',
};
const KNOWLEDGE_BASE_NAME = 'Central de ajuda básica';

export function aeToFrameworkItems(args: {
  estimate: AEEstimateResult;
  inputs: AEInputData;
  config: AEConfig;
  library: AELibraryItem[];
  deploymentType?: 'new' | 'optimization' | null;
}): AEToFrameworkResult {
  const { estimate, inputs, config, library } = args;
  const bindings: Record<string, AEBinding> = config.bindings || suggestBindings(library);
  const byId = new Map(library.map((item) => [item.id, item]));
  const byName = new Map<string, AELibraryItem>();
  library.forEach((item) => { if (!byName.has(fold(item.name))) byName.set(fold(item.name), item); });
  const findByNames = (names: string[]) => names.map((n) => byName.get(fold(n))).find(Boolean) || null;

  const totals = new Map<number, { quantity: number; sources: string[] }>();
  const unmapped: AEUnmappedLine[] = [];
  const add = (item: AELibraryItem | null | undefined, rawQty: number, source: string) => {
    const quantity = roundHalfUpInt(rawQty);
    if (quantity <= 0) return;
    if (!item) { unmapped.push({ source, quantity }); return; }
    const current = totals.get(item.id) || { quantity: 0, sources: [] };
    current.quantity += quantity;
    current.sources.push(source);
    totals.set(item.id, current);
  };
  const bound = (path: string) => {
    const b = bindings[path];
    return b && b.packageId != null ? byId.get(b.packageId) || null : null;
  };

  const breakdown = (estimate.breakdown || {}) as Record<string, number>;
  const quantities = (estimate.quantities || {}) as Record<string, number>;
  const modules = new Set(estimate.allowedModules?.length ? estimate.allowedModules : inputs.selectedModules || []);
  const details = estimate.details;

  // Configuração (Support, Voice, Copilot, WFM, QA): quantidades da fórmula.
  SECTION_KEYS.forEach((section) => {
    if (section.module && !modules.has(section.module as any)) return;
    if (!(Number(breakdown[section.breakdown]) > 0)) return;
    section.keys.forEach((key) => add(bound(`horas_unitarias.${key}`), quantities[key], `horas_unitarias.${key}`));
  });

  if (details) {
    // Setup base: agentes, marcas e canais por tipo.
    (details.baseSetup || []).forEach((l) => {
      const path = l.key === 'agents' ? 'horas_unitarias.membro_equipe' : 'horas_unitarias.marca';
      add(bound(path), l.qty, path);
    });
    (details.channelSetup || []).forEach((l) => {
      if (l.key === 'email') add(bound('horas_unitarias.canal_email'), l.qty, 'canal: email');
      else if (l.key === 'web_widget') add(bound('horas_unitarias.canal_web_widget'), l.qty, 'canal: web_widget');
    });
    // Canais do bloco "exigem reunião" e a linha de Voice: um item por canal.
    (inputs.selectedChannels || []).forEach((channel) => {
      const qty = Math.max(0, Number(inputs.channelQuantities?.[channel] ?? 1));
      if (qty <= 0 || channel === 'email' || channel === 'web_widget' || channel === 'web_form') return;
      if (channel === 'voice' && !modules.has('Voice' as any)) return;
      add(findByNames(CHANNEL_ITEM_NAMES[channel] || []), qty, `canal: ${channel}`);
    });

    (details.generalConfig || []).forEach((l) => add(bound(`configuracoes_gerais.${l.key}`), 1, `configuracoes_gerais.${l.key}`));
    (details.training || []).forEach((l) => {
      const item = bound(`treinamentos.${l.key}`);
      if (item) { add(item, 1, `treinamentos.${l.key}`); return; }
      const names = TRAINING_ITEM_NAMES[l.key] || [];
      const found = names.map((n) => byName.get(fold(n))).filter(Boolean) as AELibraryItem[];
      if (found.length) found.forEach((f) => add(f, 1, `treinamentos.${l.key}`));
      else add(null, 1, `treinamentos.${l.key}`);
    });
    (details.workshops || []).forEach((l) => add(bound(`workshops.${l.key}`), 1, `workshops.${l.key}`));
    (details.fixedItems || []).forEach((l) => {
      const group = Object.entries(DEFAULT_AE_NUMBERS.itens_fixos).find(([, items]) => l.key in (items as any))?.[0];
      const path = group ? `itens_fixos.${group}.${l.key}` : `itens_fixos.${l.key}`;
      add(group ? bound(path) : null, l.qty, path);
    });
    (details.marketplaceApps || []).forEach((l) => add(bound(`apps.${l.key}`), l.qty, `apps.${l.key}`));
    (details.aktieApps || []).forEach((l) => {
      const path = l.key === 'condicionais_avancadas' ? 'apps.condicionais_avancadas_base' : 'apps.ticket_manager_base';
      add(bound(path), 1, path);
    });
    (details.nativeConnections || []).forEach((l) => add(byName.get(fold(l.key)) || null, 1, `integração nativa: ${l.key}`));
    (details.sideConversations || []).forEach((l) => {
      add(byName.get(fold(SIDE_CONVERSATION_NAMES[l.key])) || bound('horas_unitarias.conversa_paralela'), 1, `conversas paralelas: ${l.key}`);
    });
    if ((details.knowledge || []).length) {
      const articles = Math.max(0, Number(inputs.knowledgeArticles) || 0);
      add(byName.get(fold(KNOWLEDGE_BASE_NAME)) || null, 1, 'knowledge: central de ajuda');
      if (articles > 0) add(bound('horas_unitarias.artigo'), articles, 'horas_unitarias.artigo');
    }
  }

  if (inputs.hasSSO && Number(breakdown.sso) > 0) add(bound('horas_unitarias.sso'), 1, 'horas_unitarias.sso');
  const actionFlows = (inputs.selectedActionFlows || []).filter(Boolean).length;
  if (actionFlows > 0) add(bound('horas_unitarias.action_flow'), actionFlows, 'horas_unitarias.action_flow');

  const items = Array.from(totals.entries()).map(([id, v]) => ({ id, quantity: v.quantity, source: v.sources.join(', ') }));
  const plan = (String(inputs.zendeskPlan || 'professional').toLowerCase() as AEToFrameworkResult['plan']);
  return {
    items,
    unmapped,
    plan: ['team', 'growth', 'professional', 'enterprise'].includes(plan) ? plan : 'professional',
    sku: String(inputs.skuType).toUpperCase() === 'ES' ? 'ES' : 'CS',
    deploymentType: args.deploymentType === 'optimization' ? 'optimization' : 'new',
  };
}
