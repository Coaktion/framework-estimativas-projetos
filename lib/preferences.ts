'use server';

import prisma from "./prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { revalidatePath } from "next/cache";

export async function getUserPreferencesAction() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const userId = parseInt(session.user.id);
  
  let prefs = await prisma.userPreference.findUnique({
    where: { userId }
  });

  if (!prefs) {
    prefs = await prisma.userPreference.create({
      data: { userId }
    });
  }

  return prefs;
}

export async function updateUserPreferenceAction(data: any) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Não autorizado");

  const userId = parseInt(session.user.id);

  const prefs = await prisma.userPreference.upsert({
    where: { userId },
    update: data,
    create: { ...data, userId }
  });

  revalidatePath("/");
  return prefs;
}

export async function savePresetAction(name: string, hiddenItems: string[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Não autorizado");

  const userId = parseInt(session.user.id);
  
  const currentPrefs = await prisma.userPreference.findUnique({
    where: { userId }
  });

  const presets = currentPrefs?.presets ? JSON.parse(currentPrefs.presets) : [];
  const newPresets = [...presets, { name, hiddenItems, createdAt: new Date() }];

  await prisma.userPreference.update({
    where: { userId },
    data: { presets: JSON.stringify(newPresets) }
  });

  revalidatePath("/");
}

export async function deletePresetAction(presetName: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Não autorizado");

  const userId = parseInt(session.user.id);
  
  const currentPrefs = await prisma.userPreference.findUnique({
    where: { userId }
  });

  if (!currentPrefs?.presets) return;

  const presets = JSON.parse(currentPrefs.presets);
  const newPresets = presets.filter((p: any) => p.name !== presetName);

  await prisma.userPreference.update({
    where: { userId },
    data: { presets: JSON.stringify(newPresets) }
  });

  revalidatePath("/");
}
