/**
 * Agendamento — camada de servidor: quem está logado, regras e agenda de cada
 * anfitrião, registros de agendamento e registro de atividade. SÓ SERVIDOR.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { canAccessBooking, normalizeSegment } from '@/lib/segments';
import { BookingError, defaultBookingConfig, normalizeBookingConfig, type BookingConfig } from './config';
import { BookingEngine, type BlockRecord, type LogFn, type MeetingRecord, type Lang } from './engine';
import { GoogleCalendarApi } from './google';

export type BookingUser = { id: number; email: string; name: string; segment: string; isAdmin: boolean };

/** Usuário logado com acesso ao Agendamento (null se não tiver). */
export async function getBookingUser(): Promise<BookingUser | null> {
  const session: any = await getServerSession(authOptions);
  const u = session?.user;
  if (!u?.id || !canAccessBooking(u)) return null;
  return {
    id: Number(u.id),
    email: String(u.email || '').toLowerCase(),
    name: String(u.name || u.email || ''),
    segment: normalizeSegment(u.role),
    isAdmin: Boolean(u.isAdmin),
  };
}

export async function requireBookingUser(): Promise<BookingUser> {
  const user = await getBookingUser();
  if (!user) throw new BookingError('not_authorized');
  return user;
}

export async function loadHost(userId: number) {
  return prisma.bookingHost.findUnique({ where: { userId } });
}

export function hostConfig(row: { config: unknown } | null): BookingConfig {
  return row ? normalizeBookingConfig(row.config) : defaultBookingConfig();
}

export const isConnected = (row: { refreshTokenEnc: string | null; googleEmail: string | null } | null) =>
  Boolean(row?.refreshTokenEnc && row.googleEmail);

/** Grava as regras (cria a linha do anfitrião se for a primeira vez). */
export async function saveHostConfig(userId: number, config: BookingConfig) {
  const clean = normalizeBookingConfig(config);
  await prisma.bookingHost.upsert({
    where: { userId },
    create: { userId, config: clean as any },
    update: { config: clean as any },
  });
  return clean;
}

/** Registro de atividade: acumula em memória e grava uma vez por requisição. */
export function hostLogger(hostId: number) {
  const buffer: { level: string; code: string; data: any; createdAt: Date }[] = [];
  const log: LogFn = (level, code, data) => {
    buffer.push({ level, code, data: data || {}, createdAt: new Date() });
  };
  const flush = async () => {
    if (!buffer.length) return;
    const rows = buffer.splice(0).map((b) => ({ hostId, ...b }));
    try {
      await prisma.bookingLog.createMany({ data: rows });
      // Guarda só os últimos 90 dias.
      await prisma.bookingLog.deleteMany({ where: { hostId, createdAt: { lt: new Date(Date.now() - 90 * 86400000) } } });
    } catch {
      // o registro nunca pode derrubar a operação principal
    }
  };
  return { log, flush };
}

/** Motor ligado ao Google Agenda do anfitrião. */
export function engineFor(row: NonNullable<Awaited<ReturnType<typeof loadHost>>>, opts: { log?: LogFn; lang?: Lang } = {}) {
  if (!isConnected(row)) throw new BookingError('calendar_not_connected');
  const api = new GoogleCalendarApi(row);
  return { api, engine: new BookingEngine(api, hostConfig(row), opts) };
}

export const recordMeetings = (r: { meetings: unknown }) => (Array.isArray(r.meetings) ? (r.meetings as MeetingRecord[]) : []);
export const recordBlocks = (r: { blocks: unknown }) => (Array.isArray(r.blocks) ? (r.blocks as BlockRecord[]) : []);

/** Converte um erro qualquer no formato devolvido pelas actions. */
export function bookingFailure(e: unknown): { ok: false; error: string; detail?: string } {
  if (e instanceof BookingError) return { ok: false, error: e.code, detail: e.detail };
  return { ok: false, error: 'server_error', detail: String((e as any)?.message || e).slice(0, 300) };
}

/**
 * Bloqueios órfãos: agendamentos FUTUROS cuja reunião foi apagada ('deleted')
 * ou recusada ('declined') e que ainda têm bloqueios na agenda.
 */
export async function scanOrphans(hostId: number, engine: BookingEngine, kind: 'deleted' | 'declined') {
  const records = await prisma.bookingRecord.findMany({ where: { hostId, lastEnd: { gte: new Date() } }, take: 500 });
  if (!records.length) return [];
  const parsed = records.map((r) => ({ r, meetings: recordMeetings(r), blocks: recordBlocks(r) }));
  const states = await engine.loadEventStates(parsed);
  const stateOf = (id: string) => states.get(id) || { state: 'deleted' as const };
  const found: { group: string; title: string; requester: string; typeName: string; start: string | null; blocks: number; declinedBy: string | null }[] = [];
  parsed.forEach(({ r, meetings, blocks }) => {
    const liveBlocks = blocks.filter((x) => stateOf(x.i).state !== 'deleted').length;
    if (!liveBlocks) return;
    const ms = meetings.map((m) => stateOf(m.i));
    let hit = false;
    let by: string | null = null;
    if (kind === 'deleted') hit = ms.length > 0 && ms.every((s) => s.state === 'deleted');
    else ms.forEach((s) => { if (s.state === 'declined') { hit = true; by = by || s.by || null; } });
    if (hit) found.push({ group: r.id, title: r.title, requester: r.requesterName, typeName: r.typeName, start: meetings[0]?.s || null, blocks: liveBlocks, declinedBy: by });
  });
  return found;
}
