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
 * qualquer edição manual. Cada seção tem uma linha `# comentário` dizendo à
 * skill como usá-la.
 *
 * IDIOMA
 * ------
 * O bloco sai no idioma da interface de quem copiou: pt-BR, en-US ou es-MX
 * (cabeçalhos, rótulos, comentários, números e datas). Ficam IGUAIS em todos
 * os idiomas só os identificadores que a skill lê como código:
 *  - a linha do envelope (`===== Aktie Now Tool Center · ESCOPO TÉCNICO · v3 =====`),
 *    que é o gatilho da skill;
 *  - os valores de ORIGEM (`framework`, `calculadora-ae`);
 *  - as chaves e os valores (`sim`/`nao`) de [FLAGS DE SUPRESSÃO], copiados
 *    literalmente para o plano da skill.
 * O documento gerado pela skill é sempre em inglês, qualquer que seja o idioma
 * do bloco.
 *
 * VERSIONAMENTO
 * -------------
 * v1 → v2: regra de redação, [DADOS INFORMADOS], [ZOHO CRM], itens com
 *          quantidade × horas e "Inclui / Não inclui".
 * v2 → v3: bloco no idioma da interface; linhas TEMPLATE e IDIOMA DE SAÍDA
 *          removidas (a skill tem um template só); IDs e links do Tool Center;
 *          horas por fase, bases dos percentuais, horas com rateio por
 *          categoria; descrição (tooltip) de cada item; outras versões; itens
 *          preenchidos que não contam; flags de uma tabela única
 *          (lib/scope-flags.ts); "---" para informação que não temos.
 */

import { SUPPRESSION_FLAGS } from './scope-flags';

export const SCOPE_EXPORT_VERSION = 'v3';

export type ScopeExportLocale = 'pt' | 'en' | 'es';
export type ScopeOrigin = 'framework' | 'calculadora-ae';

export function normalizeScopeLocale(value: unknown): ScopeExportLocale {
  const v = String(value || '').toLowerCase();
  if (v.startsWith('en')) return 'en';
  if (v.startsWith('es')) return 'es';
  return 'pt';
}

/* -------------------------------------------------------------------------- */
/*                                DICIONÁRIOS                                  */
/* -------------------------------------------------------------------------- */

const PT = {
  blockLanguage: 'pt-BR',
  decimal: ',',
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
  unknown: '---',
  none: '(nenhum)',
  noModules: '(nenhum módulo identificado)',
  noChannels: '(nenhum canal identificado)',
  noIntegrations: '(nenhuma integração ou app no escopo)',
  noHours: '(sem horas lançadas)',
  noItems: '(nenhum item selecionado)',
  yesText: 'sim',
  noText: 'não',
  sec: {
    project: 'PROJETO',
    context: 'CONTEXTO DO CLIENTE',
    zoho: 'ZOHO CRM',
    facts: 'DADOS INFORMADOS',
    sizing: 'DIMENSIONAMENTO',
    platform: 'PLATAFORMA',
    modules: 'MÓDULOS EM ESCOPO',
    channels: 'CANAIS EM ESCOPO',
    integrations: 'INTEGRAÇÕES E APPS',
    flags: 'FLAGS DE SUPRESSÃO',
    breakdown: 'DETALHAMENTO POR CATEGORIA',
    items: 'ITENS SELECIONADOS',
    versions: 'OUTRAS VERSÕES DO PROJETO',
    notCounted: 'ITENS PREENCHIDOS QUE NÃO CONTAM',
  },
  note: {
    project: '# Identificação da versão. "---" = informação que o Tool Center não tem.',
    context:
      '# Texto livre escrito pelo Account Executive. Use para redigir as seções ' +
      'de contexto, dores e objetivos — nunca para acrescentar entregas ao escopo.',
    zoho:
      '# Campos do negócio no Zoho CRM, lidos na hora da cópia. Use como contexto ' +
      '(cliente, negócio, contatos); não criam entregas no escopo. "---" = campo vazio ' +
      'no Zoho (informação que não temos), nunca "o recurso não tem valor".',
    facts: '# Dados digitados na tela. Servem para entender e dimensionar; não são texto para o documento.',
    sizing: '# Horas do site, prontas: nunca recalcule, arredonde nem redistribua.',
    platform: '# Plano e tipo de instância para a tabela de configuração.',
    modules: '# Módulos para a tabela de configuração. Fases de serviço (Workshop, Treinamentos, Go-Live) não são módulos do Zendesk.',
    channels: '# Canais para a tabela de configuração. As quantidades só dimensionam.',
    integrations: '# Integrações e apps para a tabela de configuração (pelo nome).',
    flags: '# "nao" significa REMOVER do documento o trecho correspondente. Copie esta seção literalmente.',
    breakdown: '# Horas por categoria: evidência de que um módulo ou seção tem horas.',
    items:
      '# Use para decidir quais bullets de capacidade permanecem no documento. ' +
      '"Descrição", "Inclui" e "Não inclui" descrevem a entrega de cada item.',
    aeItems:
      '# Quantidades estimadas pela Calculadora AE a partir dos dados informados, não ' +
      'contagens confirmadas pelo cliente. Mostram quais capacidades foram dimensionadas.',
    versions: '# Outras versões deste projeto: contexto para fases e opcionais, nunca entregas desta versão.',
    notCounted:
      '# Itens com quantidade na tela que NÃO entram nas horas desta versão. Não são escopo; ' +
      'o motivo diz por quê.',
  },
  lbl: {
    origin: 'ORIGEM',
    blockLanguage: 'IDIOMA DO BLOCO',
    client: 'Cliente',
    project: 'Projeto',
    proposalVersion: 'Versão da proposta técnica',
    versionPosition: 'Versão',
    of: 'de',
    versionDescription: 'Descrição da versão',
    date: 'Data',
    versionCreated: 'Versão criada em',
    presales: 'Pre-Sales responsável',
    techLink: 'Link do escopo técnico',
    dealLink: 'Link do negócio',
    projectType: 'Tipo de projeto',
    typeNew: 'Nova implantação',
    typeOpt: 'Otimização',
    projectId: 'ID do projeto',
    versionId: 'ID da versão',
    estimateId: 'ID da estimativa',
    versionUrl: 'Link da versão no Tool Center',
    estimateUrl: 'Link da estimativa no Tool Center',
    calcVersion: 'Versão da Calculadora AE',
    objectives: 'Objetivos e dores do cliente',
    indicators: 'Indicadores de sucesso',
    totalHours: 'Total de horas',
    skillHours: 'Horas por skill',
    calculated: 'Horas calculadas',
    percents: 'Percentuais aplicados',
    percentBases: 'Base de cada percentual',
    phases: 'Horas por fase',
    origins: 'Origem de cada número',
    plan: 'Plano Zendesk',
    sku: 'Tipo de instância',
    zendeskModules: 'Módulos Zendesk',
    servicePhases: 'Fases de serviço',
    notSelected: 'Módulos não selecionados',
    loaded: 'Com Discovery, Validação e GP rateados',
    lineItemsTotal: 'Total dos itens',
    totalEffort: 'Esforço total',
    manual: 'horas ajustadas manualmente',
    quantity: 'quantidade',
    standard: 'padrão',
    includes: 'Inclui',
    excludes: 'Não inclui',
    description: 'Descrição',
    link: 'Link',
    createdOn: 'criada em',
    over: 'sobre',
  },
};

