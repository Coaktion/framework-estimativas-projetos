/**
 * Prompt de escopo do FRAMEWORK (editor de projetos /sc), montado FORA da tela.
 *
 * Recebe o catálogo, os dados da versão e o resultado do cálculo (as mesmas
 * linhas do resumo de horas) e devolve a entrada de `buildScopePrompt`. O
 * editor chama com o estado dele; os testes chamam com fixtures — é a mesma
 * função, então o que o teste confere é o que o botão copia.
 *
 * Tudo o que é derivado (canais, integrações, módulos, flags, dados
 * informados) sai das MESMAS linhas que o bloco imprime em [ITENS
 * SELECIONADOS]: uma seção não tem como contradizer outra.
 */

import type { Language } from '@/app/i18n/settings';
import {
  lineEligibility, normalizePhase, SKILL_DESIGN, SKILL_DEV, SKILL_GP, SKILL_IMPL, SKILL_SD,
  type CalcLine, type CalcResult, type ShareKey, type VariableDef,
} from './framework-calc';
import {
  CUSTOM_SUBCATEGORY, MARKETPLACE_SUBCATEGORY, REMOVED_CATEGORY, frameworkRules,
  type CustomPackage,
} from './framework-estimate';
import type { FrameworkCatalog } from './framework-catalog';
import { categoryName, packageName, packageTooltip } from './localized-names';
import { resolveFrameworkFlags, foldKey, type FrameworkFlagLine } from './scope-flags';
import {
  FRAMEWORK_NUMBERS, formatScopeNumber, normalizeScopeLocale, scopeDict,
  type ScopeExportChannel, type ScopeExportInput, type ScopeExportIntegration, type ScopeExportItem,
  type ScopeExportLocale, type ScopeExportNotCounted,
} from './scope-export';
import { PLAN_LABEL, type ZendeskPlanTier, type ZendeskSku } from './zendesk-plans';

/** Ids da biblioteca usados nas seções derivadas (conferidos pelo teste do catálogo). */
export const FRAMEWORK_IDS = {
  agents: 17,
  brands: 16,
  groups: 19,
  sso: 14,
  sideConvSlack: 110,
  sideConvTeams: 111,
  voiceLines: 50,
  appBuilder: [74, 75],
  actionFlowExternal: 135,
  aktieApps: [71, 72],
} as const;

