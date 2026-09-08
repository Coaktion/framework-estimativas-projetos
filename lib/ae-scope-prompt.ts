/**
 * Monta o prompt de Escopo Técnico a partir de uma estimativa da Calculadora AE.
 *
 * POR QUE ISTO EXISTE
 * -------------------
 * O texto era montado dentro de `AEClient`, então só existia logo depois de
 * calcular uma estimativa nova. Reabrir a mesma estimativa por `/ae/history`
 * levava a uma tela SEM o botão de copiar — o dado estava lá, o prompt não.
 *
 * Aqui a montagem depende apenas do RESULTADO DO ENGINE e dos INPUTS, que as
 * duas telas têm. A de cálculo passa o snapshot congelado; a de visualização
 * passa o recálculo feito a partir do JSON salvo. O prompt sai idêntico.
 */

import type { AEEstimateResult, AEInputData } from './ae-engine';
import {
  buildScopePrompt,
  detectSuppressionFlags,
  type ScopeExportChannel,
  type ScopeExportIntegration,
  type ScopeExportItem,
  type ScopeExportLocale,
} from './scope-export';

/**
 * Rótulo de exibição de cada canal, na chave que o engine usa.
 *
 * Quase todos são nomes próprios e não se traduzem. Os dois que se traduzem
 * ("X público", "Página do Facebook") recebem tradução via `t` no chamador —
 * por isso o resolvedor abaixo aceita um override opcional.
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
  x_pages: 'X (public)',
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

/**
 * Rótulo em português de cada grupo de horas do engine.
 *
 * Canônico de propósito: é contra estes nomes que a skill casa os trechos do
 * template, que hoje só existe em pt-BR. Mesmo raciocínio das chaves de
 * subcategoria gravadas no banco.
 */
const GROUP_LABELS: Record<string, string> = {
  supportConfig: 'Configuração Support',
  voiceConfig: 'Configuração Voice',
  copilotConfig: 'Configuração Copilot',
  wfmConfig: 'Configuração WFM',
  qaConfig: 'Configuração QA',
  agentSetup: 'Cadastro de agentes',
  brandSetup: 'Configuração de marcas',
  channelSetup: 'Configuração de canais',
  appCondicionais: 'App Condicionais Avançadas',
  appTicketManager: 'App Ticket Manager',
  sso: 'Single Sign-On (SSO)',
  generalConfig: 'Configurações gerais',
  training: 'Treinamento',
  supportFixed: 'Pacotes fixos Support',
  wfmFixed: 'Pacotes fixos WFM',
  adppFixed: 'Pacotes fixos ADPP',
  nativeConnections: 'Integrações nativas',
  knowledge: 'Configuração geral Knowledge (artigos)',
  sideConversations: 'Conversas paralelas (Side Conversations)',
  thirdPartyApps: 'Apps de Marketplace',
  workshops: 'Workshop',
  actionFlows: 'Action Flow',
};

const PLAN_LABEL: Record<string, string> = {
  team: 'Suite Team',
  growth: 'Suite Growth',
  professional: 'Suite Professional',
  enterprise: 'Suite Enterprise',
};

export interface AEScopePromptInput {
  /** Saída crua do engine. Sem ela não há prompt. */
  estimate: AEEstimateResult | null | undefined;
  /** Inputs normalizados que geraram `estimate`. */
  inputs: Partial<AEInputData> | null | undefined;

  clientName: string;
  versionLabel?: string | null;
  zohoLink?: string | null;
  preSalesName?: string | null;

  /** Texto livre digitado pelo AE — vira o bloco [CONTEXTO DO CLIENTE]. */
  clientObjectives?: string | null;
  successIndicators?: string | null;

  deploymentType?: 'new' | 'optimization' | null;

  /** Apps de Marketplace, com o rótulo tal como aparece na tela. */
  marketplaceApps?: Array<{ label: string; quantity?: number | null }>;
  hasAppCondicionais?: boolean;
  hasAppTicketManager?: boolean;

  /** Idioma da interface — governa a prosa e o idioma do documento. */
  locale?: ScopeExportLocale | string | null;
  /** Rótulos de canal já traduzidos, quando o chamador tiver melhores. */
  channelLabels?: Record<string, string>;
  skuLabel: string;
  generatedAt?: Date | null;
}

