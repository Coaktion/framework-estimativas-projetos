'use server';

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerT } from "@/app/i18n/server";
import { recordAdminChange } from "@/lib/admin-audit";

/** Registra a alteração para a aba "Alterações do Admin" do changelog. */
async function audit(action: string, summary: string, details?: unknown) {
  const session: any = await getServerSession(authOptions);
  await recordAdminChange({ userId: Number(session?.user?.id) || null, area: 'variables', action, summary, details });
}

export async function addVariableAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error(getServerT()('errors.notAuthorized'));

  const key = formData.get("key") as string;
  const label = String(formData.get("label") || "").trim();
  const labelEn = String(formData.get("labelEn") || "").trim();
  const labelEs = String(formData.get("labelEs") || "").trim();
  const value = formData.get("value") as string;
  const category = formData.get("category") as string;
  const type = (formData.get("type") as string) || "PERCENT";
  const flatValue = parseFloat(formData.get("flatValue") as string) || 0;

  await prisma.variable.upsert({
    where: { key },
    update: { label, labelEn, labelEs, value, category, type, flatValue, isActive: true },
    create: { key, label, labelEn, labelEs, value, category, type, flatValue, isActive: true }
  });

  await audit('create', `Variável ${key} criada (ou reativada): ${value}`);
  revalidatePath("/admin");
}

export async function updateVariableAction(id: number, data: any) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error(getServerT()('errors.notAuthorized'));

  const { targetItems, targetCategories, excludedItems, flatValue, ...rest } = data;

  const before = await prisma.variable.findUnique({ where: { id } });
  const updatedVariable = await prisma.variable.update({
    where: { id },
    data: {
      ...rest,
      flatValue: flatValue !== undefined ? parseFloat(flatValue) : undefined,
      targetItems: targetItems ? JSON.stringify(targetItems) : undefined,
      targetCategories: targetCategories ? JSON.stringify(targetCategories) : undefined,
      excludedItems: excludedItems ? JSON.stringify(excludedItems) : undefined
    }
  });

  await audit('update', `Variável ${updatedVariable.key} alterada${before && before.value !== updatedVariable.value ? `: ${before.value} → ${updatedVariable.value}` : ` (${Object.keys(data || {}).join(', ')})`}`, { id });
  revalidatePath("/admin");
}

export async function deleteVariableAction(id: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error(getServerT()('errors.notAuthorized'));

  const removedVariable = await prisma.variable.update({
    where: { id },
    data: { isActive: false }
  });
  await audit('delete', `Variável ${removedVariable.key} desativada`);
  revalidatePath("/admin");
}
