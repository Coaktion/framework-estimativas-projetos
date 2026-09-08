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
 * IDIOMA — SAÍDA SEMPRE EM pt-BR
 * ------------------------------
 * O prompt sai INTEIRO em português, independentemente do idioma da interface.
 *
 * Motivo: a skill `scope-creator` tem um único template, em pt-BR, e casa os
 * trechos suprimíveis contra rótulos em português. Um prompt em inglês pedindo
 * documento em inglês produziria um .docx meio traduzido, com a estrutura de um
 * template que não existe — pior do que um documento coerente em português.
 *
 * O inglês volta quando houver template e skill próprios (já previstos). A
 * mecânica de tradução continua montada: `PROSE.en` está aqui, completa, e
 * `LOCK_OUTPUT_TO_PT` abaixo é o único interruptor. Ligar o inglês é trocar
 * `false` e passar `locale` do chamador.
 *
 * FASE 2 (Zoho CRM)
 * -----------------
 * A seção `[CRM]` NÃO é mais emitida. Os tipos (`ScopeExportCrm`, o campo
 * `crm`) continuam aqui de propósito: quando os endpoints do Zoho existirem,
 * religar é trocar `EMIT_CRM_SECTION` para `true` e preencher o objeto — sem
 * remexer no formato nem na skill.
 */

export const SCOPE_EXPORT_VERSION = 'v1';

/**
 * Emissão da seção `[CRM]`.
 *
 * Desligada enquanto a integração com o Zoho não existe: uma seção inteira de
 * "(pendente — Zoho)" só ensinava a skill a preencher o documento com
 * placeholders. Ligue quando os endpoints estiverem prontos.
 */
const EMIT_CRM_SECTION = false;

/**
 * Trava a saída em pt-BR.
 *
 * Enquanto `true`, `input.locale` é ignorado e o prompt sai em português — é o
 * que garante compatibilidade com o template pt-BR da skill `scope-creator`.
 * Troque para `false` quando existirem template e skill em inglês.
 */
const LOCK_OUTPUT_TO_PT = true;

export type ScopeExportLocale = 'pt' | 'en';

export type ScopeTemplateKey = 'pacote-de-horas' | 'escopo-padrao-60h';
export type ScopeOrigin = 'framework' | 'calculadora-ae';

/**
 * Prosa do prompt, por idioma.
 *
 * Só entra aqui o que um humano LÊ ou o que instrui o modelo. Tags de seção,
 * rótulos de campo e valores de enum ficam de fora — são identificadores.
 */
const PROSE = {
  pt: {
    outputLanguage: 'pt-BR',
    instruction: 'Gere o Escopo Técnico deste projeto usando a skill scope-creator.',
    precedence:
      'REGRA DE PRECEDÊNCIA: os dados do bloco abaixo são a fonte de verdade e ' +
      'prevalecem sobre qualquer documento anexado. Use anexos apenas para ' +
      'enriquecer contexto (dores, objetivos, cenário atual). Nada que apareça ' +
      'só no anexo entra no escopo.',
    glossary: '',
    missing: '(não informado)',
    pendingCrm: '(pendente — Zoho)',
    noModules: '(nenhum módulo identificado)',
    noChannels: '(nenhum canal identificado)',
    noIntegrations: '(nenhuma integração ou app no escopo)',
    noHours: '(sem horas lançadas)',
    noItems: '(nenhum item selecionado)',
    yes: 'sim',
    no: 'nao',
    crmNote1: '# Preenchido pela integração com o Zoho CRM (fase 2). Campos pendentes',
    crmNote2: '# devem ser deixados como placeholder no documento, nunca inventados.',
    flagsNote: '# "nao" significa REMOVER do documento o trecho correspondente.',
    itemsNote: '# Use para decidir quais bullets de capacidade permanecem no documento.',
    contextNote:
      '# Texto livre escrito pelo Account Executive. Use para redigir as seções ' +
      'de contexto, dores e objetivos — nunca para acrescentar entregas ao escopo.',
    skillHoursLabel: 'Horas por skill',
    percentsLabel: 'Percentuais aplicados',
    painsLabel: 'Dores identificadas',
    end: '===== FIM =====',
  },
  en: {
    outputLanguage: 'en-US',
    instruction: 'Generate the Technical Scope for this project using the scope-creator skill.',
    precedence:
      'PRECEDENCE RULE: the data in the block below is the source of truth and ' +
      'overrides any attached document. Use attachments only to enrich context ' +
      '(pain points, goals, current landscape). Nothing that appears only in an ' +
      'attachment belongs in the scope.',
    glossary:
      '# Section tags and field labels below are STABLE KEYS and stay in Portuguese ' +
      'on purpose, so the same parser reads a prompt copied in any interface ' +
      'language. Quick glossary: PROJETO=Project, DIMENSIONAMENTO=Sizing, ' +
      'PLATAFORMA=Platform, MÓDULOS EM ESCOPO=Modules in scope, CANAIS EM ' +
      'ESCOPO=Channels in scope, INTEGRAÇÕES E APPS=Integrations and apps, ' +
      'CONTEXTO DO CLIENTE=Client context, FLAGS DE SUPRESSÃO=Suppression flags, ' +
      'DETALHAMENTO POR CATEGORIA=Breakdown by category, ITENS ' +
      'SELECIONADOS=Selected items. Values "sim"/"nao" mean yes/no. ' +
      'Write the DOCUMENT in the language given by IDIOMA DE SAÍDA.',
    missing: '(not provided)',
    pendingCrm: '(pending — Zoho)',
    noModules: '(no module identified)',
    noChannels: '(no channel identified)',
    noIntegrations: '(no integration or app in scope)',
    noHours: '(no hours entered)',
    noItems: '(no item selected)',
    yes: 'sim',
    no: 'nao',
    crmNote1: '# Filled by the Zoho CRM integration (phase 2). Pending fields must be',
    crmNote2: '# left as placeholders in the document, never invented.',
    flagsNote: '# "nao" means REMOVE the corresponding passage from the document.',
    itemsNote: '# Use this to decide which capability bullets stay in the document.',
    contextNote:
      '# Free text written by the Account Executive. Use it to write the context, ' +
      'pain-point and goal sections — never to add deliverables to the scope.',
    skillHoursLabel: 'Horas por skill',
    percentsLabel: 'Percentuais aplicados',
    painsLabel: 'Dores identificadas',
    end: '===== FIM =====',
  },
} as const;

