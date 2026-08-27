'use server';

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerT } from "@/app/i18n/server";
import { canAccessScopes } from "@/lib/segments";

export async function saveProjectVersionAction(projectId: number, formData: any) {
  const session = await getServerSession(authOptions);
  if (!canAccessScopes(session?.user as any)) {
    throw new Error(getServerT()('errors.notAuthorized'));
  }

  const {
    versionName,
    technicalScopeLink,
    gpPercent,
    discoveryPercent,
    validationPercent,
    gpOverride,
    discoveryOverride,
    validationOverride,
    data
  } = formData;

  const version = await prisma.projectVersion.create({
    data: {
      projectId,
      versionName,
      technicalScopeLink,
      gpPercent: parseFloat(gpPercent || 0),
      discoveryPercent: parseFloat(discoveryPercent || 0),
      validationPercent: parseFloat(validationPercent || 0),
      gpOverride: gpOverride !== null ? parseFloat(gpOverride) : null,
      discoveryOverride: discoveryOverride !== null ? parseFloat(discoveryOverride) : null,
      validationOverride: validationOverride !== null ? parseFloat(validationOverride) : null,
      data: JSON.stringify(data),
      createdBy: parseInt(session.user.id)
    }
  });

  revalidatePath(`/sc/project/${projectId}`);
  return version;
}

export async function cloneProjectVersionAction(projectId: number, sourceVersionId: number, newVersionName: string, newTechLink: string) {
  const session = await getServerSession(authOptions);
  if (!canAccessScopes(session?.user as any)) {
    throw new Error(getServerT()('errors.notAuthorized'));
  }

  const source = await prisma.projectVersion.findUnique({
    where: { id: sourceVersionId }
  });

  if (!source) throw new Error("Source version not found");

  const newVersion = await prisma.projectVersion.create({
    data: {
      projectId,
      versionName: newVersionName,
      technicalScopeLink: newTechLink,
      gpPercent: source.gpPercent,
      discoveryPercent: source.discoveryPercent,
      validationPercent: source.validationPercent,
      gpOverride: source.gpOverride,
      discoveryOverride: source.discoveryOverride,
      validationOverride: source.validationOverride,
      data: source.data,
      createdBy: parseInt(session.user.id)
    }
  });

  revalidatePath(`/sc/project/${projectId}`);
  return newVersion;
}
