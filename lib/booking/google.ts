/**
 * Google Agenda do Agendamento — SÓ SERVIDOR.
 *
 * Cada anfitrião conecta a própria conta Google (OAuth, acesso offline). O
 * refresh token fica cifrado no banco (Fernet, chave BOOKING_TOKEN_KEY ou,
 * na falta dela, uma chave derivada de NEXTAUTH_SECRET); o navegador nunca
 * recebe token nenhum. As chamadas à API do Google Agenda são fetch puro.
 *
 * Configuração (uma vez, no Google Cloud): cliente OAuth "Aplicativo da Web"
 * com a Google Calendar API ativada, tela de consentimento "Interno" e a URL
 * <site>/api/booking/google/callback cadastrada como URI de redirecionamento.
 * Variáveis: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (e, opcionalmente,
 * BOOKING_TOKEN_KEY e GOOGLE_OAUTH_REDIRECT_URI).
 */
import { createHash } from 'crypto';
import prisma from '@/lib/prisma';
import { fernetDecrypt, fernetEncrypt } from '@/lib/zdcfg/fernet';
import { BookingError } from './config';
import type { CalEvent, CalendarApi, Iv } from './engine';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const API = 'https://www.googleapis.com/calendar/v3';

/** calendar.events cria/move/apaga eventos; calendar.readonly lê o fuso e a ocupação de outras pessoas. */
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];

/** Cookie com o `state` do OAuth, conferido no retorno do Google. */
export const OAUTH_STATE_COOKIE = 'tc_booking_oauth';

export const googleConfigured =() => Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());

function tokenKey(): string {
  const explicit = (process.env.BOOKING_TOKEN_KEY || '').trim();
  if (explicit) return explicit;
  const secret = (process.env.NEXTAUTH_SECRET || '').trim();
  if (!secret) throw new BookingError('google_not_configured', 'BOOKING_TOKEN_KEY / NEXTAUTH_SECRET');
  return createHash('sha256').update(`tool-center-booking:${secret}`).digest('base64').replace(/\+/g, '-').replace(/\//g, '_');
}

export const encryptToken = (value: string) => fernetEncrypt(value, tokenKey());
export const decryptToken = (value: string) => fernetDecrypt(value, tokenKey());

/** URI de retorno do OAuth para o site que recebeu a requisição. */
export function redirectUriFor(req: Request): string {
  const fixed = (process.env.GOOGLE_OAUTH_REDIRECT_URI || '').trim();
  if (fixed) return fixed;
  const h = req.headers;
  const host = h.get('x-forwarded-host') || h.get('host') || new URL(req.url).host;
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return `${proto.split(',')[0].trim()}://${host.split(',')[0].trim()}/api/booking/google/callback`;
}

export function buildAuthUrl(state: string, redirectUri: string, loginHint?: string): string {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
  });
  if (loginHint) q.set('login_hint', loginHint);
  return `${AUTH_URL}?${q.toString()}`;
}

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string; scope?: string; id_token?: string };

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      ...body,
    }),
    cache: 'no-store',
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new BookingError(data?.error === 'invalid_grant' ? 'calendar_reconnect' : 'google_error', String(data?.error_description || data?.error || res.status));
    throw err;
  }
  return data as TokenResponse;
}

export const exchangeCode = (code: string, redirectUri: string) =>
  tokenRequest({ code, redirect_uri: redirectUri, grant_type: 'authorization_code' });

/** E-mail da conta Google, lido do id_token devolvido pelo próprio Google. */
export function emailFromIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

export async function revokeToken(token: string) {
  try {
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: 'POST', cache: 'no-store' });
  } catch {
    // revogar é cortesia: a conexão some do banco de qualquer jeito
  }
}

