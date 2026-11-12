/**
 * Flags de supressão do prompt de escopo (seção [FLAGS DE SUPRESSÃO]).
 *
 * A skill `scope-creator` copia esta seção para o plano e cada `nao` APAGA
 * trechos do documento. Por isso as flags saem de UMA tabela declarativa,
 * avaliada sobre as MESMAS linhas que o prompt imprime — uma flag nunca pode
 * contradizer um item listado no mesmo bloco.
 *
 * Framework: cada flag liga quando alguma linha que conta hora casa com um id
 * de item da biblioteca, uma subcategoria ou um módulo (categoria raiz). Os ids
 * são os do banco (único para todos os ambientes); o teste
 * lib/__tests__/scope-export.test.ts confere que continuam existindo.
 *
 * Calculadora AE: não há itens da biblioteca, então cada flag lê os inputs e
 * as linhas detalhadas que o engine devolveu (as mesmas da tabela da tela).
 *
 * As chaves e os valores (sim/nao) são identificadores da skill e NUNCA se
 * traduzem; só o comentário (`governs`) acompanha o idioma do prompt.
 */

import type { ScopeExportLocale } from './scope-export';

type Governs = Record<ScopeExportLocale, string>;

/** O que casa uma linha do Framework com a flag. Qualquer critério liga. */
export interface FrameworkFlagMatcher {
  itemIds?: number[];
  /** Nome (chave) da subcategoria, comparado sem acento e sem caixa. */
  subcategories?: string[];
  /** Trecho do nome (chave) da categoria raiz, sem acento e sem caixa. */
  modules?: string[];
  /** Linhas de app de Marketplace digitadas no editor. */
  marketplaceLines?: boolean;
  /** Palavras no nome do item (só para regras antigas, mantidas por compatibilidade). */
  nameKeywords?: string[];
  /** Skill com horas > 0 no resumo. */
  skill?: string;
}

/** Sinais da Calculadora AE que as flags leem. */
export interface AEFlagSignals {
  modules: Set<string>;
  channels: Record<string, number>;
  nativeConnections: number;
  actionFlows: number;
  marketplaceApps: number;
  aktieApps: number;
  sso: boolean;
  sideConversations: boolean;
  slaPolicies: number;
  csat: number;
}

export interface SuppressionFlagRule {
  key: string;
  governs: Governs;
  framework: FrameworkFlagMatcher;
  ae: (s: AEFlagSignals) => boolean;
}

const never = () => false;
const moduleOn = (key: string) => (s: AEFlagSignals) => s.modules.has(key);