type Dict = typeof PT;

const EN: Dict = {
  blockLanguage: 'en-US',
  decimal: '.',
  instruction: 'Generate the Technical Scope for this project using the scope-creator skill.',
  precedence:
    'PRECEDENCE RULE: the data in the block below is the source of truth and ' +
    'overrides any attached document. Use attachments only to enrich context ' +
    '(pain points, goals, current landscape). Nothing that appears only in an ' +
    'attachment belongs in the scope.',
  writingRule:
    'WRITING RULE: quantities and hours size the effort and the price. The ' +
    'document describes WHAT will be done, not how many times — "3 emails + ' +
    '1 Facebook + 3 lines" becomes "set up the email, Facebook and phone ' +
    'channels in Zendesk". Only cite a number when it matters for the client ' +
    'to understand the scope (e.g. number of brands or languages, named ' +
    'integrations, agreed limits).',
  unknown: '---',
  none: '(none)',
  noModules: '(no module identified)',
  noChannels: '(no channel identified)',
  noIntegrations: '(no integration or app in scope)',
  noHours: '(no hours entered)',
  noItems: '(no item selected)',
  yesText: 'yes',
  noText: 'no',
  sec: {
    project: 'PROJECT',
    context: 'CLIENT CONTEXT',
    zoho: 'ZOHO CRM',
    facts: 'ENTERED DATA',
    sizing: 'SIZING',
    platform: 'PLATFORM',
    modules: 'MODULES IN SCOPE',
    channels: 'CHANNELS IN SCOPE',
    integrations: 'INTEGRATIONS AND APPS',
    flags: 'SUPPRESSION FLAGS',
    breakdown: 'BREAKDOWN BY CATEGORY',
    items: 'SELECTED ITEMS',
    versions: 'OTHER VERSIONS OF THE PROJECT',
    notCounted: 'FILLED-IN ITEMS THAT DO NOT COUNT',
  },
  note: {
    project: '# Version identity. "---" = information the Tool Center does not have.',
    context:
      '# Free text written by the Account Executive. Use it to write the context, ' +
      'pain-point and goal sections — never to add deliverables to the scope.',
    zoho:
      '# Deal fields from Zoho CRM, read when the prompt was copied. Use them as ' +
      'context (client, deal, contacts); they never add deliverables to the scope. ' +
      '"---" = the field is empty in Zoho (we do not have the information), never ' +
      '"the feature has no value".',
    facts: '# Data typed on screen. It helps understand and size the project; it is not text for the document.',
    sizing: '# Hours from the site, final: never recompute, round or redistribute them.',
    platform: '# Plan and instance type for the configuration table.',
    modules: '# Modules for the configuration table. Service phases (Workshop, Trainings, Go-Live) are not Zendesk modules.',
    channels: '# Channels for the configuration table. Quantities are for sizing only.',
    integrations: '# Integrations and apps for the configuration table (by name).',
    flags: '# "nao" means REMOVE the corresponding passage from the document. Copy this section literally.',
    breakdown: '# Hours by category: evidence that a module or section has hours.',
    items:
      '# Use this to decide which capability bullets stay in the document. ' +
      '"Description", "Includes" and "Does not include" describe what each item delivers.',
    aeItems:
      '# Quantities estimated by the AE Calculator from the entered data, not counts ' +
      'confirmed by the client. They show which capabilities were sized.',
    versions: '# Other versions of this project: context for phasing and optional add-ons, never deliverables of this version.',
    notCounted:
      '# Items with a quantity on screen that do NOT count toward this version\'s hours. ' +
      'They are not in scope; the reason says why.',
  },
  lbl: {
    origin: 'ORIGIN',
    blockLanguage: 'BLOCK LANGUAGE',
    client: 'Client',
    project: 'Project',
    proposalVersion: 'Technical proposal version',
    versionPosition: 'Version',
    of: 'of',
    versionDescription: 'Version description',
    date: 'Date',
    versionCreated: 'Version created on',
    presales: 'Pre-Sales owner',
    techLink: 'Technical scope link',
    dealLink: 'Deal link',
    projectType: 'Project type',
    typeNew: 'New implementation',
    typeOpt: 'Optimization',
    projectId: 'Project ID',
    versionId: 'Version ID',
    estimateId: 'Estimate ID',
    versionUrl: 'Version link in the Tool Center',
    estimateUrl: 'Estimate link in the Tool Center',
    calcVersion: 'AE Calculator version',
    objectives: 'Client goals and pain points',
    indicators: 'Success indicators',
    totalHours: 'Total hours',
    skillHours: 'Hours by skill',
    calculated: 'Calculated hours',
    percents: 'Applied percentages',
    percentBases: 'Base of each percentage',
    phases: 'Hours by phase',
    origins: 'Where each number comes from',
    plan: 'Zendesk plan',
    sku: 'Instance type',
    zendeskModules: 'Zendesk modules',
    servicePhases: 'Service phases',
    notSelected: 'Modules not selected',
    loaded: 'With Discovery, Validation and PM spread in',
    lineItemsTotal: 'Line-items total',
    totalEffort: 'Total effort',
    manual: 'hours adjusted manually',
    quantity: 'quantity',
    standard: 'standard',
    includes: 'Includes',
    excludes: 'Does not include',
    description: 'Description',
    link: 'Link',
    createdOn: 'created on',
    over: 'of',
  },
};

