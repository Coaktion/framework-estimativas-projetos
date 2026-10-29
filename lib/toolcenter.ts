/**
 * Operações do Tool Center expostas para integrações (MCP).
 *
 * Tudo aqui age COMO o usuário dono da chave e segue as mesmas regras da tela:
 *  - só quem acessa o editor de escopos (canAccessScopes) usa;
 *  - projeto visível = do próprio usuário ou não privado (igual à lista /sc);
 *  - versões são sempre CRIADAS — nada aqui altera ou apaga uma versão
 *    existente, um projeto ou o catálogo.
 *
 * O total de uma versão nova sai de lib/framework-estimate, o mesmo cálculo
 * que o editor faz, e o JSON gravado tem o formato que o editor lê.
 */

import { z } from 'zod';
import prisma from '@/lib/prisma';
import { canAccessScopes } from '@/lib/segments';
import { loadFrameworkCatalog, type FrameworkCatalog } from '@/lib/framework-catalog';
import {
  buildPriceSnapshot, customPackageKey, defaultPercents, estimateVersion, frameworkRules,
  parseCustomPackages, parseMarketplaceApps, safeJsonParse,
  MARKETPLACE_CATEGORY, REMOVED_CATEGORY,
} from '@/lib/framework-estimate';
import { SKILL_IMPL } from '@/lib/framework-calc';
import { ZENDESK_PLANS } from '@/lib/zendesk-plans';
import { nextVersionNumber, versionNameFor } from '@/lib/version-utils';
import type { ApiKeyUser } from '@/lib/api-keys';

export class ToolCenterError extends Error {
  constructor(message: string, readonly code: 'forbidden' | 'not_found' | 'invalid' = 'invalid') {
    super(message);
  }
}

export interface ToolCenterContext {
  user: ApiKeyUser;
  /** Origem pública do app (https://...), para devolver links do editor. */
  origin: string;
}

function assertCanUse(ctx: ToolCenterContext) {
  if (!canAccessScopes(ctx.user as any)) {
    throw new ToolCenterError('Seu usuário não tem acesso ao editor de escopos.', 'forbidden');
  }
}

const userId = (ctx: ToolCenterContext) => parseInt(ctx.user.id);

const visibleProjectsWhere = (ctx: ToolCenterContext) => ({
  OR: [{ ownerId: userId(ctx) }, { isPrivate: false }],
});

const editorUrl = (ctx: ToolCenterContext, projectId: number, versionId?: number) =>
  `${ctx.origin}/sc/project/${projectId}${versionId ? `?version_id=${versionId}` : ''}`;

async function findVisibleProject(ctx: ToolCenterContext, projectId: number) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...visibleProjectsWhere(ctx) },
    include: { owner: { select: { name: true, email: true } } },
  });
  if (!project) throw new ToolCenterError(`Projeto ${projectId} não encontrado (ou é privado de outra pessoa).`, 'not_found');
  return project;
}

const round1 = (n: number) => Math.round((Number(n) || 0) * 10) / 10;

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export const catalogInput = z.object({
  /** Filtra por nome/descrição do item (sem acento, sem caixa). */
  query: z.string().optional(),
  /** Só itens desta categoria raiz (nome interno, como devolvido em `modules`). */
  module: z.string().optional(),
  /** Inclui o texto de escopo incluído/excluído de cada item (mais longo). */
  includeScope: z.boolean().optional(),
});

