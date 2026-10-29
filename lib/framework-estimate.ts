/**
 * Estimativa de uma versão de projeto calculada FORA do editor.
 *
 * O editor (ProjectEditorClient) monta as linhas que contam hora dentro de um
 * useMemo e passa para `computeFrameworkTotals`. A API do Tool Center precisa
 * do mesmo resultado sem tela nenhuma, então as regras de "o que conta" estão
 * reproduzidas aqui, uma a uma, com os mesmos nomes do editor:
 *
 *  - módulo (categoria raiz) só conta marcado (`check_area_X = on`) e no plano;
 *  - item só conta com quantidade > 0, no plano (dele e de toda a cadeia de
 *    categorias), não oculto e com a dependência atendida;
 *  - ajuste manual substitui quantidade × horas;
 *  - itens personalizados e apps de Marketplace entram como no editor;
 *  - com retrato de preços salvo na versão, valem os valores ORIGINAIS (é o
 *    padrão do editor ao abrir uma versão) — o total fecha com o gravado.
 *
 * QUALQUER mudança nas regras do editor precisa ser repetida aqui. O teste de
 * paridade (scripts/framework-parity.ts) recalcula as versões salvas e aponta
 * divergências com o total que o editor gravou.
 */

import {
  computeFrameworkTotals, normalizePhase, SKILL_IMPL, VARIABLE_KEYS,
  type CalcLine, type CalcResult,
} from '@/lib/framework-calc';
import {
  isCategoryAvailable, isPackageAvailable, normalizePlanTier, normalizeSkuType,
  DEFAULT_PLAN, DEFAULT_SKU, type ZendeskPlanTier, type ZendeskSku,
} from '@/lib/zendesk-plans';
import type { FrameworkCatalog } from '@/lib/framework-catalog';

/** Itens cadastrados direto na categoria raiz (sem subcategoria no Admin). */
export const ROOT_SUBCATEGORY = '';
/** Agrupadores das linhas que não são itens da biblioteca. */
export const CUSTOM_SUBCATEGORY = '__custom__';
export const MARKETPLACE_SUBCATEGORY = '__marketplace__';
export const MARKETPLACE_CATEGORY = 'Marketplace';
export const MARKETPLACE_APP_HOURS = 5;
/** Agrupador das linhas que só existem no retrato da versão (item removido). */
export const REMOVED_CATEGORY = '__removed__';

export type PriceSnapshot = {
  v: number;
  savedAt?: string;
  drnPct?: number;
  /** h = horas unitárias, s = skill, x = tags de não incidência, n = nome, c = categoria raiz. */
  items: Record<string, { h: number; s?: string; x?: string[]; n?: string; c?: string }>;
};

export interface CustomPackage {
  id: string;
  category: string;
  index: number;
  name: string;
  hours: string | number;
  qty: string | number;
  skill: string;
  scopeIn?: string;
  scopeOut?: string;
  overrideCheck: boolean;
  overrideVal?: string | number;
}

