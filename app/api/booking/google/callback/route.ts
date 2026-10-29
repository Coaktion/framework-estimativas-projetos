/**
 * Retorno do consentimento do Google (Agendamento): confere o `state`, troca
 * o código pelos tokens, guarda o refresh token cifrado e volta para as regras.
 */
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { defaultBookingConfig } from '@/lib/booking/config';
import { getBookingUser, loadHost } from '@/lib/booking/server';
import {
  OAUTH_STATE_COOKIE, emailFromIdToken, encryptToken, exchangeCode, fetchCalendarTimeZone, redirectUriFor,
} from '@/lib/booking/google';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (status: string) => {
    const res = NextResponse.redirect(new URL(`/booking/rules?google=${status}`, url));
    res.cookies.set(OAUTH_STATE_COOKIE, '', { path: '/api/booking/google', maxAge: 0 });
    return res;
  };

  const user = await getBookingUser();
  if (!user) return NextResponse.redirect(new URL('/', url));
  if (url.searchParams.get('error')) return back('denied');

  const [state, uid] = String(cookies().get(OAUTH_STATE_COOKIE)?.value || '').split('.');
  const code = url.searchParams.get('code');
  if (!code || !state || state !== url.searchParams.get('state') || Number(uid) !== user.id) return back('state');

  try {
    const tokens = await exchangeCode(code, redirectUriFor(req));
    // Com o consentimento granular, a pessoa pode desmarcar a agenda.
    const granted = String(tokens.scope || '').split(/\s+/);
    const full = granted.includes('https://www.googleapis.com/auth/calendar');
    const has = (scope: string) => full || granted.includes(`https://www.googleapis.com/auth/${scope}`);
    if (!has('calendar.events') || !has('calendar.readonly')) return back('scopes');
    if (!tokens.refresh_token) return back('no_refresh');
    const googleEmail = emailFromIdToken(tokens.id_token) || user.email;
    const timeZone = await fetchCalendarTimeZone(tokens.access_token).catch(() => 'America/Sao_Paulo');
    const data = {
      googleEmail,
      refreshTokenEnc: encryptToken(tokens.refresh_token),
      accessTokenEnc: encryptToken(tokens.access_token),
      accessExpiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
      timeZone,
      connectedAt: new Date(),
    };
    const existing = await loadHost(user.id);
    if (existing) await prisma.bookingHost.update({ where: { userId: user.id }, data });
    else await prisma.bookingHost.create({ data: { userId: user.id, config: defaultBookingConfig() as any, ...data } });
    return back('connected');
  } catch {
    return back('failed');
  }
}
