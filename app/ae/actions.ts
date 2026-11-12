'use server';

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerT } from "@/app/i18n/server";

/**
 * Erro de salvamento com detalhes suficientes para o usuário reportar.
 *
 * O save DEVOLVE o erro em vez de lançá-lo: em produção o Next.js troca a
 * mensagem de um erro lançado numa server action por um texto genérico, e a
 * tela acabava dizendo "registro salvo" sem ter salvo nada.
 */
export interface AESaveError {
  /** Mensagem legível (já traduzida quando possível). */
  message: string;
  /** Código técnico (ex.: P2003 do Prisma), quando houver. */
  code?: string;
  /** Texto técnico original. */
  details?: string;
  /** Etapa em que falhou: auth, validation, version, create. */
  step: string;
  /** Momento do erro (ISO), para cruzar com os logs. */
  at: string;
}

export type AESaveResult =
  | { ok: true; id: number; version: number }
  | { ok: false; error: AESaveError };

function saveError(step: string, message: string, raw?: any): { ok: false; error: AESaveError } {
  return {
    ok: false,
    error: {
      message,
      code: raw?.code ? String(raw.code) : undefined,
      details: raw ? String(raw?.message || raw).slice(0, 2000) : undefined,
      step,
      at: new Date().toISOString(),
    },
  };
}

export async function saveAEEstimateAction(formData: any): Promise<AESaveResult> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return saveError('auth', getServerT()('errors.notAuthenticated'));
  }

  const {
    clientName,
    zohoLink,
    clientObjectives,
    successIndicators,
    selectedModules,
    knowledgeArticles,
    operationTypes,
    skuType,
    deploymentType,
    selectedApps,
    appQuantities,
    otherApp,
    zendeskPlan,
    selectedNativeConnections,
    selectedActionFlows,
    agents,
    brands,
    channels,
    channelQuantities,
    areas,
    hasSSO,
    hasTeamsSideConv,
    hasSlackSideConv,
    hasAppCondicionais,
    hasAppTicketManager,
    resultHours,
    needsSC,
    engineInputs,
    parentId,
    version: forcedVersion,
    aeConfigId,
    aeNumbers,
  } = formData;

  if (!String(clientName || '').trim()) {
    return saveError('validation', getServerT()('errors.aeClientNameRequired'));
  }

  const userId = parseInt(session.user.id);
  const userSession = session.user as any;
  const isAdmin = Boolean(userSession.isAdmin) || (userSession.role && String(userSession.role).toUpperCase() === 'ADMIN');
  const filterCreatedBy = isAdmin ? {} : { createdBy: userId };
 
  let detectedLastVersion: number = 0;
  try {
    const lastVersionEstimate: any = await prisma.aEEstimate.findFirst({
      where: { clientName, ...filterCreatedBy },
      orderBy: { version: 'desc' } as any,
      select: { version: true, id: true } as any,
    });
    if (lastVersionEstimate && typeof lastVersionEstimate.version === 'number') {
      detectedLastVersion = lastVersionEstimate.version;
    } else {
      // tabela já pode não lançar erro mas ainda não ter coluna versão
      // (null). Fallback abaixo para id.
      detectedLastVersion = 0;
    }
  } catch (_) {
    try {
      const fallbackRows = await prisma.aEEstimate.findMany({
        where: { clientName, ...filterCreatedBy },
        orderBy: { id: 'desc' },
        take: 500,
        select: { id: true, version: true } as any,
      });
      const maxByVersion = fallbackRows
        .filter(r => typeof (r as any).version === 'number')
        .reduce((m: number, r: any) => Math.max(m, r.version as number), 0);
      if (maxByVersion > 0) {
        detectedLastVersion = maxByVersion;
      } else {
        // fallback final: qtd de estimativas já salvas
        detectedLastVersion = fallbackRows.length;
      }
    } catch (__) {
      detectedLastVersion = 0;
    }
  }

  let version: number = forcedVersion ? Math.max(1, parseInt(forcedVersion)) : 0;
  if (!version) {
    version = Math.max(1, detectedLastVersion + 1);
  }

  let parentVersionId = parentId ? parseInt(parentId) : null;
  // A estimativa "pai" tem que ser do próprio usuário: o id vem do cliente.
  if (parentVersionId) {
    const parent = await prisma.aEEstimate.findFirst({
      where: { id: parentVersionId, createdBy: userId },
      select: { id: true },
    });
    if (!parent) parentVersionId = null;
  }

  const baseData = {
    clientName,
    zohoLink,
    data: JSON.stringify({
      clientObjectives,
      successIndicators,
      selectedModules,
      knowledgeArticles,
      operationTypes,
      skuType,
      deploymentType,
      selectedApps,
      appQuantities,
      otherApp,
      zendeskPlan,
      selectedNativeConnections,
      selectedActionFlows,
      agents,
      brands,
      channels,
      channelQuantities,
      areas,
      hasSSO,
      hasTeamsSideConv,
      hasSlackSideConv,
      hasAppCondicionais,
      hasAppTicketManager,
        engineInputs,
      // Versão da configuração da Calculadora (painel Admin) usada no cálculo:
      // a estimativa reabre com exatamente o mesmo cálculo.
      aeConfigId: aeConfigId ?? null,
      // Retrato das horas efetivas do cálculo (biblioteca + ajustes manuais).
      aeNumbers: aeNumbers && typeof aeNumbers === 'object' ? aeNumbers : null,
    }),
    resultHours,
    needsSC,
    createdBy: userId,
  };

  // Uma única tentativa: o antigo "tenta de novo sem version/parentId"
  // engolia qualquer erro (ex.: parentId inválido) e gravava a estimativa
  // como V1 sem vínculo, sem avisar ninguém.
  let estimate: any = null;
  try {
    estimate = await prisma.aEEstimate.create({
      data: {
        ...baseData,
        version,
        parentId: parentVersionId,
      } as any,
    });
  } catch (e: any) {
    console.error('[ae] erro ao salvar estimativa:', e);
    return saveError('create', getServerT()('errors.aeSaveFailed'), e);
  }

  revalidatePath('/ae');
  revalidatePath('/ae/history');

  return { ok: true, id: estimate.id, version: estimate.version ?? version };
}