const fold = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export async function getCatalog(ctx: ToolCenterContext, input: z.infer<typeof catalogInput>) {
  assertCanUse(ctx);
  const catalog = await loadFrameworkCatalog();
  const q = fold(input.query || '');

  const modules = catalog.categories.map((cat) => {
    const rec = catalog.categoryRecords[cat];
    return {
      module: cat,
      label: rec?.displayName || cat,
      implementationPhase: rec?.implementationPhase || 'SETUP',
      minPlanCS: rec?.minPlanCS || null,
      minPlanES: rec?.minPlanES || null,
      subcategories: (catalog.subcategoriesByCategory[cat] || []).map((s) => catalog.categoryRecords[s]?.displayName || s),
      itemCount: (catalog.packagesByCategory[cat] || []).length,
    };
  });

  const items = catalog.categories
    .filter((cat) => !input.module || cat === input.module)
    .flatMap((cat) => (catalog.packagesByCategory[cat] || []).map((p: any) => ({ cat, p })))
    .filter(({ p }) => !q || fold(`${p.name} ${p.nameEn} ${p.tooltip} ${p.scopeIncluded}`).includes(q))
    .map(({ cat, p }) => ({
      id: p.id,
      name: p.name,
      module: cat,
      subcategory: p.__subcategory ? (catalog.categoryRecords[p.__subcategory]?.displayName || p.__subcategory) : null,
      unitHours: Number(p.hours) || 0,
      skill: p.skillName || null,
      description: p.tooltip || null,
      ...(input.includeScope ? { scopeIncluded: p.scopeIncluded || null, scopeExcluded: p.scopeExcluded || null } : {}),
      minPlanCS: p.minPlanCS || null,
      minPlanES: p.minPlanES || null,
      dependsOnItemId: p.dependsOnItemId || null,
    }));

  return {
    plans: ZENDESK_PLANS,
    defaultPercents: defaultPercents(catalog.variables),
    rules: [
      'Um item só conta se o módulo dele estiver marcado (create_estimate_version marca sozinho os módulos dos itens enviados).',
      'Item com minPlanCS/minPlanES acima do plano do cliente não conta; módulo com mínimo acima do plano também não.',
      'Item com dependsOnItemId só conta se o item de que depende tiver quantidade.',
      'Horas = quantidade × unitHours, a não ser que se informe um total manual (hours).',
      'Discovery, Validação e GP são percentuais calculados sobre as horas (defaultPercents); com qualquer hora de Solution Design o Discovery percentual vale 0.',
    ],
    modules,
    items,
  };
}

// ---------------------------------------------------------------------------
// Projetos
// ---------------------------------------------------------------------------

export const searchProjectsInput = z.object({
  query: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export async function searchProjects(ctx: ToolCenterContext, input: z.infer<typeof searchProjectsInput>) {
  assertCanUse(ctx);
  const q = String(input.query || '').trim();
  const projects = await prisma.project.findMany({
    where: {
      ...visibleProjectsWhere(ctx),
      ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
    },
    include: {
      owner: { select: { name: true, email: true } },
      versions: { orderBy: { createdAt: 'desc' }, take: 1 },
      _count: { select: { versions: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: input.limit ?? 20,
  });
  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    owner: p.owner?.name || p.owner?.email,
    isPrivate: p.isPrivate,
    versionCount: p._count.versions,
    latestVersion: p.versions[0]
      ? {
          id: p.versions[0].id,
          name: p.versions[0].versionName,
          description: p.versions[0].description,
          totalHours: (p.versions[0] as any).totalHours ?? null,
          createdAt: p.versions[0].createdAt.toISOString(),
        }
      : null,
    url: editorUrl(ctx, p.id),
  }));
}

export const getProjectInput = z.object({ projectId: z.number().int() });

export async function getProject(ctx: ToolCenterContext, input: z.infer<typeof getProjectInput>) {
  assertCanUse(ctx);
  const project = await findVisibleProject(ctx, input.projectId);
  const versions = await prisma.projectVersion.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: 'desc' },
  });
  return {
    id: project.id,
    name: project.name,
    owner: project.owner?.name || project.owner?.email,
    isPrivate: project.isPrivate,
    url: editorUrl(ctx, project.id),
    versions: versions.map((v) => ({
      id: v.id,
      name: v.versionName,
      description: v.description,
      totalHours: (v as any).totalHours ?? null,
      technicalScopeLink: v.technicalScopeLink,
      zohoLink: v.zohoLink,
      createdAt: v.createdAt.toISOString(),
      url: editorUrl(ctx, project.id, v.id),
    })),
  };
}

