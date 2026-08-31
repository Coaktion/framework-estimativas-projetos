/**
 * Exportação do escopo como PROMPT para a skill `scope-creator`.
 *
 * O texto gerado aqui é a ÚNICA fonte de verdade que a skill recebe do site.
 * Documentos anexados pelo usuário (transcrições, atas) servem para enriquecer
 * contexto, mas nunca para contradizer este bloco — a regra está escrita no
 * próprio cabeçalho do texto, para que valha mesmo se a skill for editada.
 *
 * FORMATO
 * -------
 * Blocos `[SEÇÃO]` com linhas `Rótulo: valor`. Não é JSON de propósito: o SE
 * costuma revisar e ajustar o texto antes de colar, e um JSON quebra com
 * qualquer edição manual. Chaves são estáveis; valores são livres.
 *
 * VERSIONAMENTO
 * -------------
 * A primeira linha do envelope traz `v1`. Ao mudar o formato, incremente e
 * ensine a skill a aceitar as duas versões — assim um prompt copiado ontem
 * continua funcionando.
 *
 * FASE 2 (Zoho CRM)
 * -----------------
 * A seção `[CRM]` já é emitida com os campos previstos, marcados como
 * "(pendente — Zoho)". Quando a integração existir, basta preencher
 * `ScopeExportInput.crm` que o texto sai completo, sem mudar a skill nem o
 * formato. É por isso que a seção existe desde já, vazia.
 */

export const SCOPE_EXPORT_VERSION = 'v1';

export type ScopeTemplateKey = 'pacote-de-horas' | 'escopo-padrao-60h';
export type ScopeOrigin = 'framework' | 'calculadora-ae';

/** Valor exibido quando o dado não existe no site. */
const MISSING = '(não informado)';
/** Valor exibido para campos que virão do Zoho na fase 2. */
const PENDING_CRM = '(pendente — Zoho)';

export interface ScopeExportChannel {
  label: string;
  quantity?: number | null;
}

export interface ScopeExportIntegration {
  /** Ex.: "Integração nativa", "Marketplace", "App AktieNow", "Action Flow". */
  kind: string;
  label: string;
  quantity?: number | null;
}

export interface ScopeExportItem {
  category: string;
  subcategory: string;
  label: string;
  quantity: number;
  hours: number;
}

export interface ScopeExportCategory {
  label: string;
  hours: number;
  subcategories: Array<{ label: string; hours: number }>;
}

/**
 * Campos que hoje vêm em branco e serão preenchidos pelo Zoho CRM na fase 2.
 * Mantidos num tipo próprio para deixar explícito o que é do site e o que é do
 * CRM.
 */
export interface ScopeExportCrm {
  dealId?: string | null;
  accountExecutive?: string | null;
  clientLegalName?: string | null;
  clientWebsite?: string | null;
  segment?: string | null;
  region?: string | null;
  serviceModel?: string | null;
  painPoints?: string[] | null;
  bant?: string | null;
  hoursValidityMonths?: number | string | null;
}

export interface ScopeExportInput {
  origin: ScopeOrigin;
  template: ScopeTemplateKey;

  clientName: string;
  projectName?: string | null;
  versionName?: string | null;
  generatedAt?: Date | null;

  technicalScopeLink?: string | null;
  zohoLink?: string | null;
  preSalesName?: string | null;

  /** Total consolidado exibido no framework. */
  totalHours: number;
  /** Horas por skill, na chave canônica em português. */
  skillHours?: Record<string, number> | null;
  percents?: { discovery?: number; validation?: number; gp?: number } | null;

  planTierLabel: string;
  skuLabel: string;

  modules?: string[] | null;
  channels?: ScopeExportChannel[] | null;
  integrations?: ScopeExportIntegration[] | null;

  /** Flags de supressão já resolvidas (ver `SUPPRESSION_FLAGS`). */
  flags?: Record<string, boolean> | null;

  categories?: ScopeExportCategory[] | null;
  items?: ScopeExportItem[] | null;

  crm?: ScopeExportCrm | null;
}

/* -------------------------------------------------------------------------- */
/*                        DETECÇÃO DAS FLAGS DE SUPRESSÃO                      */
/* -------------------------------------------------------------------------- */

/**
 * Cada flag governa um trecho do template que só deve permanecer quando o
 * escopo realmente contempla aquilo. Exemplo: sem WhatsApp, a premissa longa
 * sobre validação do número na Meta sai do documento.
 *
 * `keywords` casa contra o nome do item já sem acento e em minúsculas;
 * `categories` casa contra o nome da categoria da mesma forma. Qualquer
 * ocorrência liga a flag.
 *
 * Manter esta tabela é mais barato do que manter regras espalhadas: renomeou um
 * item na biblioteca? Ajuste a palavra-chave aqui e a supressão volta a valer.
 */
