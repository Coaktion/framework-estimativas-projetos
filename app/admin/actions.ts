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

  // Simple restore strategy: deactivate current and create/update from snapshot
  // In a real app, you might want a more sophisticated merge/restore
  await prisma.package.updateMany({ data: { isActive: false } });
  await prisma.variable.updateMany({ data: { isActive: false } });

  for (const pkg of packages) {
    const { id, createdAt, ...pkgData } = pkg;
    await prisma.package.create({ data: { ...pkgData, isActive: true } });
  }

  for (const v of variables) {
    const { id, updatedAt, ...vData } = v;
    await prisma.variable.create({ data: { ...vData, isActive: true } });
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
  const hours = parseFloat(formData.get("hours") as string);
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
