import prisma from '@/lib/prisma';
import { allowedTypes, publicType } from '@/lib/booking/config';
import { getBookingUser, hostConfig, isConnected, loadHost } from '@/lib/booking/server';
import BookingFlowClient from './BookingFlowClient';

export default async function BookWithHostPage({ params }: { params: { hostId: string } }) {
  const me = (await getBookingUser())!;
  const hostId = Number(params.hostId);
  const [host, row] = Number.isInteger(hostId)
    ? await Promise.all([prisma.user.findUnique({ where: { id: hostId }, select: { id: true, name: true, email: true } }), loadHost(hostId)])
    : [null, null];
  const preview = hostId === me.id;
  const config = hostConfig(row);
  // Na própria agenda (prévia) todos os tipos aparecem; para os outros, só os liberados.
  const types = preview ? config.types : allowedTypes(config, { email: me.email, segment: me.segment });
  const unavailable = !host || !row || !isConnected(row) ? 'host_unavailable' : !row.accepting ? 'host_paused' : !types.length ? 'no_types' : null;

  return (
    <BookingFlowClient
      host={{ id: hostId, name: host?.name || host?.email || '', email: host?.email || '', timeZone: row?.timeZone || 'America/Sao_Paulo' }}
      me={{ id: me.id, email: me.email, name: me.name }}
      types={unavailable ? [] : types.map(publicType)}
      unavailable={unavailable}
      preview={preview}
    />
  );
}