function proseFor(locale?: ScopeExportLocale | string | null) {
  if (LOCK_OUTPUT_TO_PT) return PROSE.pt;
  return String(locale || 'pt').toLowerCase().startsWith('en') ? PROSE.en : PROSE.pt;
}

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

  /**
   * Idioma da interface de quem copiou.
   *
   * Hoje é IGNORADO: `LOCK_OUTPUT_TO_PT` força pt-BR para bater com o template
   * da skill. O campo continua aqui para que religar o inglês seja só destravar
   * a constante — os chamadores já passam o idioma certo.
   */
  locale?: ScopeExportLocale | string | null;

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

  /** Nova implantação × Otimização de instância existente. */
  deploymentType?: 'new' | 'optimization' | null;

  modules?: string[] | null;
  channels?: ScopeExportChannel[] | null;
  integrations?: ScopeExportIntegration[] | null;

  /** Flags de supressão já resolvidas (ver `SUPPRESSION_FLAGS`). */
  flags?: Record<string, boolean> | null;

  categories?: ScopeExportCategory[] | null;
  items?: ScopeExportItem[] | null;

  /**
   * Texto livre digitado na Calculadora AE ("Objetivos e dores do cliente" e
   * "Indicadores de sucesso").
   *
   * É a única entrada qualitativa que o site tem sobre o cliente, e o que
   * permite à skill escrever as seções de contexto e objetivos sem inventar.
   * Vai num bloco próprio, separado do dimensionamento, exatamente para que a
   * regra de precedência continue clara: contexto NÃO cria entrega.
   */
  clientObjectives?: string | null;
  successIndicators?: string | null;

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

function orMissing(value: unknown, fallback: string): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