export const SUPPRESSION_FLAGS: SuppressionFlagRule[] = [
  {
    key: 'whatsapp',
    governs: {
      pt: 'Premissas de ativação do número WhatsApp na Meta / Facebook Business',
      en: 'Assumptions about activating the WhatsApp number with Meta / Facebook Business',
      es: 'Premisas de activación del número de WhatsApp en Meta / Facebook Business',
    },
    framework: { itemIds: [222] },
    ae: (s) => (s.channels.whatsapp || 0) > 0,
  },
  {
    key: 'sso',
    governs: {
      pt: 'Premissa de SSO (SAML/JWT) e provisionamento',
      en: 'SSO (SAML/JWT) and provisioning assumption',
      es: 'Premisa de SSO (SAML/JWT) y aprovisionamiento',
    },
    framework: { itemIds: [14] },
    ae: (s) => s.sso,
  },
  {
    key: 'conteudo-dinamico',
    governs: {
      pt: 'Premissa de tradução do Conteúdo Dinâmico',
      en: 'Dynamic Content translation assumption',
      es: 'Premisa de traducción del Contenido dinámico',
    },
    framework: { itemIds: [57] },
    ae: never,
  },
  {
    key: 'central-de-ajuda',
    governs: {
      pt: 'Premissas de mapeamento de host/CNAME e itens de Central de Ajuda',
      en: 'Host mapping/CNAME assumptions and Help Center items',
      es: 'Premisas de mapeo de host/CNAME e ítems del Centro de ayuda',
    },
    framework: { itemIds: [89] },
    // A configuração geral de Knowledge da Calculadora tem o piso de 2 h, que
    // é a "Central de ajuda básica" da biblioteca: com Knowledge, há Central.
    ae: moduleOn('Knowledge'),
  },
  {
    key: 'email',
    governs: {
      pt: 'Premissa de SPF/DKIM/DNS do canal de e-mail',
      en: 'SPF/DKIM/DNS assumption for the email channel',
      es: 'Premisa de SPF/DKIM/DNS del canal de correo electrónico',
    },
    framework: { itemIds: [25, 112] },
    ae: (s) => (s.channels.email || 0) > 0,
  },
  {
    key: 'voz',
    governs: {
      pt: 'Seção de capacidades Zendesk Voice e itens de URA/fila',
      en: 'Zendesk Voice capabilities section and IVR/queue items',
      es: 'Sección de capacidades de Zendesk Voice e ítems de IVR/cola',
    },
    framework: { modules: ['canais - voz', 'zendesk voice', 'voice'] },
    ae: moduleOn('Voice'),
  },
  {
    key: 'knowledge',
    governs: {
      pt: 'Seção Zendesk Knowledge e premissas de conteúdo de artigos',
      en: 'Zendesk Knowledge section and article content assumptions',
      es: 'Sección de Zendesk Knowledge y premisas de contenido de artículos',
    },
    framework: { modules: ['knowledge'] },
    ae: moduleOn('Knowledge'),
  },
  {
    key: 'community',
    governs: {
      pt: 'Seção de capacidades Zendesk Community',
      en: 'Zendesk Community capabilities section',
      es: 'Sección de capacidades de Zendesk Community',
    },
    framework: { modules: ['community'] },
    ae: moduleOn('Community'),
  },
  {
    key: 'analytics',
    governs: {
      pt: 'Seção de capacidades Zendesk Analytics / Explore',
      en: 'Zendesk Analytics / Explore capabilities section',
      es: 'Sección de capacidades de Zendesk Analytics / Explore',
    },
    framework: { modules: ['analytics'] },
    ae: moduleOn('Analytics'),
  },
  {
    key: 'copilot',
    governs: {
      pt: 'Seção Copilot e premissa de responsabilidade sobre Procedimentos',
      en: 'Copilot section and the assumption about responsibility for Procedures',
      es: 'Sección de Copilot y premisa de responsabilidad sobre los Procedimientos',
    },
    framework: { modules: ['copilot'] },
    ae: moduleOn('Copilot'),
  },
  {
    key: 'ai-agents',
    governs: {
      pt: 'Seção AI Agents',
      en: 'AI Agents section',
      es: 'Sección de AI Agents',
    },
    framework: { modules: ['ai agents'] },
    // AI Agents não é dimensionado pela Calculadora AE.
    ae: never,
  },
  {
    key: 'ai-agents-api',
    governs: {
      pt: 'Bloco longo de premissas de API/endpoints do AI Agents',
      en: 'Long block of AI Agents API/endpoint assumptions',
      es: 'Bloque largo de premisas de API/endpoints de AI Agents',
    },
    // Integrações por API, Ações (AI Agents), Conectar CRM personalizado.
    framework: { itemIds: [175, 168, 176] },
    ae: never,
  },
  {
    key: 'wfm',
    governs: {
      pt: 'Seção de capacidades Zendesk WFM',
      en: 'Zendesk WFM capabilities section',
      es: 'Sección de capacidades de Zendesk WFM',
    },
    framework: { modules: ['wfm', 'workforce'] },
    ae: moduleOn('WFM'),
  },
  {
    key: 'qa',
    governs: {
      pt: 'Seção de capacidades Zendesk QA',
      en: 'Zendesk QA capabilities section',
      es: 'Sección de capacidades de Zendesk QA',
    },
    framework: { modules: ['zendesk qa', 'quality assurance'] },
    ae: moduleOn('QA'),
  },
  {
    key: 'adpp',
    governs: {
      pt: 'Seção ADPP (Advanced Data Privacy and Protection)',
      en: 'ADPP (Advanced Data Privacy and Protection) section',
      es: 'Sección de ADPP (Advanced Data Privacy and Protection)',
    },
    framework: { modules: ['adpp'] },
    ae: moduleOn('ADPP'),
  },
  {
    key: 'marketplace-apps',
    governs: {
      pt: 'Premissa de responsabilidade sobre apps de Marketplace (apps de terceiros e apps da Aktie Now)',
      en: 'Assumption about responsibility for Marketplace apps (third-party and Aktie Now apps)',
      es: 'Premisa de responsabilidad sobre apps de Marketplace (apps de terceros y apps de Aktie Now)',
    },
    framework: { subcategories: ['apps de marketplace'], marketplaceLines: true },
    ae: (s) => s.marketplaceApps > 0 || s.aktieApps > 0,
  },
  {
    key: 'action-flow',
    governs: {
      pt: 'Menção a Action Builder / Fluxos de Ação',
      en: 'Mention of Action Builder / Action Flows',
      es: 'Mención de Action Builder / Flujos de acción',
    },
    // Ação personalizada, Fluxos simples/complexos, sistemas externos, Conexões.
    framework: { itemIds: [132, 133, 134, 135, 136] },
    ae: (s) => s.actionFlows > 0,
  },
  {
    key: 'integracoes-nativas',
    governs: {
      pt: 'Lista de integrações NATIVAS do Zendesk no escopo (Jira, Salesforce, Slack...); apps de Marketplace ficam em marketplace-apps',
      en: 'List of NATIVE Zendesk integrations in scope (Jira, Salesforce, Slack...); Marketplace apps are covered by marketplace-apps',
      es: 'Lista de integraciones NATIVAS de Zendesk en el alcance (Jira, Salesforce, Slack...); las apps de Marketplace van en marketplace-apps',
    },
    framework: { subcategories: ['integracoes nativas'] },
    ae: (s) => s.nativeConnections > 0,
  },
  {
    key: 'migracao-de-dados',
    governs: {
      pt: 'Bloco de Migração de Dados',
      en: 'Data Migration block',
      es: 'Bloque de Migración de datos',
    },
    // Regra mantida da v2: palavra no nome do item.
    framework: { nameKeywords: ['migracao', 'migration', 'importacao de dados'] },
    ae: never,
  },
  {
    key: 'itam',
    governs: {
      pt: 'Bloco de Gestão de Ativos (ITAM) e integrações Intune/Jamf',
      en: 'Asset Management (ITAM) block and Intune/Jamf integrations',
      es: 'Bloque de Gestión de activos (ITAM) e integraciones Intune/Jamf',
    },
    framework: { subcategories: ['gestao de ativos'] },
    ae: never,
  },
  {
    key: 'objetos-customizados',
    governs: {
      pt: 'Bullet de Objetos Customizados',
      en: 'Custom Objects bullet',
      es: 'Viñeta de Objetos personalizados',
    },
    framework: { itemIds: [119, 120] },
    ae: never,
  },
  {
    key: 'sla',
    governs: {
      pt: 'Bullet de políticas de SLA',
      en: 'SLA policies bullet',
      es: 'Viñeta de políticas de SLA',
    },
    framework: { itemIds: [68] },
    ae: (s) => s.slaPolicies > 0,
  },
  {
    key: 'side-conversations',
    governs: {
      pt: 'Bullet de Conversas Paralelas',
      en: 'Side Conversations bullet',
      es: 'Viñeta de Conversaciones paralelas',
    },
    framework: { itemIds: [110, 111] },
    ae: (s) => s.sideConversations,
  },
  {
    key: 'csat',
    governs: {
      pt: 'Bullet de pesquisa de satisfação',
      en: 'Satisfaction survey (CSAT) bullet',
      es: 'Viñeta de encuesta de satisfacción (CSAT)',
    },
    framework: { itemIds: [70] },
    ae: (s) => s.csat > 0,
  },
  {
    key: 'desenvolvimento',
    governs: {
      pt: 'Premissas de Desenvolvimento (horas de Desenvolvimento > 0)',
      en: 'Development assumptions (Development hours > 0)',
      es: 'Premisas de Desarrollo (horas de Desarrollo > 0)',
    },
    framework: { skill: 'Desenvolvimento' },
    ae: never,
  },
  {
    key: 'design',
    governs: {
      pt: 'Tema da Central de Ajuda sob medida (horas de Design > 0)',
      en: 'Custom Help Center theme (Design hours > 0)',
      es: 'Tema personalizado del Centro de ayuda (horas de Diseño > 0)',
    },
    framework: { skill: 'Design' },
    ae: never,
  },
];