export const SUPPRESSION_FLAGS: Array<{
  key: string;
  /** O que o documento perde quando a flag é falsa. */
  governs: string;
  keywords?: string[];
  categories?: string[];
}> = [
  { key: 'whatsapp', governs: 'Premissas de ativação do número WhatsApp na Meta / Facebook Business', keywords: ['whatsapp'] },
  { key: 'sso', governs: 'Premissa de SSO (SAML/JWT) e provisionamento', keywords: ['sso', 'single sign', 'saml', 'jwt', 'scim'] },
  { key: 'conteudo-dinamico', governs: 'Premissa de tradução do Conteúdo Dinâmico', keywords: ['conteudo dinamico', 'dynamic content', 'multi-idioma', 'multi idioma', 'idioma'] },
  { key: 'central-de-ajuda', governs: 'Premissas de mapeamento de host/CNAME e itens de Central de Ajuda', keywords: ['central de ajuda', 'help center', 'guide', 'tema', 'theme'] },
  { key: 'email', governs: 'Premissa de SPF/DKIM/DNS do canal de e-mail', keywords: ['email', 'e-mail'] },
  { key: 'voz', governs: 'Seção de capacidades Zendesk Voice e itens de URA/fila', keywords: ['voz', 'voice', 'ura', 'ivr', 'talk'], categories: ['canais - voz'] },
  { key: 'knowledge', governs: 'Seção Zendesk Knowledge e premissas de conteúdo de artigos', keywords: ['knowledge', 'artigo', 'base de conhecimento'], categories: ['zendesk knowledge'] },
  { key: 'community', governs: 'Seção de capacidades Zendesk Community', keywords: ['community', 'comunidade'] },
  { key: 'analytics', governs: 'Seção de capacidades Zendesk Analytics / Explore', keywords: ['analytics', 'explore', 'dashboard', 'relatorio'], categories: ['zendesk analytics'] },
  { key: 'copilot', governs: 'Seção Copilot e premissa de responsabilidade sobre Procedimentos', keywords: ['copilot', 'triagem inteligente', 'auto assist'], categories: ['zendesk copilot'] },
  { key: 'ai-agents', governs: 'Seção AI Agents e o bloco longo de premissas de API/endpoints', keywords: ['ai agent', 'bot', 'dialog', 'procedure'], categories: ['ai agents essential', 'ai agents advanced'] },
  { key: 'wfm', governs: 'Seção de capacidades Zendesk WFM', keywords: ['wfm', 'workforce'], categories: ['zendesk wfm'] },
  { key: 'qa', governs: 'Seção de capacidades Zendesk QA', keywords: ['qa', 'quality assurance', 'scorecard'], categories: ['zendesk qa'] },
  { key: 'marketplace-apps', governs: 'Premissa de responsabilidade sobre apps de Marketplace', keywords: ['marketplace', 'app '], categories: ['marketplace'] },
  { key: 'action-flow', governs: 'Menção a Action Builder / Fluxos de Ação', keywords: ['action flow', 'action builder', 'fluxo de acao'] },
  { key: 'integracoes-nativas', governs: 'Lista de integrações de Marketplace no escopo', categories: ['integracoes nativas'] },
  { key: 'migracao-de-dados', governs: 'Bloco de Migração de Dados', keywords: ['migracao', 'migration', 'importacao de dados'] },
  { key: 'itam', governs: 'Bloco de Gestão de Ativos (ITAM) e integrações Intune/Jamf', keywords: ['itam', 'ativo', 'asset'], categories: ['asset management'] },
  { key: 'objetos-customizados', governs: 'Bullet de Objetos Customizados', keywords: ['objeto customizado', 'custom object'] },
  { key: 'sla', governs: 'Bullet de políticas de SLA', keywords: ['sla'] },
  { key: 'side-conversations', governs: 'Bullet de Conversas Paralelas', keywords: ['side conversation', 'conversa paralela'] },
  { key: 'csat', governs: 'Bullet de pesquisa de satisfação', keywords: ['csat', 'satisfacao'] },
];

