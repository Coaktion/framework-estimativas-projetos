/**
 * Medidor de horas do scoping (RF-32): simulação com o motor atual, SEM gravar.
 *
 * Usa só funções exportadas do motor (frameworkRules e estimateVersion, as
 * mesmas do simulate_estimate) e não altera nada nelas. Diferente do MCP, não
 * aplica os itens ocultos do editor de quem está usando: o scoping é isolado
 * do resto do Tool Center, e o total não pode mudar conforme a pessoa.
 */

import { estimateVersion, frameworkRules } from '@/lib/framework-estimate';
import type { FrameworkCatalog } from '@/lib/framework-catalog';
import type { MappedItem } from './mapping';

export type EstimateWarning =
  | { kind: 'not_found'; itemId: number; itemName: string }
  | { kind: 'module_off_plan'; module: string }
  | { kind: 'item_off_plan'; itemId: number; itemName: string }
  | { kind: 'dependency'; itemId: number; itemName: string; dependsOnItemId: number };

export interface ScopingEstimate {
  grandTotal: number;
  /** soma das linhas, antes de GP, Discovery e Validação */
  subtotal: number;
  bySkill: Record<string, number>;
  /** horas por item (só os que contaram) */
  itemHours: Record<number, number>;
  shares: { discovery: number; validation: number; gp: number };
  warnings: EstimateWarning[];
}

export interface EstimateContext {
  plan: string;
  sku: string;
  deploymentType: string;
}

const round1 = (n: number) => Math.round((Number(n) || 0) * 10) / 10;

export function simulateScopingEstimate(
  catalog: FrameworkCatalog,
  ctx: EstimateContext,
  items: Pick<MappedItem, 'itemId' | 'itemName' | 'quantity'>[],
): ScopingEstimate {
  const warnings: EstimateWarning[] = [];
  const data: Record<string, any> = {
    __skuType: ctx.sku === 'ES' ? 'ES' : 'CS',
    __planTier: ctx.plan || 'professional',
    __deploymentType: ctx.deploymentType === 'optimization' ? 'optimization' : 'new',
    marketplace_apps: '[]',
  };
  const rules = frameworkRules(catalog, data);
  const modules = new Set<string>();

  items.forEach((item) => {
    const pkg = rules.packageById[String(item.itemId)];
    if (!pkg) {
      warnings.push({ kind: 'not_found', itemId: item.itemId, itemName: item.itemName });
      return;
    }
    if (!(item.quantity > 0)) return;
    data[`item_${item.itemId}_qty`] = String(item.quantity);
    modules.add(rules.packageRootCategoryById[String(item.itemId)]);
  });

  modules.forEach((m) => {
    if (!m || !catalog.categories.includes(m)) return;
    data[`check_area_${m}`] = 'on';
    if (!rules.isCategoryOnPlan(m)) warnings.push({ kind: 'module_off_plan', module: catalog.categoryRecords?.[m]?.displayName || m });
  });

  const withData = frameworkRules(catalog, data);
  items.forEach((item) => {
    const pkg = withData.packageById[String(item.itemId)];
    if (!pkg || !data[`item_${item.itemId}_qty`]) return;
    if (!withData.isAvailable(pkg)) {
      warnings.push({ kind: 'item_off_plan', itemId: item.itemId, itemName: String(pkg.name || item.itemName).trim() });
    } else if (!withData.isPackageVisible(pkg)) {
      warnings.push({ kind: 'dependency', itemId: item.itemId, itemName: String(pkg.name || item.itemName).trim(), dependsOnItemId: Number(pkg.dependsOnItemId) });
    }
  });

  const totals = estimateVersion(catalog, { data }, { priceMode: 'current' });
  const itemHours: Record<number, number> = {};
  Object.entries(totals.itemTotals || {}).forEach(([id, h]) => { if (h > 0) itemHours[Number(id)] = round1(h); });

  return {
    grandTotal: round1(totals.grandTotal),
    subtotal: round1(totals.subtotal),
    bySkill: Object.fromEntries(Object.entries(totals.skillTotals).filter(([, v]) => v > 0).map(([k, v]) => [k, round1(v)])),
    itemHours,
    shares: { discovery: round1(totals.discVal), validation: round1(totals.validVal), gp: round1(totals.gpVal) },
    warnings,
  };
}