/** Sem acento, sem caixa, sem espaços nas pontas. */
export function foldKey(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Linha do Framework como as flags a enxergam. */
export interface FrameworkFlagLine {
  kind: 'package' | 'custom' | 'marketplace';
  packageId?: number | null;
  /** Chave da categoria raiz. */
  category: string;
  /** Chave da subcategoria ('' = raiz). */
  subcategory: string;
  /** Nome em português do item (para as regras por palavra). */
  name: string;
  hours: number;
}

export function frameworkLineMatches(rule: SuppressionFlagRule, line: FrameworkFlagLine): boolean {
  const m = rule.framework;
  if (!(Number(line.hours) > 0)) return false;
  if (m.itemIds && line.kind === 'package' && line.packageId != null && m.itemIds.includes(Number(line.packageId))) return true;
  if (m.marketplaceLines && line.kind === 'marketplace') return true;
  const sub = foldKey(line.subcategory);
  if (m.subcategories && sub && m.subcategories.some((s) => sub === foldKey(s))) return true;
  const cat = foldKey(line.category);
  if (m.modules && m.modules.some((s) => cat.includes(foldKey(s)))) return true;
  if (m.nameKeywords) {
    const name = foldKey(line.name);
    if (m.nameKeywords.some((kw) => name.includes(foldKey(kw)))) return true;
  }
  return false;
}

/** Flags do Framework a partir das linhas que contam hora e das horas por skill. */
export function resolveFrameworkFlags(
  lines: FrameworkFlagLine[],
  skillHours: Record<string, number>,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  SUPPRESSION_FLAGS.forEach((rule) => {
    if (rule.framework.skill) {
      out[rule.key] = Number(skillHours?.[rule.framework.skill] || 0) > 0;
      return;
    }
    out[rule.key] = lines.some((line) => frameworkLineMatches(rule, line));
  });
  return out;
}

export function resolveAEFlags(signals: AEFlagSignals): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  SUPPRESSION_FLAGS.forEach((rule) => { out[rule.key] = rule.ae(signals); });
  return out;
}
