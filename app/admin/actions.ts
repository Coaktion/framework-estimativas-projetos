'use server';

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerT, getServerLanguage } from "@/app/i18n/server";
import { normalizeSegment, syncIsAdmin, canManageSegments, isSegment } from "@/lib/segments";
import { ZENDESK_PLANS } from "@/lib/zendesk-plans";
import { normalizePhase } from "@/lib/framework-calc";
import { getActiveAeConfig } from "@/lib/ae-config-server";
import { aeBindingUsage } from "@/lib/ae-config";
import { aeNumberLabel } from "@/lib/ae-number-labels";

export async function createFrameworkSnapshotAction(versionName: string, type: string = "SC_AE") {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error(getServerT()('errors.notAuthorized'));

  // Capture current packages and variables as JSON
  const packages = await prisma.package.findMany({ where: { isActive: true } });
  const variables = await prisma.variable.findMany({ where: { isActive: true } });

  const data = {
    packages,
    variables
  };

  const snapshot = await prisma.frameworkVersion.create({
    data: {
      versionName,
      type,
      data: JSON.stringify(data),
      createdBy: parseInt(session.user.id)
    }
  });

  revalidatePath("/admin");
  return snapshot;
}

export async function restoreFrameworkSnapshotAction(snapshotId: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error(getServerT()('errors.notAuthorized'));

  const snapshot = await prisma.frameworkVersion.findUnique({
    where: { id: snapshotId }
  });

  if (!snapshot) throw new Error("Snapshot not found");

  const { packages, variables } = JSON.parse(snapshot.data);

  // Simple restore strategy: update existing or create new from snapshot
  // We mark all current as inactive first to ensure a clean slate, 
  // then upsert to activate only what is in the snapshot.
  await prisma.package.updateMany({ data: { isActive: false } });
  await prisma.variable.updateMany({ data: { isActive: false } });

  for (const pkg of packages) {
    const {
      id, createdAt,
      categoryName, skillName, category, skill,
      dependsOnItemId,
      ...pkgData
    } = pkg;
    const updateData: any = { ...pkgData, isActive: true };
    const createData: any = { name: pkgData.name, ...pkgData, isActive: true };
    if (categoryName) {
      const nestedCat = { connectOrCreate: { where: { name: categoryName }, create: { name: categoryName } } };
      updateData.category = nestedCat;
      createData.category = nestedCat;
    }
    if (skillName) {
      const nestedSkill = { connectOrCreate: { where: { name: skillName }, create: { name: skillName } } };
      updateData.skill = nestedSkill;
      createData.skill = nestedSkill;
    }
    if (dependsOnItemId) {
      const nestedDep = { connect: { id: Number(dependsOnItemId) } };
      updateData.dependsOnItem = nestedDep;
      createData.dependsOnItem = nestedDep;
    }
    if (category && !categoryName) delete updateData.category;
    if (skill && !skillName) delete updateData.skill;
    await prisma.package.upsert({
      where: { name: pkgData.name },
      update: updateData,
      create: createData,
    });
  }

  for (const v of variables) {
    const { id, updatedAt, ...vData } = v;
    await prisma.variable.upsert({
      where: { key: vData.key },
      update: { ...vData, isActive: true },
      create: { ...vData, isActive: true }
    });
  }

  revalidatePath("/admin");
}

export async function deleteUserAction(userId: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error(getServerT()('errors.notAuthorized'));

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin");
}