const ES: Dict = {
  blockLanguage: 'es-MX',
  decimal: '.',
  instruction: 'Genera el Alcance Técnico de este proyecto usando la skill scope-creator.',
  precedence:
    'REGLA DE PRECEDENCIA: los datos del bloque de abajo son la fuente de verdad y ' +
    'prevalecen sobre cualquier documento adjunto. Usa los adjuntos solo para ' +
    'enriquecer el contexto (dolores, objetivos, escenario actual). Nada que aparezca ' +
    'solo en un adjunto entra en el alcance.',
  writingRule:
    'REGLA DE REDACCIÓN: las cantidades y las horas sirven para dimensionar el ' +
    'esfuerzo y el precio. El documento describe QUÉ se hará, no cuántas veces — ' +
    '"3 correos + 1 Facebook + 3 líneas" se vuelve "configurar los canales de correo ' +
    'electrónico, Facebook y telefonía en Zendesk". Cita un número solo cuando sea ' +
    'relevante para que el cliente entienda el alcance (p. ej., número de marcas o de ' +
    'idiomas, integraciones nombradas, límites acordados).',
  unknown: '---',
  none: '(ninguno)',
  noModules: '(ningún módulo identificado)',
  noChannels: '(ningún canal identificado)',
  noIntegrations: '(ninguna integración o app en el alcance)',
  noHours: '(sin horas registradas)',
  noItems: '(ningún ítem seleccionado)',
  yesText: 'sí',
  noText: 'no',
  sec: {
    project: 'PROYECTO',
    context: 'CONTEXTO DEL CLIENTE',
    zoho: 'ZOHO CRM',
    facts: 'DATOS INGRESADOS',
    sizing: 'DIMENSIONAMIENTO',
    platform: 'PLATAFORMA',
    modules: 'MÓDULOS EN EL ALCANCE',
    channels: 'CANALES EN EL ALCANCE',
    integrations: 'INTEGRACIONES Y APPS',
    flags: 'FLAGS DE SUPRESIÓN',
    breakdown: 'DESGLOSE POR CATEGORÍA',
    items: 'ÍTEMS SELECCIONADOS',
    versions: 'OTRAS VERSIONES DEL PROYECTO',
    notCounted: 'ÍTEMS CON CANTIDAD QUE NO CUENTAN',
  },
  note: {
    project: '# Identificación de la versión. "---" = información que el Tool Center no tiene.',
    context:
      '# Texto libre escrito por el Account Executive. Úsalo para redactar las secciones ' +
      'de contexto, dolores y objetivos — nunca para agregar entregables al alcance.',
    zoho:
      '# Campos del negocio en Zoho CRM, leídos al copiar el prompt. Úsalos como contexto ' +
      '(cliente, negocio, contactos); no crean entregables en el alcance. "---" = campo ' +
      'vacío en Zoho (información que no tenemos), nunca "la función no tiene valor".',
    facts: '# Datos escritos en pantalla. Sirven para entender y dimensionar; no son texto para el documento.',
    sizing: '# Horas del sitio, definitivas: nunca las recalcules, redondees ni redistribuyas.',
    platform: '# Plan y tipo de instancia para la tabla de configuración.',
    modules: '# Módulos para la tabla de configuración. Las fases de servicio (Workshop, Capacitaciones, Go-Live) no son módulos de Zendesk.',
    channels: '# Canales para la tabla de configuración. Las cantidades solo dimensionan.',
    integrations: '# Integraciones y apps para la tabla de configuración (por nombre).',
    flags: '# "nao" significa ELIMINAR del documento el fragmento correspondiente. Copia esta sección literalmente.',
    breakdown: '# Horas por categoría: evidencia de que un módulo o sección tiene horas.',
    items:
      '# Úsalo para decidir qué viñetas de capacidades se quedan en el documento. ' +
      '"Descripción", "Incluye" y "No incluye" describen la entrega de cada ítem.',
    aeItems:
      '# Cantidades estimadas por la Calculadora AE a partir de los datos ingresados, no ' +
      'conteos confirmados por el cliente. Muestran qué capacidades se dimensionaron.',
    versions: '# Otras versiones de este proyecto: contexto para fases y opcionales, nunca entregables de esta versión.',
    notCounted:
      '# Ítems con cantidad en pantalla que NO cuentan en las horas de esta versión. ' +
      'No son alcance; el motivo dice por qué.',
  },
  lbl: {
    origin: 'ORIGEN',
    blockLanguage: 'IDIOMA DEL BLOQUE',
    client: 'Cliente',
    project: 'Proyecto',
    proposalVersion: 'Versión de la propuesta técnica',
    versionPosition: 'Versión',
    of: 'de',
    versionDescription: 'Descripción de la versión',
    date: 'Fecha',
    versionCreated: 'Versión creada el',
    presales: 'Pre-Sales responsable',
    techLink: 'Enlace del alcance técnico',
    dealLink: 'Enlace del negocio',
    projectType: 'Tipo de proyecto',
    typeNew: 'Nueva implementación',
    typeOpt: 'Optimización',
    projectId: 'ID del proyecto',
    versionId: 'ID de la versión',
    estimateId: 'ID de la estimación',
    versionUrl: 'Enlace de la versión en el Tool Center',
    estimateUrl: 'Enlace de la estimación en el Tool Center',
    calcVersion: 'Versión de la Calculadora AE',
    objectives: 'Objetivos y dolores del cliente',
    indicators: 'Indicadores de éxito',
    totalHours: 'Total de horas',
    skillHours: 'Horas por skill',
    calculated: 'Horas calculadas',
    percents: 'Porcentajes aplicados',
    percentBases: 'Base de cada porcentaje',
    phases: 'Horas por fase',
    origins: 'Origen de cada número',
    plan: 'Plan de Zendesk',
    sku: 'Tipo de instancia',
    zendeskModules: 'Módulos de Zendesk',
    servicePhases: 'Fases de servicio',
    notSelected: 'Módulos no seleccionados',
    loaded: 'Con Discovery, Validación y GP prorrateados',
    lineItemsTotal: 'Total de los ítems',
    totalEffort: 'Esfuerzo total',
    manual: 'horas ajustadas manualmente',
    quantity: 'cantidad',
    standard: 'estándar',
    includes: 'Incluye',
    excludes: 'No incluye',
    description: 'Descripción',
    link: 'Enlace',
    createdOn: 'creada el',
    over: 'sobre',
  },
};

