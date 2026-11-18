'use client';

/**
 * Coluna da direita do Modo completo: por que perguntar, impacto no Zendesk,
 * itens do catálogo afetados e horas que somam agora, aprofundamento,
 * origem e histórico da resposta (RF-16).
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { History, Loader2 } from 'lucide-react';
import { answerHistoryAction, type HistoryEntry } from '@/app/scoping/actions';
import { tr } from '@/lib/scoping/i18n';
import { STATUS_LABEL, formatValue } from '@/lib/scoping/format';
import type { SessionEstimate } from '@/lib/scoping/server';
import type { AnswerStatus, BankQuestion, CatalogMapping, ScopingLang, SessionAnswer } from '@/lib/scoping/types';

function mappingItems(m: CatalogMapping): { itemId: number; itemName: string }[] {
  if (m.rule === 'table_item_qty' || m.rule === 'ai_usecase_complexity') return Object.values(m.items);
  return [{ itemId: m.itemId, itemName: m.itemName }];
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-caption font-semibold uppercase tracking-wide text-slate-500 mb-1">{title}</h3>
      <div className="text-label text-brand-dark">{children}</div>
    </section>
  );
}

export default function ContextPanel({
  sessionId, q, answer, lang, estimate,
}: {
  sessionId: string;
  q: BankQuestion | null;
  answer: SessionAnswer | undefined;
  lang: ScopingLang;
  estimate: SessionEstimate | null;
}) {
  const { t, i18n } = useTranslation();
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setHistory(null); }, [q?.key]);

  if (!q) return <p className="text-label text-slate-500">{t('scoping.context.empty')}</p>;

  const items = Array.from(new Map(q.catalogMappings.flatMap(mappingItems).map((i) => [i.itemId, i])).values());
  const statusName = (s: string | null) => (s ? STATUS_LABEL[s as AnswerStatus]?.[lang] ?? s : '—');
  const loadHistory = async () => {
    setLoading(true);
    const res = await answerHistoryAction(sessionId, q.key);
    setLoading(false);
    setHistory(res.ok ? res.history : []);
  };

  return (
    <div className="space-y-5">
      {tr(q.help, lang) && <Block title={t('scoping.context.why')}>{tr(q.help, lang)}</Block>}
      {tr(q.configImpact, lang) && <Block title={t('scoping.context.impact')}>{tr(q.configImpact, lang)}</Block>}

      <Block title={t('scoping.context.catalog')}>
        {q.noCatalogItem ? (
          <span className="text-slate-500">{t('scoping.noCatalogItem')} · {t('scoping.context.manualHours')}</span>
        ) : items.length === 0 ? (
          <span className="text-slate-500">{t('scoping.context.noMapping')}</span>
        ) : (
          <ul className="space-y-0.5">
            {items.map((i) => {
              const hours = estimate?.estimate.itemHours[i.itemId];
              const mapped = estimate?.mapping.items.find((x) => x.itemId === i.itemId);
              return (
                <li key={i.itemId} className="flex justify-between gap-2">
                  <span>{i.itemName}</span>
                  <span className="tabular-nums text-slate-500 whitespace-nowrap">
                    {mapped ? `${mapped.quantity.toLocaleString(i18n.language)} · ${hours !== undefined ? `${hours.toLocaleString(i18n.language)} h` : '—'}` : '—'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Block>

      {q.followUps.length > 0 && (
        <Block title={t('scoping.context.followUps')}>
          <ul className="list-disc pl-5 space-y-0.5">{q.followUps.map((f, i) => <li key={i}>{tr(f, lang)}</li>)}</ul>
        </Block>
      )}

      <Block title={t('scoping.context.source')}>
        {answer && answer.status !== 'nao_perguntada' ? (
          <span>
            {t(`scoping.source.${answer.source}`)}
            {answer.updatedByName ? ` · ${answer.updatedByName}` : ''}
            {answer.updatedAt ? ` · ${new Date(answer.updatedAt).toLocaleString(i18n.language)}` : ''}
          </span>
        ) : <span className="text-slate-500">—</span>}
      </Block>

      <section>
        {history === null ? (
          <button type="button" onClick={loadHistory} className="inline-flex items-center gap-1 text-label text-slate-600 hover:text-brand-dark">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <History className="w-4 h-4" />} {t('scoping.context.history')}
          </button>
        ) : history.length === 0 ? (
          <p className="text-caption text-slate-500">{t('scoping.context.noHistory')}</p>
        ) : (
          <ol className="space-y-2 border-l border-slate-200 pl-3">
            {history.map((h, i) => (
              <li key={i} className="text-caption">
                <div className="text-slate-500">{new Date(h.changedAt).toLocaleString(i18n.language)} · {h.changedBy || '—'} · {t(`scoping.source.${h.source}`, { defaultValue: h.source })}</div>
                <div className="text-brand-dark">
                  {statusName(h.previousStatus)} → {statusName(h.newStatus)}
                </div>
                <div className="text-slate-600 whitespace-pre-line line-clamp-3">{formatValue(q, (h.newValue as any)?.v, lang) || '—'}</div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
