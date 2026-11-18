'use client';

/**
 * Medidor de horas no rodapé (RF-32/33): total da simulação no motor atual,
 * itens mapeados ainda sem quantidade, avisos do motor e perguntas sem item
 * no catálogo (horas manuais). Nada é gravado.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronUp, Loader2 } from 'lucide-react';
import { tr } from '@/lib/scoping/i18n';
import type { SessionEstimate } from '@/lib/scoping/server';
import type { Bank, ScopingLang } from '@/lib/scoping/types';

const h = (n: number, lang: string) => `${n.toLocaleString(lang, { maximumFractionDigits: 1 })} h`;

export default function HoursMeter({
  data, loading, bank, lang, onJump,
}: {
  data: SessionEstimate | null;
  loading: boolean;
  bank: Bank;
  lang: ScopingLang;
  onJump: (questionKey: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const qText = (key: string) => tr(bank.questions.find((q) => q.key === key)?.text, lang) || key;
  const warnings = data?.estimate.warnings || [];
  const manual = data?.mapping.manual || [];
  const anyRange = data?.mapping.items.some((i) => i.isRange);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 h-11 hover:border-slate-400"
      >
        <span className="text-caption uppercase tracking-wide text-slate-500">{t('scoping.meter.title')}</span>
        <span className="font-heading text-[26px] leading-none text-brand-dark tabular-nums">
          {data ? h(data.estimate.grandTotal, i18n.language) : '—'}
        </span>
        {anyRange && <span className="text-caption text-slate-500">{t('scoping.meter.range')}</span>}
        {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" aria-label={t('scoping.meter.loading')} />}
        {!!data?.mapping.missing.length && <span className="text-caption text-slate-600 tabular-nums">{t('scoping.meter.missing', { n: data.mapping.missing.length })}</span>}
        {!!warnings.length && <span className="inline-flex items-center gap-1 text-caption text-amber-700"><AlertTriangle className="w-3.5 h-3.5" />{warnings.length}</span>}
        <ChevronUp className={`w-4 h-4 text-slate-400 transition-transform ${open ? '' : 'rotate-180'}`} />
      </button>

      {open && data && (
        <div className="absolute bottom-14 left-0 z-40 w-[min(560px,90vw)] max-h-[60vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl space-y-4 text-label">
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              [t('scoping.meter.items'), data.estimate.subtotal],
              ['Discovery', data.estimate.shares.discovery],
              [t('scoping.meter.validation'), data.estimate.shares.validation],
              ['GP', data.estimate.shares.gp],
            ].map(([k, v]) => (
              <div key={String(k)} className="rounded-xl border border-slate-100 p-2">
                <div className="text-caption text-slate-500">{k}</div>
                <div className="font-semibold tabular-nums">{h(Number(v), i18n.language)}</div>
              </div>
            ))}
          </div>

          {!!warnings.length && (
            <div>
              <h4 className="font-semibold text-amber-800 mb-1">{t('scoping.meter.warnings')}</h4>
              <ul className="list-disc pl-5 text-amber-900 space-y-0.5">
                {warnings.map((w, i) => (
                  <li key={i}>{t(`scoping.meter.warn.${w.kind}`, { item: 'itemName' in w ? w.itemName : '', module: 'module' in w ? w.module : '', dep: 'dependsOnItemId' in w ? w.dependsOnItemId : '' })}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h4 className="font-semibold text-brand-dark mb-1">{t('scoping.meter.mapped')}</h4>
            {data.mapping.items.length === 0 ? <p className="text-slate-500">{t('scoping.meter.none')}</p> : (
              <table className="w-full">
                <tbody>
                  {data.mapping.items.map((i) => (
                    <tr key={i.itemId} className="border-t border-slate-100">
                      <td className="py-1 pr-2">{i.itemName}{i.isRange && <span className="ml-1 text-caption text-slate-500">({t('scoping.meter.rangeShort')})</span>}{i.sources.some((s) => s.startsWith('track:')) && i.sources.length === 1 && <span className="ml-1 text-caption text-slate-500">· {t('scoping.meter.fromTrack')}</span>}</td>
                      <td className="py-1 pr-2 text-right tabular-nums">{i.quantity.toLocaleString(i18n.language)}</td>
                      <td className="py-1 text-right tabular-nums text-slate-600">{data.estimate.itemHours[i.itemId] !== undefined ? h(data.estimate.itemHours[i.itemId], i18n.language) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {!!data.mapping.missing.length && (
            <div>
              <h4 className="font-semibold text-brand-dark mb-1">{t('scoping.meter.missingTitle')}</h4>
              <ul className="space-y-0.5">
                {data.mapping.missing.map((k) => (
                  <li key={k}><button type="button" className="text-left hover:underline text-slate-700" onClick={() => { setOpen(false); onJump(k); }}>{qText(k)}</button></li>
                ))}
              </ul>
            </div>
          )}

          {!!manual.length && (
            <div>
              <h4 className="font-semibold text-brand-dark mb-1">{t('scoping.meter.manualTitle')}</h4>
              <p className="text-caption text-slate-500 mb-1">{t('scoping.meter.manualHint')}</p>
              <ul className="space-y-0.5">
                {manual.map((m) => (
                  <li key={m.questionKey} className="flex justify-between gap-2">
                    <button type="button" className="text-left hover:underline text-slate-700" onClick={() => { setOpen(false); onJump(m.questionKey); }}>{qText(m.questionKey)}</button>
                    <span className="tabular-nums text-slate-500">{m.quantity ?? '—'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-caption text-slate-400">{t('scoping.meter.footnote')}</p>
        </div>
      )}
    </div>
  );
}
