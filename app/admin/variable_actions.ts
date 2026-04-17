'use server';

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function addVariableAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error("Não autorizado");

  const key = formData.get("key") as string;
  const value = formData.get("value") as string;
  const category = formData.get("category") as string;

  await prisma.variable.upsert({
    where: { key },
    update: { value, category, isActive: true },
    create: { key, value, category, isActive: true }
  });

  revalidatePath("/admin");
}

export async function deleteVariableAction(id: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.isAdmin) throw new Error("Não autorizado");

  await prisma.variable.update({
    where: { id },
    data: { isActive: false }
  });
  revalidatePath("/admin");
}
