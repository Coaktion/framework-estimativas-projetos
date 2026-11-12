/**
 * Atalhos do editor de estimativas (Treinamento, Workshop, Go-live e os que o
 * admin criar em Admin › Biblioteca › Atalhos).
 *
 * Um atalho é um botão no editor. Ligado, ele preenche itens da biblioteca
 * conforme as REGRAS dele, e acompanha a estimativa enquanto ela muda:
 *
 *   regra = item a preencher + quantidade + condições
 *   condições = grupos ligados por OU; dentro de cada grupo, tudo por E
 *               (ex.: [B e C] OU [B e D] OU [E]); sem grupos = sempre.
 *
 * Tipos de condição: módulo selecionado, módulo com horas, item com
 * quantidade, subcategoria com horas, tipo de projeto (nova implantação ×
 * otimização), plano Zendesk e SKU. Qualquer condição pode ser negada.
 *
 * O atalho só mexe no que ele mesmo preencheu: o mapa `__shortcut_applied_<key>`
 * nos dados da versão guarda o que foi colocado, e desligar (ou a condição
 * deixar de valer) só apaga a quantidade se ela ainda for a que o atalho pôs.
 * Quantidade digitada à mão nunca é desfeita.
 *
 * Funções puras: rodam no editor e nos testes.
 */

import { isCategoryAvailable, isPackageAvailable, normalizePlanTier, normalizeSkuType, ZENDESK_PLANS, type ZendeskPlanTier } from './zendesk-plans';

export type ShortcutCondition =
  | { type: 'module'; category: string; mode: 'selected' | 'hours'; negate?: boolean }
  | { type: 'item'; itemId: number; negate?: boolean }
  | { type: 'subcategory'; category: string; negate?: boolean }
  | { type: 'deployment'; value: 'new' | 'optimization'; negate?: boolean }
  | { type: 'plan'; values: ZendeskPlanTier[]; negate?: boolean }
  | { type: 'sku'; value: 'CS' | 'ES'; negate?: boolean };

export interface ShortcutRule {
  itemId: number;
  quantity: number;
  /** OU entre grupos; E dentro do grupo. Vazio = sempre. */
  groups: ShortcutCondition[][];
}

export interface EditorShortcut {
  id: number;
  key: string;
  name: string;
  nameEn: string;
  nameEs: string;
  description: string;
  isActive: boolean;
  displayOrder: number;
  rules: ShortcutRule[];
}

export const SHORTCUT_FLAG_PREFIX = '__shortcut_';
export const SHORTCUT_APPLIED_PREFIX = '__shortcut_applied_';
export const shortcutFlagKey = (key: string) => `${SHORTCUT_FLAG_PREFIX}${key}`;
export const shortcutAppliedKey = (key: string) => `${SHORTCUT_APPLIED_PREFIX}${key}`;

const CONDITION_TYPES = ['module', 'item', 'subcategory', 'deployment', 'plan', 'sku'] as const;

function cleanCondition(raw: any): ShortcutCondition | null {
  const type = String(raw?.type || '');
  if (!(CONDITION_TYPES as readonly string[]).includes(type)) return null;
  const negate = Boolean(raw?.negate) || undefined;
  switch (type) {
    case 'module': {
      const category = String(raw?.category || '').trim();
      return category ? { type, category, mode: raw?.mode === 'hours' ? 'hours' : 'selected', negate } : null;
    }
    case 'item': {
      const itemId = Number(raw?.itemId);
      return Number.isInteger(itemId) && itemId > 0 ? { type, itemId, negate } : null;
    }
    case 'subcategory': {
      const category = String(raw?.category || '').trim();
      return category ? { type, category, negate } : null;
    }
    case 'deployment':
      return { type, value: raw?.value === 'optimization' ? 'optimization' : 'new', negate };
    case 'plan': {
      const values = (Array.isArray(raw?.values) ? raw.values : [])
        .map((v: unknown) => String(v).toLowerCase())
        .filter((v: string) => (ZENDESK_PLANS as readonly string[]).includes(v)) as ZendeskPlanTier[];
      return values.length ? { type, values: Array.from(new Set(values)), negate } : null;
    }
    case 'sku':
      return { type, value: String(raw?.value).toUpperCase() === 'ES' ? 'ES' : 'CS', negate };
    default:
      return null;
  }
}

export function normalizeRules(raw: unknown): ShortcutRule[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((r: any) => {
      const itemId = Number(r?.itemId);
      if (!Number.isInteger(itemId) || itemId <= 0) return null;
      const quantity = Math.max(0, Math.round((Number(r?.quantity) || 0) * 100) / 100) || 1;
      const groups = (Array.isArray(r?.groups) ? r.groups : [])
        .map((g: any) => (Array.isArray(g) ? g : []).map(cleanCondition).filter(Boolean) as ShortcutCondition[])
        .filter((g: ShortcutCondition[]) => g.length > 0);
      return { itemId, quantity, groups };
    })
    .filter(Boolean)
    .slice(0, 500) as ShortcutRule[];
}