const DICTS: Record<ScopeExportLocale, Dict> = { pt: PT, en: EN, es: ES };

export function scopeDict(locale: unknown): Dict {
  return DICTS[normalizeScopeLocale(locale)];
}

/* -------------------------------------------------------------------------- */
/*                                  NÚMEROS                                    */
/* -------------------------------------------------------------------------- */

export interface NumberStyle {
  /** Casas decimais das horas. */
  hoursDecimals: number;
  /** true = sempre todas as casas (1,00h), como a Calculadora AE mostra. */
  fixed: boolean;
}

export const FRAMEWORK_NUMBERS: NumberStyle = { hoursDecimals: 1, fixed: false };
export const AE_NUMBERS: NumberStyle = { hoursDecimals: 2, fixed: true };

/** Número no idioma do bloco: decimal com vírgula (pt) ou ponto (en, es-MX). */
export function formatScopeNumber(value: unknown, decimals: number, fixed: boolean, locale: unknown): string {
  const n = Number(value);
  const d = scopeDict(locale);
  if (!Number.isFinite(n)) return fixed ? (0).toFixed(decimals).replace('.', d.decimal) : '0';
  const factor = Math.pow(10, decimals);
  const rounded = Math.round((n + Math.sign(n) * Number.EPSILON) * factor) / factor;
  let text = rounded.toFixed(decimals);
  if (!fixed && text.includes('.')) text = text.replace(/\.?0+$/, '');
  if (text === '-0') text = '0';
  return text.replace('.', d.decimal);
}

