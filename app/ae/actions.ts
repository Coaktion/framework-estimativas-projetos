'use server';

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function saveAEEstimateAction(formData: any) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("Usuário não autenticado");
  }

  const {
    clientName,
    zohoLink,
    clientObjectives,
    successIndicators,
    selectedModules,
    analyticsTrainingType,
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
    operationLanguages,
    resultHours,
    needsSC,
    engineInputs,
    parentId,
    version: forcedVersion,
  } = formData;

  const userId = parseInt(session.user.id);

 
  let detectedLastVersion: number = 0;
  try {
    const lastVersionEstimate: any = await prisma.aEEstimate.findFirst({
      where: { clientName, createdBy: userId },
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
        where: { clientName, createdBy: userId },
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
      analyticsTrainingType,
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
      operationLanguages,
      engineInputs,
    }),
    resultHours,
    needsSC,
    createdBy: userId,
  };

  // ------------------------------------------------------------
  // Tentativa 1: com version e parentId.
  // Tentativa 2: sem version/parentId (caso a tabela ainda não
  // tenha essas colunas ou cliente Prisma desatualizado).
  // ------------------------------------------------------------
  let estimate: any = null;
  try {
    estimate = await prisma.aEEstimate.create({
      data: {
        ...baseData,
        version,
        parentId: parentVersionId,
      } as any,
    });
  } catch (_) {
    try {
      estimate = await prisma.aEEstimate.create({
        data: baseData,
      });
    } catch (e: any) {
      throw new Error(`Erro ao salvar estimativa AE: ${e?.message ?? e}`);
    }
  }

  revalidatePath('/ae');
  revalidatePath('/ae/history');

  return estimate;
}