/** Rótulos fixos do Framework, por idioma do bloco. */
const TEXT: Record<ScopeExportLocale, {
  skills: Record<string, string>;
  phases: Record<string, string>;
  discovery: string; validation: string; drn: string; gp: string;
  sdNote: string; sdHoursNote: string; devNote: string; inSdNote: string;
  percent: string; manual: string; fixed: string; mixed: string; zeroSd: string;
  gpDefault: (pct: string) => string; gpChanged: (pct: string, def: string) => string;
  categoryItems: string; customItems: string; marketplaceGroup: string; removedGroup: string;
  unnamedApp: string; unnamedCustom: string;
  kinds: { native: string; marketplace: string; aktie: string; appBuilder: string; actionFlow: string; sideConv: string };
  facts: { agents: string; brands: string; groups: string; sso: string; slack: string; teams: string };
  reasons: { notSelected: string; categoryPlan: string; plan: string; dependency: (name: string) => string; hidden: string };
  yes: string; no: string;
}> = {
  pt: {
    skills: { [SKILL_IMPL]: 'Implantação', [SKILL_SD]: 'Solution Design', [SKILL_GP]: 'Gerente de Projeto', [SKILL_DEV]: 'Desenvolvimento', [SKILL_DESIGN]: 'Design' },
    phases: { workshop: 'Workshop', discovery: 'Discovery', setup: 'Setup', validation: 'Validação', training: 'Treinamento', golive: 'Go-Live e Pós Go-Live' },
    discovery: 'Discovery', validation: 'Validação', drn: 'DRN - Desenvolvimento', gp: 'GP',
    sdNote: 'projeto com SD — sem discovery percentual', sdHoursNote: 'projeto com SD — as horas de SD são o discovery',
    devNote: 'conduzido pelo Solution Design', inSdNote: 'em Solution Design',
    percent: 'percentual', manual: 'valor manual', fixed: 'valor fixo do Admin', mixed: 'percentual + valor fixo do Admin',
    zeroSd: '0, porque o projeto tem Solution Design (as horas de SD são o discovery)',
    gpDefault: (pct) => `percentual padrão (${pct})`, gpChanged: (pct, def) => `percentual alterado nesta versão (${pct}; padrão ${def})`,
    categoryItems: 'Itens da categoria', customItems: 'Itens personalizados', marketplaceGroup: 'Apps de Marketplace', removedGroup: 'Itens removidos da biblioteca',
    unnamedApp: 'App de Marketplace (sem nome)', unnamedCustom: 'Item personalizado (sem nome)',
    kinds: { native: 'Integração nativa', marketplace: 'App de Marketplace', aktie: 'App da Aktie Now', appBuilder: 'Criador de aplicativos', actionFlow: 'Fluxo de ação', sideConv: 'Conversas paralelas' },
    facts: { agents: 'Agentes', brands: 'Marcas', groups: 'Grupos', sso: 'Single Sign-On (SSO)', slack: 'Conversas paralelas via Slack', teams: 'Conversas paralelas via Microsoft Teams' },
    reasons: {
      notSelected: 'módulo não selecionado', categoryPlan: 'módulo acima do plano Zendesk escolhido',
      plan: 'item acima do plano Zendesk escolhido', dependency: (name) => `depende de "${name}", que está sem quantidade`, hidden: 'item oculto',
    },
    yes: 'sim', no: 'não',
  },
  en: {
    skills: { [SKILL_IMPL]: 'Implementation', [SKILL_SD]: 'Solution Design', [SKILL_GP]: 'Project Manager', [SKILL_DEV]: 'Development', [SKILL_DESIGN]: 'Design' },
    phases: { workshop: 'Workshop', discovery: 'Discovery', setup: 'Setup', validation: 'Validation', training: 'Training', golive: 'Go-Live and Post Go-Live' },
    discovery: 'Discovery', validation: 'Validation', drn: 'DRN - Development', gp: 'PM',
    sdNote: 'project with SD — no percentage Discovery', sdHoursNote: 'project with SD — the SD hours are the discovery',
    devNote: 'led by Solution Design', inSdNote: 'in Solution Design',
    percent: 'percentage', manual: 'manual value', fixed: 'fixed value from Admin', mixed: 'percentage + fixed value from Admin',
    zeroSd: '0, because the project has Solution Design (the SD hours are the discovery)',
    gpDefault: (pct) => `default percentage (${pct})`, gpChanged: (pct, def) => `percentage changed in this version (${pct}; default ${def})`,
    categoryItems: 'Category items', customItems: 'Custom items', marketplaceGroup: 'Marketplace apps', removedGroup: 'Items removed from the library',
    unnamedApp: 'Marketplace app (no name)', unnamedCustom: 'Custom item (no name)',
    kinds: { native: 'Native integration', marketplace: 'Marketplace app', aktie: 'Aktie Now app', appBuilder: 'App Builder', actionFlow: 'Action flow', sideConv: 'Side conversations' },
    facts: { agents: 'Agents', brands: 'Brands', groups: 'Groups', sso: 'Single Sign-On (SSO)', slack: 'Side conversations via Slack', teams: 'Side conversations via Microsoft Teams' },
    reasons: {
      notSelected: 'module not selected', categoryPlan: 'module above the selected Zendesk plan',
      plan: 'item above the selected Zendesk plan', dependency: (name) => `depends on "${name}", which has no quantity`, hidden: 'hidden item',
    },
    yes: 'yes', no: 'no',
  },
  es: {
    skills: { [SKILL_IMPL]: 'Implementación', [SKILL_SD]: 'Solution Design', [SKILL_GP]: 'Gerente de Proyecto', [SKILL_DEV]: 'Desarrollo', [SKILL_DESIGN]: 'Diseño' },
    phases: { workshop: 'Workshop', discovery: 'Discovery', setup: 'Setup', validation: 'Validación', training: 'Capacitación', golive: 'Go-Live y Post Go-Live' },
    discovery: 'Discovery', validation: 'Validación', drn: 'DRN - Desarrollo', gp: 'GP',
    sdNote: 'proyecto con SD — sin discovery porcentual', sdHoursNote: 'proyecto con SD — las horas de SD son el discovery',
    devNote: 'conducido por Solution Design', inSdNote: 'en Solution Design',
    percent: 'porcentaje', manual: 'valor manual', fixed: 'valor fijo del Admin', mixed: 'porcentaje + valor fijo del Admin',
    zeroSd: '0, porque el proyecto tiene Solution Design (las horas de SD son el discovery)',
    gpDefault: (pct) => `porcentaje estándar (${pct})`, gpChanged: (pct, def) => `porcentaje cambiado en esta versión (${pct}; estándar ${def})`,
    categoryItems: 'Ítems de la categoría', customItems: 'Ítems personalizados', marketplaceGroup: 'Apps de Marketplace', removedGroup: 'Ítems eliminados de la biblioteca',
    unnamedApp: 'App de Marketplace (sin nombre)', unnamedCustom: 'Ítem personalizado (sin nombre)',
    kinds: { native: 'Integración nativa', marketplace: 'App de Marketplace', aktie: 'App de Aktie Now', appBuilder: 'Creador de aplicaciones', actionFlow: 'Flujo de acción', sideConv: 'Conversaciones paralelas' },
    facts: { agents: 'Agentes', brands: 'Marcas', groups: 'Grupos', sso: 'Single Sign-On (SSO)', slack: 'Conversaciones paralelas vía Slack', teams: 'Conversaciones paralelas vía Microsoft Teams' },
    reasons: {
      notSelected: 'módulo no seleccionado', categoryPlan: 'módulo por encima del plan de Zendesk elegido',
      plan: 'ítem por encima del plan de Zendesk elegido', dependency: (name) => `depende de "${name}", que no tiene cantidad`, hidden: 'ítem oculto',
    },
    yes: 'sí', no: 'no',
  },
};

