/**
 * Limpeza automática do Agendamento, chamada de hora em hora pela Scheduled
 * Function do Netlify (netlify/functions/booking-cleanup.mts).
 *
 * Para cada anfitrião com a limpeza automática ligada: apaga os bloqueios de
 * reuniões futuras que foram apagadas ou recusadas. Exige o header
 * x-booking-secret = BOOKING_CRON_SECRET (a rota fica fora do login).
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { engineFor, hostConfig, hostLogger, isConnected, recordBlocks, recordMeetings, scanOrphans } from '@/lib/booking/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const secret = (process.env.BOOKING_CRON_SECRET || '').trim();
  if (!secret || req.headers.get('x-booking-secret') !== secret) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const hosts = await prisma.bookingHost.findMany({ where: { refreshTokenEnc: { not: null } } });
  const summary: { host: number; groups: number; removed: number; error?: string }[] = [];
  for (const row of hosts) {
    if (!isConnected(row) || !hostConfig(row).settings.autoCleanup) continue;
    const { log, flush } = hostLogger(row.userId);
    try {
      const { engine } = engineFor(row, { log });
      const groups = new Set<string>();
      for (const kind of ['deleted', 'declined'] as const) {
        (await scanOrphans(row.userId, engine, kind)).forEach((f) => groups.add(f.group));
      }
      let removed = 0;
      if (groups.size) {
        const records = await prisma.bookingRecord.findMany({ where: { hostId: row.userId, id: { in: Array.from(groups) } } });
        for (const r of records) {
          removed += (await engine.deleteEvents({ meetings: recordMeetings(r), blocks: recordBlocks(r) }, 'blocks')).removed;
        }
        log('info', 'auto_cleanup', { groups: groups.size, removed });
      }
      summary.push({ host: row.userId, groups: groups.size, removed });
    } catch (e) {
      const msg = String((e as any)?.code || (e as any)?.message || e).slice(0, 200);
      log('error', 'auto_cleanup_failed', { detail: msg });
      summary.push({ host: row.userId, groups: 0, removed: 0, error: msg });
    }
    await flush();
  }
  return NextResponse.json({ ok: true, summary });
}
