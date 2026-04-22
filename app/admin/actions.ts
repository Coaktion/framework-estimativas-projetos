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
    const { id, createdAt, ...pkgData } = pkg;
    await prisma.package.upsert({
      where: { name: pkgData.name },
      update: { ...pkgData, isActive: true },
      create: { ...pkgData, isActive: true }
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

export async function updateUserRoleAction(userId: number, role: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error("Não autorizado");

  await prisma.user.update({
    where: { id: userId },
    data: { role }
  });
  revalidatePath("/admin");
}

export async function addPackageAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error("Não autorizado");

  const name = formData.get("name") as string;
  const hours = Math.max(0, parseFloat(formData.get("hours") as string) || 0);
  const skill = formData.get("skill") as string;
  const category = formData.get("category") as string;
  const link = formData.get("link") as string;

  await prisma.package.upsert({
    where: { name },
    update: { hours, skill, category, link, isActive: true },
    create: { name, hours, skill, category, link, isActive: true }
  });

  revalidatePath("/admin");
}

export async function reseedFrameworkAction() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error("Não autorizado");

  const packages = [
    // Zendesk Support
    { name: "Support: Configurações gerais (Config Base)", hours: 1.3, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Configurações de Segurança (Auth, 2FA, IP)", hours: 0.25, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Aparência (cor, nome, favicon)", hours: 0.05, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Localização (fuso, idioma)", hours: 0.08, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Eventos de perfil de usuário", hours: 0.08, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Configuração de usuários finais", hours: 0.17, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Customização do Cartão de usuário", hours: 0.17, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Interface do agente", hours: 0.17, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Painel de Contexto", hours: 0.17, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Configuração de conversas paralelas", hours: 0.08, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Solicitações de aprovação (approvals)", hours: 0.02, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Configurações de ticket", hours: 0.08, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Criação de chaves API", hours: 0.08, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Single Sign-On (SAML / JWT / OpenID)", hours: 3.0, category: "Zendesk Support", skill: "Desenvolvimento" },
    { name: "Support: Programações de exclusão de dados (cada)", hours: 0.5, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Marcas (por marca)", hours: 0.25, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Membros de equipe / Agentes Light (por agente)", hours: 0.03, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Funções (por função)", hours: 0.33, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Grupos (por grupo)", hours: 0.08, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Campos do usuário (por campo)", hours: 0.07, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Campos da organização (por campo)", hours: 0.07, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Importação de usuários (por arquivo)", hours: 0.25, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: Importação de organizações (por arquivo)", hours: 0.25, category: "Zendesk Support", skill: "Implantação" },
    { name: "Support: IPs a serem banidos (por IP)", hours: 0.08, category: "Zendesk Support", skill: "Implantação" },

    // Canais - Ticket
    { name: "Ticket: Email (por endereço)", hours: 0.33, category: "Canais - Ticket", skill: "Implantação" },
    { name: "Ticket: Template HTML (por marca)", hours: 1.0, category: "Canais - Ticket", skill: "Design" },
    { name: "Ticket: Formulários/Catálogos (por form)", hours: 0.5, category: "Canais - Ticket", skill: "Implantação" },
    { name: "Ticket: Condicionais (por condição)", hours: 0.03, category: "Canais - Ticket", skill: "Implantação" },
    { name: "Ticket: Facebook Page (Timeline)", hours: 1.0, category: "Canais - Ticket", skill: "Implantação" },
    { name: "Ticket: X (Mensagens Públicas)", hours: 1.0, category: "Canais - Ticket", skill: "Implantação" },
    { name: "Ticket: Microsoft Teams integration", hours: 1.0, category: "Canais - Ticket", skill: "Implantação" },

    // Canais - Messaging
    { name: "Messaging: Web Widget (por widget)", hours: 0.42, category: "Canais - Messaging", skill: "Implantação" },
    { name: "Messaging: Facebook Messenger (por página)", hours: 1.0, category: "Canais - Messaging", skill: "Implantação" },
    { name: "Messaging: Instagram Direct (por página)", hours: 1.0, category: "Canais - Messaging", skill: "Implantação" },
    { name: "Messaging: Android SDK", hours: 1.0, category: "Canais - Messaging", skill: "Desenvolvimento" },
    { name: "Messaging: iOS SDK", hours: 1.0, category: "Canais - Messaging", skill: "Desenvolvimento" },
    { name: "Messaging: Unity SDK", hours: 1.0, category: "Canais - Messaging", skill: "Desenvolvimento" },
    { name: "Messaging: LINE", hours: 1.0, category: "Canais - Messaging", skill: "Implantação" },
    { name: "Messaging: Apple Messages for Business", hours: 1.0, category: "Canais - Messaging", skill: "Implantação" },
    { name: "Messaging: Slack", hours: 1.0, category: "Canais - Messaging", skill: "Implantação" },
    { name: "Messaging: X Corp DM (por página)", hours: 1.0, category: "Canais - Messaging", skill: "Implantação" },
    { name: "Messaging: WeChat", hours: 1.0, category: "Canais - Messaging", skill: "Implantação" },
    { name: "Messaging: Google RCS", hours: 1.0, category: "Canais - Messaging", skill: "Implantação" },
    { name: "Messaging: Google Business Messages", hours: 1.0, category: "Canais - Messaging", skill: "Implantação" },
    { name: "Messaging: KakaoTalk", hours: 1.0, category: "Canais - Messaging", skill: "Implantação" },
    { name: "Messaging: Telegram", hours: 1.0, category: "Canais - Messaging", skill: "Implantação" },
    { name: "Messaging: Text/SMS (por número)", hours: 0.17, category: "Canais - Messaging", skill: "Implantação" },
  ];

  for (const pkg of packages) {
    await prisma.package.upsert({
      where: { name: pkg.name },
      update: { ...pkg, isActive: true },
      create: { ...pkg, isActive: true }
    });
  }

  const variables = [
    { key: "VALOR_HORA_SC", value: "250", category: "Preços" },
    { key: "VALOR_HORA_DEV", value: "350", category: "Preços" },
    { key: "VALOR_HORA_DESIGN", value: "200", category: "Preços" },
    { key: "MIN_HOURS_AE", value: "8", category: "Limites" },
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
