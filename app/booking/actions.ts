'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { getServerLanguage } from '@/app/i18n/server';
import { BookingError, allowedTypes, isEmail, normalizeBookingConfig, type BookingConfig } from '@/lib/booking/config';
import { BOOKING_LIMITS, type Iv } from '@/lib/booking/engine';
import { GoogleCalendarApi, decryptToken, fetchCalendarTimeZone, revokeToken } from '@/lib/booking/google';
import {
  bookingFailure, engineFor, hostConfig, hostLogger, isConnected, loadHost, recordBlocks, recordMeetings,
  requireBookingUser, saveHostConfig, scanOrphans,
} from '@/lib/booking/server';

type Fail = { ok: false; error: string; detail?: string };

/* ------------------------------------------------------------------------ */
/*                       Anfitrião: minhas regras                            */
/* ------------------------------------------------------------------------ */

export async function saveBookingRulesAction(config: BookingConfig): Promise<{ ok: true; config: BookingConfig } | Fail> {
  try {
    const user = await requireBookingUser();
    const saved = await saveHostConfig(user.id, normalizeBookingConfig(config));
    revalidatePath('/booking');
    return { ok: true, config: saved };
  } catch (e) {
    return bookingFailure(e);
  }
}

/** Liga/desliga só a limpeza automática, sem mexer no resto das regras (nem no rascunho da tela). */
export async function setAutoCleanupAction(on: boolean): Promise<{ ok: true } | Fail> {
  try {
    const user = await requireBookingUser();
    const config = hostConfig(await loadHost(user.id));
    config.settings.autoCleanup = Boolean(on);
    await saveHostConfig(user.id, config);
    return { ok: true };
  } catch (e) {
    return bookingFailure(e);
  }
}

export async function setAcceptingAction(accepting: boolean): Promise<{ ok: true } | Fail> {
  try {
    const user = await requireBookingUser();
    const row = await loadHost(user.id);
    if (row) await prisma.bookingHost.update({ where: { userId: user.id }, data: { accepting } });
    else await prisma.bookingHost.create({ data: { userId: user.id, config: hostConfig(null) as any, accepting } });
    revalidatePath('/booking');
    return { ok: true };
  } catch (e) {
    return bookingFailure(e);
  }
}

export async function disconnectGoogleAction(): Promise<{ ok: true } | Fail> {
  try {
    const user = await requireBookingUser();
    const row = await loadHost(user.id);
    if (row?.refreshTokenEnc) {
      try { await revokeToken(decryptToken(row.refreshTokenEnc)); } catch { /* segue */ }
    }
    if (row) {
      await prisma.bookingHost.update({
        where: { userId: user.id },
        data: { refreshTokenEnc: null, accessTokenEnc: null, accessExpiresAt: null, googleEmail: null, connectedAt: null },
      });
    }
    revalidatePath('/booking');
    return { ok: true };
  } catch (e) {
    return bookingFailure(e);
  }
}

/** Diagnóstico: a agenda responde? Atualiza o fuso guardado. */
export async function testConnectionAction(): Promise<{ ok: true; email: string; timeZone: string; records: number; upcoming: number } | Fail> {
  try {
    const user = await requireBookingUser();
    const row = await loadHost(user.id);
    if (!row || !isConnected(row)) throw new BookingError('calendar_not_connected');
    const api = new GoogleCalendarApi(row);
    await api.listEvents({ timeMin: new Date().toISOString(), timeMax: new Date(Date.now() + 86400000).toISOString() });
    const timeZone = await fetchCalendarTimeZone(await api.getToken());
    if (timeZone !== row.timeZone) await prisma.bookingHost.update({ where: { userId: user.id }, data: { timeZone } });
    const [records, upcoming] = await Promise.all([
      prisma.bookingRecord.count({ where: { hostId: user.id } }),
      prisma.bookingRecord.count({ where: { hostId: user.id, lastEnd: { gte: new Date() } } }),
    ]);
    return { ok: true, email: api.email, timeZone, records, upcoming };
  } catch (e) {
    return bookingFailure(e);
  }
}