/** Data no formato do idioma: dd/mm/aaaa (pt, es-MX) ou mm/dd/aaaa (en-US). */
export function formatScopeDate(value: unknown, locale: unknown): string {
  const date = value instanceof Date ? value : value ? new Date(String(value)) : new Date();
  const ok = !Number.isNaN(date.getTime()) ? date : new Date();
  const dd = String(ok.getDate()).padStart(2, '0');
  const mm = String(ok.getMonth() + 1).padStart(2, '0');
  return normalizeScopeLocale(locale) === 'en' ? `${mm}/${dd}/${ok.getFullYear()}` : `${dd}/${mm}/${ok.getFullYear()}`;
}

/** Normaliza texto multilinha para o corpo do prompt, sem linhas vazias. */
export function textBlock(value: unknown): string[] {
  return String(value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/* -------------------------------------------------------------------------- */
/*                                   ENTRADA                                   */
/* -------------------------------------------------------------------------- */

export interface ScopeExportChannel {
  label: string;
  quantity?: number | null;
}

export interface ScopeExportIntegration {
  /** Tipo, já no idioma do bloco (ex.: "Integração nativa"). */
  kind: string;
  label: string;
  quantity?: number | null;
  link?: string | null;
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
  /** Com ajuste manual: horas unitárias da biblioteca, para mostrar o padrão. */
  standardUnitHours?: number | null;
  /** Descrição do item (o "?" do editor). */
  description?: string | null;
  /** Texto "o que está incluído" do item (biblioteca ou linha personalizada). */
  includes?: string | null;
  /** Texto "o que não está incluído". */
  excludes?: string | null;
  /** Link de referência (ex.: página do app no Marketplace). */
  link?: string | null;
  /** Observação no lugar das horas (ex.: "horas no grupo Configuração Voice"). */
  hoursNote?: string | null;
  /** Só a linha "Nome — Xh", sem quantidade (grupos de esforço da Calculadora). */
  totalOnly?: boolean;
}

export interface ScopeExportCategory {
  label: string;
  hours: number;
  /** Horas com Discovery, Validação e GP rateados (Framework). */
  loadedHours?: number | null;
  subcategories: Array<{ label: string; hours: number }>;
}

export interface ScopeExportVersionRef {
  name: string;
  description?: string | null;
  hours: number;
  createdAt?: Date | string | null;
}

export interface ScopeExportNotCounted {
  label: string;
  category: string;
  quantity: number;
  reason: string;
}

export interface ScopeExportInput {
  origin: ScopeOrigin;
  /** Idioma do bloco (o da interface de quem copiou). */
  locale?: ScopeExportLocale | string | null;
  numbers?: NumberStyle;

  clientName: string;
  projectName?: string | null;
  versionName?: string | null;
  /** "Versão: 7 de 7". */
  versionPosition?: { index: number; total: number } | null;
  versionDescription?: string | null;
  generatedAt?: Date | null;
  versionCreatedAt?: Date | string | null;

  projectId?: number | null;
  versionId?: number | null;
  estimateId?: number | null;
  /** Link da versão (Framework) ou da estimativa (Calculadora) no Tool Center. */
  toolCenterUrl?: string | null;
  /** Linha já escrita sobre a versão da configuração da Calculadora. */
  calculatorVersion?: string | null;

  technicalScopeLink?: string | null;
  zohoLink?: string | null;
  preSalesName?: string | null;
  deploymentType?: 'new' | 'optimization' | null;

  /** Total consolidado exibido na tela. */
  totalHours: number;
  /** Horas por skill, na chave canônica em português. */
  skillHours?: Record<string, number> | null;
  /** Nome exibido de cada skill (chave canônica → rótulo no idioma). */
  skillLabels?: Record<string, string> | null;
  calculatedHours?: Array<{ label: string; hours: number; note?: string }> | null;
  percentLines?: Array<{ label: string; value: number; note?: string }> | null;
  /** "Discovery 20% sobre 22,7h = 4,54h". */
  percentBases?: Array<{ label: string; percent: number; base: number; hours: number; note?: string }> | null;
  phaseHours?: Array<{ label: string; hours: number }> | null;
  /** Linhas prontas: de onde veio cada número (percentual × manual). */
  origins?: string[] | null;

  planTierLabel: string;
  skuLabel: string;

  modules?: string[] | null;
  moduleDetail?: { zendesk: string[]; servicePhases: string[]; notSelected: string[] } | null;
  channels?: ScopeExportChannel[] | null;
  integrations?: ScopeExportIntegration[] | null;

  /** Flags já resolvidas (lib/scope-flags.ts). */
  flags?: Record<string, boolean> | null;

  categories?: ScopeExportCategory[] | null;
  /** Rodapé do detalhamento (Calculadora): total dos itens e esforço total. */
  categoryFooter?: { lineItems: number; total: number } | null;
  items?: ScopeExportItem[] | null;
  /** Grupos (category / subcategory) que recebem o comentário de quantidades estimadas. */
  estimatedItemGroups?: string[] | null;

  clientObjectives?: string | null;
  successIndicators?: string | null;

  /** Demais dados digitados na tela, como "Rótulo: valor" (seção [DADOS INFORMADOS]). */
  facts?: Array<{ label: string; value: string }> | null;
  /** Imprime também os fatos vazios (com "---" ou "nenhum"). */
  includeEmptyFacts?: boolean;

  /** Linhas já formatadas da seção [ZOHO CRM] (ver lib/zoho.ts). Ausente = seção omitida. */
  zohoSection?: string[] | null;

  otherVersions?: ScopeExportVersionRef[] | null;
  /** null/ausente = seção omitida; [] = "(nenhum)". */
  notCounted?: ScopeExportNotCounted[] | null;
}

/* -------------------------------------------------------------------------- */
/*                              MONTAGEM DO TEXTO                              */
/* -------------------------------------------------------------------------- */

export function buildScopePrompt(input: ScopeExportInput): string {
  const locale = normalizeScopeLocale(input.locale);
  const L = scopeDict(locale);
  const style = input.numbers || FRAMEWORK_NUMBERS;
  const lines: string[] = [];
  const push = (line = '') => lines.push(line);
  const or = (value: unknown, fallback: string = L.unknown) => {
    const text = String(value ?? '').trim();
    return text || fallback;
  };
  const num = (value: unknown, decimals = style.hoursDecimals) =>
    formatScopeNumber(value, decimals, style.fixed, locale);
  const hrs = (value: unknown) => `${num(value)}h`;
  const unitHrs = (value: unknown) => `${formatScopeNumber(value, 2, style.fixed, locale)}h`;
  const qty = (value: unknown) => formatScopeNumber(value, 2, false, locale);
  const pct = (value: unknown) => `${formatScopeNumber(value, 2, false, locale)}%`;
  const date = (value: unknown) => formatScopeDate(value, locale);

  // ---- Instrução de uso ---------------------------------------------------
  push(L.instruction);
  push();
  push(L.precedence);
  push();
  push(L.writingRule);
  push();

  // ---- Envelope (identificadores fixos em todos os idiomas) --------------
  push(`===== Aktie Now Tool Center · ESCOPO TÉCNICO · ${SCOPE_EXPORT_VERSION} =====`);
  push(`${L.lbl.origin}: ${input.origin}`);
  push(`${L.lbl.blockLanguage}: ${L.blockLanguage}`);
  push();

  // ---- Projeto ------------------------------------------------------------
  push(`[${L.sec.project}]`);
  push(L.note.project);
  push(`${L.lbl.client}: ${or(input.clientName)}`);
  push(`${L.lbl.project}: ${or(input.projectName, or(input.clientName))}`);
  push(`${L.lbl.proposalVersion}: ${or(input.versionName, 'V1')}`);
  if (input.versionPosition && input.versionPosition.total > 0) {
    push(`${L.lbl.versionPosition}: ${input.versionPosition.index} ${L.lbl.of} ${input.versionPosition.total}`);
  }
  const versionDescription = textBlock(input.versionDescription);
  if (versionDescription.length) push(`${L.lbl.versionDescription}: ${versionDescription.join(' / ')}`);
  push(`${L.lbl.date}: ${date(input.generatedAt || new Date())}`);
  if (input.versionCreatedAt) push(`${L.lbl.versionCreated}: ${date(input.versionCreatedAt)}`);
  push(`${L.lbl.presales}: ${or(input.preSalesName)}`);
  push(`${L.lbl.techLink}: ${or(input.technicalScopeLink)}`);
  push(`${L.lbl.dealLink}: ${or(input.zohoLink)}`);
  if (input.deploymentType) {
    push(`${L.lbl.projectType}: ${input.deploymentType === 'optimization' ? L.lbl.typeOpt : L.lbl.typeNew}`);
  }
  if (input.projectId != null) push(`${L.lbl.projectId}: ${input.projectId}`);
  if (input.versionId != null) push(`${L.lbl.versionId}: ${input.versionId}`);
  if (input.estimateId != null) push(`${L.lbl.estimateId}: ${input.estimateId}`);
  if (input.toolCenterUrl) {
    push(`${input.origin === 'calculadora-ae' ? L.lbl.estimateUrl : L.lbl.versionUrl}: ${input.toolCenterUrl}`);
  }
  if (input.calculatorVersion) push(`${L.lbl.calcVersion}: ${input.calculatorVersion}`);
  push();

  // ---- Contexto do cliente (texto livre do AE) ---------------------------
  const objectives = textBlock(input.clientObjectives);
  const indicators = textBlock(input.successIndicators);
  if (objectives.length || indicators.length) {
    push(`[${L.sec.context}]`);
    push(L.note.context);
    if (objectives.length) {
      push(`${L.lbl.objectives}:`);
      objectives.forEach((line) => push(`- ${line}`));
    }
    if (indicators.length) {
      push(`${L.lbl.indicators}:`);
      indicators.forEach((line) => push(`- ${line}`));
    }
    push();
  }

  // ---- Zoho CRM (lido na hora da cópia) -----------------------------------
  if (input.zohoSection && input.zohoSection.length) {
    push(`[${L.sec.zoho}]`);
    push(L.note.zoho);
    input.zohoSection.forEach((line) => push(line));
    push();
  }

  // ---- Dados informados na tela ------------------------------------------
  const facts = (input.facts || []).filter((f) => f && f.label && (input.includeEmptyFacts || String(f.value ?? '').trim()));
  if (facts.length) {
    push(`[${L.sec.facts}]`);
    push(L.note.facts);
    facts.forEach((f) => push(`${f.label}: ${or(textBlock(f.value).join(' / '))}`));
    push();
  }

  // ---- Dimensionamento ---------------------------------------------------
  push(`[${L.sec.sizing}]`);
  push(L.note.sizing);
  push(`${L.lbl.totalHours}: ${hrs(input.totalHours)}`);
  const skills = input.skillHours || {};
  const skillOrder = ['Implantação', 'Solution Design', 'GP', 'Desenvolvimento', 'Design'];
  const skillLabel = (skill: string) => input.skillLabels?.[skill] || skill;
  push(`${L.lbl.skillHours}:`);
  skillOrder.forEach((skill) => push(`- ${skillLabel(skill)}: ${hrs(Number(skills[skill] || 0))}`));
  // Skills além das cinco padrão (cadastradas no Admin) também entram no total.
  Object.keys(skills)
    .filter((skill) => !skillOrder.includes(skill) && Number(skills[skill]) > 0)
    .sort()
    .forEach((skill) => push(`- ${skillLabel(skill)}: ${hrs(skills[skill])}`));
  const calculated = (input.calculatedHours || []).filter((c) => c && c.label);
  if (calculated.length) {
    push(`${L.lbl.calculated}:`);
    calculated.forEach((c) => push(`- ${c.label}: ${hrs(c.hours)}${c.note ? ` (${c.note})` : ''}`));
  }
  if (input.percentLines && input.percentLines.length) {
    push(
      `${L.lbl.percents}: ` +
        input.percentLines
          .map((line) => `${line.label} ${pct(line.value)}${line.note ? ` (${line.note})` : ''}`)
          .join(' · '),
    );
  }
  const bases = (input.percentBases || []).filter((b) => b && b.label);
  if (bases.length) {
    push(`${L.lbl.percentBases}:`);
    bases.forEach((b) => push(
      `- ${b.label} ${pct(b.percent)} ${L.lbl.over} ${hrs(b.base)} = ${hrs(b.hours)}${b.note ? ` (${b.note})` : ''}`,
    ));
  }
  const phases = (input.phaseHours || []).filter((p) => p && p.label);
  if (phases.length) push(`${L.lbl.phases}: ${phases.map((p) => `${p.label} ${hrs(p.hours)}`).join(' · ')}`);
  const origins = (input.origins || []).filter(Boolean);
  if (origins.length) {
    push(`${L.lbl.origins}:`);
    origins.forEach((line) => push(`- ${line}`));
  }
  push();

  // ---- Plataforma --------------------------------------------------------
  push(`[${L.sec.platform}]`);
  push(L.note.platform);
  push(`${L.lbl.plan}: ${or(input.planTierLabel)}`);
  push(`${L.lbl.sku}: ${or(input.skuLabel)}`);
  push();

  // ---- Módulos -----------------------------------------------------------
  const modules = (input.modules || []).filter(Boolean);
  push(`[${L.sec.modules}]`);
  push(L.note.modules);
  push(modules.length ? modules.join(', ') : L.noModules);
  if (input.moduleDetail) {
    const list = (values: string[]) => (values.length ? values.join(', ') : L.none);
    push(`${L.lbl.zendeskModules}: ${list(input.moduleDetail.zendesk)}`);
    push(`${L.lbl.servicePhases}: ${list(input.moduleDetail.servicePhases)}`);
    push(`${L.lbl.notSelected}: ${list(input.moduleDetail.notSelected)}`);
  }
  push();

  // ---- Canais ------------------------------------------------------------
  const channels = (input.channels || []).filter((c) => c && c.label);
  push(`[${L.sec.channels}]`);
  push(L.note.channels);
  if (channels.length) {
    channels.forEach((c) => {
      const q = Number(c.quantity);
      push(`- ${c.label}${Number.isFinite(q) && q > 0 ? `: ${qty(q)}` : ''}`);
    });
  } else {
    push(L.noChannels);
  }
  push();

  // ---- Integrações -------------------------------------------------------
  const integrations = (input.integrations || []).filter((i) => i && i.label);
  push(`[${L.sec.integrations}]`);
  push(L.note.integrations);
  if (integrations.length) {
    integrations.forEach((i) => {
      const q = Number(i.quantity);
      const link = String(i.link ?? '').trim();
      push(`- ${i.kind}: ${i.label}${Number.isFinite(q) && q > 1 ? ` (${qty(q)})` : ''}${link ? ` — ${link}` : ''}`);
    });
  } else {
    push(L.noIntegrations);
  }
  push();

  // ---- Flags (chaves e valores fixos em todos os idiomas) ----------------
  const flags = input.flags || {};
  push(`[${L.sec.flags}]`);
  push(L.note.flags);
  SUPPRESSION_FLAGS.forEach((flag) => {
    push(`${flag.key}: ${flags[flag.key] ? 'sim' : 'nao'}  # ${flag.governs[locale]}`);
  });
  Object.keys(flags)
    .filter((key) => !SUPPRESSION_FLAGS.some((f) => f.key === key))
    .sort()
    .forEach((key) => push(`${key}: ${flags[key] ? 'sim' : 'nao'}`));
  push();

  // ---- Detalhamento ------------------------------------------------------
  const categories = (input.categories || []).filter((c) => c && c.label);
  push(`[${L.sec.breakdown}]`);
  push(L.note.breakdown);
  if (categories.length) {
    categories.forEach((cat) => {
      push(`${cat.label} — ${hrs(cat.hours)}`);
      if (cat.loadedHours != null) push(`  ${L.lbl.loaded}: ${hrs(cat.loadedHours)}`);
      (cat.subcategories || []).forEach((sub) => push(`  ${sub.label}: ${hrs(sub.hours)}`));
    });
    if (input.categoryFooter) {
      push(`${L.lbl.lineItemsTotal}: ${hrs(input.categoryFooter.lineItems)}`);
      push(`${L.lbl.totalEffort}: ${hrs(input.categoryFooter.total)}`);
    }
  } else {
    push(L.noHours);
  }
  push();

  // ---- Itens -------------------------------------------------------------
  const items = (input.items || []).filter((i) => i && String(i.label || '').trim());
  const estimatedGroups = new Set(input.estimatedItemGroups || []);
  push(`[${L.sec.items}]`);
  push(L.note.items);
  if (items.length) {
    let currentGroup = '';
    let estimatedNoted = false;
    items.forEach((item) => {
      const group = item.subcategory ? `${item.category} / ${item.subcategory}` : item.category;
      if (group !== currentGroup) {
        currentGroup = group;
        push(group);
        if (estimatedGroups.has(group) && !estimatedNoted) {
          push(L.note.aeItems);
          estimatedNoted = true;
        }
      }
      const label = String(item.label).trim();
      const q = Number(item.quantity) || 0;
      const unit = Number(item.unitHours);
      let sizing: string;
      if (item.hoursNote) {
        sizing = item.hoursNote;
      } else if (item.totalOnly) {
        sizing = hrs(item.hours);
      } else if (item.manualHours) {
        const std = Number(item.standardUnitHours);
        const standard = Number.isFinite(std) && item.standardUnitHours != null && q > 0
          ? `; ${L.lbl.standard} ${qty(q)} × ${unitHrs(std)} = ${hrs(q * std)}`
          : '';
        sizing = `${hrs(item.hours)} (${L.lbl.manual}${q > 0 ? `; ${L.lbl.quantity} ${qty(q)}` : ''}${standard})`;
      } else if (Number.isFinite(unit) && item.unitHours != null) {
        sizing = `${qty(q)} × ${unitHrs(unit)} = ${hrs(item.hours)}`;
      } else {
        sizing = `${q > 1 ? `×${qty(q)} — ` : ''}${hrs(item.hours)}`;
      }
      push(`- ${label} — ${sizing}${item.skill ? ` · ${item.skill}` : ''}`);
      const description = textBlock(item.description);
      const includes = textBlock(item.includes);
      const excludes = textBlock(item.excludes);
      if (description.length) push(`  ${L.lbl.description}: ${description.join(' / ')}`);
      if (includes.length) push(`  ${L.lbl.includes}: ${includes.join(' / ')}`);
      if (excludes.length) push(`  ${L.lbl.excludes}: ${excludes.join(' / ')}`);
      if (String(item.link ?? '').trim()) push(`  ${L.lbl.link}: ${String(item.link).trim()}`);
    });
  } else {
    push(L.noItems);
  }
  push();

  // ---- Outras versões ----------------------------------------------------
  if (input.otherVersions) {
    push(`[${L.sec.versions}]`);
    push(L.note.versions);
    if (input.otherVersions.length) {
      input.otherVersions.forEach((v) => {
        const desc = textBlock(v.description).join(' / ');
        push(
          `- ${or(v.name)} — ${hrs(v.hours)}` +
            (v.createdAt ? ` · ${L.lbl.createdOn} ${date(v.createdAt)}` : '') +
            (desc ? ` — ${desc}` : ''),
        );
      });
    } else {
      push(L.none);
    }
    push();
  }

  // ---- Itens preenchidos que não contam -----------------------------------
  if (input.notCounted) {
    push(`[${L.sec.notCounted}]`);
    push(L.note.notCounted);
    if (input.notCounted.length) {
      input.notCounted.forEach((n) => push(`- ${String(n.label).trim()} (${n.category}) — ${L.lbl.quantity} ${qty(n.quantity)}: ${n.reason}`));
    } else {
      push(L.none);
    }
    push();
  }

  push('===== FIM =====');

  return lines.join('\n');
}
