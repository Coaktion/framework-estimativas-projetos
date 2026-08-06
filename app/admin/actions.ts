'use server';

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function createFrameworkSnapshotAction(versionName: string, type: string = "SC_AE") {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Não autorizado");

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
  if (!session?.user || !session.user.isAdmin) throw new Error("Não autorizado");

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
  if (!session?.user || !session.user.isAdmin) throw new Error("Não autorizado");

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
  if (!session?.user || !session.user.isAdmin) throw new Error("Não autorizado");

  const email = String(data.email || '').trim().toLowerCase();
  if (!email) return { success: false, error: "E-mail obrigatório" };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { success: false, error: "Já existe usuário com este e-mail" };

  const password = String(data.password || '').trim();
  if (!password) return { success: false, error: "Senha obrigatória" };

  let hashedPassword: string | undefined = undefined;
  try {
    const bcrypt = (await import('bcryptjs')).default;
    hashedPassword = await bcrypt.hash(password, 10);
  } catch {
    return { success: false, error: "Erro ao gerar hash da senha" };
  }

  try {
    await prisma.user.create({
      data: {
        email,
        name: String(data.name || '').trim() || null,
        password: hashedPassword,
        role: String(data.role || 'USER').toUpperCase(),
        isAdmin: Boolean(data.isAdmin),
      },
    });
    revalidatePath("/admin");
    return { success: true };
  } catch (err: any) {
    if (err?.code === 'P2002') return { success: false, error: "Já existe usuário com este e-mail" };
    return { success: false, error: err?.message || "Erro ao criar usuário" };
  }
}

export async function updateUserRoleAction(userId: number, role: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error("Não autorizado");

  await prisma.user.update({
    where: { id: userId },
    data: { role }
  });
  revalidatePath("/admin");
}

export async function updatePackageAction(id: number, data: any) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error("Não autorizado");

  const { hours, dependsOnItemId, excludedFromVariables, sdDiscovery, categoryName, skillName, ...rest } = data;
  
  try {
    const updateData: any = {
      ...rest,
      hours: hours !== undefined ? Math.max(0, parseFloat(hours) || 0) : undefined,
      excludedFromVariables: excludedFromVariables !== undefined ? JSON.stringify(excludedFromVariables) : undefined,
      sdDiscovery: sdDiscovery !== undefined ? Boolean(sdDiscovery) : undefined,
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
      return { success: false, error: "Já existe um pacote cadastrado com este nome. Por favor, utilize um nome exclusivo." };
    }
    return { success: false, error: "Erro ao atualizar o pacote. Tente novamente." };
  }
}

export async function addCategoryAction(name: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error("Não autorizado");

  const maxOrder = await prisma.category.aggregate({
    where: { isActive: true },
    _max: { displayOrder: true }
  });

  const nextOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  await prisma.category.upsert({
    where: { name },
    update: { isActive: true },
    create: { name, displayOrder: nextOrder }
  });

  revalidatePath("/admin");
}

export async function updateCategoryAction(id: number, data: any) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error("Não autorizado");

  const displayOrder = data.displayOrder !== undefined ? parseInt(data.displayOrder) : undefined;
  const displayName = data.displayName !== undefined ? String(data.displayName) : undefined;
  const parentName = data.parentName !== undefined ? (data.parentName ? String(data.parentName) : null) : undefined;

  await prisma.category.update({
    where: { id },
    data: {
      displayName,
      displayOrder: displayOrder !== undefined && !isNaN(displayOrder) ? displayOrder : undefined,
      parentName
    }
  });

  revalidatePath("/admin");
}