export function buildAEScopePrompt(input: AEScopePromptInput): string {
  const { estimate, inputs } = input;
  if (!estimate || !inputs) return '';

  const breakdown = (estimate.breakdown || {}) as Record<string, number>;
  const labelFor = (key: string) =>
    input.channelLabels?.[key] || AE_CHANNEL_LABELS[key] || String(key);

  const modules: string[] = (
    estimate.allowedModules?.length ? estimate.allowedModules : inputs.selectedModules || []
  ).filter(Boolean) as string[];

  const channels: ScopeExportChannel[] = (inputs.selectedChannels || []).map((key) => ({
    label: labelFor(String(key)),
    quantity: Math.max(1, Number(inputs.channelQuantities?.[key] ?? 1)),
  }));

  const integrations: ScopeExportIntegration[] = [
    ...(inputs.selectedNativeConnections || []).filter(Boolean).map((name) => ({
      kind: 'Integração nativa',
      label: String(name),
      quantity: 1,
    })),
    ...(input.marketplaceApps || [])
      .filter((app) => app && app.label)
      .map((app) => ({
        kind: 'Marketplace',
        label: String(app.label),
        quantity: Math.max(1, Number(app.quantity ?? 1)),
      })),
    // ACTION_FLOW_OPTIONS é uma lista de STRINGS (nomes de serviço), não de
    // objetos { value, label } — o nome guardado já é o rótulo.
    ...(inputs.selectedActionFlows || []).filter(Boolean).map((name) => ({
      kind: 'Action Flow',
      label: String(name),
      quantity: 1,
    })),
    ...(input.hasAppCondicionais
      ? [{ kind: 'App AktieNow', label: 'Condicionais Avançadas', quantity: 1 }]
      : []),
    ...(input.hasAppTicketManager
      ? [{ kind: 'App AktieNow', label: 'Ticket Manager', quantity: 1 }]
      : []),
  ];

  /**
   * A Calculadora AE não tem biblioteca de itens como o Framework: o engine
   * devolve grupos de horas. Cada grupo com hora > 0 vira uma linha, o que dá
   * à skill a mesma base para decidir quais bullets do template ficam.
   */
  const items: ScopeExportItem[] = Object.entries(breakdown)
    .filter(([, hours]) => Number(hours) > 0)
    .map(([key, hours]) => ({
      category: 'Calculadora AE',
      subcategory: 'Grupos de esforço',
      label: GROUP_LABELS[key] || key,
      quantity: 1,
      hours: Number(hours) || 0,
    }));

  // Canais e integrações também entram como itens: é deles que as flags de
  // WhatsApp, e-mail e Central de Ajuda são detectadas.
  channels.forEach((c) =>
    items.push({
      category: 'Canais',
      subcategory: 'Canais',
      label: c.label,
      quantity: Number(c.quantity) || 1,
      hours: 0,
    }),
  );
  integrations.forEach((i) =>
    items.push({
      category: i.kind,
      subcategory: 'Integrações',
      label: i.label,
      quantity: Number(i.quantity) || 1,
      hours: 0,
    }),
  );

  const knowledgeArticles = Number(inputs.knowledgeArticles) || 0;
  const flags = detectSuppressionFlags(items, {
    // A Calculadora nunca contempla desenvolvimento nem design sob medida.
    desenvolvimento: false,
    design: false,
    sso: Boolean(inputs.hasSSO),
    'side-conversations': Boolean(inputs.hasTeamsSideConv || inputs.hasSlackSideConv),
    'action-flow': (inputs.selectedActionFlows || []).filter(Boolean).length > 0,
    knowledge: knowledgeArticles > 0 || modules.includes('Knowledge'),
    // AI Agents saiu da Calculadora: a flag é sempre falsa aqui, para que a
    // skill remova o bloco de premissas de API/endpoints do documento.
    'ai-agents': false,
  });

  const planKey = String(inputs.zendeskPlan || 'professional').toLowerCase();

  return buildScopePrompt({
    origin: 'calculadora-ae',
    template: 'escopo-padrao-60h',
    locale: input.locale,
    clientName: input.clientName,
    projectName: input.clientName,
    versionName: input.versionLabel || 'v1',
    generatedAt: input.generatedAt || new Date(),
    zohoLink: input.zohoLink || null,
    preSalesName: input.preSalesName || null,
    totalHours: estimate.totalHours,
    // A Calculadora não separa horas por skill; o total técnico é a linha de
    // implantação e as variáveis vêm no bloco de percentuais.
    skillHours: {
      'Implantação': estimate.lineItemHours,
      'GP': estimate.gpHours,
    },
    percents: null,
    planTierLabel: PLAN_LABEL[planKey] || `Suite ${planKey}`,
    skuLabel: input.skuLabel,
    deploymentType: input.deploymentType || null,
    modules,
    channels,
    integrations,
    flags,
    categories: null,
    items,
    clientObjectives: input.clientObjectives || null,
    successIndicators: input.successIndicators || null,
    crm: null,
  });
}
