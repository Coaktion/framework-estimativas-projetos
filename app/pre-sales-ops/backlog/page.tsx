import { EmConstrucao } from '@/components/psops/EmConstrucao';
import { getServerT } from '@/app/i18n/server';

export default function Pagina() {
  const t = getServerT();
  return (
    <>
      <h2 className="mb-6 font-heading text-2xl font-black uppercase tracking-tight text-psops-texto">
        {t('psops.abas.backlog')}
      </h2>
      <EmConstrucao rotaApi="/api/pre-sales-ops/activities" />
    </>
  );
}
