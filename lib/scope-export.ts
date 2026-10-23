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
 * v2
 * --
 * - REGRA DE REDAÇÃO no cabeçalho: quantidades dimensionam horas e preço; o
 *   documento descreve o que será feito e só cita números relevantes.
 * - `[DADOS INFORMADOS]`: tudo o que foi digitado na tela e não cabe nas outras
 *   seções (agentes, marcas, áreas, operação, artigos, SSO, texto de outros
 *   apps...).
 * - `[ITENS SELECIONADOS]` traz quantidade × horas unitárias, skill, ajuste
 *   manual e os textos "Inclui / Não inclui" de cada item.
 * - `[ZOHO CRM]`: campos do negócio lidos do Zoho (somente leitura) na hora da
 *   cópia — ver lib/zoho.ts. Campos vazios saem agrupados numa linha só.
 */

export const SCOPE_EXPORT_VERSION = 'v2';

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
    writingRule:
      'REGRA DE REDAÇÃO: quantidades e horas servem para dimensionar o esforço e ' +
      'o preço. O documento descreve O QUE será feito, não quantas vezes — ' +
      '"3 e-mails + 1 Facebook + 3 linhas" vira "configurar os canais de e-mail, ' +
      'Facebook e telefonia no Zendesk". Cite um número só quando ele for ' +
      'relevante para o cliente entender o escopo (ex.: número de marcas ou de ' +
      'idiomas, integrações nomeadas, limites combinados).',
    glossary: '',
    missing: '(não informado)',
    noModules: '(nenhum módulo identificado)',
    noChannels: '(nenhum canal identificado)',
    noIntegrations: '(nenhuma integração ou app no escopo)',
    noHours: '(sem horas lançadas)',
    noItems: '(nenhum item selecionado)',
    yes: 'sim',
    no: 'nao',
    zohoNote:
      '# Campos do negócio no Zoho CRM, lidos na hora da cópia. Use como contexto ' +
      '(cliente, negócio, contatos); não criam entregas no escopo.',
    factsNote: '# Dados digitados na tela. Servem para entender e dimensionar; não são texto para o documento.',
    flagsNote: '# "nao" significa REMOVER do documento o trecho correspondente.',
    itemsNote:
      '# Use para decidir quais bullets de capacidade permanecem no documento. ' +
      '"Inclui / Não inclui" descrevem a entrega de cada item.',
    contextNote:
      '# Texto livre escrito pelo Account Executive. Use para redigir as seções ' +
      'de contexto, dores e objetivos — nunca para acrescentar entregas ao escopo.',
    skillHoursLabel: 'Horas por skill',
    percentsLabel: 'Percentuais aplicados',
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
    writingRule:
      'WRITING RULE: quantities and hours size the effort and the price. The ' +
      'document describes WHAT will be done, not how many times — "3 emails + ' +
      '1 Facebook + 3 lines" becomes "set up the email, Facebook and phone ' +
      'channels in Zendesk". Only cite a number when it matters for the client ' +
      'to understand the scope (e.g. number of brands or languages, named ' +
      'integrations, agreed limits).',
    missing: '(not provided)',
    noModules: '(no module identified)',
    noChannels: '(no channel identified)',
    noIntegrations: '(no integration or app in scope)',
    noHours: '(no hours entered)',
    noItems: '(no item selected)',
    yes: 'sim',
    no: 'nao',
    zohoNote:
      '# Deal fields from Zoho CRM, read when the prompt was copied. Use them as ' +
      'context (client, deal, contacts); they never add deliverables to the scope.',
    factsNote: '# Data typed on screen. It helps understand and size the project; it is not text for the document.',
    flagsNote: '# "nao" means REMOVE the corresponding passage from the document.',
    itemsNote:
      '# Use this to decide which capability bullets stay in the document. ' +
      '"Inclui / Não inclui" describe what each item delivers.',
    contextNote:
      '# Free text written by the Account Executive. Use it to write the context, ' +
      'pain-point and goal sections — never to add deliverables to the scope.',
    skillHoursLabel: 'Horas por skill',
    percentsLabel: 'Percentuais aplicados',
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
  /** Horas por unidade (quando o item tem quantidade × horas). */
  unitHours?: number | null;
  skill?: string | null;
  /** As horas foram digitadas à mão (ajuste manual), não quantidade × horas. */
  manualHours?: boolean;
  /** Texto "o que está incluído" do item (biblioteca ou linha personalizada). */
  includes?: string | null;
  /** Texto "o que não está incluído". */
  excludes?: string | null;
  /** Link de referência (ex.: página do app no Marketplace). */
  link?: string | null;
}

export interface ScopeExportCategory {
  label: string;
  hours: number;
  subcategories: Array<{ label: string; hours: number }>;
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
  /** Descrição digitada ao salvar a versão. */
  versionDescription?: string | null;
  generatedAt?: Date | null;

  technicalScopeLink?: string | null;
  zohoLink?: string | null;
  preSalesName?: string | null;

