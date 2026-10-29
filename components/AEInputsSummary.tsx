'use client';

import { useTranslation } from 'react-i18next';
import { ClipboardList } from 'lucide-react';
import type { AEInputDetail } from '@/lib/ae-input-details';

/** Dados informados na Calculadora AE para gerar a estimativa (visível para todos). */
export default function AEInputsSummary({ details }: { details: AEInputDetail[] }) {
  const { t } = useTranslation();
  const short = details.filter((d) => !d.long);
  const long = details.filter((d) => d.long);
  const isUrl = (value: string) => /^https?:\/\//i.test(value);

  return (
    <section className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 md:p-10 space-y-6">
      <div className="flex items-start gap-3">
        <div className="bg-brand-primary/10 p-2.5 rounded-2xl text-brand-primary shrink-0">
          <ClipboardList className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-brand-dark text-title font-bold">{t('aeView.inputsTitle')}</h3>
          <p className="text-label text-slate-500 mt-1">{t('aeView.inputsSubtitle')}</p>
        </div>
      </div>
      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
        {short.map((d) => (
          <div key={d.key} className="min-w-0">
            <dt className="text-caption font-medium text-slate-500">{d.label}</dt>
            <dd className="text-label text-brand-dark break-words mt-0.5">
              {isUrl(d.value) ? (
                <a href={d.value} target="_blank" rel="noreferrer" className="underline decoration-[color:var(--primary)] underline-offset-2 break-all">{d.value}</a>
              ) : d.value}
            </dd>
          </div>
        ))}
      </dl>
      {long.map((d) => (
        <div key={d.key} className="pt-4 border-t border-slate-100">
          <dt className="text-caption font-medium text-slate-500">{d.label}</dt>
          <dd className="text-body text-brand-dark whitespace-pre-wrap break-words mt-1">{d.value}</dd>
        </div>
      ))}
    </section>
  );
}
