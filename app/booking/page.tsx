import prisma from '@/lib/prisma';
import { getBookingUser, isConnected, loadHost } from '@/lib/booking/server';
import { googleConfigured } from '@/lib/booking/google';
import BookingHomeClient, { type MyBooking } from './BookingHomeClient';

export default async function BookingPage() {
  const user = (await getBookingUser())!;
  const [row, mine, received] = await Promise.all([
    loadHost(user.id),
    prisma.bookingRecord.findMany({
      where: { requesterId: user.id, lastEnd: { gte: new Date(Date.now() - 30 * 86400000) } },
      orderBy: { firstStart: 'asc' },
      take: 100,
    }),
    prisma.bookingRecord.count({ where: { hostId: user.id, lastEnd: { gte: new Date() } } }),
  ]);
  const hostIds = Array.from(new Set(mine.map((r) => r.hostId)));
  const hosts = hostIds.length ? await prisma.user.findMany({ where: { id: { in: hostIds } }, select: { id: true, name: true, email: true } }) : [];
  const hostName = new Map(hosts.map((h) => [h.id, h.name || h.email]));

  const bookings: MyBooking[] = mine.map((r) => {
    const result = (r.result || {}) as any;
    return {
      group: r.id,
      title: r.title,
      typeName: r.typeName,
      hostName: hostName.get(r.hostId) || '',
      multi: r.multi,
      starts: (Array.isArray(r.meetings) ? (r.meetings as any[]) : []).map((m) => String(m.s)),
      end: r.lastEnd.toISOString(),
      meetLink: result?.bookings?.[0]?.meetLink || null,
      cancelledAt: result?.cancelledAt || null,
    };
  });

  return (
    <BookingHomeClient
      status={{
        configured: googleConfigured(),
        connected: isConnected(row),
        googleEmail: row?.googleEmail || null,
        accepting: row ? row.accepting : true,
        upcomingReceived: received,
      }}
      bookings={bookings}
    />
  );
}
