/**
 * Motor de cálculo do Framework (editor de projetos /sc).
 *
 * Função pura: recebe as linhas que de fato contam (itens visíveis, com
 * quantidade, já com override aplicado) e devolve os totais por skill, os
 * percentuais e o total geral. O editor, o detalhamento por categoria, a
 * exportação e o prompt do escopo leem TODOS deste mesmo resultado — é isso
 * que impede os números de divergirem entre uma tela e outra.
 *
 * REGRAS
 * ------
 * - Cada linha soma as próprias horas na skill dela.
 * - Discovery e Validação incidem sobre TODAS as linhas; GP incide sobre tudo,
 *   inclusive Discovery, Validação e DRN. As únicas exceções são as tags de não
 *   incidência configuradas no item pelo painel Admin (`excluded`).
 * - DRN = % sobre as horas de Desenvolvimento (respeitando a tag do item).
 * - Havendo QUALQUER hora de Solution Design na tabela, o Discovery percentual
 *   vale 0: as horas de SD já são o discovery customizado do projeto.
 * - Havendo Desenvolvimento SEM Solution Design, o Discovery calculado sai de
 *   Implantação e aparece em Solution Design > Discovery (o SD conduz o
 *   discovery inteiro); o DRN continua na própria linha.
 */

export const SKILL_IMPL = 'Implantação';
export const SKILL_SD = 'Solution Design';
export const SKILL_DEV = 'Desenvolvimento';
export const SKILL_DESIGN = 'Design';
export const SKILL_GP = 'GP';
/** Item cadastrado sem skill no Admin: aparece num card próprio em vez de sumir. */
export const SKILL_NONE = 'Sem skill';

/** Skills com card próprio no resumo, na ordem de exibição. */
export const CORE_SKILLS = [SKILL_IMPL, SKILL_SD, SKILL_GP, SKILL_DEV, SKILL_DESIGN];

/** Chaves das variáveis no painel Admin (e nas tags de não incidência). */
export const VARIABLE_KEYS = {
  discovery: 'DISCOVERY_STANDARD',
  validation: 'VALIDATION_STANDARD',
  gp: 'GP_STANDARD',
  drn: 'SD_DRN_DEVOPS_PERCENT',
} as const;

/** Fase de Implantação de uma categoria (campo do painel Admin). */
export type ImplementationPhase = 'WORKSHOP' | 'SETUP' | 'TRAINING' | 'GOLIVE';
export const IMPLEMENTATION_PHASES: ImplementationPhase[] = ['WORKSHOP', 'SETUP', 'TRAINING', 'GOLIVE'];

export function normalizePhase(value: unknown): ImplementationPhase {
  const key = String(value || '').toUpperCase();
  return (IMPLEMENTATION_PHASES as string[]).includes(key) ? (key as ImplementationPhase) : 'SETUP';
}

const PHASE_BUCKET: Record<ImplementationPhase, string> = {
  WORKSHOP: 'implantacao_workshop',
  SETUP: 'implantacao_setup',
  TRAINING: 'implantacao_treinamento',
  GOLIVE: 'implantacao_golive',
};

/**
 * Onde o Discovery percentual foi parar:
 *  - `implementation`: projeto sem SD e sem Dev, fica em Implantação;
 *  - `sd`: projeto com SD, o Discovery percentual vale 0;
 *  - `dev`: Dev sem SD, o Discovery calculado vai para Solution Design.
 */
export type DiscoveryMode = 'implementation' | 'sd' | 'dev';

export interface CalcLine {
  /** Identificador estável da linha ("pkg:12", "custom:3", "marketplace:0"). */
  key: string;
  kind: 'package' | 'custom' | 'marketplace';
  /** id do pacote da biblioteca (só `package`). */
  packageId?: number;
  /** Índice em `customPackages` (só `custom`). */
  customIndex?: number;
  /** Categoria raiz em que a linha aparece. */
  category: string;
  /** Chave da subcategoria (nome da categoria filha) ou '' para itens da raiz. */
  subcategory: string;
  label: string;
  quantity: number;
  unitHours: number;
  /** Horas que contam (quantidade × horas, ou o override manual). */
  hours: number;
  skill: string;
  phase: ImplementationPhase;
  /** Chaves de variável das quais a linha está excluída (tags do Admin). */
  excluded: string[];
}

export interface VariableDef {
  type?: string | null;
  flatValue?: number | string | null;
}

export interface CalcInput {
  lines: CalcLine[];
  percents: { discovery: number; validation: number; gp: number };
  drnPct: number;
  overrides: { discovery: number | null; validation: number | null; gp: number | null };
  /** Tipo de cada variável no Admin (PERCENT, FLAT, MIXED). Ausente = PERCENT. */
  variableDefs?: { discovery?: VariableDef | null; validation?: VariableDef | null; gp?: VariableDef | null };
}