/** Remove acentos e caixa — mesma normalização usada na busca do framework. */
export function fold(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Resolve as flags a partir dos itens que realmente entraram no escopo.
 *
 * `extra` permite forçar uma flag a partir de um sinal que não está no nome do
 * item — por exemplo `desenvolvimento`, que vem das horas da skill, não de uma
 * palavra-chave.
 */
export function detectSuppressionFlags(
  items: ScopeExportItem[],
  extra: Record<string, boolean> = {},
): Record<string, boolean> {
  const haystacks = items.map((item) => ({
    name: fold(item.label),
    category: fold(item.category),
    subcategory: fold(item.subcategory),
  }));

  const flags: Record<string, boolean> = {};

  for (const flag of SUPPRESSION_FLAGS) {
    const keywords = (flag.keywords || []).map(fold).filter(Boolean);
    const categories = (flag.categories || []).map(fold).filter(Boolean);

    flags[flag.key] = haystacks.some((hay) => {
      if (categories.some((cat) => hay.category.includes(cat))) return true;
      return keywords.some(
        (kw) => hay.name.includes(kw) || hay.subcategory.includes(kw),
      );
    });
  }

  return { ...flags, ...extra };
}

/* -------------------------------------------------------------------------- */
/*                              MONTAGEM DO TEXTO                              */
/* -------------------------------------------------------------------------- */

/** Formata horas em pt-BR, sem casa decimal inútil: 12,5h / 30h. */
function hrs(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0h';
  const rounded = Math.round(n * 10) / 10;
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1).replace('.', ',');
  return `${text}h`;
}

function pct(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0%';
  const rounded = Math.round(n * 100) / 100;
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : String(rounded).replace('.', ',');
  return `${text}%`;
}