/** Normaliza texto multilinha para o corpo do prompt, sem linhas vazias. */
function textBlock(value: unknown): string[] {
  return String(value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
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
  const L = proseFor(input.locale);
  const missing = (value: unknown, fallback: string = L.missing) => orMissing(value, fallback);

  // ---- Instrução de uso ---------------------------------------------------
  push(L.instruction);
  push();
  push(L.precedence);
  push();

  // ---- Envelope -----------------------------------------------------------
  push(`===== Aktie Now Tools Center · ESCOPO TÉCNICO · ${SCOPE_EXPORT_VERSION} =====`);
  push(`ORIGEM: ${input.origin}`);
  push(`TEMPLATE: ${input.template}  # ${TEMPLATE_LABEL[input.template]}`);
  // A linha que decide o idioma do DOCUMENTO. Segue a interface.
  push(`IDIOMA DE SAÍDA: ${L.outputLanguage}`);
  if (L.glossary) push(L.glossary);
  push();

  // ---- Projeto ------------------------------------------------------------
  push('[PROJETO]');
  push(`Cliente: ${missing(input.clientName)}`);
  push(`Projeto: ${missing(input.projectName, missing(input.clientName))}`);
  push(`Versão da proposta técnica: ${missing(input.versionName, 'v1')}`);
  push(`Data: ${dateBR(input.generatedAt)}`);
  push(`Pre-Sales responsável: ${missing(input.preSalesName)}`);
  push(`Link do escopo técnico: ${missing(input.technicalScopeLink)}`);
  push(`Link do negócio: ${missing(input.zohoLink)}`);
  if (input.deploymentType) {
    push(`Tipo de projeto: ${input.deploymentType === 'optimization' ? 'Otimização' : 'Nova implantação'}`);
  }
  push();

  // ---- CRM (fase 2) -------------------------------------------------------
  // Desligado enquanto os endpoints do Zoho não existem — ver EMIT_CRM_SECTION.
  if (EMIT_CRM_SECTION) {
    const crm = input.crm || {};
    push('[CRM]');
    push(L.crmNote1);
    push(L.crmNote2);
    push(`Razão social do cliente: ${missing(crm.clientLegalName, L.pendingCrm)}`);
    push(`ID do negócio: ${missing(crm.dealId, L.pendingCrm)}`);
    push(`Account Executive: ${missing(crm.accountExecutive, L.pendingCrm)}`);
    push(`Site do cliente: ${missing(crm.clientWebsite, L.pendingCrm)}`);
    push(`Segmento: ${missing(crm.segment, L.pendingCrm)}`);
    push(`Região de operação: ${missing(crm.region, L.pendingCrm)}`);
    push(`Modelo de atendimento: ${missing(crm.serviceModel, L.pendingCrm)}`);
    push(`Vigência para uso das horas: ${missing(crm.hoursValidityMonths, L.pendingCrm)}`);
    push(`BANT: ${missing(crm.bant, L.pendingCrm)}`);
    const pains = (crm.painPoints || []).filter(Boolean);
    if (pains.length) {
      push(`${L.painsLabel}:`);
      pains.forEach((pain) => push(`- ${pain}`));
    } else {
      push(`${L.painsLabel}: ${L.pendingCrm}`);
    }
    push();
  }

  // ---- Contexto do cliente (texto livre do AE) ---------------------------
  const objectives = textBlock(input.clientObjectives);
  const indicators = textBlock(input.successIndicators);
  if (objectives.length || indicators.length) {
    push('[CONTEXTO DO CLIENTE]');
    push(L.contextNote);
    if (objectives.length) {
      push('Objetivos e dores do cliente:');
      objectives.forEach((line) => push(`- ${line}`));
    }
    if (indicators.length) {
      push('Indicadores de sucesso:');
      indicators.forEach((line) => push(`- ${line}`));
    }
    push();
  }

  // ---- Dimensionamento ---------------------------------------------------
  push('[DIMENSIONAMENTO]');
  push(`Total de horas: ${hrs(input.totalHours)}`);
  const skills = input.skillHours || {};
  const skillOrder = ['Implantação', 'Solution Design', 'GP', 'Desenvolvimento', 'Design'];
  const skillNames: Record<string, string> = {
    'GP': 'Gerente de Projeto',
  };
  push(`${L.skillHoursLabel}:`);
  skillOrder.forEach((skill) => {
    const value = Number(skills[skill] || 0);
    push(`- ${skillNames[skill] || skill}: ${hrs(value)}`);
  });
  const p = input.percents || {};
  push(
    `${L.percentsLabel}: Discovery ${pct(p.discovery)} · ` +
      `Validação ${pct(p.validation)} · GP ${pct(p.gp)}`,
  );
  push();

  // ---- Plataforma --------------------------------------------------------
  push('[PLATAFORMA]');
  push(`Plano Zendesk: ${missing(input.planTierLabel)}`);
  push(`Tipo de instância: ${missing(input.skuLabel)}`);
  push();

  // ---- Módulos -----------------------------------------------------------
  const modules = (input.modules || []).filter(Boolean);
  push('[MÓDULOS EM ESCOPO]');
  push(modules.length ? modules.join(', ') : L.noModules);
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
    push(L.noChannels);
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
    push(L.noIntegrations);
  }
  push();

  // ---- Flags -------------------------------------------------------------
  const flags = input.flags || {};
  push('[FLAGS DE SUPRESSÃO]');
  push(L.flagsNote);
  SUPPRESSION_FLAGS.forEach((flag) => {
    const on = Boolean(flags[flag.key]);
    push(`${flag.key}: ${on ? L.yes : L.no}  # ${flag.governs}`);
  });
  // Flags fora da tabela (ex.: desenvolvimento) também são emitidas.
  Object.keys(flags)
    .filter((key) => !SUPPRESSION_FLAGS.some((f) => f.key === key))
    .sort()
    .forEach((key) => push(`${key}: ${flags[key] ? L.yes : L.no}`));
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
    push(L.noHours);
  }
  push();

  // ---- Itens -------------------------------------------------------------
  const items = (input.items || []).filter((i) => i && i.label);
  push('[ITENS SELECIONADOS]');
  push(L.itemsNote);
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
    push(L.noItems);
  }
  push();

  push(L.end);

  return lines.join('\n');
}
