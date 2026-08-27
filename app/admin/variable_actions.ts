'use server';

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerT } from "@/app/i18n/server";

export async function addVariableAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error(getServerT()('errors.notAuthorized'));

  const key = formData.get("key") as string;
  const label = String(formData.get("label") || "").trim();
  const labelEn = String(formData.get("labelEn") || "").trim();
  const value = formData.get("value") as string;
  const category = formData.get("category") as string;
  const type = (formData.get("type") as string) || "PERCENT";
  const flatValue = parseFloat(formData.get("flatValue") as string) || 0;

  await prisma.variable.upsert({
    where: { key },
    update: { label, labelEn, value, category, type, flatValue, isActive: true },
    create: { key, label, labelEn, value, category, type, flatValue, isActive: true }
  });

  revalidatePath("/admin");
}

export async function updateVariableAction(id: number, data: any) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error(getServerT()('errors.notAuthorized'));

  const { targetItems, targetCategories, excludedItems, flatValue, ...rest } = data;

  await prisma.variable.update({
    where: { id },
    data: {
      ...rest,
      flatValue: flatValue !== undefined ? parseFloat(flatValue) : undefined,
      targetItems: targetItems ? JSON.stringify(targetItems) : undefined,
      targetCategories: targetCategories ? JSON.stringify(targetCategories) : undefined,
      excludedItems: excludedItems ? JSON.stringify(excludedItems) : undefined
    }
  });

  revalidatePath("/admin");
}

export async function deleteVariableAction(id: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error(getServerT()('errors.notAuthorized'));

  await prisma.variable.update({
    where: { id },
    data: { isActive: false }
  });
  revalidatePath("/admin");
}
