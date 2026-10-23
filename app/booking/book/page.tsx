import prisma from '@/lib/prisma';
import { canAccessBooking, normalizeSegment } from '@/lib/segments';
import { allowedTypes } from '@/lib/booking/config';
import { getBookingUser, hostConfig, isConnected } from '@/lib/booking/server';
import HostPickerClient, { type HostCard } from './HostPickerClient';

/** SEs (e admins com agenda conectada) com quem dá para agendar. */
export default async function BookWithSePage() {
  const me = (await getBookingUser())!;
  const [users, rows] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, isAdmin: true }, orderBy: { name: 'asc' } }),
    prisma.bookingHost.findMany(),
  ]);
  const rowOf = new Map(rows.map((r) => [r.userId, r]));
  const booker = { email: me.email, segment: me.segment };

  const hosts: HostCard[] = users
    .filter((u) => u.id !== me.id && canAccessBooking(u))
    .map((u) => {
      const row = rowOf.get(u.id) || null;
      const connected = isConnected(row);
      const types = row ? allowedTypes(hostConfig(row), booker) : [];
      const status: HostCard['status'] = !connected ? 'not_connected' : !row!.accepting ? 'paused' : types.length ? 'available' : 'no_types';
      return { id: u.id, name: u.name || u.email, email: u.email, segment: normalizeSegment(u.role), status, typeNames: types.map((tp) => tp.name) };
    })
    // Admins sem agenda conectada não são SEs: ficam fora da lista.
    .filter((h) => h.status !== 'not_connected' || h.segment === 'SC');

  return <HostPickerClient hosts={hosts} />;
}
