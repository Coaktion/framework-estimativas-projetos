import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { scopingLigado } from '@/lib/feature-flags';
import { getScopingUser } from '@/lib/scoping/server';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Scoping · Aktie Now Tool Center',
  description: 'Discovery de requisitos com banco de perguntas, pendências e simulação de horas.',
};

export default async function ScopingLayout({ children }: { children: React.ReactNode }) {
  if (!scopingLigado) notFound();
  if (!(await getServerSession(authOptions))) redirect('/login');
  if (!(await getScopingUser())) redirect('/');
  // Largura "estourada", como o Radar: o Modo completo tem três colunas.
  return (
    <div className="relative left-1/2 w-[min(1600px,calc(100vw-2rem))] -translate-x-1/2">
      {children}
    </div>
  );
}
