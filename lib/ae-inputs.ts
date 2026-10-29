/**
 * Converte o estado do formulário da Calculadora AE (ou o JSON salvo de uma
 * estimativa) nos inputs do engine.
 *
 * Uma ÚNICA implementação para a tela de cálculo e para a de visualização: as
 * duas tinham cópias próprias, e a da visualização lia os canais da chave
 * errada (`selectedChannels`, enquanto o save grava `channels`) — toda
 * estimativa reaberta era recalculada só com "Web Form".
 */

import type {
  AEInputData, ChannelKey, MarketplaceAppKey, ModuleKey, OperationType, SkuType, ZendeskPlan,
} from './ae-engine';

export const AE_PLAN_RANK = { team: 1, growth: 2, professional: 3, enterprise: 4 } as const;

export const MARKETPLACE_APP_LABEL_TO_KEY: Record<string, MarketplaceAppKey> = {
  'WooCommerce': 'woocommerce',
  'Woo Commerce': 'woocommerce',
  'Dialpad': 'dialpad',
  'Aircall': 'aircall',
  'VTEX': 'vtex',
  'Stripe': 'stripe',
  'Pipedrive': 'pipedrive',
  'SweetHawk': 'sweethawk',
  // 'App Marketplace' saiu da Calculadora, mas fica no mapa para que estimativas
  // antigas que gravaram esse rótulo continuem contabilizando corretamente.
  'Outros': 'other_marketplace',
  'App Marketplace': 'other_marketplace',
  'Outro Marketplace': 'other_marketplace',
  'other_marketplace': 'other_marketplace',
};

export const CHANNEL_LEGACY_TO_KEY: Record<string, ChannelKey> = {
  web_form: 'web_form',
  email: 'email',
  web_widget: 'web_widget',
  whatsapp: 'whatsapp',
  facebook: 'facebook_messenger',
  facebook_messenger: 'facebook_messenger',
  instagram: 'instagram_dm',
  instagram_dm: 'instagram_dm',
  instagram_page: 'instagram_page',
  voice: 'voice',
  teams: 'microsoft_teams',
  microsoft_teams: 'microsoft_teams',
  slack: 'slack',
  x: 'x_dm', // legado: estimativas salvas antes da separação DM / público
  x_dm: 'x_dm',
  x_pages: 'x_pages',
  sms: 'sms',
  ios: 'ios',
  unity: 'unity',
  line: 'line',
  apple_business: 'apple_messages',
  apple_messages: 'apple_messages',
  wechat: 'wechat',
  google_rcs: 'google_rcs',
  google_business: 'google_business_messages',
  google_business_messages: 'google_business_messages',
  kakaotalk: 'kakaotalk',
  facebook_pages: 'facebook_pages',
  telegram: 'telegram',
};

export function isSideConversationEligible(skuType: SkuType, zendeskPlan: ZendeskPlan): boolean {
  const planRank = AE_PLAN_RANK[zendeskPlan] ?? 1;
  if (skuType === 'CS') return planRank >= AE_PLAN_RANK.professional;
  return planRank >= AE_PLAN_RANK.growth;
}

export function normalizeAESku(raw: string): SkuType {
  const key = String(raw || '').toUpperCase();
  if (key.includes('ES') || key.includes('EMPLOYEE')) return 'ES';
  return 'CS';
}

/**
 * Aceita tanto o estado vivo do formulário (`selectedChannels`) quanto o JSON
 * salvo (`channels`).
 */
export function buildEngineInputs(formState: any): AEInputData {
  const rawChannels: string[] = Array.isArray(formState?.selectedChannels) && formState.selectedChannels.length
    ? formState.selectedChannels
    : Array.isArray(formState?.channels) ? formState.channels : [];
  const selectedChannels: ChannelKey[] = rawChannels
    .map((c: string) => CHANNEL_LEGACY_TO_KEY[c])
    .filter(Boolean);

  const channelQuantities: Partial<Record<ChannelKey, number>> = {};
  for (const [k, v] of Object.entries<number>(formState?.channelQuantities || {})) {
    const key = CHANNEL_LEGACY_TO_KEY[k];
    if (!key) continue;
    channelQuantities[key] = Math.max(0, Number(v) || 0);
  }

  const selectedApps: MarketplaceAppKey[] = [];
  const appQuantities: Partial<Record<MarketplaceAppKey, number>> = {};
  for (const appLabel of formState?.selectedApps || []) {
    const key = MARKETPLACE_APP_LABEL_TO_KEY[String(appLabel)];
    if (!key) continue;
    if (!selectedApps.includes(key)) selectedApps.push(key);
    const qtyRaw = formState.appQuantities?.[appLabel];
    if (qtyRaw != null) {
      appQuantities[key] = Math.max(0, Number(qtyRaw) || 0);
    }
  }

  const sku = normalizeAESku(formState?.skuType);
  const zendeskPlan = (String(formState?.zendeskPlan || 'professional').toLowerCase().replace(/^suite\s+/, '').trim() as ZendeskPlan) || 'professional';
  const planRank = AE_PLAN_RANK[zendeskPlan] ?? AE_PLAN_RANK.team;

  const selectedModules = (formState?.selectedModules || ['Support']).filter((m: string) => {
    // AI Agents saiu da Calculadora AE. Estimativas salvas antes disso ainda
    // trazem o módulo no JSON, então ele é descartado já na entrada.
    if (m === 'AI Agents') return false;
    if (['Analytics', 'Community', 'Copilot', 'QA', 'WFM'].includes(m)) return planRank >= AE_PLAN_RANK.professional;
    if (m === 'ADPP') return planRank >= AE_PLAN_RANK.enterprise;
    return true;
  }) as ModuleKey[];

  return {
    agents: Math.max(1, Number(formState?.agents) || 1),
    brands: Math.max(1, Number(formState?.brands) || 1),
    areas: Math.max(1, Number(formState?.areas) || 1),
    skuType: sku,
    zendeskPlan,
    operationTypes: ((formState?.operationTypes || []) as OperationType[]).filter(Boolean),
    selectedModules: selectedModules.length ? selectedModules : ['Support'],
    selectedChannels: selectedChannels.length ? selectedChannels : ['web_form'],
    channelQuantities,
    knowledgeArticles: Math.max(0, Number(formState?.knowledgeArticles) || 0),
    selectedNativeConnections: formState?.selectedNativeConnections || [],
    selectedActionFlows: formState?.selectedActionFlows || [],
    selectedApps,
    appQuantities,
    hasAppCondicionais: Boolean(formState?.hasAppCondicionais),
    hasAppTicketManager: Boolean(formState?.hasAppTicketManager),
    hasSSO: Boolean(formState?.hasSSO),
    hasTeamsSideConv: isSideConversationEligible(sku, zendeskPlan) && Boolean(formState?.hasTeamsSideConv),
    hasSlackSideConv: isSideConversationEligible(sku, zendeskPlan) && Boolean(formState?.hasSlackSideConv),
  };
}