export async function createUserAction(data: {
  email: string;
  name?: string;
  password?: string;
  role?: string;
  isAdmin?: boolean;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error(getServerT()('errors.notAuthorized'));

  const email = String(data.email || '').trim().toLowerCase();
  if (!email) return { success: false, error: getServerT()('errors.emailRequired') };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { success: false, error: getServerT()('errors.emailTaken') };

  const password = String(data.password || '').trim();
  if (!password) return { success: false, error: getServerT()('errors.passwordRequired') };

  // O segmento é a única fonte da verdade: ADMIN implica privilégio de admin.
  const segment = normalizeSegment(data.role);

  let hashedPassword: string | undefined = undefined;
  try {
    const bcrypt = (await import('bcryptjs')).default;
    hashedPassword = await bcrypt.hash(password, 10);
  } catch {
    return { success: false, error: getServerT()('errors.hashFailed') };
  }

  try {
    await prisma.user.create({
      data: {
        email,
        name: String(data.name || '').trim() || null,
        password: hashedPassword,
        role: segment,
        isAdmin: syncIsAdmin(segment),
      },
    });
    revalidatePath("/admin");
    return { success: true };
  } catch (err: any) {
    if (err?.code === 'P2002') return { success: false, error: getServerT()('errors.emailTaken') };
    return { success: false, error: err?.message || getServerT()('errors.createUserFailed') };
  }
}

/**
 * Altera o SEGMENTO de um usuário. Somente administradores podem chamar isto.
 * `isAdmin` é derivado do segmento, então os dois nunca saem de sincronia.
 */
export async function updateUserSegmentAction(userId: number, segment: string) {
  const session = await getServerSession(authOptions);
  if (!canManageSegments(session?.user as any)) {
    return { success: false, error: getServerT()('errors.cannotChangeSegment') };
  }

  if (!isSegment(segment)) {
    return { success: false, error: getServerT()('errors.invalidSegment') };
  }

  const next = normalizeSegment(segment);
  const nextIsAdmin = syncIsAdmin(next);

  // Impede que o sistema fique sem nenhum administrador.
  if (!nextIsAdmin) {
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (target?.isAdmin) {
      const adminCount = await prisma.user.count({ where: { isAdmin: true } });
      if (adminCount <= 1) {
        return { success: false, error: getServerT()('errors.lastAdmin') };
      }
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role: next, isAdmin: nextIsAdmin },
  });
  revalidatePath("/admin");
  return { success: true };
}

/** @deprecated Use updateUserSegmentAction. Mantido para chamadas antigas. */
export async function updateUserRoleAction(userId: number, role: string) {
  return updateUserSegmentAction(userId, role);
}

