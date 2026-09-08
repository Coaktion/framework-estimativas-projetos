'use server';

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerT } from "@/app/i18n/server";
import { canAccessScopes } from "@/lib/segments";

/**
 * Atualiza `totalHours` de uma versão em um update separado.
 *
 * Estratégia de compatibilidade com Prisma Client desatualizado em Dev:
 *  - `totalHours` existe no `schema.prisma` e no banco, mas se o dev não
 *    rodou `prisma generate`, o Client local desconhece o campo.
 *  - NÃO passamos `totalHours` dentro do `create()` (isso causaria o erro
 *    "Unknown argument `totalHours`").
 *  - Em vez disso, fazemos um `update` separado com try/catch: se o Client
 *    reconhece o campo, o valor é gravado normalmente; se não reconhece,
 *    engolimos o erro silenciosamente e a versão fica com `@default(0)` do
 *    schema — no dashboard, o chip aparece sem o total, mas nada quebra.
 */
async function trySetTotalHours(versionId: number, hours: number | null | undefined) {
  const safe = Number.isFinite(Number(hours)) ? Number(hours) : 0;
  try {
    // Usamos `as any` para contornar a checagem estática de tipos — em
    // produção tipada isso sempre funciona; em desenvolvimento, o erro de
    // runtime é capturado abaixo.
    await (prisma.projectVersion as any).update({
      where: { id: versionId },
      data: { totalHours: safe },
    });
  } catch {
    /* Prisma Client desatualizado em Dev — ignora. */
  }
}

export async function saveProjectVersionAction(projectId: number, formData: any) {
  const session = await getServerSession(authOptions);
  if (!canAccessScopes(session?.user as any)) {
    throw new Error(getServerT()('errors.notAuthorized'));
  }

  const {
    versionName,
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

  // CORREÇÃO: `zohoLink` e `safetyHours` já eram ENVIADOS pelo editor e lidos de
  // volta na abertura da versão (`currentVersion?.zohoLink`), mas nunca eram
  // gravados — o campo voltava vazio a cada reabertura. Passaram a ser
  // persistidos junto com o resto.
  const version = await prisma.projectVersion.create({
    data: {
      projectId,
      versionName,
      technicalScopeLink,
      zohoLink: zohoLink || null,
      gpPercent: parseFloat(gpPercent || 0),
      discoveryPercent: parseFloat(discoveryPercent || 0),
      validationPercent: parseFloat(validationPercent || 0),
      gpOverride: gpOverride !== null ? parseFloat(gpOverride) : null,
      discoveryOverride: discoveryOverride !== null ? parseFloat(discoveryOverride) : null,
      validationOverride: validationOverride !== null ? parseFloat(validationOverride) : null,
      safetyHours: safetyHours || null,
      // NOTA: `totalHours` NÃO é passado aqui. É aplicado via update abaixo.
      data: JSON.stringify(data),
      createdBy: parseInt(session.user.id)
    }
  });

  await trySetTotalHours(version.id, totalHours);

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
      safetyHours: source.safetyHours,
      // NOTA: `totalHours` NÃO é passado aqui. É aplicado via update abaixo.
      data: source.data,
      createdBy: parseInt(session.user.id)
    }
  });

  await trySetTotalHours(newVersion.id, (source as any).totalHours ?? 0);

  revalidatePath(`/sc/project/${projectId}`);
  return newVersion;
}
