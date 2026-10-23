import { redirect } from 'next/navigation';
import { getBookingUser } from '@/lib/booking/server';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Agendamento · Aktie Now Tool Center',
  description: 'Agendamento de reuniões no Google Agenda dos Solution Engineers.',
};

export default async function BookingLayout({ children }: { children: React.ReactNode }) {
  if (!(await getBookingUser())) redirect('/');
  return <>{children}</>;
}
