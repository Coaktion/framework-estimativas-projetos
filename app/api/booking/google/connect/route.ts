/**
 * Início da conexão com o Google Agenda (Agendamento): redireciona para o
 * consentimento do Google com um `state` aleatório, conferido no retorno.
 */
import { randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { getBookingUser } from '@/lib/booking/server';
import { OAUTH_STATE_COOKIE, buildAuthUrl, googleConfigured, redirectUriFor } from '@/lib/booking/google';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const base = new URL(req.url);
  const user = await getBookingUser();
  if (!user) return NextResponse.redirect(new URL('/', base));
  if (!googleConfigured()) return NextResponse.redirect(new URL('/booking/rules?google=not_configured', base));

  const state = randomBytes(24).toString('hex');
  const res = NextResponse.redirect(buildAuthUrl(state, redirectUriFor(req), user.email));
  res.cookies.set(OAUTH_STATE_COOKIE, `${state}.${user.id}`, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/booking/google', maxAge: 600,
  });
  return res;
}
