/**
 * Exportação / importação da configuração da Calculadora AE (Admin ›
 * Calculadora AE). O arquivo é um JSON pensado para ser lido e editado pela
 * Claude: traz a configuração completa e, ao lado, as instruções e a
 * referência (rótulos, variáveis das fórmulas, itens da biblioteca) de que um
 * modelo precisa para entender e alterar o cálculo sem ver o código. A
 * importação usa só o bloco `config`; o resto é contexto.
 */

import {
  ALL_FORMULAS, APP_FORMULAS, APP_VARIABLES, BASE_FORMULAS, BASE_VARIABLES, BINDABLE_NUMBERS, FIXED_QTY_FORMULAS,
  INPUT_VARIABLES, QUANTITY_FORMULAS, normalizeAEConfig, numberAt, resolveBindings,
  type AEConfig, type AELibraryItem,
} from './ae-config';
import { FORMULA_FUNCTION_NAMES } from './formula';

export const AE_CONFIG_FILE_FORMAT = 'aktienow-ae-calculator-config';
export const AE_CONFIG_FILE_VERSION = 1;

const INSTRUCTIONS = [
  'This file is the full configuration of the "Calculadora AE" (an hours estimator for Zendesk implementation projects). Only the "config" object is imported back; "reference" is read-only context. Do not rename or add keys in "config"; change values only.',
  'Workflow: edit "config", keep "format" and "formatVersion", and return the whole file (or just { "config": ... }). Returning only the keys you changed also works: anything missing keeps its current value. The import loads it into the editor as unsaved changes; an admin reviews it and saves a new version. Invalid formulas or numbers are flagged and block saving.',
  'Units: hours unless stated. config.numbers.percentuais are FRACTIONS (0.2 = 20%), except limite_gerente_projetos, which is an hour threshold. fatores_plano / fatores_operacao are plain multipliers.',
  'How the estimate is computed: (1) each quantity formula (config.formulas, keys listed in reference.formulas.quantity) is evaluated from the inputs; (2) line hours = quantity × config.numbers.horas_unitarias[same key] for the module-configuration items; (3) flat hours are added per enabled module from configuracoes_gerais, treinamentos and workshops; (4) fixed items add qtd_<item> (formula) × itens_fixos.<group>.<item> (hours); (5) apps and the two Aktie Now app formulas add their hours; (6) Discovery, Validation, Go-live and Technical communication are percentuais × base_percentuais; (7) PM (gerente_projetos) is charged on base_gp only when gatilho_gp exceeds limite_gerente_projetos.',
  'Formula syntax: numbers accept a decimal comma or dot (0,5 or 0.5); operators + - * / ^ and a standalone "x" also multiplies; comparisons (> < >= <= == !=) return 1 or 0; function arguments are separated by ";" e.g. max(areas; 2), se(plano_team; 1; formularios) (se = if). Available functions: see reference.functions.',
  'Which variables each formula may use: quantity formulas and fixed-quantity formulas (qtd_*) may use reference.variables.inputs and any other quantity (no circular dependencies). App formulas may additionally use reference.variables.apps. Base formulas may use inputs, quantities and reference.variables.bases (horas_discovery / horas_validacao / horas_golive / horas_comunicacao_tecnica only inside gatilho_gp and base_gp).',
  'Library bindings (config.bindings): the company library (Admin › Library) is the source of truth for hours. A binding { "packageId": <id>, "override": false } makes that number use the library item hours (the stored number is only a fallback). With "override": true the stored number in config.numbers is used instead, even if the library changes. "packageId": null means unbound (the stored number applies). To rebind, use an id from reference.library (or give "libraryItemName" with the exact item name instead of packageId). If config.bindings is absent, no binding is active yet.',
  'reference.effectiveHours shows the value each bindable number currently resolves to (library or manual) so you can reason about the real calculation.',
];

type Lang = 'pt' | 'en' | 'es';

export interface AEConfigExportOptions {
  config: AEConfig;
  library: AELibraryItem[];
  /** Versão ativa em que o rascunho se baseia (null = padrão de fábrica). */
  basedOnVersion: number | null;
  includesUnsavedChanges: boolean;
  /** Rótulo legível de um número (Admin › Números) no idioma da tela. */
  numberLabel: (path: string) => string;
  lang: Lang;
}