  /** Total consolidado exibido no framework. */
  totalHours: number;
  /** Horas por skill, na chave canônica em português. */
  skillHours?: Record<string, number> | null;
  percents?: { discovery?: number; validation?: number; gp?: number } | null;
  /**
   * Percentuais efetivamente aplicados, com observação opcional (ex.: "projeto
   * com SD — sem discovery percentual"). Quando presente, substitui a linha
   * montada a partir de `percents`.
   */
  percentLines?: Array<{ label: string; value: number; note?: string }> | null;
  /**
   * Horas de cada parcela calculada (Discovery, Validação, GP...). Saem logo
   * abaixo das horas por skill, para que o total feche à vista.
   */
  calculatedHours?: Array<{ label: string; hours: number; note?: string }> | null;

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

  /** Demais dados digitados na tela, como "Rótulo: valor" (seção [DADOS INFORMADOS]). */
  facts?: Array<{ label: string; value: string }> | null;

  /** Linhas já formatadas da seção [ZOHO CRM] (ver lib/zoho.ts). Ausente = seção omitida. */
  zohoSection?: string[] | null;
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
  push(L.writingRule);
  push();

  // ---- Envelope -----------------------------------------------------------
  push(`===== Aktie Now Tool Center · ESCOPO TÉCNICO · ${SCOPE_EXPORT_VERSION} =====`);
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
  const versionDescription = textBlock(input.versionDescription);
  if (versionDescription.length) push(`Descrição da versão: ${versionDescription.join(' / ')}`);
  push(`Data: ${dateBR(input.generatedAt)}`);
  push(`Pre-Sales responsável: ${missing(input.preSalesName)}`);
  push(`Link do escopo técnico: ${missing(input.technicalScopeLink)}`);
  push(`Link do negócio: ${missing(input.zohoLink)}`);
  if (input.deploymentType) {
    push(`Tipo de projeto: ${input.deploymentType === 'optimization' ? 'Otimização' : 'Nova implantação'}`);
  }
  push();

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

  // ---- Zoho CRM (lido na hora da cópia) -----------------------------------
  if (input.zohoSection && input.zohoSection.length) {
    push('[ZOHO CRM]');
    push(L.zohoNote);
    input.zohoSection.forEach((line) => push(line));
    push();
  }

  // ---- Dados informados na tela ------------------------------------------
  const facts = (input.facts || []).filter((f) => f && f.label && String(f.value ?? '').trim());
  if (facts.length) {
    push('[DADOS INFORMADOS]');
    push(L.factsNote);
    facts.forEach((f) => push(`${f.label}: ${textBlock(f.value).join(' / ')}`));
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
  // Skills além das cinco padrão (cadastradas no Admin) também entram no total.
  Object.keys(skills)
    .filter((skill) => !skillOrder.includes(skill) && Number(skills[skill]) > 0)
    .sort()
    .forEach((skill) => push(`- ${skill}: ${hrs(skills[skill])}`));
  const calculated = (input.calculatedHours || []).filter((c) => c && c.label);
  if (calculated.length) {
    push('Horas calculadas:');
    calculated.forEach((c) => push(`- ${c.label}: ${hrs(c.hours)}${c.note ? ` (${c.note})` : ''}`));
  }
  if (input.percentLines && input.percentLines.length) {
    push(
      `${L.percentsLabel}: ` +
        input.percentLines
          .map((line) => `${line.label} ${pct(line.value)}${line.note ? ` (${line.note})` : ''}`)
          .join(' · '),
    );
  } else {
    const p = input.percents || {};
    push(
      `${L.percentsLabel}: Discovery ${pct(p.discovery)} · ` +
        `Validação ${pct(p.validation)} · GP ${pct(p.gp)}`,
    );
  }
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
      const group = item.subcategory ? `${item.category} / ${item.subcategory}` : item.category;
      if (group !== currentGroup) {
        currentGroup = group;
        push(group);
      }
      const qty = Number(item.quantity) || 0;
      const unit = Number(item.unitHours);
      const sizing = item.manualHours
        ? `${hrs(item.hours)} (horas ajustadas manualmente${qty > 0 ? `; quantidade ${qty}` : ''})`
        : Number.isFinite(unit) && item.unitHours != null
          ? `${qty} × ${hrs(unit)} = ${hrs(item.hours)}`
          : `${qty > 1 ? `×${qty} — ` : ''}${hrs(item.hours)}`;
      push(`- ${item.label} — ${sizing}${item.skill ? ` · ${item.skill}` : ''}`);
      const includes = textBlock(item.includes);
      const excludes = textBlock(item.excludes);
      if (includes.length) push(`  Inclui: ${includes.join(' / ')}`);
      if (excludes.length) push(`  Não inclui: ${excludes.join(' / ')}`);
      if (String(item.link ?? '').trim()) push(`  Link: ${String(item.link).trim()}`);
    });
  } else {
    push(L.noItems);
  }
  push();

  push(L.end);

  return lines.join('\n');
}
