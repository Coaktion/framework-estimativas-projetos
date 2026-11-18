'use server';

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerT } from "@/app/i18n/server";
import { canAccessScopes } from "@/lib/segments";
import { assertProjectAccess, canReadProject } from "@/lib/project-access";
import { nextVersionNumber, versionNameFor } from "@/lib/version-utils";

/** Próximo nome automático (V1, V2...) para uma nova versão do projeto. */
async function nextVersionNameFor(projectId: number): Promise<string> {
  const existing = await prisma.projectVersion.findMany({
    where: { projectId },
    select: { versionName: true },
  });
  return versionNameFor(nextVersionNumber(existing.map((v) => v.versionName)));
}

/** Total de horas da versão (mostrado nos atalhos "V1 · 108h" do painel). */
function safeHours(hours: unknown): number {
  const n = Number(hours);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Salva a estimativa do editor.
 *
 *  - `saveMode: 'new'`    → cria uma nova versão com o próximo número automático
 *                           (V1, V2...). `description` é obrigatória.
 *  - `saveMode: 'update'` → sobrescreve a versão `versionId`, mantendo nome e
 *                           descrição.
 *
 * O nome da versão NUNCA vem do cliente: a numeração é sempre do servidor.
 */
export async function saveProjectVersionAction(projectId: number, formData: any) {
  const session = await getServerSession(authOptions);
  if (!canAccessScopes(session?.user as any)) {
    throw new Error(getServerT()('errors.notAuthorized'));
  }
  await assertProjectAccess(projectId, session!.user as any);

  const {
    saveMode,
    versionId,
    description,
    technicalScopeLink,
    zohoLink,
    gpPercent,
    discoveryPercent,
    validationPercent,
    gpOverride,
    discoveryOverride,
    validationOverride,
    safetyHours,
    totalHours,
    data
  } = formData;

  // `data` é SEMPRE gravada como string JSON. Se já chegou string,
  // re-stringificar criaria JSON aninhado e quebraria o parse na abertura.
  const safeDataString = typeof data === 'string' ? data : JSON.stringify(data ?? {});

  const contentFields = {
    technicalScopeLink,
    zohoLink: zohoLink || null,
    gpPercent: parseFloat(gpPercent || 0),
    discoveryPercent: parseFloat(discoveryPercent || 0),
    validationPercent: parseFloat(validationPercent || 0),
    gpOverride: gpOverride !== null ? parseFloat(gpOverride) : null,
    discoveryOverride: discoveryOverride !== null ? parseFloat(discoveryOverride) : null,
    validationOverride: validationOverride !== null ? parseFloat(validationOverride) : null,
    safetyHours: safetyHours || null,
    totalHours: safeHours(totalHours),
    data: safeDataString,
  };

  let version;
  if (saveMode === 'update') {
    const target = await prisma.projectVersion.findFirst({
      where: { id: Number(versionId), projectId },
    });
    if (!target) throw new Error('Version not found');
    version = await prisma.projectVersion.update({
      where: { id: target.id },
      data: contentFields,
    });
  } else {
    const cleanDescription = String(description || '').trim();
    if (!cleanDescription) throw new Error('Version description is required');
    version = await prisma.projectVersion.create({
      data: {
        projectId,
        versionName: await nextVersionNameFor(projectId),
        description: cleanDescription,
        ...contentFields,
        createdBy: parseInt(session.user.id)
      }
    });
  }

  revalidatePath(`/sc/project/${projectId}`);
  return version;
}

export async function cloneProjectVersionAction(projectId: number, sourceVersionId: number, description: string, newTechLink: string) {
  const session = await getServerSession(authOptions);
  if (!canAccessScopes(session?.user as any)) {
    throw new Error(getServerT()('errors.notAuthorized'));
  }

  await assertProjectAccess(projectId, session!.user as any);

  const cleanDescription = String(description || '').trim();
  if (!cleanDescription) throw new Error('Version description is required');

  const source = await prisma.projectVersion.findUnique({
    where: { id: Number(sourceVersionId) },
    include: { project: { select: { ownerId: true, isPrivate: true } } },
  });

  // A versão de origem também tem que ser de um projeto que o usuário pode ler.
  if (!source || !canReadProject(source.project, session!.user as any)) {
    throw new Error("Source version not found");
  }

  const newVersion = await prisma.projectVersion.create({
    data: {
      projectId,
      versionName: await nextVersionNameFor(projectId),
      description: cleanDescription,
      technicalScopeLink: newTechLink,
      gpPercent: source.gpPercent,
      discoveryPercent: source.discoveryPercent,
      validationPercent: source.validationPercent,
      gpOverride: source.gpOverride,
      discoveryOverride: source.discoveryOverride,
      validationOverride: source.validationOverride,
      safetyHours: source.safetyHours,
      totalHours: source.totalHours,
      data: source.data,
      createdBy: parseInt(session.user.id)
    }
  });

  revalidatePath(`/sc/project/${projectId}`);
  return newVersion;
}

/**
 * Edita a descrição ("Identificação da versão") de uma versão já salva, sem
 * criar versão nova e sem mexer no conteúdo. Quem pode salvar a versão pode
 * corrigir a descrição dela.
 */
export async function updateVersionDescriptionAction(projectId: number, versionId: number, rawDescription: string) {
  const session = await getServerSession(authOptions);
  if (!canAccessScopes(session?.user as any)) {
    throw new Error(getServerT()('errors.notAuthorized'));
  }
  await assertProjectAccess(projectId, session!.user as any);

  const description = String(rawDescription || '').trim().slice(0, 2000);
  if (!description) throw new Error('Version description is required');

  const target = await prisma.projectVersion.findFirst({
    where: { id: Number(versionId), projectId: Number(projectId) },
    select: { id: true },
  });
  if (!target) throw new Error('Version not found');

  await prisma.projectVersion.update({ where: { id: target.id }, data: { description } });
  revalidatePath(`/sc/project/${projectId}`);
  revalidatePath('/sc');
  return { description };
}

/**
 * Exclui uma versão SÓ NA TELA (continua no banco; um admin restaura em Admin ›
 * Estimativas excluídas). Pode: o dono do projeto, quem criou a versão ou um
 * admin. A última versão restante não sai sozinha — aí se exclui o projeto.
 */
export async function deleteProjectVersionAction(projectId: number, versionId: number) {
  const session = await getServerSession(authOptions);
  if (!canAccessScopes(session?.user as any)) {
    throw new Error(getServerT()('errors.notAuthorized'));
  }
  const user = session!.user as any;
  const project = await assertProjectAccess(projectId, user);
  const version = await prisma.projectVersion.findFirst({
    where: { id: Number(versionId), projectId: Number(projectId), deletedAt: null },
    select: { id: true, createdBy: true },
  });
  if (!version) throw new Error('Version not found');
  const canDelete = !!user.isAdmin || project.ownerId === Number(user.id) || version.createdBy === Number(user.id);
  if (!canDelete) throw new Error(getServerT()('errors.notAuthorized'));
  const remaining = await prisma.projectVersion.count({ where: { projectId: Number(projectId), deletedAt: null } });
  if (remaining <= 1) return { ok: false as const, reason: 'last_version' as const };

  await prisma.projectVersion.update({
    where: { id: version.id },
    data: { deletedAt: new Date(), deletedBy: Number(user.id) || null },
  });
  revalidatePath(`/sc/project/${projectId}`);
  revalidatePath('/sc');
  return { ok: true as const };
}