export type HostBooking = {
  group: string; title: string; requester: string; email: string; typeId: string; typeName: string; createdAt: string; multi: boolean;
  meetings: { id: string; start: string; end: string; state: string; declinedBy: string | null }[];
  blocks: { id: string; role: string; start: string; end: string; state: string }[];
  lastMeetingEnd: string | null; liveMeetings: number; liveBlocks: number;
  fullyDeleted: boolean; meetingDeleted: boolean; declined: boolean;
};

/** Agendamentos recebidos (últimos 180 dias), com o estado real de cada evento. */
export async function listHostBookingsAction(): Promise<{ ok: true; bookings: HostBooking[]; truncated: number } | Fail> {
  try {
    const user = await requireBookingUser();
    const row = await loadHost(user.id);
    if (!row) return { ok: true, bookings: [], truncated: 0 };
    const since = new Date(Date.now() - 180 * 86400000);
    const [records, older] = await Promise.all([
      prisma.bookingRecord.findMany({ where: { hostId: user.id, lastEnd: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 400 }),
      prisma.bookingRecord.count({ where: { hostId: user.id, lastEnd: { lt: since } } }),
    ]);
    const parsed = records.map((r) => ({ r, meetings: recordMeetings(r), blocks: recordBlocks(r) }));
    let states = new Map<string, { state: string; by?: string }>();
    if (isConnected(row) && parsed.length) {
      const { engine } = engineFor(row);
      states = await engine.loadEventStates(parsed);
    }
    const stateOf = (id: string) => states.get(id) || { state: isConnected(row) ? 'deleted' : 'unknown' };
    const bookings = parsed.map(({ r, meetings, blocks }): HostBooking => {
      const ms = meetings.map((m) => {
        const st = stateOf(m.i);
        return { id: m.i, start: m.s, end: m.e, state: st.state, declinedBy: st.by || null };
      });
      const bs = blocks.map((x) => ({ id: x.i, role: x.r, start: x.s, end: x.e, state: stateOf(x.i).state }));
      const liveMeetings = ms.filter((m) => m.state !== 'deleted').length;
      const liveBlocks = bs.filter((b) => b.state !== 'deleted').length;
      return {
        group: r.id, title: r.title, requester: r.requesterName, email: r.requesterEmail, typeId: r.typeId, typeName: r.typeName,
        createdAt: r.createdAt.toISOString(), multi: r.multi, meetings: ms, blocks: bs,
        lastMeetingEnd: r.lastEnd.toISOString(), liveMeetings, liveBlocks,
        fullyDeleted: liveMeetings === 0 && liveBlocks === 0,
        meetingDeleted: liveMeetings === 0 && ms.length > 0,
        declined: ms.some((m) => m.state === 'declined'),
      };
    });
    return { ok: true, bookings, truncated: older + Math.max(0, records.length - 400) };
  } catch (e) {
    return bookingFailure(e);
  }
}

export async function deleteBookingEventsAction(groups: string[], scope: 'all' | 'blocks' | 'before' | 'after'): Promise<{ ok: true; removed: number; failed: number } | Fail> {
  try {
    const user = await requireBookingUser();
    const row = await loadHost(user.id);
    if (!row) throw new BookingError('calendar_not_connected');
    const safeScope = (['all', 'blocks', 'before', 'after'] as const).includes(scope) ? scope : 'blocks';
    const { log, flush } = hostLogger(user.id);
    const { engine } = engineFor(row, { log });
    const records = await prisma.bookingRecord.findMany({ where: { hostId: user.id, id: { in: groups.slice(0, 200) } } });
    let removed = 0;
    let failed = 0;
    for (const r of records) {
      const res = await engine.deleteEvents({ meetings: recordMeetings(r), blocks: recordBlocks(r) }, safeScope);
      removed += res.removed;
      failed += res.failed;
    }
    log('info', 'events_deleted', { scope: safeScope, groups: records.length, removed, failed });
    await flush();
    return { ok: true, removed, failed };
  } catch (e) {
    return bookingFailure(e);
  }
}

export async function scanOrphansAction(kind: 'deleted' | 'declined') {
  try {
    const user = await requireBookingUser();
    const row = await loadHost(user.id);
    if (!row) throw new BookingError('calendar_not_connected');
    const { engine } = engineFor(row);
    const found = await scanOrphans(user.id, engine, kind === 'declined' ? 'declined' : 'deleted');
    return { ok: true as const, kind, found };
  } catch (e) {
    return bookingFailure(e);
  }
}

export async function getBookingLogAction() {
  try {
    const user = await requireBookingUser();
    const rows = await prisma.bookingLog.findMany({ where: { hostId: user.id }, orderBy: { id: 'desc' }, take: 300 });
    return {
      ok: true as const,
      entries: rows.map((r) => ({ t: r.createdAt.toISOString(), l: r.level, c: r.code, d: r.data as Record<string, unknown> })),
    };
  } catch (e) {
    return bookingFailure(e);
  }
}

export async function clearBookingLogAction(): Promise<{ ok: true } | Fail> {
  try {
    const user = await requireBookingUser();
    await prisma.bookingLog.deleteMany({ where: { hostId: user.id } });
    return { ok: true };
  } catch (e) {
    return bookingFailure(e);
  }
}

/* ------------------------------------------------------------------------ */
/*                    Quem agenda: horários e reserva                        */
/* ------------------------------------------------------------------------ */

async function bookableHost(hostId: number, typeId: string) {
  const user = await requireBookingUser();
  const row = await loadHost(hostId);
  if (!row || !isConnected(row) || !row.accepting) throw new BookingError('host_unavailable');
  const config = hostConfig(row);
  // Na própria agenda (prévia das regras) todos os tipos valem.
  const types = user.id === hostId ? config.types : allowedTypes(config, { email: user.email, segment: user.segment });
  if (!types.some((t) => t.id === typeId)) throw new BookingError('type_not_allowed');
  return { user, row };
}

export interface FindSlotsInput {
  hostId: number;
  typeId: string;
  itemIds: string[];
  durationMin: number;
  multi: boolean;
  checkMine: boolean;
  checkEmails: string[];
  fromDay: number;
  days: number;
}

export async function findSlotsAction(input: FindSlotsInput) {
  try {
    const { user, row } = await bookableHost(Number(input.hostId), String(input.typeId));
    const { api, engine } = engineFor(row);
    const hostEmail = api.email;
    const guestEmails = Array.from(new Set((input.checkEmails || []).map((e) => String(e || '').trim().toLowerCase())))
      .filter((e) => isEmail(e) && e !== hostEmail && e !== user.email)
      .slice(0, BOOKING_LIMITS.MAX_CHECK_CALS);
    const checkMine = Boolean(input.checkMine) && user.email !== hostEmail;

    const othersBusy = checkMine || guestEmails.length
      ? async (fromMs: number, toMs: number) => {
          const busy: Iv[] = [];
          const unavailable: string[] = [];
          const timeMin = new Date(fromMs).toISOString();
          const timeMax = new Date(toMs).toISOString();
          const viaHost = [...guestEmails];
          if (checkMine) {
            // Quem agenda e tem a própria agenda conectada: lê direto dela.
            const mine = await loadHost(user.id);
            if (mine && isConnected(mine)) {
              const own = new GoogleCalendarApi(mine);
              const r = await own.freeBusy([own.email], timeMin, timeMax);
              if (r[own.email]) busy.push(...r[own.email]!);
              else viaHost.push(user.email);
            } else {
              viaHost.push(user.email);
            }
          }
          const r = await api.freeBusy(viaHost, timeMin, timeMax);
          viaHost.forEach((email) => {
            if (r[email]) busy.push(...r[email]!);
            else unavailable.push(email);
          });
          return { busy, unavailable };
        }
      : undefined;

    const result = await engine.findSlots({
      typeId: input.typeId, itemIds: input.itemIds, durationMin: input.durationMin, multi: input.multi,
      fromDay: input.fromDay, days: input.days, othersBusy,
    });
    return { ok: true as const, ...result };
  } catch (e) {
    return bookingFailure(e);
  }
}

export interface BookInput {
  hostId: number;
  typeId: string;
  itemIds: string[];
  durationMin: number;
  starts: string[];
  title: string;
  zoho: string;
  notes: string;
  guests: string[];
  requestId: string;
}

export type BookSuccess = {
  ok: true;
  group: string;
  title: string;
  multi: boolean;
  typeName: string;
  durationMin: number;
  hostName: string;
  bookings: { eventId: string; start: string; end: string; meetLink: string | null }[];
  roles: Record<string, { blocks: { start: string; end: string }[]; minutes: number; outsideWindow?: boolean } | null>;
  replayed?: boolean;
};

export async function bookAction(input: BookInput): Promise<BookSuccess | Fail> {
  const hostId = Number(input.hostId);
  const requestId = String(input.requestId || '').slice(0, 60) || null;
  let flushLog: (() => Promise<void>) | null = null;
  try {
    const { user, row } = await bookableHost(hostId, String(input.typeId));
    // Idempotência: um reenvio do mesmo pedido devolve o resultado original.
    if (requestId) {
      const prev = await prisma.bookingRecord.findUnique({ where: { hostId_requestId: { hostId, requestId } } });
      if (prev?.result) return { ...(prev.result as any), replayed: true };
    }
    const { log, flush } = hostLogger(hostId);
    flushLog = flush;
    const { engine } = engineFor(row, { log, lang: getServerLanguage() });
    const host = await prisma.user.findUnique({ where: { id: hostId }, select: { name: true, email: true } });
    const res = await engine.book({
      typeId: input.typeId, itemIds: input.itemIds, durationMin: input.durationMin, starts: input.starts,
      title: input.title, zoho: input.zoho, notes: input.notes, guests: input.guests,
      requester: { email: user.email, name: user.name },
    });
    const result: BookSuccess = {
      ok: true, group: res.group, title: res.title, multi: res.multi, typeName: res.typeName, durationMin: res.durationMin,
      hostName: host?.name || host?.email || '', bookings: res.bookings, roles: res.roles,
    };
    await prisma.bookingRecord.create({
      data: {
        id: res.group, hostId, requesterId: user.id, requesterEmail: user.email, requesterName: user.name,
        title: input.title.trim().slice(0, 120), typeId: res.typeId, typeName: res.typeName, multi: res.multi,
        meetings: res.bookings.map((b) => ({ i: b.eventId, s: b.start, e: b.end })) as any,
        blocks: res.blocks as any,
        firstStart: new Date(res.bookings[0].start), lastEnd: new Date(res.bookings[res.bookings.length - 1].end),
        requestId, result: result as any,
      },
    });
    await flush();
    revalidatePath('/booking');
    return result;
  } catch (e) {
    if (flushLog) await flushLog();
    return bookingFailure(e);
  }
}

/** Quem agendou cancela: apaga a reunião (os convidados são avisados) e os bloqueios. */
export async function cancelMyBookingAction(group: string): Promise<{ ok: true; removed: number } | Fail> {
  try {
    const user = await requireBookingUser();
    const record = await prisma.bookingRecord.findFirst({ where: { id: String(group), requesterId: user.id } });
    if (!record) throw new BookingError('not_found');
    const row = await loadHost(record.hostId);
    if (!row) throw new BookingError('host_unavailable');
    const { log, flush } = hostLogger(record.hostId);
    const { engine } = engineFor(row, { log });
    const res = await engine.deleteEvents({ meetings: recordMeetings(record), blocks: recordBlocks(record) }, 'all');
    log('info', 'cancelled_by_requester', { group: record.id, title: record.title, email: user.email, removed: res.removed, failed: res.failed });
    await flush();
    await prisma.bookingRecord.update({ where: { id: record.id }, data: { result: { ...(record.result as any || {}), cancelledAt: new Date().toISOString() } as any } });
    revalidatePath('/booking');
    return { ok: true, removed: res.removed };
  } catch (e) {
    return bookingFailure(e);
  }
}