/* -------------------------------------------------------------------------- */
/*              CALCULADORA AE → ESTIMATIVA DO FRAMEWORK (SE e admin)         */
/* -------------------------------------------------------------------------- */

export type AEToEstimateTarget =
  | { mode: 'new'; name: string }
  | { mode: 'existing'; projectId: number };

/**
 * Cria uma estimativa do Framework com as quantidades que a Calculadora AE
 * deu (arredondadas, ,5 para cima): um projeto novo com V1, ou uma versão nova
 * num projeto que o usuário já enxerga. A versão é gravada pelo mesmo caminho
 * da integração do Tool Center (lib/toolcenter.ts), então o total e o retrato
 * de preços saem iguais aos do editor.
 */
export async function createEstimateFromAEAction(estimateId: number, target: AEToEstimateTarget) {
  const session: any = await getServerSession(authOptions);
  const user = session?.user;
  const { canUseSeTools, canAccessScopes } = await import('@/lib/segments');
  if (!user || !canUseSeTools(user) || !canAccessScopes(user)) {
    return { ok: false as const, error: getServerT()('errors.notAuthorized') };
  }
  try {
    const estimate = await prisma.aEEstimate.findUnique({ where: { id: Number(estimateId) } });
    const isAdmin = Boolean(user.isAdmin);
    if (!estimate || (estimate as any).deletedAt || (!isAdmin && Number(estimate.createdBy) !== Number(user.id))) {
      return { ok: false as const, error: getServerT()('aeView.notFoundOrNoPermission') };
    }

    const { getAeConfigById, getAeLibrary } = await import('@/lib/ae-config-server');
    const { normalizeAEConfig, resolveAEConfig } = await import('@/lib/ae-config');
    const { buildEngineInputs } = await import('@/lib/ae-inputs');
    const { calculateAEEstimate } = await import('@/lib/ae-engine');
    const { aeToFrameworkItems } = await import('@/lib/ae-to-framework');
    const { createProject, createEstimateVersion } = await import('@/lib/toolcenter');

    let data: any = {};
    try { data = JSON.parse(estimate.data); } catch { data = {}; }
    // Mesma configuração com que a estimativa foi calculada (ver /ae/[id]).
    const used = await getAeConfigById(data?.aeConfigId);
    const library = await getAeLibrary();
    const snapshot = data?.aeNumbers && typeof data.aeNumbers === 'object' ? data.aeNumbers : null;
    const config = snapshot?.numbers
      ? { ...used.config, numbers: normalizeAEConfig({ numbers: snapshot.numbers }).numbers, nativeIntegrationHours: snapshot.nativeIntegrationHours || undefined }
      : resolveAEConfig(used.config, library);
    const inputs = buildEngineInputs(data);
    const result = calculateAEEstimate(inputs, config);
    const mapped = aeToFrameworkItems({ estimate: result, inputs, config, library, deploymentType: data?.deploymentType });

    const origin = (process.env.NEXTAUTH_URL || process.env.URL || '').replace(/\/+$/, '');
    const ctx = { user: { id: String(user.id), email: String(user.email || ''), name: user.name || null, role: String(user.role || ''), isAdmin, apiKeyId: 0 }, origin };
    const projectId = target.mode === 'new'
      ? (await createProject(ctx, { name: String(target.name || estimate.clientName).trim().slice(0, 120) || estimate.clientName })).id
      : Number(target.projectId);

    const version = estimate.version ?? 1;
    const created = await createEstimateVersion(ctx, {
      projectId,
      description: `${getServerT()('aeView.fromCalculatorDescription', { version, id: estimate.id })}`.slice(0, 120),
      plan: mapped.plan,
      sku: mapped.sku,
      deploymentType: mapped.deploymentType,
      items: mapped.items.map((i) => ({ id: i.id, quantity: i.quantity })),
      customItems: [],
      marketplaceApps: [],
      modules: [],
      zohoLink: estimate.zohoLink || undefined,
    } as any);
    revalidatePath('/sc');
    return {
      ok: true as const,
      projectId,
      versionId: created.version.id,
      url: `/sc/project/${projectId}?version_id=${created.version.id}`,
      itemCount: mapped.items.length,
      unmapped: mapped.unmapped,
      warnings: created.warnings,
      totalHours: created.grandTotal,
    };
  } catch (e: any) {
    console.error('[ae→estimate]', e);
    return { ok: false as const, error: String(e?.message || e) };
  }
}

