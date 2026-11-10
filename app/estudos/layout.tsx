import { redirect } from 'next/navigation';
import { getEstudosUser } from '@/lib/estudos/server';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Estudos · Aktie Now Tool Center',
  description: 'Acompanhamento de estudo do time de pré-vendas: registro semanal, matriz de conhecimento, resumo e relatório.',
};

export default async function EstudosLayout({ children }: { children: React.ReactNode }) {
  if (!(await getEstudosUser())) redirect('/');
  return <>{children}</>;
}