export async function updatePackageAction(id: number, data: any) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error(getServerT()('errors.notAuthorized'));

  const { hours, dependsOnItemId, excludedFromVariables, sdDiscovery, categoryName, skillName, goLiveShortcutQty, moduleLink, ...rest } = data;
  
  try {
    const updateData: any = {
      ...rest,
      hours: hours !== undefined ? Math.max(0, parseFloat(hours) || 0) : undefined,
      excludedFromVariables: excludedFromVariables !== undefined ? JSON.stringify(excludedFromVariables) : undefined,
      sdDiscovery: sdDiscovery !== undefined ? Boolean(sdDiscovery) : undefined,
      // Atalhos do framework (Workshop/Treinamento: módulo; Go-live: quantidade).
      moduleLink: moduleLink !== undefined ? String(moduleLink || "") : undefined,
      goLiveShortcutQty: goLiveShortcutQty !== undefined ? Math.max(0, Math.round(Number(goLiveShortcutQty) || 0)) : undefined,
    };
    if (dependsOnItemId !== undefined) {
      const parsedId = parseInt(dependsOnItemId);
      if (parsedId && !isNaN(parsedId)) {
        updateData.dependsOnItem = { connect: { id: parsedId } };
      } else {
        updateData.dependsOnItem = { disconnect: true };
      }
    }
    if (categoryName) {
      updateData.category = { connectOrCreate: { where: { name: categoryName }, create: { name: categoryName } } };
    }
    if (skillName) {
      updateData.skill = { connectOrCreate: { where: { name: skillName }, create: { name: skillName } } };
    }

    await prisma.package.update({
      where: { id },
      data: updateData,
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    if (error.code === 'P2002') {
      return { success: false, error: getServerT()('errors.packageNameTaken') };
    }
    return { success: false, error: getServerT()('errors.packageUpdateFailed') };
  }
}

export async function addCategoryAction(
  name: string,
  displayNameEn?: string,
  minPlanCS?: string,
  minPlanES?: string,
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error(getServerT()('errors.notAuthorized'));

  const maxOrder = await prisma.category.aggregate({
    where: { isActive: true },
    _max: { displayOrder: true }
  });

  const nextOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  const nameEn = String(displayNameEn || "").trim();
  const csTier = normalizeMinPlanInput(minPlanCS);
  const esTier = normalizeMinPlanInput(minPlanES);

  await prisma.category.upsert({
    where: { name },
    update: {
      isActive: true,
      ...(nameEn ? { displayNameEn: nameEn } : {}),
      // Reativando uma categoria, só sobrescreve a porteira se veio um valor —
      // assim não apagamos por acidente a restrição já configurada.
      ...(csTier ? { minPlanCS: csTier } : {}),
      ...(esTier ? { minPlanES: esTier } : {})
    },
    create: {
      name,
      displayOrder: nextOrder,
      displayNameEn: nameEn,
      minPlanCS: csTier,
      minPlanES: esTier
    }
  });

  revalidatePath("/admin");
  revalidatePath("/sc");
}

export async function updateCategoryAction(id: number, data: any) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error(getServerT()('errors.notAuthorized'));

  const displayOrder = data.displayOrder !== undefined ? parseInt(data.displayOrder) : undefined;
  const displayName = data.displayName !== undefined ? String(data.displayName) : undefined;
  const displayNameEn = data.displayNameEn !== undefined ? String(data.displayNameEn) : undefined;
  const displayNameEs = data.displayNameEs !== undefined ? String(data.displayNameEs) : undefined;
  const parentName = data.parentName !== undefined ? (data.parentName ? String(data.parentName) : null) : undefined;
  // Porteira de plano da categoria. String vazia é um valor VÁLIDO (= sem
  // restrição), então só ignoramos quando a chave não veio no payload.
  const minPlanCS = data.minPlanCS !== undefined ? normalizeMinPlanInput(data.minPlanCS) : undefined;
  const minPlanES = data.minPlanES !== undefined ? normalizeMinPlanInput(data.minPlanES) : undefined;
  // Linha do card de Implantação (Workshop/Setup/Treinamento/Go-Live).
  const implementationPhase = data.implementationPhase !== undefined
    ? normalizePhase(data.implementationPhase)
    : undefined;

  await prisma.category.update({
    where: { id },
    data: {
      displayName,
      displayNameEn,
      displayNameEs,
      displayOrder: displayOrder !== undefined && !isNaN(displayOrder) ? displayOrder : undefined,
      parentName,
      minPlanCS,
      minPlanES,
      implementationPhase,
    }
  });

  revalidatePath("/admin");
  revalidatePath("/sc");
}

/**
 * Aceita apenas os tiers conhecidos; qualquer outra coisa vira "" (sem
 * restrição). Guardar um tier inválido faria `parseMinPlan` devolver null e a
 * restrição sumiria em silêncio.
 */
function normalizeMinPlanInput(value: any): string {
  const key = String(value ?? "").toLowerCase().replace(/^suite\s+/, "").trim();
  return (ZENDESK_PLANS as readonly string[]).includes(key) ? key : "";
}

