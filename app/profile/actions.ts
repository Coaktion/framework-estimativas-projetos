'use server';

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerT } from "@/app/i18n/server";
import { canAccessScopes } from "@/lib/segments";
import { generateApiKey } from "@/lib/api-keys";

// ---------------------------------------------------------------------------
// Chaves de API (MCP do Tool Center). Só quem acessa o editor de escopos pode
// criar: é o que a chave permite fazer.
// ---------------------------------------------------------------------------

type ApiKeyRow = { id: number; name: string; prefix: string; createdAt: string; lastUsedAt: string | null };
type CreateApiKeyResult = { success: boolean; error?: string; key?: string; row?: ApiKeyRow };

const toRow = (k: { id: number; name: string; prefix: string; createdAt: Date; lastUsedAt: Date | null }): ApiKeyRow => ({
  id: k.id,
  name: k.name,
  prefix: k.prefix,
  createdAt: k.createdAt.toISOString(),
  lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
});

/** Chaves ativas do próprio usuário (sem o valor, que não é guardado). */
export async function listApiKeysAction(): Promise<ApiKeyRow[]> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return [];
  const keys = await prisma.apiKey.findMany({
    where: { userId: parseInt(session.user.id), revokedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  return keys.map(toRow);
}

/** Cria uma chave e devolve o valor UMA única vez. */
export async function createApiKeyAction(rawName: string): Promise<CreateApiKeyResult> {
  const t = getServerT();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: t('errors.notAuthenticated') };
  if (!canAccessScopes(session.user as any)) return { success: false, error: t('errors.notAuthorized') };

  const name = String(rawName || '').trim().slice(0, 60);
  if (!name) return { success: false, error: t('profile.apiKeyNameRequired') };

  try {
    const { raw, prefix, hash } = generateApiKey();
    const created = await prisma.apiKey.create({
      data: { userId: parseInt(session.user.id), name, prefix, hash },
    });
    return { success: true, key: raw, row: toRow(created) };
  } catch (e) {
    console.error('createApiKeyAction error:', e);
    return { success: false, error: t('errors.generic') };
  }
}

/** Revoga uma chave do próprio usuário. A chave para de funcionar na hora. */
export async function revokeApiKeyAction(id: number): Promise<{ success: boolean }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false };
  const result = await prisma.apiKey.updateMany({
    where: { id: Number(id), userId: parseInt(session.user.id), revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return { success: result.count > 0 };
}
