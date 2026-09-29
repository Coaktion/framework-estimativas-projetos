import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ProfileClient from './ProfileClient';

export const metadata = {
  title: 'Perfil · Aktie Now Tool Center',
  description: 'Gerencie sua conta e altere sua senha.',
};

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/login');

  return <ProfileClient email={session.user.email} name={session.user.name} role={(session.user as any)?.role} />;
}