/** Fuso da agenda principal. */
export async function fetchCalendarTimeZone(accessToken: string): Promise<string> {
  const res = await fetch(`${API}/calendars/primary`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new BookingError('google_error', String(data?.error?.message || res.status));
  return String(data.timeZone || 'America/Sao_Paulo');
}

type HostRow = {
  userId: number;
  googleEmail: string | null;
  refreshTokenEnc: string | null;
  accessTokenEnc: string | null;
  accessExpiresAt: Date | null;
  timeZone: string | null;
};

/** API do Google Agenda de um anfitrião conectado. */
export class GoogleCalendarApi implements CalendarApi {
  email: string;
  timeZone: string;
  private accessToken: string | null = null;
  private expiresAt = 0;

  constructor(private row: HostRow) {
    if (!row.refreshTokenEnc || !row.googleEmail) throw new BookingError('calendar_not_connected');
    this.email = row.googleEmail.toLowerCase();
    this.timeZone = row.timeZone || 'America/Sao_Paulo';
    if (row.accessTokenEnc && row.accessExpiresAt) {
      try {
        this.accessToken = decryptToken(row.accessTokenEnc);
        this.expiresAt = row.accessExpiresAt.getTime();
      } catch {
        this.accessToken = null;
      }
    }
  }

  async getToken(force = false): Promise<string> {
    if (!force && this.accessToken && this.expiresAt - 60000 > Date.now()) return this.accessToken;
    let refresh: string;
    try {
      refresh = decryptToken(this.row.refreshTokenEnc!);
    } catch {
      throw new BookingError('calendar_reconnect', 'token');
    }
    try {
      const t = await tokenRequest({ refresh_token: refresh, grant_type: 'refresh_token' });
      this.accessToken = t.access_token;
      this.expiresAt = Date.now() + (t.expires_in || 3600) * 1000;
      await prisma.bookingHost.update({
        where: { userId: this.row.userId },
        data: { accessTokenEnc: encryptToken(t.access_token), accessExpiresAt: new Date(this.expiresAt) },
      }).catch(() => {});
      return t.access_token;
    } catch (e) {
      if (e instanceof BookingError && e.code === 'calendar_reconnect') {
        // Acesso revogado ou expirado no Google: a conexão precisa ser refeita.
        await prisma.bookingHost.update({
          where: { userId: this.row.userId },
          data: { refreshTokenEnc: null, accessTokenEnc: null, accessExpiresAt: null },
        }).catch(() => {});
      }
      throw e;
    }
  }

  private async call(method: string, path: string, body?: unknown, retry = true): Promise<any> {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${await this.getToken(!retry)}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    if (res.status === 401 && retry) return this.call(method, path, body, false);
    if (res.status === 204) return null;
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const reason = data?.error?.errors?.[0]?.reason || '';
      const err: any = new Error(`${res.status} ${reason} ${data?.error?.message || ''}`.trim());
      err.status = res.status;
      throw err;
    }
    return data;
  }

  async listEvents(p: { timeMin: string; timeMax: string; privateExtendedProperty?: string; showDeleted?: boolean }): Promise<CalEvent[]> {
    const out: CalEvent[] = [];
    let pageToken: string | undefined;
    let guard = 0;
    do {
      const q = new URLSearchParams({
        timeMin: p.timeMin, timeMax: p.timeMax, singleEvents: 'true', maxResults: '2500',
        showDeleted: p.showDeleted ? 'true' : 'false',
      });
      if (p.privateExtendedProperty) q.set('privateExtendedProperty', p.privateExtendedProperty);
      if (pageToken) q.set('pageToken', pageToken);
      const data = await this.call('GET', `/calendars/primary/events?${q.toString()}`);
      out.push(...((data?.items as CalEvent[]) || []));
      pageToken = data?.nextPageToken;
    } while (pageToken && guard++ < 10);
    return out;
  }

  async freeBusy(emails: string[], timeMin: string, timeMax: string): Promise<Record<string, Iv[] | null>> {
    const out: Record<string, Iv[] | null> = {};
    if (!emails.length) return out;
    try {
      const data = await this.call('POST', '/freeBusy', { timeMin, timeMax, items: emails.map((id) => ({ id })) });
      emails.forEach((email) => {
        const cal = data?.calendars?.[email];
        out[email] = !cal || (cal.errors && cal.errors.length)
          ? null
          : (cal.busy || []).map((b: any) => [new Date(b.start).getTime(), new Date(b.end).getTime()] as Iv);
      });
    } catch {
      emails.forEach((email) => { out[email] = null; });
    }
    return out;
  }

  async insertEvent(resource: Record<string, any>, opts: { sendUpdates?: 'all' | 'none'; conferenceDataVersion?: number } = {}): Promise<CalEvent> {
    const q = new URLSearchParams();
    if (opts.sendUpdates) q.set('sendUpdates', opts.sendUpdates);
    if (opts.conferenceDataVersion !== undefined) q.set('conferenceDataVersion', String(opts.conferenceDataVersion));
    const qs = q.toString();
    return this.call('POST', `/calendars/primary/events${qs ? `?${qs}` : ''}`, resource);
  }

  async patchEvent(id: string, patch: Record<string, any>): Promise<void> {
    await this.call('PATCH', `/calendars/primary/events/${encodeURIComponent(id)}`, patch);
  }

  async deleteEvent(id: string, opts: { sendUpdates?: 'all' | 'none' } = {}): Promise<'deleted' | 'gone'> {
    try {
      await this.call('DELETE', `/calendars/primary/events/${encodeURIComponent(id)}?sendUpdates=${opts.sendUpdates || 'none'}`);
      return 'deleted';
    } catch (e: any) {
      if (e?.status === 404 || e?.status === 410) return 'gone';
      throw e;
    }
  }
}
