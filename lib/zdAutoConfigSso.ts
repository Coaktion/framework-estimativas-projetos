/**
 * Autenticação do site no ZD Auto Config (serviço Python separado).
 *
 * A tela do ZD Auto Config mora no site (/zd-auto-config). Para falar com a API
 * do serviço, ela pede aqui um token curto, assinado com HMAC-SHA256 no formato
 * JWT HS256, e o envia em `Authorization: Bearer`. O serviço confere
 * assinatura, emissor, destino, validade e segmento. Não há segundo login.
 *
 * Só roda no servidor: o segredo (ZDCFG_SSO_SECRET) nunca vai para o browser.
 */
import { createHmac, randomUUID } from 'crypto';

const ISSUER = 'pre-sales-ai';
const AUDIENCE = 'zd-auto-config-api';
/** Validade do token. A tela renova sozinha antes de expirar. */
export const ZDCFG_TOKEN_TTL_SECONDS = 15 * 60;

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function zdAutoConfigSsoSecret(): string {
  return (process.env.ZDCFG_SSO_SECRET || '').trim();
}

export function signZdAutoConfigToken(
  user: { email: string; name?: string | null; role?: string | null; isAdmin?: boolean },
  secret: string = zdAutoConfigSsoSecret(),
  ttlSeconds: number = ZDCFG_TOKEN_TTL_SECONDS,
): { token: string; expiresAt: number } {
  if (!secret) throw new Error('ZDCFG_SSO_SECRET não configurada');
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    iss: ISSUER,
    aud: AUDIENCE,
    sub: user.email,
    name: user.name || user.email,
    role: user.role || '',
    adm: Boolean(user.isAdmin),
    iat: now,
    exp: now + ttlSeconds,
    jti: randomUUID(),
  };
  const body = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature = b64url(createHmac('sha256', secret).update(body).digest());
  return { token: `${body}.${signature}`, expiresAt: payload.exp * 1000 };
}