export const createProjectInput = z.object({
  name: z.string().trim().min(1).max(120),
  isPrivate: z.boolean().optional(),
});

export async function createProject(ctx: ToolCenterContext, input: z.infer<typeof createProjectInput>) {
  assertCanUse(ctx);
  const project = await prisma.project.create({
    data: { name: input.name, isPrivate: Boolean(input.isPrivate), ownerId: userId(ctx), status: 'DRAFT' },
  });
  return { id: project.id, name: project.name, url: editorUrl(ctx, project.id) };
}

// ---------------------------------------------------------------------------
// Versões de estimativa
// ---------------------------------------------------------------------------

const percentsInput = z.object({
  gp: z.number().min(0).max(100).optional(),
  discovery: z.number().min(0).max(100).optional(),
  validation: z.number().min(0).max(100).optional(),
}).optional();

export const estimateInput = z.object({
  projectId: z.number().int(),
  /**
   * Título curto da versão (obrigatório, como na janela de salvar do editor).
   * Aparece no seletor de versões: detalhes do escopo vão no documento, não aqui.
   */
  description: z.string().trim().min(1).max(120),
  plan: z.enum(ZENDESK_PLANS).optional(),
  sku: z.enum(['CS', 'ES']).optional(),
  deploymentType: z.enum(['new', 'optimization']).optional(),
  items: z.array(z.object({
    id: z.number().int(),
    quantity: z.number().min(0),
    /** Total manual de horas da linha (substitui quantidade × horas). */
    hours: z.number().min(0).optional(),
  })).default([]),
  customItems: z.array(z.object({
    module: z.string(),
    name: z.string().trim().min(1),
    unitHours: z.number().min(0),
    quantity: z.number().min(0).default(1),
    skill: z.string().optional(),
    scopeIncluded: z.string().optional(),
    scopeExcluded: z.string().optional(),
  })).default([]),
  marketplaceApps: z.array(z.object({ name: z.string().trim().min(1), link: z.string().optional() })).default([]),
  /** Módulos a marcar mesmo sem itens (os dos itens enviados são marcados sozinhos). */
  modules: z.array(z.string()).default([]),
  percents: percentsInput,
  technicalScopeLink: z.string().optional(),
  zohoLink: z.string().optional(),
  /** true = só calcula e devolve o resultado, sem gravar nada. */
  dryRun: z.boolean().optional(),
});

type EstimateInput = z.infer<typeof estimateInput>;