export interface FrameworkScopeArgs {
  locale?: string | null;
  catalog: Pick<FrameworkCatalog, 'categories' | 'categoryRecords' | 'packagesByCategory'>;
  /** Dados da versão (o mesmo objeto que o editor grava). */
  data: Record<string, any>;
  /** Resultado do cálculo (com as linhas que contam). */
  totals: CalcResult;
  percents: { discovery: number; validation: number; gp: number };
  overrides: { discovery: number | null; validation: number | null; gp: number | null };
  /** Percentual padrão de GP do Admin (para dizer se a versão o alterou). */
  gpDefault?: number | null;
  variableDefs?: { discovery?: VariableDef | null; validation?: VariableDef | null; gp?: VariableDef | null };
  customPackages: CustomPackage[];
  marketplaceApps: any[];
  hiddenIds?: number[];
  planTier: ZendeskPlanTier;
  sku: ZendeskSku;
  deploymentType?: 'new' | 'optimization' | null;
  project: { id: number; name: string; ownerName?: string | null };
  version: {
    id: number;
    name: string;
    description?: string | null;
    createdAt?: Date | string | null;
    technicalScopeLink?: string | null;
    zohoLink?: string | null;
  } | null;
  /** Todas as versões do projeto (a atual é retirada da lista de "outras"). */
  versions?: Array<{ id: number; name: string; description?: string | null; totalHours: number; createdAt?: Date | string | null }>;
  /** Origem do site (https://...) para o link da versão. */
  baseUrl?: string | null;
  generatedAt?: Date | null;
}

