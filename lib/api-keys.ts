/**
 * Chaves de API do Tool Center (usadas pelo MCP e por integrações).
 *
 * - Cada chave pertence a um usuário e age como ele: as mesmas regras de
 *   acesso da tela valem para quem chama com a chave.
 * - O valor só existe na hora da criação. No banco fica o hash SHA-256 — uma
 *   cópia do banco não dá acesso a nada.
 * - A chave viaja no header `Authorization: Bearer tc_...`, nunca na URL
 *   (URLs ficam em logs do Netlify, de proxies e do navegador).
 */

import { createHash, randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { normalizeSegment, syncIsAdmin } from '@/lib/segments';

export const API_KEY_PREFIX = 'tc_';
/** Quantos caracteres do início ficam visíveis na lista do Perfil. */
const VISIBLE_PREFIX_LENGTH = API_KEY_PREFIX.length + 4;
/** Evita gravar `lastUsedAt` a cada chamada: uma vez por minuto basta. */
const LAST_USED_THROTTLE_MS = 60_000;

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

/** Gera uma chave nova. O valor devolvido em `raw` não é gravado em lugar nenhum. */
export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const raw = API_KEY_PREFIX + randomBytes(32).toString('base64url');
  return { raw, prefix: raw.slice(0, VISIBLE_PREFIX_LENGTH), hash: hashApiKey(raw) };
}

/** Usuário dono da chave, no mesmo formato de `session.user`. */
export interface ApiKeyUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isAdmin: boolean;
  apiKeyId: number;
}

/** Extrai a chave do header Authorization (Bearer) ou de x-api-key. */
export function readApiKey(req: Request): string | null {
  const auth = req.headers.get('authorization') || '';
  const bearer = auth.match(/^Bearer\s+(\S+)$/i)?.[1];
  const raw = bearer || req.headers.get('x-api-key') || '';
  return raw.startsWith(API_KEY_PREFIX) ? raw : null;
}

/** Confere a chave e devolve o usuário dono, ou null (inexistente, revogada ou usuário removido). */
export async function authenticateApiKey(req: Request): Promise<ApiKeyUser | null> {
  const raw = readApiKey(req);
  if (!raw) return null;
  const key = await prisma.apiKey.findUnique({
    where: { hash: hashApiKey(raw) },
    include: { user: true },
  });
  if (!key || key.revokedAt || !key.user) return null;

  if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > LAST_USED_THROTTLE_MS) {
    await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  }

  const segment = normalizeSegment(key.user.role);
  return {
    id: String(key.user.id),
    email: key.user.email,
    name: key.user.name,
    role: segment,
    isAdmin: key.user.isAdmin || syncIsAdmin(segment),
    apiKeyId: key.id,
  };
}