/** Monta o JSON `data` da versão no formato do editor e lista o que não vai contar. */
function buildVersionData(catalog: FrameworkCatalog, input: EstimateInput) {
  const warnings: string[] = [];
  const data: Record<string, any> = {
    __skuType: input.sku ?? 'CS',
    __planTier: input.plan ?? 'professional',
    __deploymentType: input.deploymentType ?? 'new',
  };
  const rules = frameworkRules(catalog, data);
  const seen = new Set<number>();
  const modules = new Set<string>(input.modules);

  for (const item of input.items) {
    if (seen.has(item.id)) {
      warnings.push(`Item ${item.id} veio mais de uma vez; vale a primeira ocorrência.`);
      continue;
    }
    seen.add(item.id);
    const pkg = rules.packageById[String(item.id)];
    if (!pkg) {
      warnings.push(`Item ${item.id} não existe no catálogo ativo e foi ignorado.`);
      continue;
    }
    if (item.quantity <= 0 && item.hours === undefined) continue;
    data[`item_${item.id}_qty`] = String(item.quantity);
    if (item.hours !== undefined) {
      data[`item_override_check_${item.id}`] = 'on';
      data[`item_override_val_${item.id}`] = String(item.hours);
    }
    modules.add(rules.packageRootCategoryById[String(item.id)]);
  }

  input.customItems.forEach((c, i) => {
    if (!catalog.categories.includes(c.module)) {
      warnings.push(`Item personalizado "${c.name}": módulo "${c.module}" não existe e o item foi ignorado.`);
      return;
    }
    const index = Date.now() + i;
    const set = (field: string, value: unknown) => { data[customPackageKey(c.module, index, field)] = value; };
    set('name', c.name);
    set('hours', c.unitHours);
    set('qty', c.quantity);
    set('skill', c.skill || SKILL_IMPL);
    set('scopeIn', c.scopeIncluded || '');
    set('scopeOut', c.scopeExcluded || '');
    set('overrideCheck', 'off');
    set('overrideVal', '');
    modules.add(c.module);
  });

  if (input.marketplaceApps.length) {
    data.marketplace_apps = JSON.stringify(
      input.marketplaceApps.map((a, i) => ({ id: Date.now() + i, name: a.name, link: a.link || '' })),
    );
    modules.add(MARKETPLACE_CATEGORY);
  } else {
    data.marketplace_apps = '[]';
  }

  modules.forEach((m) => {
    if (!m) return;
    if (!catalog.categories.includes(m)) {
      warnings.push(`Módulo "${m}" não existe e foi ignorado.`);
      return;
    }
    data[`check_area_${m}`] = 'on';
    if (!rules.isCategoryOnPlan(m)) warnings.push(`Módulo "${m}" não está disponível no plano ${data.__planTier} (${data.__skuType}): nada nele conta.`);
  });

  // O que foi enviado mas não vai contar (plano ou dependência).
  const rulesWithData = frameworkRules(catalog, data);
  seen.forEach((id) => {
    const pkg = rulesWithData.packageById[String(id)];
    if (!pkg || !data[`item_${id}_qty`]) return;
    if (!rulesWithData.isAvailable(pkg)) {
      warnings.push(`Item ${id} (${pkg.name}) não está disponível no plano ${data.__planTier} (${data.__skuType}) e não conta.`);
    } else if (!rulesWithData.isPackageVisible(pkg)) {
      warnings.push(`Item ${id} (${pkg.name}) depende do item ${pkg.dependsOnItemId}, que não tem quantidade, e não conta.`);
    }
  });

  return { data, warnings };
}

/** Itens que o usuário escondeu no editor: lá eles não contam, então aqui também não. */
async function hiddenItemsOf(ctx: ToolCenterContext): Promise<number[]> {
  const pref = await prisma.userPreference.findUnique({ where: { userId: userId(ctx) } }).catch(() => null);
  const raw = safeJsonParse<any>(pref?.hiddenItems, []);
  return Array.isArray(raw) ? raw.map(Number).filter(Number.isFinite) : [];
}

/** Resumo legível de uma estimativa: totais por skill e por módulo, e as linhas. */
function summarize(catalog: FrameworkCatalog, totals: ReturnType<typeof estimateVersion>) {
  const label = (cat: string) =>
    cat === REMOVED_CATEGORY ? 'Itens fora da biblioteca atual' : (catalog.categoryRecords[cat]?.displayName || cat);
  return {
    grandTotal: totals.grandTotal,
    bySkill: Object.fromEntries(Object.entries(totals.skillTotals).filter(([, v]) => v > 0)),
    byModule: Object.entries(totals.catTotals)
      .map(([module, hours]) => ({ module, label: label(module), itemHours: round1(hours) }))
      .sort((a, b) => b.itemHours - a.itemHours),
    variables: {
      discovery: totals.discVal,
      validation: totals.validVal,
      gp: totals.gpVal,
      drn: totals.drnVal,
      discoveryMode: totals.discoveryMode,
    },
    lines: totals.lines.map((l) => ({
      ...(l.packageId != null ? { itemId: l.packageId } : {}),
      kind: l.kind,
      name: l.label,
      module: label(l.category),
      quantity: l.quantity,
      unitHours: l.unitHours,
      hours: round1(l.hours),
      skill: l.skill,
    })),
  };
}