/**
 * Tooltip que diz algo sobre a entrega. Os de uma ou duas palavras ("Cada",
 * "Por ação", "Por número") só explicam a unidade da quantidade e viram ruído
 * no prompt.
 */
function meaningfulTooltip(text: string): string | null {
  const clean = String(text || '').trim();
  return clean.split(/\s+/).filter(Boolean).length >= 3 ? clean : null;
}

type Elig = Record<ShareKey, number>;
const SHARE_KEYS: ShareKey[] = ['discovery', 'validation', 'gp', 'drn'];

/**
 * Detalhamento por categoria com Discovery, Validação, GP e DRN repartidos na
 * proporção das horas elegíveis de cada linha — a mesma conta do painel
 * "Por categoria" do editor.
 */
export function categoryBreakdownOf(totals: CalcResult) {
  const zero = (): Elig => ({ discovery: 0, validation: 0, gp: 0, drn: 0 });
  const byCategory = new Map<string, { total: number; elig: Elig; subs: Map<string, { hours: number; elig: Elig }> }>();
  totals.lines.forEach((line) => {
    const hours = Number(line.hours) || 0;
    if (!hours) return;
    const elig = lineEligibility(line, totals);
    if (!byCategory.has(line.category)) byCategory.set(line.category, { total: 0, elig: zero(), subs: new Map() });
    const entry = byCategory.get(line.category)!;
    entry.total += hours;
    if (!entry.subs.has(line.subcategory)) entry.subs.set(line.subcategory, { hours: 0, elig: zero() });
    const sub = entry.subs.get(line.subcategory)!;
    sub.hours += hours;
    SHARE_KEYS.forEach((key) => {
      if (!elig[key]) return;
      entry.elig[key] += hours;
      sub.elig[key] += hours;
    });
  });
  const varTotals: Record<ShareKey, number> = {
    discovery: Number(totals.discVal) || 0,
    validation: Number(totals.validVal) || 0,
    gp: Number(totals.gpVal) || 0,
    drn: Number(totals.drnVal) || 0,
  };
  const eligibleGrand = zero();
  byCategory.forEach((entry) => SHARE_KEYS.forEach((key) => { eligibleGrand[key] += entry.elig[key]; }));
  const contribOf = (elig: Elig): Record<ShareKey, number> => {
    const out = zero();
    SHARE_KEYS.forEach((key) => {
      out[key] = eligibleGrand[key] ? varTotals[key] * (elig[key] / eligibleGrand[key]) : 0;
    });
    return out;
  };
  const sumOf = (c: Record<ShareKey, number>) => SHARE_KEYS.reduce((acc, key) => acc + c[key], 0);
  const rows = Array.from(byCategory.entries())
    .map(([cat, entry]) => {
      const contrib = contribOf(entry.elig);
      return {
        cat,
        total: entry.total,
        contrib,
        totalWithVariables: entry.total + sumOf(contrib),
        subs: Array.from(entry.subs.entries())
          .map(([sub, s]) => {
            const subContrib = contribOf(s.elig);
            return { sub, hours: s.hours, contrib: subContrib, hoursWithVariables: s.hours + sumOf(subContrib) };
          })
          .sort((a, b) => b.hours - a.hours),
      };
    })
    .sort((a, b) => b.total - a.total);
  return {
    rows,
    grand: rows.reduce((acc, r) => acc + r.total, 0),
    grandWithVariables: rows.reduce((acc, r) => acc + r.totalWithVariables, 0),
    varTotals,
  };
}

