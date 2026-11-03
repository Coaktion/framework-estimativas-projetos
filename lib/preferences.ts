'use server';

import prisma from "./prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { revalidatePath } from "next/cache";
import { getServerT } from "@/app/i18n/server";

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

/**
 * Só estes campos podem ser alterados pelo cliente. Gravar o objeto recebido
 * direto permitiria trocar `userId`/`user` (mover a linha para outro usuário)
 * ou gravar JSON inválido que quebra os presets.
 */
function sanitizePreferenceUpdate(data: any) {
  const out: { theme?: string; isCompact?: boolean; language?: string; hiddenItems?: string; layoutConfig?: string } = {};
  if (!data || typeof data !== 'object') return out;
  if (data.theme === 'light' || data.theme === 'dark') out.theme = data.theme;
  if (typeof data.isCompact === 'boolean') out.isCompact = data.isCompact;
  if (['pt', 'en', 'es'].includes(data.language)) out.language = data.language;
  const jsonField = (v: unknown, kind: 'array' | 'object') => {
    if (typeof v !== 'string' || v.length > 200_000) return undefined;
    try {
      const parsed = JSON.parse(v);
      const ok = kind === 'array' ? Array.isArray(parsed) : parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed);
      return ok ? v : undefined;
    } catch { return undefined; }
  };
  const hidden = jsonField(data.hiddenItems, 'array');
  if (hidden !== undefined) out.hiddenItems = hidden;
  const layout = jsonField(data.layoutConfig, 'object');
  if (layout !== undefined) out.layoutConfig = layout;
  return out;
}

export async function updateUserPreferenceAction(data: any) {
  const session = await getServerSession(authOptions);
  // Sem sessão (ex.: alternar idioma/tema na tela de login) não há preferência
  // para gravar: sai em silêncio em vez de lançar erro no servidor.
  if (!session?.user?.id) return null;

  const userId = parseInt(session.user.id);
  const clean = sanitizePreferenceUpdate(data);

  const prefs = await prisma.userPreference.upsert({
    where: { userId },
    update: clean,
    create: { ...clean, userId }
  });

  revalidatePath("/");
  return prefs;
}

export async function savePresetAction(name: string, hiddenItems: string[], layoutConfig: any = {}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error(getServerT()('errors.notAuthorized'));

  const userId = parseInt(session.user.id);
  
  const currentPrefs = await prisma.userPreference.findUnique({
    where: { userId }
  });

  const presets = currentPrefs?.presets ? JSON.parse(currentPrefs.presets) : [];
  const newPresets = [...presets, { name, hiddenItems, layoutConfig, createdAt: new Date() }];

  await prisma.userPreference.update({
    where: { userId },
    data: { presets: JSON.stringify(newPresets) }
  });

  revalidatePath("/");
}

export async function deletePresetAction(presetName: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error(getServerT()('errors.notAuthorized'));

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