export interface CalcResult {
  lines: CalcLine[];
  /** Soma das horas de todas as linhas. */
  subtotal: number;
  skillTotals: Record<string, number>;
  skillBreakdownBySkill: Record<string, Record<string, number>>;
  itemTotals: Record<number, number>;
  catTotals: Record<string, number>;
  customTotals: Record<number, number>;
  flatHoursMarketplace: number;

  discoveryMode: DiscoveryMode;
  /** Discovery calculado pela regra (antes de decidir onde ele fica). */
  discoveryCalculated: number;
  /** Discovery efetivamente cobrado (0 quando o projeto tem SD). */
  discVal: number;
  validVal: number;
  gpVal: number;
  drnVal: number;
  drnPct: number;

  baseDiscovery: number;
  baseValidation: number;
  baseDrn: number;
  totalBaseGP: number;
  excludedFromVariables: { discovery: number; validation: number; gp: number; drn: number };

  grandTotal: number;
}

export function roundHalfUp(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : 0;
}

/** Aplica a variável conforme o tipo cadastrado no Admin. */
function applyVariable(base: number, pct: number, def?: VariableDef | null): number {
  const type = String(def?.type || 'PERCENT').toUpperCase();
  const flat = num(def?.flatValue);
  if (type === 'FLAT') return flat;
  if (type === 'MIXED') return base * (pct / 100) + flat;
  return base * (pct / 100);
}

export function isExcluded(line: Pick<CalcLine, 'excluded'>, variableKey: string): boolean {
  return Array.isArray(line.excluded) && line.excluded.includes(variableKey);
}