export function buildFrameworkScopeInput(args: FrameworkScopeArgs): ScopeExportInput {
  const locale = normalizeScopeLocale(args.locale);
  const language = locale as Language;
  const T = TEXT[locale];
  const D = scopeDict(locale);
  const { catalog, data, totals } = args;
  const pct = (value: unknown) => `${formatScopeNumber(value, 2, false, locale)}%`;
  const hrsText = (value: unknown) => `${formatScopeNumber(value, 1, false, locale)}h`;

  const packageById: Record<string, any> = {};
  const rootOfPackage: Record<string, string> = {};
  Object.entries(catalog.packagesByCategory || {}).forEach(([root, pkgs]) => {
    (pkgs || []).forEach((p: any) => {
      packageById[String(p.id)] = p;
      rootOfPackage[String(p.id)] = root;
    });
  });
  const records = catalog.categoryRecords || {};
  const catLabel = (key: string) => (records[key] ? categoryName(records[key], language) : key);
  const subLabel = (root: string, sub: string) => {
    if (sub === CUSTOM_SUBCATEGORY) return T.customItems;
    if (sub === MARKETPLACE_SUBCATEGORY) return T.marketplaceGroup;
    return sub ? catLabel(sub) : '';
  };
  const groupCategory = (key: string) => (key === REMOVED_CATEGORY ? T.removedGroup : catLabel(key));
  const skillLabel = (skill: string) => T.skills[skill] || skill;

  // ---- Itens (as linhas que contam) --------------------------------------
  const lines: CalcLine[] = (totals.lines || []).filter((l) => Number(l.hours) > 0);
  const lineLabel = (line: CalcLine) => {
    if (line.kind === 'marketplace') return String(line.label || '').trim() || T.unnamedApp;
    if (line.kind === 'custom') return String(line.label || '').trim() || T.unnamedCustom;
    const pkg = line.packageId != null ? packageById[String(line.packageId)] : null;
    return (pkg ? packageName(pkg, language) : String(line.label || '')).trim();
  };

  const items: ScopeExportItem[] = lines.map((line) => {
    const pkg = line.kind === 'package' && line.packageId != null ? packageById[String(line.packageId)] : null;
    const custom = line.kind === 'custom' ? args.customPackages[line.customIndex ?? -1] : null;
    const app = line.kind === 'marketplace' ? args.marketplaceApps[Number(String(line.key).split(':')[1])] : null;
    const manual = line.kind === 'package'
      ? data?.[`item_override_check_${line.packageId}`] === 'on'
      : Boolean(custom?.overrideCheck);
    return {
      category: groupCategory(line.category),
      subcategory: subLabel(line.category, line.subcategory),
      label: lineLabel(line),
      quantity: line.quantity,
      hours: line.hours,
      unitHours: line.unitHours,
      skill: line.skill ? skillLabel(line.skill) : null,
      manualHours: manual,
      standardUnitHours: manual ? line.unitHours : null,
      description: pkg ? meaningfulTooltip(packageTooltip(pkg, language)) : null,
      includes: pkg ? pkg.scopeIncluded : custom ? custom.scopeIn : null,
      excludes: pkg ? pkg.scopeExcluded : custom ? custom.scopeOut : null,
      link: app ? app.link : pkg?.link || null,
    };
  });
  items.sort((a, b) =>
    a.category.localeCompare(b.category) ||
    a.subcategory.localeCompare(b.subcategory) ||
    a.label.localeCompare(b.label));

  // ---- Flags (das mesmas linhas) -----------------------------------------
  const flagLines: FrameworkFlagLine[] = lines.map((line) => ({
    kind: line.kind,
    packageId: line.packageId ?? null,
    category: line.category,
    subcategory: line.subcategory,
    name: String(line.label || ''),
    hours: line.hours,
  }));
  const flags = resolveFrameworkFlags(flagLines, totals.skillTotals || {});

  // ---- Canais --------------------------------------------------------------
  const byId = (id: number) => lines.find((l) => l.kind === 'package' && Number(l.packageId) === id) || null;
  const channels: ScopeExportChannel[] = [];
  lines
    .filter((l) => foldKey(l.subcategory) === 'canais')
    .forEach((l) => channels.push({ label: lineLabel(l), quantity: l.quantity }));
  const voiceLines = byId(FRAMEWORK_IDS.voiceLines);
  if (voiceLines) channels.push({ label: `${lineLabel(voiceLines)} (${catLabel(voiceLines.category)})`, quantity: voiceLines.quantity });

  // ---- Integrações e apps ---------------------------------------------------
  const integrations: ScopeExportIntegration[] = [];
  lines.forEach((l) => {
    const sub = foldKey(l.subcategory);
    const id = Number(l.packageId);
    if (sub === 'integracoes nativas') {
      integrations.push({ kind: T.kinds.native, label: lineLabel(l), quantity: l.quantity });
    } else if (sub === 'apps de marketplace') {
      const aktie = (FRAMEWORK_IDS.aktieApps as readonly number[]).includes(id);
      integrations.push({ kind: aktie ? T.kinds.aktie : T.kinds.marketplace, label: lineLabel(l), quantity: l.quantity, link: packageById[String(id)]?.link || null });
    }
  });
  lines.filter((l) => l.kind === 'marketplace').forEach((l) => {
    const app = args.marketplaceApps[Number(String(l.key).split(':')[1])];
    integrations.push({ kind: T.kinds.marketplace, label: lineLabel(l), quantity: 1, link: app?.link || null });
  });
  lines.forEach((l) => {
    const id = Number(l.packageId);
    if (l.kind !== 'package') return;
    if ((FRAMEWORK_IDS.appBuilder as readonly number[]).includes(id)) {
      integrations.push({ kind: T.kinds.appBuilder, label: lineLabel(l), quantity: l.quantity });
    } else if (id === FRAMEWORK_IDS.actionFlowExternal) {
      integrations.push({ kind: T.kinds.actionFlow, label: lineLabel(l), quantity: l.quantity });
    } else if (id === FRAMEWORK_IDS.sideConvSlack || id === FRAMEWORK_IDS.sideConvTeams) {
      integrations.push({ kind: T.kinds.sideConv, label: lineLabel(l), quantity: l.quantity });
    }
  });

  // ---- Módulos ---------------------------------------------------------------
  const phaseOf = (cat: string) => normalizePhase(records[cat]?.implementationPhase);
  const withHours = Array.from(new Set(lines.map((l) => l.category))).filter((c) => c !== REMOVED_CATEGORY);
  const ordered = (catalog.categories || []).filter((c) => withHours.includes(c));
  withHours.forEach((c) => { if (!ordered.includes(c)) ordered.push(c); });
  const modules = ordered.map(catLabel).sort((a, b) => a.localeCompare(b));
  const zendesk = ordered.filter((c) => phaseOf(c) === 'SETUP').map(catLabel);
  const servicePhases = ordered.filter((c) => phaseOf(c) !== 'SETUP').map(catLabel);
  const notSelected = (catalog.categories || [])
    .filter((c) => !withHours.includes(c) && data?.[`check_area_${c}`] !== 'on')
    .map(catLabel);

  // ---- Dimensionamento -------------------------------------------------------
  const discNote = totals.discoveryMode === 'sd' ? T.sdNote : totals.discoveryMode === 'dev' ? T.devNote : undefined;
  const percentLines = [
    { label: T.discovery, value: totals.discoveryMode === 'sd' ? 0 : args.percents.discovery, note: discNote },
    { label: T.validation, value: args.percents.validation },
    { label: T.gp, value: args.percents.gp },
    { label: 'DRN', value: totals.drnPct },
  ];
  const calculatedHours = [
    {
      label: T.discovery,
      hours: totals.discVal,
      note: totals.discoveryMode === 'sd' ? T.sdHoursNote : totals.discoveryMode === 'dev' ? T.inSdNote : undefined,
    },
    { label: T.validation, hours: totals.validVal },
    { label: T.drn, hours: totals.drnVal },
    { label: T.gp, hours: totals.gpVal },
  ];
  const impl = totals.skillBreakdownBySkill?.[SKILL_IMPL] || {};
  const phaseHours = [
    { label: T.phases.workshop, hours: Number(impl.implantacao_workshop) || 0 },
    { label: T.phases.discovery, hours: Number(impl.implantacao_discovery) || 0 },
    { label: T.phases.setup, hours: Number(impl.implantacao_setup) || 0 },
    { label: T.phases.validation, hours: Number(impl.implantacao_validacao) || 0 },
    { label: T.phases.training, hours: Number(impl.implantacao_treinamento) || 0 },
    { label: T.phases.golive, hours: Number(impl.implantacao_golive) || 0 },
  ];

  // De onde veio cada número: percentual (com a base), valor manual ou fixo.
  const describe = (
    label: string,
    override: number | null,
    percent: number,
    base: number,
    value: number,
    def?: VariableDef | null,
  ) => {
    if (override !== null && override !== undefined) return `${label}: ${T.manual} — ${hrsText(value)}`;
    const type = String(def?.type || 'PERCENT').toUpperCase();
    if (type === 'FLAT') return `${label}: ${T.fixed} — ${hrsText(value)}`;
    const how = type === 'MIXED' ? T.mixed : T.percent;
    return `${label}: ${how} — ${pct(percent)} ${D.lbl.over} ${hrsText(base)} = ${hrsText(value)}`;
  };
  const origins = [
    totals.discoveryMode === 'sd'
      ? `${T.discovery}: ${T.zeroSd}`
      : describe(T.discovery, args.overrides.discovery, args.percents.discovery, totals.baseDiscovery, totals.discVal, args.variableDefs?.discovery),
    describe(T.validation, args.overrides.validation, args.percents.validation, totals.baseValidation, totals.validVal, args.variableDefs?.validation),
    (() => {
      const base = describe(T.gp, args.overrides.gp, args.percents.gp, totals.totalBaseGP, totals.gpVal, args.variableDefs?.gp);
      if (args.overrides.gp !== null && args.overrides.gp !== undefined) return base;
      const def = Number(args.gpDefault);
      if (!Number.isFinite(def)) return base;
      const extra = Math.abs(def - Number(args.percents.gp)) < 1e-9 ? T.gpDefault(pct(def)) : T.gpChanged(pct(args.percents.gp), pct(def));
      return `${base} (${extra})`;
    })(),
    `DRN: ${T.percent} — ${pct(totals.drnPct)} ${D.lbl.over} ${hrsText(totals.baseDrn)} = ${hrsText(totals.drnVal)}`,
  ];

  // ---- Detalhamento por categoria -------------------------------------------
  const breakdown = categoryBreakdownOf(totals);
  const categories = breakdown.rows.map((row) => ({
    label: groupCategory(row.cat),
    hours: row.total,
    loadedHours: row.totalWithVariables,
    subcategories: row.subs.map((s) => ({ label: subLabel(row.cat, s.sub) || T.categoryItems, hours: s.hours })),
  }));

  // ---- Dados informados (das quantidades dos itens) --------------------------
  const qtyOf = (id: number) => Number(byId(id)?.quantity) || 0;
  const facts = [
    { label: T.facts.agents, value: qtyOf(FRAMEWORK_IDS.agents) ? String(qtyOf(FRAMEWORK_IDS.agents)) : '' },
    { label: T.facts.brands, value: qtyOf(FRAMEWORK_IDS.brands) ? String(qtyOf(FRAMEWORK_IDS.brands)) : '' },
    { label: T.facts.groups, value: qtyOf(FRAMEWORK_IDS.groups) ? String(qtyOf(FRAMEWORK_IDS.groups)) : '' },
    { label: T.facts.sso, value: qtyOf(FRAMEWORK_IDS.sso) > 0 ? T.yes : T.no },
    { label: T.facts.slack, value: qtyOf(FRAMEWORK_IDS.sideConvSlack) > 0 ? T.yes : T.no },
    { label: T.facts.teams, value: qtyOf(FRAMEWORK_IDS.sideConvTeams) > 0 ? T.yes : T.no },
  ];

  // ---- Itens preenchidos que não contam --------------------------------------
  const rules = frameworkRules(catalog as FrameworkCatalog, data, { sku: args.sku, plan: args.planTier, hiddenIds: args.hiddenIds });
  const counted = new Set(lines.filter((l) => l.kind === 'package').map((l) => Number(l.packageId)));
  const hidden = new Set((args.hiddenIds || []).map(Number));
  const notCounted: ScopeExportNotCounted[] = [];
  Object.values(packageById).forEach((pkg: any) => {
    const id = Number(pkg.id);
    const qty = parseFloat(data?.[`item_${id}_qty`] || 0) || 0;
    if (qty <= 0 || counted.has(id)) return;
    const root = rootOfPackage[String(id)];
    let reason: string;
    if (hidden.has(id)) reason = T.reasons.hidden;
    else if (!rules.isCategoryOnPlan(root)) reason = T.reasons.categoryPlan;
    else if (data?.[`check_area_${root}`] !== 'on') reason = T.reasons.notSelected;
    else if (!rules.isAvailable(pkg)) reason = T.reasons.plan;
    else if (pkg.dependsOnItemId) {
      const dep = packageById[String(pkg.dependsOnItemId)];
      reason = T.reasons.dependency(dep ? packageName(dep, language).trim() : `#${pkg.dependsOnItemId}`);
    } else reason = T.reasons.plan;
    notCounted.push({ label: packageName(pkg, language).trim(), category: catLabel(root), quantity: qty, reason });
  });
  args.customPackages.forEach((pkg) => {
    const qty = parseFloat(String(pkg.qty || 0)) || 0;
    if (qty <= 0 || rules.isCategoryActive(pkg.category)) return;
    notCounted.push({ label: String(pkg.name || '').trim() || T.unnamedCustom, category: catLabel(pkg.category), quantity: qty, reason: T.reasons.notSelected });
  });
  notCounted.sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label));

  // ---- Versões ----------------------------------------------------------------
  const version = args.version;
  const otherVersions = (args.versions || [])
    .filter((v) => !version || Number(v.id) !== Number(version.id))
    .map((v) => ({ name: v.name, description: v.description || null, hours: Number(v.totalHours) || 0, createdAt: v.createdAt || null }));
  const base = String(args.baseUrl || '').replace(/\/+$/, '');

  return {
    origin: 'framework',
    locale,
    numbers: FRAMEWORK_NUMBERS,
    clientName: args.project.name,
    projectName: args.project.name,
    versionName: version?.name || 'V1',
    versionDescription: version?.description || null,
    generatedAt: args.generatedAt || new Date(),
    versionCreatedAt: version?.createdAt || null,
    projectId: args.project.id,
    versionId: version?.id ?? null,
    toolCenterUrl: base && version ? `${base}/sc/project/${args.project.id}?version_id=${version.id}` : null,
    technicalScopeLink: version?.technicalScopeLink || null,
    zohoLink: version?.zohoLink || null,
    preSalesName: args.project.ownerName || null,
    deploymentType: args.deploymentType || null,
    totalHours: totals.grandTotal,
    skillHours: totals.skillTotals,
    skillLabels: T.skills,
    calculatedHours,
    percentLines,
    phaseHours,
    origins,
    planTierLabel: PLAN_LABEL[args.planTier],
    skuLabel: args.sku === 'ES' ? 'Employee Service' : 'Customer Service',
    modules,
    moduleDetail: { zendesk, servicePhases, notSelected },
    channels,
    integrations,
    flags,
    categories,
    items,
    facts,
    otherVersions,
    notCounted,
  };
}
