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
    clientObjectives,
    successIndicators,
    selectedModules,
    analyticsBasicReports,
    analyticsAdvancedReports,
    knowledgeArticles,
    hasCommunity,
    hasHCCustomization,
    operationTypes,
    skuType,
    deploymentType,
    hasAppsMarketplace,
    selectedApps,
    otherApp,
    zendeskPlan,
    hasNativeConnections,
    selectedNativeConnections,
    agents,
    brands,
    channels,
    channelQuantities,
    areas,
    hasIntegration,
    hasQA,
    hasWFM,
    hasCopilot,
    copilotType,
    hasAIAgents,
    resultHours,
    needsSC
  } = formData;

  // Save the estimate record using the session user ID
  const estimate = await prisma.aEEstimate.create({
    data: {
      clientName,
      data: JSON.stringify({
        clientObjectives,
        successIndicators,
        selectedModules,
        analyticsBasicReports,
        analyticsAdvancedReports,
        knowledgeArticles,
        hasCommunity,
        hasHCCustomization,
        operationTypes,
        skuType,
        deploymentType,
        hasAppsMarketplace,
        selectedApps,
        otherApp,
        zendeskPlan,
        hasNativeConnections,
        selectedNativeConnections,
        agents,
        brands,
        channels,
        channelQuantities,
        areas,
        hasIntegration,
        hasQA,
        hasWFM,
        hasCopilot,
        copilotType,
        hasAIAgents
      }),
      resultHours,
      needsSC,
      createdBy: parseInt(session.user.id)
    }
  });

  revalidatePath('/ae');
  revalidatePath('/ae/history');
  
  return estimate;
}