export function normalizeShortcutKey(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
}

/** Catálogo como o avaliador precisa enxergar. */
export interface ShortcutCatalog {
  categories: string[];
  categoryRecords: Record<string, { parentName?: string | null; minPlanCS?: string; minPlanES?: string; implementationPhase?: string }>;
  packagesByCategory: Record<string, any[]>;
}

interface Index {
  packageById: Map<number, any>;
  rootOf: Map<number, string>;
}

function indexCatalog(catalog: ShortcutCatalog): Index {
  const packageById = new Map<number, any>();
  const rootOf = new Map<number, string>();
  Object.entries(catalog.packagesByCategory || {}).forEach(([root, pkgs]) => {
    (pkgs || []).forEach((p: any) => {
      packageById.set(Number(p.id), p);
      rootOf.set(Number(p.id), root);
    });
  });
  return { packageById, rootOf };
}

const qtyOf = (data: Record<string, any>, id: number) => parseFloat(data?.[`item_${id}_qty`] || 0) || 0;

/** A condição vale nestes dados? */
export function conditionHolds(cond: ShortcutCondition, data: Record<string, any>, catalog: ShortcutCatalog, idx: Index): boolean {
  const sku = normalizeSkuType(data?.__skuType);
  const plan = normalizePlanTier(data?.__planTier);
  let ok = false;
  switch (cond.type) {
    case 'module': {
      const selected = data?.[`check_area_${cond.category}`] === 'on';
      if (cond.mode === 'selected') ok = selected;
      else ok = selected && (catalog.packagesByCategory[cond.category] || []).some((p: any) => qtyOf(data, Number(p.id)) > 0);
      break;
    }
    case 'item':
      ok = qtyOf(data, cond.itemId) > 0 && data?.[`check_area_${idx.rootOf.get(cond.itemId)}`] === 'on';
      break;
    case 'subcategory': {
      ok = Object.entries(catalog.packagesByCategory || {}).some(([root, pkgs]) =>
        data?.[`check_area_${root}`] === 'on'
        && (pkgs || []).some((p: any) => String(p.__subcategory || '') === cond.category && qtyOf(data, Number(p.id)) > 0));
      break;
    }
    case 'deployment':
      ok = (data?.__deploymentType === 'optimization' ? 'optimization' : 'new') === cond.value;
      break;
    case 'plan':
      ok = cond.values.includes(plan);
      break;
    case 'sku':
      ok = sku === cond.value;
      break;
  }
  return cond.negate ? !ok : ok;
}

export function ruleTriggered(rule: ShortcutRule, data: Record<string, any>, catalog: ShortcutCatalog, idx: Index): boolean {
  if (!rule.groups.length) return true;
  return rule.groups.some((group) => group.every((cond) => conditionHolds(cond, data, catalog, idx)));
}

function parseApplied(raw: unknown): Record<string, number> {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, number> = {};
    Object.entries(parsed as Record<string, unknown>).forEach(([k, v]) => {
      const n = Number(v);
      if (Number.isFinite(n)) out[k] = n;
    });
    return out;
  } catch {
    return {};
  }
}

export interface ReconcileOptions {
  hiddenIds?: number[];
}

/**
 * Aplica os atalhos ligados aos dados da versão: preenche o que passou a
 * valer, desfaz (se intocado) o que deixou de valer. Repete até estabilizar,
 * porque um item preenchido por um atalho pode ser condição de outro.
 */