export async function setCategoryOrderAction(categoryIds: number[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error(getServerT()('errors.notAuthorized'));

  await prisma.$transaction(
    categoryIds.map((id, index) =>
      prisma.category.update({
        where: { id },
        data: { displayOrder: index + 1 }
      })
    )
  );

  revalidatePath("/admin");
}

export async function bulkMovePackagesAction(packageIds: number[], targetCategoryName: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error(getServerT()('errors.notAuthorized'));

  await prisma.package.updateMany({
    where: { id: { in: packageIds } },
    data: { categoryName: targetCategoryName }
  });

  revalidatePath("/admin");
}

export async function mergeCategoryAction(sourceCategoryId: number, targetCategoryName: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error(getServerT()('errors.notAuthorized'));

  const source = await prisma.category.findUnique({ where: { id: sourceCategoryId } });
  if (!source) return;

  await prisma.$transaction([
    prisma.package.updateMany({
      where: { categoryName: source.name },
      data: { categoryName: targetCategoryName }
    }),
    prisma.category.update({
      where: { id: sourceCategoryId },
      data: { isActive: false }
    })
  ]);

  revalidatePath("/admin");
}

export async function deleteCategoryAction(id: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error(getServerT()('errors.notAuthorized'));

  // Desativar uma categoria que ainda tem itens ou subcategorias ativas faria
  // esses itens sumirem do framework (e das horas de versões salvas). Pede
  // para movê-los antes.
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) return { success: false, error: getServerT()('errors.categoryNotFound') };
  const [activeItems, activeChildren] = await Promise.all([
    prisma.package.count({ where: { categoryName: category.name, isActive: true } }),
    prisma.category.count({ where: { parentName: category.name, isActive: true } }),
  ]);
  if (activeItems > 0 || activeChildren > 0) {
    return {
      success: false,
      error: getServerT()('errors.categoryNotEmpty', { items: activeItems, children: activeChildren }),
    };
  }

  await prisma.category.update({
    where: { id },
    data: { isActive: false }
  });

  revalidatePath("/admin");
  revalidatePath("/sc");
  return { success: true };
}

/** Atualiza os nomes de exibição de uma skill (o nome PT é a chave e não muda). */
export async function updateSkillAction(id: number, nameEn?: string, nameEs?: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error(getServerT()('errors.notAuthorized'));

  await prisma.skill.update({
    where: { id },
    data: {
      nameEn: nameEn !== undefined ? String(nameEn || "").trim() : undefined,
      nameEs: nameEs !== undefined ? String(nameEs || "").trim() : undefined,
    },
  });

  revalidatePath("/admin");
}

export async function addSkillAction(name: string, nameEnInput?: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error(getServerT()('errors.notAuthorized'));

  const nameEn = String(nameEnInput || "").trim();

  await prisma.skill.upsert({
    where: { name },
    update: { isActive: true, ...(nameEn ? { nameEn } : {}) },
    create: { name, nameEn }
  });

  revalidatePath("/admin");
}

export async function deleteSkillAction(id: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error(getServerT()('errors.notAuthorized'));

  await prisma.skill.update({
    where: { id },
    data: { isActive: false }
  });

  revalidatePath("/admin");
}

export async function addPackageAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error(getServerT()('errors.notAuthorized'));

  const name = formData.get("name") as string;
  // O nome em português é a chave canônica; o inglês é só exibição.
  const nameEn = String(formData.get("nameEn") || "").trim();
  const nameEs = String(formData.get("nameEs") || "").trim();
  const tooltipEs = String(formData.get("tooltipEs") || "").trim();
  const minPlanCS = String(formData.get("minPlanCS") || "").trim();
  const minPlanES = String(formData.get("minPlanES") || "").trim();
  const tooltipEn = String(formData.get("tooltipEn") || "").trim();
  const hours = Math.max(0, parseFloat(formData.get("hours") as string) || 0);
  const skillName = formData.get("skillName") as string;
  const categoryName = formData.get("categoryName") as string;
  const tooltip = formData.get("tooltip") as string;
  const link = formData.get("link") as string;
  const sdDiscovery = formData.get("sdDiscovery") === "on";
  const dependsOnItemIdRaw = formData.get("dependsOnItemId");
  const dependsOnItemId = dependsOnItemIdRaw ? parseInt(dependsOnItemIdRaw as string) : null;

  const common: any = {
    hours,
    nameEn,
    nameEs,
    tooltipEs,
    minPlanCS,
    minPlanES,
    tooltip,
    tooltipEn,
    link,
    isActive: true,
    sdDiscovery,
    category: categoryName
      ? { connectOrCreate: { where: { name: categoryName }, create: { name: categoryName } } }
      : undefined,
    skill: skillName
      ? { connectOrCreate: { where: { name: skillName }, create: { name: skillName } } }
      : undefined,
  };
  if (dependsOnItemId) {
    common.dependsOnItem = { connect: { id: dependsOnItemId } };
  }

  await prisma.package.upsert({
    where: { name },
    update: common,
    create: { name, ...common }
  });

  revalidatePath("/admin");
}