/** Projetos que o usuário enxerga (seus ou públicos), para escolher onde criar a versão. */
export async function listProjectsForAEAction(query: string) {
  const session: any = await getServerSession(authOptions);
  const user = session?.user;
  const { canUseSeTools, canAccessScopes } = await import('@/lib/segments');
  if (!user || !canUseSeTools(user) || !canAccessScopes(user)) return [];
  const q = String(query || '').trim();
  const where: any = user.isAdmin ? {} : { OR: [{ ownerId: Number(user.id) }, { isPrivate: false }] };
  const rows = await prisma.project.findMany({
    where: { ...where, deletedAt: null, ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}) },
    select: { id: true, name: true, owner: { select: { name: true } }, _count: { select: { versions: { where: { deletedAt: null } } } } },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  });
  return rows.map((r: any) => ({ id: r.id, name: r.name, owner: r.owner?.name || '', versions: r._count.versions }));
}

/**
 * Exclui estimativas da Calculadora SÓ NA TELA (uma versão, ou todas as versões
 * de um cliente no histórico). Continuam no banco; um admin vê e restaura em
 * Admin › Estimativas excluídas. Pode excluir: quem criou a versão, ou admin.
 */
export async function deleteAEEstimatesAction(ids: number[]) {
  const session: any = await getServerSession(authOptions);
  const user = session?.user;
  if (!user?.id) return { ok: false as const, error: getServerT()('errors.notAuthorized') };
  const wanted = Array.from(new Set((ids || []).map(Number).filter((n) => Number.isInteger(n) && n > 0)));
  if (!wanted.length) return { ok: true as const, count: 0 };
  const rows = await prisma.aEEstimate.findMany({ where: { id: { in: wanted }, deletedAt: null }, select: { id: true, createdBy: true } });
  const isAdmin = Boolean(user.isAdmin);
  if (rows.some((row) => !isAdmin && Number(row.createdBy) !== Number(user.id))) {
    return { ok: false as const, error: getServerT()('errors.notAuthorized') };
  }
  const result = await prisma.aEEstimate.updateMany({
    where: { id: { in: rows.map((row) => row.id) } },
    data: { deletedAt: new Date(), deletedBy: Number(user.id) || null },
  });
  revalidatePath('/ae/history');
  return { ok: true as const, count: result.count };
}
