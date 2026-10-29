import { getBookingUser, hostConfig, isConnected, loadHost } from '@/lib/booking/server';
import { googleConfigured } from '@/lib/booking/google';
import BookingRulesClient, { type RulesTab } from './BookingRulesClient';

const TABS: RulesTab[] = ['connection', 'types', 'auths', 'bookings', 'settings'];

export default async function BookingRulesPage({ searchParams }: { searchParams: { tab?: string; google?: string } }) {
  const user = (await getBookingUser())!;
  const row = await loadHost(user.id);
  const tab = TABS.includes(searchParams.tab as RulesTab) ? (searchParams.tab as RulesTab) : searchParams.google ? 'connection' : row ? 'types' : 'connection';

  return (
    <BookingRulesClient
      me={{ id: user.id, email: user.email }}
      initialConfig={hostConfig(row)}
      connection={{
        configured: googleConfigured(),
        connected: isConnected(row),
        googleEmail: row?.googleEmail || null,
        timeZone: row?.timeZone || null,
        connectedAt: row?.connectedAt?.toISOString() || null,
        accepting: row ? row.accepting : true,
        saved: Boolean(row),
      }}
      initialTab={tab}
      googleStatus={searchParams.google || null}
    />
  );
}