export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function parseIdList(raw: unknown): string[] {
  const parsed = typeof raw === 'string' ? safeJsonParse<any>(raw, []) : raw;
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

export function getVariableNumber(variables: any[] | null | undefined, keys: string[], fallback: number) {
  const hit = variables?.find((v: any) => keys.includes(v.key));
  const parsed = parseFloat(hit?.value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

const CUSTOM_FIELD_SNAKE: Record<string, string> = {
  overrideCheck: 'override_check',
  overrideVal: 'override_val',
  scopeIn: 'scope_in',
  scopeOut: 'scope_out',
};

/** Chave plana de um campo de item personalizado: custom_pkg_{CATEGORIA}_{INDEX}_{CAMPO}. */
export function customPackageKey(category: string, index: string | number, field: string) {
  return `custom_pkg_${category}_${index}_${CUSTOM_FIELD_SNAKE[field] ?? field}`;
}

/** Itens personalizados gravados no JSON da versão (mesmo parser do editor). */
export function parseCustomPackages(data: Record<string, any>): CustomPackage[] {
  const PKG_NAME_RE = /^custom_pkg_(.+)_(\d+)_name$/;
  const out: CustomPackage[] = [];
  Object.keys(data || {}).forEach((key) => {
    const m = key.match(PKG_NAME_RE);
    if (!m) return;
    const [, category, index] = m;
    out.push({
      id: `${category}_${index}`,
      category,
      index: Number(index),
      name: data[customPackageKey(category, index, 'name')],
      hours: data[customPackageKey(category, index, 'hours')],
      qty: data[customPackageKey(category, index, 'qty')],
      skill: data[customPackageKey(category, index, 'skill')] || SKILL_IMPL,
      scopeIn: data[customPackageKey(category, index, 'scopeIn')],
      scopeOut: data[customPackageKey(category, index, 'scopeOut')],
      overrideCheck: data[customPackageKey(category, index, 'overrideCheck')] === 'on',
      overrideVal: data[customPackageKey(category, index, 'overrideVal')],
    });
  });
  return out;
}

export function parseMarketplaceApps(data: Record<string, any>): any[] {
  const parsed = safeJsonParse<any>(data?.marketplace_apps, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function parsePriceSnapshot(raw: unknown): PriceSnapshot | null {
  const parsed = typeof raw === 'string' ? safeJsonParse<any>(raw, null) : raw;
  return parsed && typeof parsed === 'object' && (parsed as any).items ? (parsed as PriceSnapshot) : null;
}

const qtyOf = (data: Record<string, any>, id: string | number) =>
  parseFloat(data?.[`item_${id}_qty`] || 0) || 0;

/**
 * Regras de disponibilidade e visibilidade do editor, presas a um catálogo,
 * um plano e um conjunto de dados de versão.
 */
export function frameworkRules(
  catalog: FrameworkCatalog,
  data: Record<string, any>,
  opts: { sku?: ZendeskSku; plan?: ZendeskPlanTier; hiddenIds?: number[] } = {},
) {
  const sku = opts.sku ?? normalizeSkuType(data?.__skuType ?? DEFAULT_SKU);
  const plan = opts.plan ?? normalizePlanTier(data?.__planTier ?? DEFAULT_PLAN);
  const hiddenSet = new Set((opts.hiddenIds || []).map(Number));
  const { categories, categoryRecords, packagesByCategory } = catalog;

  const packageById: Record<string, any> = {};
  const packageRootCategoryById: Record<string, string> = {};
  Object.entries(packagesByCategory || {}).forEach(([rootCat, pkgs]) => {
    (pkgs || []).forEach((p: any) => {
      packageById[String(p.id)] = p;
      packageRootCategoryById[String(p.id)] = rootCat;
    });
  });

  const isCategoryOnPlan = (catName: string) => {
    const record = categoryRecords?.[catName];
    if (!record) return true;
    return isCategoryAvailable(record, sku, plan);
  };

  const isAvailable = (pkg: any) => {
    if (!isPackageAvailable(pkg, sku, plan)) return false;
    let sourceCat = pkg?.categoryName;
    const seen = new Set<string>();
    while (sourceCat && !seen.has(sourceCat)) {
      if (!isCategoryOnPlan(sourceCat)) return false;
      seen.add(sourceCat);
      sourceCat = categoryRecords?.[sourceCat]?.parentName;
    }
    return true;
  };

  const isCategoryActive = (cat: string) =>
    Boolean(cat) && categories.includes(cat) && isCategoryOnPlan(cat) && data?.[`check_area_${cat}`] === 'on';

  const isPackageVisible = (pkg: any): boolean => {
    const visit = (p: any, depth: number): boolean => {
      if (!p || depth > 20) return false;
      if (!isAvailable(p)) return false;
      if (hiddenSet.has(Number(p.id))) return false;
      if (p.dependsOnItemId) {
        const dep = packageById[String(p.dependsOnItemId)];
        if (!dep) return false;
        if (qtyOf(data, dep.id) <= 0) return false;
        if (!isCategoryActive(packageRootCategoryById[String(dep.id)])) return false;
        if (!visit(dep, depth + 1)) return false;
      }
      return true;
    };
    return visit(pkg, 0);
  };

  const phaseOf = (cat: string) => normalizePhase(categoryRecords?.[cat]?.implementationPhase);

  return {
    sku, plan, packageById, packageRootCategoryById,
    isCategoryOnPlan, isAvailable, isCategoryActive, isPackageVisible, phaseOf,
  };
}

export interface EstimateOptions {
  /** Itens ocultos do usuário: nunca contam (o editor também os tira ao salvar). */
  hiddenIds?: number[];
  /**
   * 'original' usa o retrato de preços da versão quando existir (padrão do
   * editor ao abrir uma versão); 'current' usa sempre a biblioteca atual.
   */
  priceMode?: 'original' | 'current';
}

export interface VersionLike {
  data: Record<string, any> | string | null;
  gpPercent?: number | null;
  discoveryPercent?: number | null;
  validationPercent?: number | null;
  gpOverride?: number | null;
  discoveryOverride?: number | null;
  validationOverride?: number | null;
}

/** Linhas que contam hora — o mesmo `calcLines` do editor. */
export function buildCalcLines(
  catalog: FrameworkCatalog,
  data: Record<string, any>,
  opts: EstimateOptions = {},
): { lines: CalcLine[]; drnPct: number; priceMode: 'original' | 'current' } {
  const rules = frameworkRules(catalog, data, { hiddenIds: opts.hiddenIds });
  const { categories, packagesByCategory, variables } = catalog;
  const snapshot = parsePriceSnapshot(data?.__priceSnapshot);
  const priceMode = opts.priceMode === 'current' || !snapshot ? 'current' : 'original';

  const currentPriceOf = (pkg: any) => ({
    hours: Number(pkg?.hours) || 0,
    skill: String(pkg?.skillName || pkg?.skill || ''),
    excluded: parseIdList(pkg?.excludedFromVariables),
  });
  const priceOf = (pkg: any) => {
    const cur = currentPriceOf(pkg);
    if (priceMode !== 'original' || !snapshot) return cur;
    const snap = snapshot.items?.[String(pkg?.id)];
    if (!snap) return cur;
    return {
      hours: Number(snap.h) || 0,
      skill: snap.s !== undefined ? String(snap.s || '') : cur.skill,
      excluded: snap.x !== undefined ? (snap.x || []).map(String) : cur.excluded,
    };
  };

  const currentDrnPct = getVariableNumber(variables, [VARIABLE_KEYS.drn], 15);
  const drnPct = priceMode === 'original' && snapshot?.drnPct !== undefined
    ? Number(snapshot.drnPct)
    : currentDrnPct;

  const out: CalcLine[] = [];
  categories.forEach((cat) => {
    if (!rules.isCategoryActive(cat)) return;
    (packagesByCategory[cat] || []).forEach((pkg: any) => {
      const qty = qtyOf(data, pkg.id);
      if (qty <= 0) return;
      if (!rules.isPackageVisible(pkg)) return;
      const price = priceOf(pkg);
      let hours = qty * price.hours;
      if (data[`item_override_check_${pkg.id}`] === 'on') {
        const overrideVal = parseFloat(data[`item_override_val_${pkg.id}`]);
        if (!isNaN(overrideVal)) hours = overrideVal;
      }
      out.push({
        key: `pkg:${pkg.id}`,
        kind: 'package',
        packageId: Number(pkg.id),
        category: cat,
        subcategory: String(pkg?.__subcategory || ROOT_SUBCATEGORY),
        label: String(pkg.name || ''),
        quantity: qty,
        unitHours: price.hours,
        hours,
        skill: price.skill,
        phase: rules.phaseOf(cat),
        excluded: price.excluded,
      });
    });
  });

  parseCustomPackages(data).forEach((pkg, idx) => {
    if (!rules.isCategoryActive(pkg.category)) return;
    const qty = parseFloat(String(pkg.qty || 0)) || 0;
    const unit = parseFloat(String(pkg.hours || 0)) || 0;
    let hours = qty * unit;
    if (pkg.overrideCheck) {
      const val = parseFloat(String(pkg.overrideVal));
      if (!isNaN(val)) hours = val;
    }
    out.push({
      key: `custom:${idx}`,
      kind: 'custom',
      customIndex: idx,
      category: pkg.category,
      subcategory: CUSTOM_SUBCATEGORY,
      label: String(pkg.name || ''),
      quantity: qty,
      unitHours: unit,
      hours,
      skill: String(pkg.skill || SKILL_IMPL),
      phase: rules.phaseOf(pkg.category),
      excluded: [],
    });
  });

  if (rules.isCategoryActive(MARKETPLACE_CATEGORY)) {
    parseMarketplaceApps(data).forEach((app: any, idx: number) => {
      out.push({
        key: `marketplace:${idx}`,
        kind: 'marketplace',
        category: MARKETPLACE_CATEGORY,
        subcategory: MARKETPLACE_SUBCATEGORY,
        label: String(app?.name || '').trim(),
        quantity: 1,
        unitHours: MARKETPLACE_APP_HOURS,
        hours: MARKETPLACE_APP_HOURS,
        skill: SKILL_IMPL,
        phase: rules.phaseOf(MARKETPLACE_CATEGORY),
        excluded: [],
      });
    });
  }

  // Itens que só existem no retrato da versão (removidos da biblioteca, ou sem
  // categoria ativa) contam com os valores salvos, como no editor.
  if (priceMode === 'original' && snapshot) {
    Object.entries(snapshot.items || {}).forEach(([id, snap]) => {
      if (rules.packageById[id]) return;
      const qty = qtyOf(data, id);
      if (qty <= 0) return;
      let hours = qty * (Number(snap.h) || 0);
      if (data[`item_override_check_${id}`] === 'on') {
        const overrideVal = parseFloat(data[`item_override_val_${id}`]);
        if (!isNaN(overrideVal)) hours = overrideVal;
      }
      const category = snap.c && categories.includes(snap.c) ? snap.c : REMOVED_CATEGORY;
      out.push({
        key: `snapshot:${id}`,
        kind: 'package',
        packageId: Number(id),
        category,
        subcategory: ROOT_SUBCATEGORY,
        label: String(snap.n || `#${id}`),
        quantity: qty,
        unitHours: Number(snap.h) || 0,
        hours,
        skill: String(snap.s || ''),
        phase: category === REMOVED_CATEGORY ? 'SETUP' : rules.phaseOf(category),
        excluded: (snap.x || []).map(String),
      });
    });
  }

  return { lines: out, drnPct, priceMode };
}

/** Percentuais padrão de uma versão nova (variáveis do Admin), como no editor. */
export function defaultPercents(variables: any[]) {
  return {
    gp: getVariableNumber(variables, ['GP_STANDARD', 'GP_PERCENTAGE'], 25),
    discovery: getVariableNumber(variables, ['DISCOVERY_STANDARD'], 0),
    validation: getVariableNumber(variables, ['VALIDATION_STANDARD'], 0),
  };
}

/** Total da versão, como o editor mostra (e grava em `totalHours`). */
export function estimateVersion(
  catalog: FrameworkCatalog,
  version: VersionLike,
  opts: EstimateOptions = {},
): CalcResult & { priceMode: 'original' | 'current' } {
  const data = typeof version.data === 'string'
    ? safeJsonParse<Record<string, any>>(version.data, {})
    : (version.data || {});
  const { lines, drnPct, priceMode } = buildCalcLines(catalog, data, opts);
  const defaults = defaultPercents(catalog.variables);
  const defOf = (key: string) => (catalog.variables || []).find((v: any) => v.key === key) || null;
  const totals = computeFrameworkTotals({
    lines,
    percents: {
      gp: version.gpPercent ?? defaults.gp,
      discovery: version.discoveryPercent ?? defaults.discovery,
      validation: version.validationPercent ?? defaults.validation,
    },
    drnPct,
    overrides: {
      gp: version.gpOverride ?? null,
      discovery: version.discoveryOverride ?? null,
      validation: version.validationOverride ?? null,
    },
    variableDefs: {
      discovery: defOf(VARIABLE_KEYS.discovery),
      validation: defOf(VARIABLE_KEYS.validation),
      gp: defOf(VARIABLE_KEYS.gp),
    },
  });
  return { ...totals, priceMode };
}

/**
 * Retrato de preços gravado junto com uma versão nova (valores atuais da
 * biblioteca), igual ao que o editor grava ao salvar.
 */
export function buildPriceSnapshot(catalog: FrameworkCatalog, data: Record<string, any>): PriceSnapshot {
  const rules = frameworkRules(catalog, data);
  const items: PriceSnapshot['items'] = {};
  Object.values(rules.packageById).forEach((pkg: any) => {
    if (qtyOf(data, pkg.id) <= 0) return;
    items[String(pkg.id)] = {
      h: Number(pkg?.hours) || 0,
      s: String(pkg?.skillName || pkg?.skill || ''),
      x: parseIdList(pkg?.excludedFromVariables),
      n: String(pkg.name || ''),
      c: rules.packageRootCategoryById[String(pkg.id)],
    };
  });
  return {
    v: 1,
    savedAt: new Date().toISOString(),
    drnPct: getVariableNumber(catalog.variables, [VARIABLE_KEYS.drn], 15),
    items,
  };
}
