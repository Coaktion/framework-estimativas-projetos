'use client';

import { Fragment, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { buildAEResultTable } from '@/lib/ae-result-table';
import { formatHoursMinutes } from '@/lib/format-hours';
import { normalizeSegment, SEGMENT_LABEL_KEYS } from '@/lib/segments';
import type { AEEstimateResult, AEInputData } from '@/lib/ae-engine';

/**
 * Tabela de resultado da Calculadora AE.
 *
 * O nível de detalhe depende do segmento de QUEM ESTÁ OLHANDO, nunca de quem
 * gerou a estimativa:
 *
 *   Account Executive -> só a lista de itens considerados
 *   Todos os demais   -> itens + quantidade + horas
 *
 * A tabela é remontada a cada render a partir dos inputs salvos, então a mesma
 * estimativa mostra mais detalhe quando um Sales Engineer a abre.
 */
export default function AEResultTable({
  estimation,
  inputs,
}: {
  estimation: AEEstimateResult | null | undefined;
  inputs: Partial<AEInputData> | null | undefined;
}) {
  const { t } = useTranslation();
  const { data: session } = useSession();

  const viewerSegment = normalizeSegment((session?.user as any)?.role);
  // Apenas o segmento AE tem a visão reduzida. Admin, SC, PM e Implantação
  // enxergam quantidades e horas.
  const itemsOnly = viewerSegment === 'AE';

  const { sections, lineItemTotal, grandTotal } = useMemo(
    () => buildAEResultTable(estimation, inputs, t),
    [estimation, inputs, t],
  );

  if (!sections.length) {
    return (
      <div className="py-8 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-[color:var(--text-muted)]">
        {t('aeTable.empty')}
      </div>
    );
  }

  const colCount = itemsOnly ? 1 : 4;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-black text-brand-dark dark:text-[color:var(--text-main)] font-heading uppercase tracking-tighter">
            {t('aeTable.title')}
          </h3>
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-[color:var(--text-muted)] mt-1">
            {itemsOnly ? t('aeTable.subtitleItemsOnly') : t('aeTable.subtitleFull')}
          </p>
        </div>
        <span className="shrink-0 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[color:var(--bg-input)] border border-slate-200 dark:border-[color:var(--border-main)] text-[8px] font-black uppercase tracking-widest text-slate-500 dark:text-[color:var(--text-muted)]">
          {t('aeTable.viewingAs', { segment: t(SEGMENT_LABEL_KEYS[viewerSegment]) })}
        </span>
      </div>

      {itemsOnly && (
        <div className="flex items-start gap-2.5 p-4 rounded-2xl bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-400/30">
          <Info className="w-4 h-4 shrink-0 text-sky-500 mt-0.5" />
          <p className="text-[9px] font-bold leading-relaxed text-sky-700 dark:text-sky-200">
            {t('aeTable.aeViewNotice')}
          </p>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-[color:var(--border-main)]">
        <table className="min-w-full text-left">
          <thead className="bg-slate-50 dark:bg-[#0f0f0f]">
            <tr>
              <th className="px-4 py-3 text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-[color:var(--text-muted)]">
                {t('aeTable.item')}
              </th>
              {!itemsOnly && (
                <>
                  <th className="px-4 py-3 text-right text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-[color:var(--text-muted)]">
                    {t('aeTable.qty')}
                  </th>
                  <th className="px-4 py-3 text-right text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-[color:var(--text-muted)]">
                    {t('aeTable.unit')}
                  </th>
                  <th className="px-4 py-3 text-right text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-[color:var(--text-muted)]">
                    {t('aeTable.hours')}
                  </th>
                </>
              )}
            </tr>
          </thead>

          <tbody>
            {sections.map((sec) => (
              <Fragment key={sec.key}>
                <tr className="bg-slate-100/70 dark:bg-[#141414] border-y border-slate-200 dark:border-[color:var(--border-main)]">
                  <td colSpan={colCount} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[9px] font-black uppercase tracking-widest text-brand-dark dark:text-[color:var(--text-main)]">
                        {sec.title}
                      </span>
                      {!itemsOnly && (
                        <span className="text-[9px] font-black tabular-nums text-brand-primary dark:text-[color:var(--primary)]">
                          {sec.subtotal.toFixed(2)}h
                          <span className="ml-2 font-bold text-slate-400 dark:text-[color:var(--text-muted)]">
                            {formatHoursMinutes(sec.subtotal)}
                          </span>
                        </span>
                      )}
                    </div>
                  </td>
                </tr>

                {sec.rows.map((r, i) => (
                  <tr
                    key={`${sec.key}-${r.label}-${i}`}
                    className="border-b border-slate-100 dark:border-[color:var(--border-main)] last:border-0 hover:bg-slate-50/50 dark:hover:bg-[color:var(--bg-input)] transition-colors"
                  >
                    <td className="px-4 py-2.5 text-[10px] font-bold text-slate-600 dark:text-[color:var(--text-main)]">
                      {r.label}
                    </td>
                    {!itemsOnly && (
                      <>
                        <td className="px-4 py-2.5 text-right text-[10px] font-black tabular-nums text-brand-dark dark:text-[color:var(--text-main)]">
                          {Math.round(r.qty * 100) / 100}
                        </td>
                        <td className="px-4 py-2.5 text-right text-[9px] font-bold tabular-nums text-slate-400 dark:text-[color:var(--text-muted)]">
                          {r.unitHours ? `${r.unitHours.toFixed(2)}h` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-[10px] font-black tabular-nums text-brand-dark dark:text-[color:var(--text-main)]">
                          <div>{r.hours.toFixed(2)}h</div>
                          <div className="text-[8px] font-bold text-slate-400 dark:text-[color:var(--text-muted)]">
                            {formatHoursMinutes(r.hours)}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>

          {!itemsOnly && (
            <tfoot className="bg-slate-50 dark:bg-[#0f0f0f] border-t-2 border-slate-200 dark:border-[color:var(--border-main)]">
              <tr>
                <td colSpan={3} className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-[color:var(--text-muted)]">
                  {t('aeTable.lineItems')}
                </td>
                <td className="px-4 py-3 text-right text-[10px] font-black tabular-nums text-brand-dark dark:text-[color:var(--text-main)]">
                  {lineItemTotal.toFixed(2)}h
                </td>
              </tr>
              <tr>
                <td colSpan={3} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-brand-primary dark:text-[color:var(--primary)]">
                  {t('aeTable.grandTotal')}
                </td>
                <td className="px-4 py-3 text-right text-brand-primary dark:text-[color:var(--primary)]">
                  <div className="text-sm font-black tabular-nums">{grandTotal.toFixed(2)}h</div>
                  <div className="text-[8px] font-bold">{formatHoursMinutes(grandTotal)}</div>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
