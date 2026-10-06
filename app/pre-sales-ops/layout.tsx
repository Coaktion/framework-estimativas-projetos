import { redirect } from 'next/navigation';
import { canAccessPreSalesOps } from '@/lib/segments';
import { usuarioAtual } from '@/lib/psops/lib/auth';
import { getServerT } from '@/app/i18n/server';
import { AbasModulo } from '@/components/psops/AbasModulo';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Radar · Aktie Now Tool Center',
  description: 'Novidades do Zendesk viram backlog de demo, estimativa e escopo.',
};

export default async function PreSalesOpsLayout({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioAtual();
  if (!usuario) redirect('/login');
  if (!canAccessPreSalesOps({ isAdmin: usuario.admin, role: usuario.papel })) redirect('/');

  const t = getServerT();

  // Mesma largura "estourada" do ZD Auto Config: a triagem tem duas colunas densas.
  return (
    <div className="psops relative left-1/2 w-[min(1600px,calc(100vw-3rem))] -translate-x-1/2 space-y-8">
      <div className="space-y-2">
        <h1 className="font-heading text-5xl font-black uppercase leading-none tracking-tighter text-brand-dark dark:text-[color:var(--text-main)]">
          <span className="text-brand-primary dark:text-[color:var(--primary)]">Radar</span>
        </h1>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-[color:var(--text-muted)]">
          {t('psops.subtitulo')}
        </p>
      </div>
      <AbasModulo />
      <div>{children}</div>
    </div>
  );
}