export async function setCategoryOrderAction(categoryIds: number[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error("Não autorizado");

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
  if (!session?.user || !session.user.isAdmin) throw new Error("Não autorizado");

  await prisma.package.updateMany({
    where: { id: { in: packageIds } },
    data: { categoryName: targetCategoryName }
  });

  revalidatePath("/admin");
}

export async function mergeCategoryAction(sourceCategoryId: number, targetCategoryName: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error("Não autorizado");

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
  if (!session?.user || !session.user.isAdmin) throw new Error("Não autorizado");

  await prisma.category.update({
    where: { id },
    data: { isActive: false }
  });

  revalidatePath("/admin");
}

export async function addSkillAction(name: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error("Não autorizado");

  await prisma.skill.upsert({
    where: { name },
    update: { isActive: true },
    create: { name }
  });

  revalidatePath("/admin");
}

export async function deleteSkillAction(id: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error("Não autorizado");

  await prisma.skill.update({
    where: { id },
    data: { isActive: false }
  });

  revalidatePath("/admin");
}

export async function addPackageAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error("Não autorizado");

  const name = formData.get("name") as string;
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
    tooltip,
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

export async function reseedFrameworkAction() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error("Não autorizado");

  // Create Skills
  const skills = ["Implantação", "GP", "Solution Design", "Desenvolvimento", "Design"];
  for (const s of skills) {
    await prisma.skill.upsert({ where: { name: s }, update: { isActive: true }, create: { name: s } });
  }

  // Create Categories
  const categories = ["Zendesk Support", "Canais - Ticket", "Canais - Messaging", "Zendesk Guide", "Zendesk Explore", "Zendesk Talk"];
  for (const c of categories) {
    await prisma.category.upsert({ where: { name: c }, update: { isActive: true }, create: { name: c } });
  }

  const packages = [
    // Zendesk Support
    { name: "Support: Configurações gerais (Config Base)", hours: 1.3, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Configurações de Segurança (Auth, 2FA, IP)", hours: 0.25, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Aparência (cor, nome, favicon)", hours: 0.05, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Localização (fuso, idioma)", hours: 0.08, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Eventos de perfil de usuário", hours: 0.08, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Configuração de usuários finais", hours: 0.17, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Customização do Cartão de usuário", hours: 0.17, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Interface do agente", hours: 0.17, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Painel de Contexto", hours: 0.17, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Configuração de conversas paralelas", hours: 0.08, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Solicitações de aprovação (approvals)", hours: 0.02, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Configurações de ticket", hours: 0.08, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Criação de chaves API", hours: 0.08, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Single Sign-On (SAML / JWT / OpenID)", hours: 3.0, categoryName: "Zendesk Support", skillName: "Desenvolvimento" },
    { name: "Support: Programações de exclusão de dados (cada)", hours: 0.5, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Marcas (por marca)", hours: 0.25, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Membros de equipe / Agentes Light (por agente)", hours: 0.03, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Funções (por função)", hours: 0.33, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Grupos (por grupo)", hours: 0.08, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Campos do usuário (por campo)", hours: 0.07, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Campos da organização (por campo)", hours: 0.07, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Importação de usuários (por arquivo)", hours: 0.25, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: Importação de organizações (por arquivo)", hours: 0.25, categoryName: "Zendesk Support", skillName: "Implantação" },
    { name: "Support: IPs a serem banidos (por IP)", hours: 0.08, categoryName: "Zendesk Support", skillName: "Implantação" },

    // Canais - Ticket
    { name: "Ticket: Email (por endereço)", hours: 0.33, categoryName: "Canais - Ticket", skillName: "Implantação" },
    { name: "Ticket: Template HTML (por marca)", hours: 1.0, categoryName: "Canais - Ticket", skillName: "Design" },
    { name: "Ticket: Formulários/Catálogos (por form)", hours: 0.5, categoryName: "Canais - Ticket", skillName: "Implantação" },
    { name: "Ticket: Condicionais (por condição)", hours: 0.03, categoryName: "Canais - Ticket", skillName: "Implantação" },
    { name: "Ticket: Facebook Page (Timeline)", hours: 1.0, categoryName: "Canais - Ticket", skillName: "Implantação" },
    { name: "Ticket: X (Mensagens Públicas)", hours: 1.0, categoryName: "Canais - Ticket", skillName: "Implantação" },
    { name: "Ticket: Microsoft Teams integration", hours: 1.0, categoryName: "Canais - Ticket", skillName: "Implantação" },

    // Canais - Messaging
    { name: "Messaging: Web Widget (por widget)", hours: 0.42, categoryName: "Canais - Messaging", skillName: "Implantação" },
    { name: "Messaging: Facebook Messenger (por página)", hours: 1.0, categoryName: "Canais - Messaging", skillName: "Implantação" },
    { name: "Messaging: Instagram Direct (por página)", hours: 1.0, categoryName: "Canais - Messaging", skillName: "Implantação" },
    { name: "Messaging: Android SDK", hours: 1.0, categoryName: "Canais - Messaging", skillName: "Desenvolvimento" },
    { name: "Messaging: iOS SDK", hours: 1.0, categoryName: "Canais - Messaging", skillName: "Desenvolvimento" },
    { name: "Messaging: Unity SDK", hours: 1.0, categoryName: "Canais - Messaging", skillName: "Desenvolvimento" },
    { name: "Messaging: LINE", hours: 1.0, categoryName: "Canais - Messaging", skillName: "Implantação" },
    { name: "Messaging: Apple Messages for Business", hours: 1.0, categoryName: "Canais - Messaging", skillName: "Implantação" },
    { name: "Messaging: Slack", hours: 1.0, categoryName: "Canais - Messaging", skillName: "Implantação" },
    { name: "Messaging: X Corp DM (por página)", hours: 1.0, categoryName: "Canais - Messaging", skillName: "Implantação" },
    { name: "Messaging: WeChat", hours: 1.0, categoryName: "Canais - Messaging", skillName: "Implantação" },
    { name: "Messaging: Google RCS", hours: 1.0, categoryName: "Canais - Messaging", skillName: "Implantação" },
    { name: "Messaging: Google Business Messages", hours: 1.0, categoryName: "Canais - Messaging", skillName: "Implantação" },
    { name: "Messaging: KakaoTalk", hours: 1.0, categoryName: "Canais - Messaging", skillName: "Implantação" },
    { name: "Messaging: Telegram", hours: 1.0, categoryName: "Canais - Messaging", skillName: "Implantação" },
    { name: "Messaging: Text/SMS (por número)", hours: 0.17, categoryName: "Canais - Messaging", skillName: "Implantação" },
  ];

  for (const pkg of packages) {
    const { categoryName, skillName, dependsOnItemId, ...rest } = pkg as any;
    const nested: any = {};
    if (categoryName) nested.category = { connectOrCreate: { where: { name: categoryName }, create: { name: categoryName } } };
    if (skillName) nested.skill = { connectOrCreate: { where: { name: skillName }, create: { name: skillName } } };
    if (dependsOnItemId) nested.dependsOnItem = { connect: { id: Number(dependsOnItemId) } };
    await prisma.package.upsert({
      where: { name: pkg.name },
      update: { ...rest, isActive: true, ...nested },
      create: { name: pkg.name, ...rest, isActive: true, ...nested }
    });
  }

  const variables = [
    { key: "GP_STANDARD", value: "25", category: "Cálculos", type: "PERCENT", flatValue: 0 },
    { key: "DISCOVERY_STANDARD", value: "0", category: "Cálculos", type: "PERCENT", flatValue: 0 },
    { key: "VALIDATION_STANDARD", value: "0", category: "Cálculos", type: "PERCENT", flatValue: 0 },
    { key: "VALOR_HORA_SC", value: "250", category: "Preços", type: "FLAT", flatValue: 250 },
    { key: "VALOR_HORA_DEV", value: "350", category: "Preços", type: "FLAT", flatValue: 350 },
    { key: "VALOR_HORA_DESIGN", value: "200", category: "Preços", type: "FLAT", flatValue: 200 },
    { key: "MIN_HOURS_AE", value: "8", category: "Limites", type: "FLAT", flatValue: 8 },
  ];

  for (const v of variables) {
    await prisma.variable.upsert({
      where: { key: v.key },
      update: { ...v, isActive: true },
      create: { ...v, isActive: true }
    });
  }

  revalidatePath("/admin");
}

export async function deletePackageAction(id: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error("Não autorizado");

  await prisma.package.update({
    where: { id },
    data: { isActive: false }
  });
  revalidatePath("/admin");
}

export async function updateUserAdminStatusAction(userId: number, isAdmin: boolean) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error("Não autorizado");

  await prisma.user.update({
    where: { id: userId },
    data: { isAdmin }
  });
  revalidatePath("/admin");
}