export function reconcileShortcuts(
  data: Record<string, any>,
  shortcuts: EditorShortcut[],
  catalog: ShortcutCatalog,
  opts: ReconcileOptions = {},
): Record<string, any> {
  const idx = indexCatalog(catalog);
  const hidden = new Set((opts.hiddenIds || []).map(Number));
  let next = { ...data };
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const sc of shortcuts) {
      if (!sc.isActive || next[shortcutFlagKey(sc.key)] !== 'on') continue;
      const applied = parseApplied(next[shortcutAppliedKey(sc.key)]);
      const desired: Record<string, number> = {};
      const sku = normalizeSkuType(next.__skuType);
      const plan = normalizePlanTier(next.__planTier);
      sc.rules.forEach((rule) => {
        const pkg = idx.packageById.get(rule.itemId);
        if (!pkg || hidden.has(rule.itemId)) return;
        // Item oculto ou fora do plano não conta hora — o atalho não mexe nele.
        if (!isPackageAvailable(pkg, sku, plan)) return;
        const root = idx.rootOf.get(rule.itemId);
        const record = root ? catalog.categoryRecords?.[root] : null;
        if (record && !isCategoryAvailable(record as any, sku, plan)) return;
        if (!ruleTriggered(rule, next, catalog, idx)) return;
        desired[String(rule.itemId)] = Math.max(desired[String(rule.itemId)] || 0, rule.quantity);
      });
      const nextApplied: Record<string, number> = {};
      // Preenche o que vale agora.
      Object.entries(desired).forEach(([id, qty]) => {
        const key = `item_${id}_qty`;
        const current = parseFloat(next[key] || 0) || 0;
        const root = idx.rootOf.get(Number(id));
        if (current < qty) {
          next[key] = String(qty);
          changed = true;
          nextApplied[id] = qty;
        } else if (applied[id] !== undefined && current === applied[id]) {
          nextApplied[id] = current; // continua sendo o valor do atalho
        }
        if (root && next[`check_area_${root}`] !== 'on') {
          next[`check_area_${root}`] = 'on';
          changed = true;
        }
      });
      // Desfaz o que deixou de valer (só se ninguém mexeu na quantidade).
      Object.entries(applied).forEach(([id, qty]) => {
        if (desired[id] !== undefined) return;
        const key = `item_${id}_qty`;
        if ((parseFloat(next[key] || 0) || 0) === qty) {
          delete next[key];
          changed = true;
        }
      });
      const serialized = Object.keys(nextApplied).length ? JSON.stringify(nextApplied) : undefined;
      if (serialized !== next[shortcutAppliedKey(sc.key)]) {
        if (serialized) next[shortcutAppliedKey(sc.key)] = serialized;
        else delete next[shortcutAppliedKey(sc.key)];
        changed = true;
      }
    }
    if (!changed) break;
  }
  return next;
}

/** Desliga um atalho: apaga o que ele preencheu (se intocado), a marca e o mapa. */
export function turnOffShortcut(data: Record<string, any>, shortcut: EditorShortcut): Record<string, any> {
  const next = { ...data };
  const applied = parseApplied(next[shortcutAppliedKey(shortcut.key)]);
  Object.entries(applied).forEach(([id, qty]) => {
    const key = `item_${id}_qty`;
    if ((parseFloat(next[key] || 0) || 0) === qty) delete next[key];
  });
  delete next[shortcutAppliedKey(shortcut.key)];
  delete next[shortcutFlagKey(shortcut.key)];
  return next;
}

/** Quantos itens o atalho está preenchendo agora. */
export function appliedCount(data: Record<string, any>, shortcut: EditorShortcut): number {
  return Object.keys(parseApplied(data?.[shortcutAppliedKey(shortcut.key)])).length;
}

/**
 * Atalhos de fábrica, a partir dos campos antigos da biblioteca:
 *  - Treinamento / Workshop: itens das categorias dessas fases, cada um
 *    ligado ao módulo do campo "Atalho: módulo vinculado" (moduleLink),
 *    preenchidos com 1 quando o módulo está selecionado;
 *  - Go-live: itens da fase Go-Live com quantidade de atalho > 0, sempre.
 * As chaves (training, workshop, golive) são as das marcas que as versões
 * antigas já gravaram (__shortcut_training etc.).
 */
export function legacyShortcuts(catalog: ShortcutCatalog): Array<Omit<EditorShortcut, 'id'>> {
  const phaseOf = (root: string) => String(catalog.categoryRecords?.[root]?.implementationPhase || 'SETUP').toUpperCase();
  const rulesFor = (phase: string): ShortcutRule[] => {
    const out: ShortcutRule[] = [];
    Object.entries(catalog.packagesByCategory || {}).forEach(([root, pkgs]) => {
      if (phaseOf(root) !== phase) return;
      (pkgs || []).forEach((p: any) => {
        if (phase === 'GOLIVE') {
          const qty = Math.round(Number(p.goLiveShortcutQty) || 0);
          if (qty > 0) out.push({ itemId: Number(p.id), quantity: qty, groups: [] });
        } else if (String(p.moduleLink || '').trim()) {
          out.push({ itemId: Number(p.id), quantity: 1, groups: [[{ type: 'module', category: String(p.moduleLink), mode: 'selected' }]] });
        }
      });
    });
    return out;
  };
  return [
    { key: 'training', name: 'Treinamento', nameEn: 'Training', nameEs: 'Capacitación', description: '', isActive: true, displayOrder: 0, rules: rulesFor('TRAINING') },
    { key: 'workshop', name: 'Workshop', nameEn: 'Workshop', nameEs: 'Workshop', description: '', isActive: true, displayOrder: 1, rules: rulesFor('WORKSHOP') },
    { key: 'golive', name: 'Go-live', nameEn: 'Go-live', nameEs: 'Go-live', description: '', isActive: true, displayOrder: 2, rules: rulesFor('GOLIVE') },
  ];
}

export function shortcutName(sc: Pick<EditorShortcut, 'name' | 'nameEn' | 'nameEs'>, language: string): string {
  if (language === 'en' && sc.nameEn.trim()) return sc.nameEn;
  if (language === 'es' && sc.nameEs.trim()) return sc.nameEs;
  return sc.name;
}