/** Monta o objeto do arquivo exportado. */
export function buildAeConfigExport(options: AEConfigExportOptions) {
  const { config, library, lang } = options;
  const resolved = resolveBindings(config, library);
  const formulaRef = (specs: typeof ALL_FORMULAS) =>
    Object.fromEntries(specs.map((f) => [f.key, { label: f.label.en, labelUi: f.label[lang], default: f.default }]));
  const variables = (list: typeof INPUT_VARIABLES) => Object.fromEntries(list.map((v) => [v.name, v.description.en]));
  const numberLabels: Record<string, string> = {};
  const walk = (node: any, path: string) => {
    if (node && typeof node === 'object') Object.entries(node).forEach(([k, v]) => walk(v, path ? `${path}.${k}` : k));
    else numberLabels[path] = options.numberLabel(path);
  };
  walk(config.numbers, '');

  return {
    format: AE_CONFIG_FILE_FORMAT,
    formatVersion: AE_CONFIG_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    basedOnVersion: options.basedOnVersion,
    includesUnsavedChanges: options.includesUnsavedChanges,
    _instructions: INSTRUCTIONS,
    config: {
      numbers: config.numbers,
      formulas: config.formulas,
      settings: config.settings,
      ...(config.bindings ? { bindings: config.bindings } : {}),
    },
    reference: {
      functions: FORMULA_FUNCTION_NAMES,
      formulas: {
        quantity: formulaRef(QUANTITY_FORMULAS),
        fixedQuantity: formulaRef(FIXED_QTY_FORMULAS),
        apps: formulaRef(APP_FORMULAS),
        bases: formulaRef(BASE_FORMULAS),
      },
      variables: {
        inputs: variables(INPUT_VARIABLES),
        quantities: Object.fromEntries(QUANTITY_FORMULAS.map((f) => [f.key, `Quantity: ${f.label.en}`])),
        apps: variables(APP_VARIABLES),
        bases: variables(BASE_VARIABLES),
      },
      numberLabels,
      bindableNumbers: BINDABLE_NUMBERS.map((b) => b.path),
      effectiveHours: Object.fromEntries(BINDABLE_NUMBERS.map((b) => {
        const r = resolved[b.path];
        return [b.path, {
          hours: r.effective,
          source: !config.bindings ? 'stored (bindings not active)' : r.override ? 'manual override' : r.item ? 'library' : r.missing ? 'stored (bound item missing)' : 'stored (unbound)',
          libraryItem: r.item ? { id: r.item.id, name: r.item.name, hours: r.item.hours } : null,
          storedValue: numberAt(config.numbers, b.path),
        }];
      })),
      library: library.map((item) => ({ id: item.id, name: item.name, hours: item.hours, category: item.categoryName || null })),
    },
  };
}

const foldName = (value: unknown) => String(value ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export type AEConfigImportResult =
  | { ok: true; config: AEConfig; unknownItems: string[] }
  | { ok: false; error: 'json' | 'format' };

/** Mescla `override` sobre `base` (objetos simples; o resto substitui). */
function deepMerge(base: any, override: any): any {
  if (!override || typeof override !== 'object' || Array.isArray(override)) return override === undefined ? base : override;
  const out: any = { ...(base && typeof base === 'object' ? base : {}) };
  Object.entries(override).forEach(([k, v]) => { out[k] = deepMerge(out[k], v); });
  return out;
}

/**
 * Lê um arquivo exportado (ou só `{ config }`, ou a configuração "crua") e
 * devolve a configuração normalizada. O que faltar no arquivo vem de `base`
 * (o rascunho atual), para um arquivo parcial não zerar o resto. Vínculos
 * podem vir por `packageId` ou por `libraryItemName` (nome exato do item).
 */
export function parseAeConfigImport(text: string, library: AELibraryItem[], base: AEConfig): AEConfigImportResult {
  let data: any;
  try {
    data = JSON.parse(String(text || '').trim());
  } catch {
    return { ok: false, error: 'json' };
  }
  const raw = data && typeof data === 'object' && data.config && typeof data.config === 'object' ? data.config : data;
  if (!raw || typeof raw !== 'object' || !(raw.numbers || raw.formulas || raw.bindings || raw.settings)) return { ok: false, error: 'format' };

  const unknownItems: string[] = [];
  if (raw.bindings && typeof raw.bindings === 'object') {
    const byName = new Map(library.map((item) => [foldName(item.name), item.id]));
    raw.bindings = Object.fromEntries(Object.entries(raw.bindings).map(([path, b]: [string, any]) => {
      if (!b || typeof b !== 'object') return [path, b];
      if ((b.packageId == null || b.packageId === '') && b.libraryItemName) {
        const id = byName.get(foldName(b.libraryItemName));
        if (id == null) unknownItems.push(String(b.libraryItemName));
        return [path, { packageId: id ?? null, override: Boolean(b.override) }];
      }
      return [path, b];
    }));
  }
  const merged = {
    numbers: deepMerge(base.numbers, raw.numbers),
    formulas: { ...base.formulas, ...(raw.formulas || {}) },
    settings: deepMerge(base.settings, raw.settings),
    bindings: raw.bindings ? deepMerge(base.bindings || {}, raw.bindings) : base.bindings,
  };
  return { ok: true, config: normalizeAEConfig(merged), unknownItems };
}
