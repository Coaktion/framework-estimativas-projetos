'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, ExternalLink, ShieldCheck } from 'lucide-react';

export interface AEConfigInfo {
  /** null = padrão de fábrica. */
  usedId: number | null;
  usedAt: string | null;
  activeId: number | null;
  activeAt: string | null;
  /** Mesma versão, mas as horas da biblioteca mudaram desde o cálculo. */
  valuesChanged: boolean;
}

/**
 * Bloco só para administradores: com que versão da Calculadora AE a estimativa
 * foi calculada, com link para os detalhes e um aviso quando ela não é mais a
 * versão ativa (ou quando as horas da biblioteca mudaram desde então).
 */
export default function AEConfigVersionNotice({ info, dateLocale }: { info: AEConfigInfo; dateLocale: string }) {
  const { t } = useTranslation();
  const outdated = info.usedId !== info.activeId;
  const warn = outdated || info.valuesChanged;
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(dateLocale) : '');
  const href = `/admin?tab=aeCalculator&aeVersion=${info.usedId ?? 'factory'}`;

  return (
    <section className={`rounded-3xl border-2 p-6 md:p-8 space-y-4 ${warn ? 'border-amber-300 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/40' : 'border-slate-200 bg-white'}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`p-2.5 rounded-2xl shrink-0 ${warn ? 'bg-amber-200 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-slate-100 text-slate-500'}`}>
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-brand-dark text-title font-bold">{t('aeView.configTitle')}</h3>
            <p className="text-caption text-slate-500 mt-0.5">{t('aeView.configAdminOnly')}</p>
            <p className="text-label text-brand-dark mt-2">
              {info.usedId != null
                ? t('aeView.configUsed', { id: info.usedId, date: fmt(info.usedAt) })
                : t('aeView.configUsedFactory')}
            </p>
          </div>
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-300 bg-white text-label font-medium text-brand-dark hover:border-brand-primary transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          {t('aeView.configDetails')}
        </Link>
      </div>
      {outdated ? (
        <p className="flex items-start gap-2 text-label font-medium text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {info.activeId != null
            ? t('aeView.configOutdated', { id: info.activeId, date: fmt(info.activeAt) })
            : t('aeView.configOutdatedFactory')}
        </p>
      ) : info.valuesChanged ? (
        <p className="flex items-start gap-2 text-label font-medium text-amber-800 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {t('aeView.configValuesChanged')}
        </p>
      ) : (
        <p className="flex items-start gap-2 text-label text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          {t('aeView.configCurrent')}
        </p>
      )}
    </section>
  );
}