export async function createEstimateVersion(ctx: ToolCenterContext, input: EstimateInput) {
  assertCanUse(ctx);
  const project = await findVisibleProject(ctx, input.projectId);
  const catalog = await loadFrameworkCatalog();
  const hiddenIds = await hiddenItemsOf(ctx);

  const { data, warnings } = buildVersionData(catalog, input);
  hiddenIds.forEach((id) => {
    if (data[`item_${id}_qty`]) {
      warnings.push(`Item ${id} está oculto no seu editor e não conta (no editor ele também não apareceria). Mostre o item no editor ou remova-o da estimativa.`);
      delete data[`item_${id}_qty`];
      delete data[`item_override_check_${id}`];
      delete data[`item_override_val_${id}`];
    }
  });
  data.__priceSnapshot = buildPriceSnapshot(catalog, data);

  const defaults = defaultPercents(catalog.variables);
  const version = {
    data,
    gpPercent: input.percents?.gp ?? defaults.gp,
    discoveryPercent: input.percents?.discovery ?? defaults.discovery,
    validationPercent: input.percents?.validation ?? defaults.validation,
    gpOverride: null,
    discoveryOverride: null,
    validationOverride: null,
  };
  const totals = estimateVersion(catalog, version, { hiddenIds, priceMode: 'current' });
  const summary = summarize(catalog, totals);

  if (input.dryRun) {
    return { saved: false, project: { id: project.id, name: project.name }, warnings, ...summary };
  }

  const existing = await prisma.projectVersion.findMany({ where: { projectId: project.id }, select: { versionName: true } });
  const created = await prisma.projectVersion.create({
    data: {
      projectId: project.id,
      versionName: versionNameFor(nextVersionNumber(existing.map((v) => v.versionName))),
      description: input.description,
      data: JSON.stringify(data),
      technicalScopeLink: input.technicalScopeLink || null,
      zohoLink: input.zohoLink || null,
      gpPercent: version.gpPercent,
      discoveryPercent: version.discoveryPercent,
      validationPercent: version.validationPercent,
      safetyHours: null,
      totalHours: totals.grandTotal,
      createdBy: userId(ctx),
    },
  });
  await prisma.project.update({ where: { id: project.id }, data: { updatedAt: new Date() } });

  return {
    saved: true,
    project: { id: project.id, name: project.name },
    version: { id: created.id, name: created.versionName, url: editorUrl(ctx, project.id, created.id) },
    warnings,
    ...summary,
  };
}

export const getVersionInput = z.object({ versionId: z.number().int() });

export async function getVersion(ctx: ToolCenterContext, input: z.infer<typeof getVersionInput>) {
  assertCanUse(ctx);
  const version = await prisma.projectVersion.findUnique({ where: { id: input.versionId } });
  if (!version) throw new ToolCenterError(`Versão ${input.versionId} não encontrada.`, 'not_found');
  const project = await findVisibleProject(ctx, version.projectId);
  const catalog = await loadFrameworkCatalog();
  const data = safeJsonParse<Record<string, any>>(version.data, {});
  const totals = estimateVersion(catalog, version);
  return {
    project: { id: project.id, name: project.name },
    version: {
      id: version.id,
      name: version.versionName,
      description: version.description,
      savedTotalHours: (version as any).totalHours ?? null,
      plan: data.__planTier ?? null,
      sku: data.__skuType ?? null,
      deploymentType: data.__deploymentType ?? null,
      technicalScopeLink: version.technicalScopeLink,
      zohoLink: version.zohoLink,
      createdAt: version.createdAt.toISOString(),
      url: editorUrl(ctx, project.id, version.id),
    },
    customItems: parseCustomPackages(data).map((c) => ({ module: c.category, name: c.name, scopeIncluded: c.scopeIn || null, scopeExcluded: c.scopeOut || null })),
    marketplaceApps: parseMarketplaceApps(data).map((a: any) => a?.name).filter(Boolean),
    ...summarize(catalog, totals),
  };
}
