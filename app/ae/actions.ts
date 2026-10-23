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

  const parentVersionId = parentId ? parseInt(parentId) : null;

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