export function computeFrameworkTotals(input: CalcInput): CalcResult {
  const lines = (input.lines || []).filter((l) => num(l.hours) > 0);
  const percents = input.percents;
  const overrides = input.overrides;
  const defs = input.variableDefs || {};
  const drnPct = num(input.drnPct);

  const skillItemHours: Record<string, number> = {};
  const itemTotals: Record<number, number> = {};
  const catTotals: Record<string, number> = {};
  const customTotals: Record<number, number> = {};
  const implBuckets: Record<string, number> = {
    implantacao_workshop: 0,
    implantacao_setup: 0,
    implantacao_treinamento: 0,
    implantacao_golive: 0,
  };

  let subtotal = 0;
  let flatHoursMarketplace = 0;
  let baseDiscovery = 0;
  let baseValidation = 0;
  let baseDrn = 0;
  const excludedHours = { discovery: 0, validation: 0, gp: 0, drn: 0 };

  for (const line of lines) {
    const hours = num(line.hours);
    const skill = line.skill || SKILL_NONE;
    subtotal += hours;
    skillItemHours[skill] = (skillItemHours[skill] || 0) + hours;
    catTotals[line.category] = (catTotals[line.category] || 0) + hours;
    if (line.kind === 'package' && line.packageId != null) itemTotals[line.packageId] = hours;
    if (line.kind === 'custom' && line.customIndex != null) customTotals[line.customIndex] = hours;
    if (line.kind === 'marketplace') flatHoursMarketplace += hours;

    if (skill === SKILL_IMPL) {
      const bucket = PHASE_BUCKET[normalizePhase(line.phase)];
      implBuckets[bucket] += hours;
    }

    if (isExcluded(line, VARIABLE_KEYS.discovery)) excludedHours.discovery += hours;
    else baseDiscovery += hours;

    if (isExcluded(line, VARIABLE_KEYS.validation)) excludedHours.validation += hours;
    else baseValidation += hours;

    if (isExcluded(line, VARIABLE_KEYS.gp)) excludedHours.gp += hours;

    if (skill === SKILL_DEV) {
      if (isExcluded(line, VARIABLE_KEYS.drn)) excludedHours.drn += hours;
      else baseDrn += hours;
    }
  }

  const sdItemHours = skillItemHours[SKILL_SD] || 0;
  const devItemHours = skillItemHours[SKILL_DEV] || 0;
  const hasSD = sdItemHours > 0.0001;
  const hasDEV = devItemHours > 0.0001;
  const discoveryMode: DiscoveryMode = hasSD ? 'sd' : hasDEV ? 'dev' : 'implementation';

  // Discovery calculado pela regra (ou travado à mão).
  const discoveryCalculated = overrides.discovery !== null && overrides.discovery !== undefined
    ? num(overrides.discovery)
    : applyVariable(baseDiscovery, num(percents.discovery), defs.discovery);
  const validationCalculated = overrides.validation !== null && overrides.validation !== undefined
    ? num(overrides.validation)
    : applyVariable(baseValidation, num(percents.validation), defs.validation);

  const discVal = roundHalfUp(discoveryMode === 'sd' ? 0 : discoveryCalculated, 1);
  const validVal = roundHalfUp(validationCalculated, 1);
  const drnVal = roundHalfUp(baseDrn * (drnPct / 100), 1);

  // --- Implantação: fases das categorias + Discovery (se ficou aqui) + Validação.
  const implantacao_discovery = discoveryMode === 'implementation' ? discVal : 0;
  const implBreakdown: Record<string, number> = {
    implantacao_workshop: roundHalfUp(implBuckets.implantacao_workshop, 1),
    implantacao_discovery,
    implantacao_setup: roundHalfUp(implBuckets.implantacao_setup, 1),
    implantacao_validacao: validVal,
    implantacao_treinamento: roundHalfUp(implBuckets.implantacao_treinamento, 1),
    implantacao_golive: roundHalfUp(implBuckets.implantacao_golive, 1),
  };

  // --- Solution Design: Discovery (horas de SD, ou o Discovery transferido) + DRN.
  const sd_discovery = roundHalfUp(
    discoveryMode === 'sd' ? sdItemHours : discoveryMode === 'dev' ? discVal : 0,
    1,
  );
  const sdBreakdown: Record<string, number> = {
    sd_discovery,
    sd_desenvolvimento: drnVal,
  };

  const sumValues = (rec: Record<string, number>) =>
    Object.values(rec).reduce((acc, v) => acc + (Number(v) || 0), 0);

  const skillTotals: Record<string, number> = {
    [SKILL_IMPL]: roundHalfUp(sumValues(implBreakdown), 1),
    [SKILL_SD]: roundHalfUp(sumValues(sdBreakdown), 1),
    [SKILL_DEV]: roundHalfUp(devItemHours, 1),
    [SKILL_DESIGN]: roundHalfUp(skillItemHours[SKILL_DESIGN] || 0, 1),
    [SKILL_GP]: 0,
  };
  // Skills cadastradas no Admin além das cinco padrão também contam.
  Object.keys(skillItemHours).forEach((skill) => {
    if (skill in skillTotals) return;
    skillTotals[skill] = roundHalfUp(skillItemHours[skill], 1);
  });
  const gpItemHours = roundHalfUp(skillItemHours[SKILL_GP] || 0, 1);

  // --- GP: tudo (inclusive Discovery, Validação, DRN e itens de GP), menos os
  //     itens marcados como fora do GP.
  const consolidatedBeforeGp =
    Object.entries(skillTotals).reduce((acc, [skill, v]) => (skill === SKILL_GP ? acc : acc + v), 0)
    + gpItemHours;
  const totalBaseGP = Math.max(0, consolidatedBeforeGp - excludedHours.gp);
  const gpCalculated = overrides.gp !== null && overrides.gp !== undefined
    ? num(overrides.gp)
    : applyVariable(totalBaseGP, num(percents.gp), defs.gp);
  const gpVal = roundHalfUp(gpCalculated, 1);
  skillTotals[SKILL_GP] = roundHalfUp(gpVal + gpItemHours, 1);

  const grandTotal = roundHalfUp(sumValues(skillTotals), 0);

  return {
    lines,
    subtotal: roundHalfUp(subtotal, 1),
    skillTotals,
    skillBreakdownBySkill: {
      [SKILL_IMPL]: implBreakdown,
      [SKILL_SD]: sdBreakdown,
      [SKILL_GP]: {},
      [SKILL_DEV]: {},
      [SKILL_DESIGN]: {},
    },
    itemTotals,
    catTotals,
    customTotals,
    flatHoursMarketplace,
    discoveryMode,
    discoveryCalculated: roundHalfUp(discoveryCalculated, 1),
    discVal,
    validVal,
    gpVal,
    drnVal,
    drnPct,
    baseDiscovery: roundHalfUp(baseDiscovery, 1),
    baseValidation: roundHalfUp(baseValidation, 1),
    baseDrn: roundHalfUp(baseDrn, 1),
    totalBaseGP: roundHalfUp(totalBaseGP, 1),
    excludedFromVariables: {
      discovery: roundHalfUp(excludedHours.discovery, 1),
      validation: roundHalfUp(excludedHours.validation, 1),
      gp: roundHalfUp(excludedHours.gp, 1),
      drn: roundHalfUp(excludedHours.drn, 1),
    },
    grandTotal,
  };
}

/**
 * Repartição proporcional de Discovery, Validação, GP e DRN pelas linhas, para
 * o detalhamento por categoria. Usa os valores JÁ calculados, então a soma das
 * parcelas fecha exatamente com o resumo.
 */
export type ShareKey = 'discovery' | 'validation' | 'gp' | 'drn';

export function lineEligibility(line: CalcLine, result: Pick<CalcResult, 'discVal'>): Record<ShareKey, boolean> {
  return {
    discovery: result.discVal > 0 && !isExcluded(line, VARIABLE_KEYS.discovery),
    validation: !isExcluded(line, VARIABLE_KEYS.validation),
    gp: !isExcluded(line, VARIABLE_KEYS.gp),
    drn: line.skill === SKILL_DEV && !isExcluded(line, VARIABLE_KEYS.drn),
  };
}