export async function deletePackageAction(id: number): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error(getServerT()('errors.notAuthorized'));

  // A biblioteca governa as horas da Calculadora AE: um item vinculado só pode
  // sair depois que o admin reatribuir o valor (Admin › Calculadora AE › Números).
  const usage = aeBindingUsage((await getActiveAeConfig()).config)[id];
  if (usage?.length) {
    const t = getServerT();
    const items = usage.map((u) => aeNumberLabel(u.path, t, getServerLanguage())).join(", ");
    return { success: false, error: t('errors.packageBoundToAe', { items }) };
  }

  await prisma.package.update({
    where: { id },
    data: { isActive: false }
  });
  revalidatePath("/admin");
  return { success: true };
}

/**
 * Privilégio de admin agora é consequência do segmento: promover alguém a
 * administrador significa movê-lo para o segmento ADMIN. Esta função foi
 * mantida para não quebrar chamadas antigas e apenas delega o trabalho.
 */
export async function updateUserAdminStatusAction(userId: number, isAdmin: boolean) {
  return updateUserSegmentAction(userId, isAdmin ? 'ADMIN' : 'IMPL');
}

/**
 * Importa a planilha de traduções da biblioteca (exportada pelo próprio painel).
 *
 * Grava os nomes em inglês e espanhol e os tooltips nos três idiomas. Nunca
 * apaga: célula vazia na planilha não mexe no que já está gravado. O nome em
 * português é a chave canônica e não é alterado.
 */
export async function importTranslationsAction(
  rows: Array<{
    type: string; id: number;
    nameEn?: string; nameEs?: string;
    tooltipPt?: string; tooltipEn?: string; tooltipEs?: string;
  }>,
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error(getServerT()('errors.notAuthorized'));

  const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);
  let updated = 0;
  const notFound: string[] = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const id = Number(row?.id);
    const nameEn = text(row?.nameEn, 300);
    const nameEs = text(row?.nameEs, 300);
    const tooltipPt = text(row?.tooltipPt, 2000);
    const tooltipEn = text(row?.tooltipEn, 2000);
    const tooltipEs = text(row?.tooltipEs, 2000);
    if (!Number.isInteger(id)) continue;
    try {
      if (row.type === 'item') {
        const data = {
          ...(nameEn ? { nameEn } : {}),
          ...(nameEs ? { nameEs } : {}),
          ...(tooltipPt ? { tooltip: tooltipPt } : {}),
          ...(tooltipEn ? { tooltipEn } : {}),
          ...(tooltipEs ? { tooltipEs } : {}),
        };
        if (!Object.keys(data).length) continue;
        await prisma.package.update({ where: { id }, data });
      } else if (row.type === 'categoria') {
        if (!nameEn && !nameEs) continue;
        await prisma.category.update({
          where: { id },
          data: { ...(nameEn ? { displayNameEn: nameEn } : {}), ...(nameEs ? { displayNameEs: nameEs } : {}) },
        });
      } else if (row.type === 'skill') {
        if (!nameEn && !nameEs) continue;
        await prisma.skill.update({
          where: { id },
          data: { ...(nameEn ? { nameEn } : {}), ...(nameEs ? { nameEs } : {}) },
        });
      } else {
        continue;
      }
      updated++;
    } catch {
      notFound.push(`${row.type} #${id}`);
    }
  }

  revalidatePath('/admin');
  revalidatePath('/sc');
  return { success: true, updated, notFound };
}