function orMissing(value: unknown, fallback = MISSING): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function dateBR(value?: Date | null): string {
  const date = value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date();
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

const TEMPLATE_LABEL: Record<ScopeTemplateKey, string> = {
  'pacote-de-horas': 'TEMPLATE_[PT Pacote de Horas] — proposta técnica completa',
  'escopo-padrao-60h': '[PT] Escopo Padrão - Até 60hrs - V2',
};

export function buildScopePrompt(input: ScopeExportInput): string {
  const lines: string[] = [];
  const push = (line = '') => lines.push(line);

  // ---- Instrução de uso ---------------------------------------------------
  push('Gere o Escopo Técnico deste projeto usando a skill scope-creator.');
  push();
  push(
    'REGRA DE PRECEDÊNCIA: os dados do bloco abaixo são a fonte de verdade e ' +
      'prevalecem sobre qualquer documento anexado. Use anexos apenas para ' +
      'enriquecer contexto (dores, objetivos, cenário atual). Nada que apareça ' +
      'só no anexo entra no escopo.',
  );
  push();

  // ---- Envelope -----------------------------------------------------------
  push(`===== PRE-SALES.AI · ESCOPO TÉCNICO · ${SCOPE_EXPORT_VERSION} =====`);
  push(`ORIGEM: ${input.origin}`);
  push(`TEMPLATE: ${input.template}  # ${TEMPLATE_LABEL[input.template]}`);
  push('IDIOMA DE SAÍDA: pt-BR');
  push();

  // ---- Projeto ------------------------------------------------------------
  push('[PROJETO]');
  push(`Cliente: ${orMissing(input.clientName)}`);
  push(`Projeto: ${orMissing(input.projectName, orMissing(input.clientName))}`);
  push(`Versão da proposta técnica: ${orMissing(input.versionName, 'v1')}`);
  push(`Data: ${dateBR(input.generatedAt)}`);
  push(`Pre-Sales responsável: ${orMissing(input.preSalesName)}`);
  push(`Link do escopo técnico: ${orMissing(input.technicalScopeLink)}`);
  push(`Link do negócio: ${orMissing(input.zohoLink)}`);
  push();

  // ---- CRM (fase 2) -------------------------------------------------------
  const crm = input.crm || {};
  push('[CRM]');
  push('# Preenchido pela integração com o Zoho CRM (fase 2). Campos pendentes');
  push('# devem ser deixados como placeholder no documento, nunca inventados.');
  push(`Razão social do cliente: ${orMissing(crm.clientLegalName, PENDING_CRM)}`);
  push(`ID do negócio: ${orMissing(crm.dealId, PENDING_CRM)}`);
  push(`Account Executive: ${orMissing(crm.accountExecutive, PENDING_CRM)}`);
  push(`Site do cliente: ${orMissing(crm.clientWebsite, PENDING_CRM)}`);
  push(`Segmento: ${orMissing(crm.segment, PENDING_CRM)}`);
  push(`Região de operação: ${orMissing(crm.region, PENDING_CRM)}`);
  push(`Modelo de atendimento: ${orMissing(crm.serviceModel, PENDING_CRM)}`);
  push(`Vigência para uso das horas: ${orMissing(crm.hoursValidityMonths, PENDING_CRM)}`);
  push(`BANT: ${orMissing(crm.bant, PENDING_CRM)}`);
  const pains = (crm.painPoints || []).filter(Boolean);
  if (pains.length) {
    push('Dores identificadas:');
    pains.forEach((pain) => push(`- ${pain}`));
  } else {
    push(`Dores identificadas: ${PENDING_CRM}`);
  }
  push();

  // ---- Dimensionamento ---------------------------------------------------
  push('[DIMENSIONAMENTO]');
  push(`Total de horas: ${hrs(input.totalHours)}`);
  const skills = input.skillHours || {};
  const skillOrder = ['Implantação', 'Solution Design', 'GP', 'Desenvolvimento', 'Design'];
  const skillNames: Record<string, string> = {
    'GP': 'Gerente de Projeto',
  };
  push('Horas por skill:');
  skillOrder.forEach((skill) => {
    const value = Number(skills[skill] || 0);
    push(`- ${skillNames[skill] || skill}: ${hrs(value)}`);
  });
  const p = input.percents || {};
  push(
    `Percentuais aplicados: Discovery ${pct(p.discovery)} · ` +
      `Validação ${pct(p.validation)} · GP ${pct(p.gp)}`,
  );
  push();

  // ---- Plataforma --------------------------------------------------------
  push('[PLATAFORMA]');
  push(`Plano Zendesk: ${orMissing(input.planTierLabel)}`);
  push(`Tipo de instância: ${orMissing(input.skuLabel)}`);
  push();

  // ---- Módulos -----------------------------------------------------------
  const modules = (input.modules || []).filter(Boolean);
  push('[MÓDULOS EM ESCOPO]');
  push(modules.length ? modules.join(', ') : '(nenhum módulo identificado)');
  push();

  // ---- Canais ------------------------------------------------------------
  const channels = (input.channels || []).filter((c) => c && c.label);
  push('[CANAIS EM ESCOPO]');
  if (channels.length) {
    channels.forEach((c) => {
      const qty = Number(c.quantity);
      push(`- ${c.label}${Number.isFinite(qty) && qty > 0 ? `: ${qty}` : ''}`);
    });
  } else {
    push('(nenhum canal identificado)');
  }
  push();

  // ---- Integrações -------------------------------------------------------
  const integrations = (input.integrations || []).filter((i) => i && i.label);
  push('[INTEGRAÇÕES E APPS]');
  if (integrations.length) {
    integrations.forEach((i) => {
      const qty = Number(i.quantity);
      push(
        `- ${i.kind}: ${i.label}` +
          (Number.isFinite(qty) && qty > 1 ? ` (${qty})` : ''),
      );
    });
  } else {
    push('(nenhuma integração ou app no escopo)');
  }
  push();

  // ---- Flags -------------------------------------------------------------
  const flags = input.flags || {};
  push('[FLAGS DE SUPRESSÃO]');
  push('# "nao" significa REMOVER do documento o trecho correspondente.');
  SUPPRESSION_FLAGS.forEach((flag) => {
    const on = Boolean(flags[flag.key]);
    push(`${flag.key}: ${on ? 'sim' : 'nao'}  # ${flag.governs}`);
  });
  // Flags fora da tabela (ex.: desenvolvimento) também são emitidas.
  Object.keys(flags)
    .filter((key) => !SUPPRESSION_FLAGS.some((f) => f.key === key))
    .sort()
    .forEach((key) => push(`${key}: ${flags[key] ? 'sim' : 'nao'}`));
  push();

  // ---- Detalhamento ------------------------------------------------------
  const categories = (input.categories || []).filter((c) => c && c.label);
  push('[DETALHAMENTO POR CATEGORIA]');
  if (categories.length) {
    categories.forEach((cat) => {
      push(`${cat.label} — ${hrs(cat.hours)}`);
      (cat.subcategories || []).forEach((sub) => {
        push(`  ${sub.label}: ${hrs(sub.hours)}`);
      });
    });
  } else {
    push('(sem horas lançadas)');
  }
  push();

  // ---- Itens -------------------------------------------------------------
  const items = (input.items || []).filter((i) => i && i.label);
  push('[ITENS SELECIONADOS]');
  push('# Use para decidir quais bullets de capacidade permanecem no documento.');
  if (items.length) {
    let currentGroup = '';
    items.forEach((item) => {
      const group = `${item.category} / ${item.subcategory}`;
      if (group !== currentGroup) {
        currentGroup = group;
        push(group);
      }
      const qty = Number(item.quantity) || 0;
      push(`- ${item.label}${qty > 1 ? ` ×${qty}` : ''} — ${hrs(item.hours)}`);
    });
  } else {
    push('(nenhum item selecionado)');
  }
  push();

  push('===== FIM =====');

  return lines.join('\n');
}
