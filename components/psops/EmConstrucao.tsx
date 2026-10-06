'use client';

import { Construction } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Placeholder honesto: diz que a tela não existe ainda e qual rota da API já
 * está pronta, para dar para testar o backend antes da interface.
 */
export function EmConstrucao({ rotaApi }: { rotaApi: string }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-[2rem] border border-dashed border-psops-forte bg-psops-surf1 px-6 py-14 text-center">
      <Construction size={26} className="mx-auto mb-3 text-psops-tinta" aria-hidden />
      <h2 className="mb-2 font-heading text-lg font-black uppercase tracking-tight text-psops-texto">
        {t('psops.emConstrucao.titulo')}
      </h2>
      <p className="mx-auto max-w-[520px] text-[13px] leading-relaxed text-psops-muted">
        {t('psops.emConstrucao.texto')}
      </p>
      <code className="mt-3 inline-block rounded-xl border border-psops-linha bg-psops-surf3 px-3 py-1.5 text-[12px] text-psops-tinta">
        GET {rotaApi}
      </code>
    </div>
  );
}
