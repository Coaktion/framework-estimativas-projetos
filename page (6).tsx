import { Backlog } from '@/components/psops/Backlog';
import { getServerT } from '@/app/i18n/server';

export const dynamic = 'force-dynamic';

export default async function Pagina() {
  const t = getServerT();

  return (
    <>
      <div className="mb-6">
        <div className="mb-1.5 text-caption font-medium text-psops-tinta">
          {t('psops.backlog.editoria')}
        </div>
        <h2 className="font-heading text-section text-psops-texto">
          {t('psops.backlog.titulo')}
        </h2>
        <p className="mt-1.5 max-w-[720px] text-[13px] leading-relaxed text-psops-muted">
          {t('psops.backlog.subtitulo')}
        </p>
      </div>
      <Backlog />
    </>
  );
}
