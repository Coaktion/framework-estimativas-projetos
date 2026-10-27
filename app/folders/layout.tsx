import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canAccessFolders } from '@/lib/segments';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Criador de Pastas · Aktie Now Tool Center',
  description: 'Criação da estrutura padrão de pastas do cliente no Google Drive.',
};

export default async function FoldersLayout({ children }: { children: React.ReactNode }) {
  const session: any = await getServerSession(authOptions);
  if (!canAccessFolders(session?.user)) redirect('/');
  return <>{children}</>;
}
