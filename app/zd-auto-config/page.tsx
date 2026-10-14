import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { canAccessZdAutoConfig } from '@/lib/segments';
import ZdAutoConfigClient from './ZdAutoConfigClient';

export const metadata = {
  title: 'ZD Auto Config · Aktie Now Tool Center',
  description: 'Provisionador de ambientes de demonstração Zendesk.',
};

export default async function ZdAutoConfigPage() {
  const session: any = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  if (!canAccessZdAutoConfig(session.user)) redirect('/');

  return <ZdAutoConfigClient email={session.user.email} />;
}
