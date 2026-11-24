'use client';

/**
 * Aba "Para revisar" (RF-51 a RF-53): respostas que o Claude propôs a partir
 * de uma gravação ou das notas. Cada cartão mostra a pergunta, o valor atual
 * e o proposto, a confiança, a citação e o link da gravação. Nada entra sem
 * aceitar; rejeitar pede um motivo opcional, que ajuda a melhorar o roteiro.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ExternalLink, Pencil, X } from 'lucide-react';
import { Button, INPUT } from '@/components/booking/ui';
import AnswerInput from './AnswerInput';
import { tr } from '@/lib/scoping/i18n';
import { formatValue } from '@/lib/scoping/format';
import type { MeetingUsed, ProposalView } from '@/lib/scoping/proposals';
import type { AnswerValue, Bank, ScopingLang, SessionAnswer } from '@/lib/scoping/types';

const CONF_CLASS: Record<string, string> = {
  alta: 'brand-bg-primary text-brand-ink border-transparent',
  media: 'border-amber-300 text-amber-800 bg-amber-50',
  baixa: 'border-slate-300 text-slate-600',
};

export default function ReviewPanel({
  proposals, meetings, bank, answers, lang, readOnly, onAccept, onReject, onAcceptMany,
}: {
  proposals: ProposalView[];
  meetings: MeetingUsed[];
  bank: Bank;
  answers: Record<string, SessionAnswer>;
  lang: ScopingLang;
  readOnly: boolean;
  onAccept: (id: string, edited?: AnswerValue) => Promise<boolean>;
  onReject: (id: string, reason?: string) => Promise<boolean>;
  onAcceptMany: (ids: string[]) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ id: string; value: AnswerValue } | null>(null);
  const [rejecting, setRejecting] = useState<{ id: string; reason: string } | null>(null);
  const [confirmHigh, setConfirmHigh] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const byKey = useMemo(() => new Map(bank.questions.map((q) => [q.key, q])), [bank]);
  const high = proposals.filter((p) => p.confidence === 'alta');
  const toggle = (id: string) => setSelected((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const run = async (key: string, fn: () => Promise<unknown>) => { setBusy(key); try { await fn(); } finally { setBusy(null); } };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-section text-brand-dark">{t('scoping.review.title')}</h2>
          <p className="text-label text-slate-500">{t('scoping.review.subtitle')}</p>
        </div>
        {!readOnly && proposals.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={!selected.size || !!busy} busy={busy === 'many'} onClick={() => run('many', async () => { await onAcceptMany(Array.from(selected)); setSelected(new Set()); })}>
              <Check className="w-4 h-4" /> {t('scoping.review.acceptSelected', { n: selected.size })}
            </Button>
            {high.length > 0 && !confirmHigh && (
              <Button size="sm" variant="primary" onClick={() => setConfirmHigh(true)}>{t('scoping.review.acceptHigh', { n: high.length })}</Button>
            )}
            {confirmHigh && (
              <span className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-label">
                {t('scoping.review.confirmHigh', { n: high.length })}
                <Button size="sm" variant="primary" busy={busy === 'high'} onClick={() => run('high', async () => { await onAcceptMany(high.map((p) => p.id)); setConfirmHigh(false); })}>{t('scoping.review.yes')}</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmHigh(false)}>{t('scoping.bulkNa.cancel')}</Button>
              </span>
            )}
          </div>
        )}
      </div>

      {meetings.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-[color:var(--border-main)] p-3">
          <div className="text-caption font-semibold uppercase tracking-wide text-slate-500 mb-1">{t('scoping.review.meetings')}</div>
          <ul className="space-y-0.5 text-label">
            {meetings.map((m, i) => (
              <li key={i} className="flex flex-wrap gap-2">
                <span className="text-brand-dark">{m.title}</span>
                {m.date && <span className="text-slate-500">{m.date}</span>}
                <span className="text-slate-500">· {t('scoping.review.acceptedN', { n: m.accepted })}</span>
                {m.url && /^https?:\/\//.test(m.url) && <a href={m.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-dark underline-offset-2 hover:underline">{t('scoping.review.open')} <ExternalLink className="w-3 h-3" /></a>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {proposals.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-2">
          <p className="text-body text-brand-dark">{t('scoping.review.empty')}</p>
          <p className="text-label text-slate-500">{t('scoping.review.howTo')}</p>
        </div>
      )}

      {proposals.map((p) => {
        const q = byKey.get(p.questionKey);
        if (!q) return null;
        const current = answers[p.questionKey];
        const currentText = current?.status === 'respondida' ? formatValue(q, current.value?.v, lang) : '';
        const proposedText = formatValue(q, p.value?.v, lang);
        const isEditing = editing?.id === p.id;
        const isRejecting = rejecting?.id === p.id;
        return (
          <article key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-start gap-3">
              {!readOnly && (
                <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} aria-label={t('scoping.review.select')} className="mt-1 rounded border-slate-300" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-body font-medium text-brand-dark">{tr(q.text, lang)}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-[2px] text-caption font-medium ${CONF_CLASS[p.confidence] || CONF_CLASS.baixa}`}>{t(`scoping.review.conf.${p.confidence}`)}</span>
                  {current?.status === 'respondida' && <span className="text-caption text-amber-700">{t('scoping.review.overrides')}</span>}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-caption text-slate-500 mb-1">{t('scoping.review.current')}</div>
                <div className="text-label whitespace-pre-line">{currentText || '—'}</div>
              </div>
              <div className="rounded-xl border border-[color:var(--primary)] p-3">
                <div className="text-caption text-slate-500 mb-1">{t('scoping.review.proposed')}</div>
                {isEditing ? (
                  <AnswerInput q={q} value={editing!.value} lang={lang} onChange={(v) => setEditing({ id: p.id, value: v })} idPrefix={`rv-${p.id}`} />
                ) : (
                  <div className="text-label whitespace-pre-line">{proposedText || '—'}{p.value?.note ? `\n${p.value.note}` : ''}</div>
                )}
              </div>
            </div>

            <blockquote className="border-l-4 border-[color:var(--primary)] pl-3 text-label text-slate-700 italic">
              “{p.source?.quote}”
              <footer className="not-italic text-caption text-slate-500 mt-1 flex flex-wrap gap-2">
                <span>{t(`scoping.source.${p.source?.provider === 'other' ? 'import' : p.source?.provider}`, { defaultValue: p.source?.provider })}</span>
                {p.source?.meetingTitle && <span>· {p.source.meetingTitle}</span>}
                {p.source?.meetingDate && <span>· {p.source.meetingDate}</span>}
                {p.source?.timestamp && <span>· {p.source.timestamp}</span>}
                {p.source?.url && /^https?:\/\//.test(p.source.url) && (
                  <a href={p.source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline-offset-2 hover:underline">{t('scoping.review.openRecording')} <ExternalLink className="w-3 h-3" /></a>
                )}
              </footer>
            </blockquote>
            {p.rationale && <p className="text-caption text-slate-500">{p.rationale}</p>}

            {!readOnly && (
              isRejecting ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input autoFocus value={rejecting!.reason} maxLength={300} onChange={(e) => setRejecting({ id: p.id, reason: e.target.value })} placeholder={t('scoping.review.rejectReason')} className={`${INPUT} h-9 w-72 text-label`} aria-label={t('scoping.review.rejectReason')} />
                  <Button size="sm" variant="danger" busy={busy === p.id} onClick={() => run(p.id, async () => { if (await onReject(p.id, rejecting!.reason)) setRejecting(null); })}>{t('scoping.review.reject')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setRejecting(null)}>{t('scoping.bulkNa.cancel')}</Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {isEditing ? (
                    <>
                      <Button size="sm" variant="primary" busy={busy === p.id} onClick={() => run(p.id, async () => { if (await onAccept(p.id, editing!.value)) setEditing(null); })}><Check className="w-4 h-4" /> {t('scoping.review.saveAccept')}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>{t('scoping.bulkNa.cancel')}</Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="primary" busy={busy === p.id} onClick={() => run(p.id, () => onAccept(p.id))}><Check className="w-4 h-4" /> {t('scoping.review.accept')}</Button>
                      <Button size="sm" onClick={() => setEditing({ id: p.id, value: p.value || {} })}><Pencil className="w-4 h-4" /> {t('scoping.review.edit')}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setRejecting({ id: p.id, reason: '' })}><X className="w-4 h-4" /> {t('scoping.review.reject')}</Button>
                    </>
                  )}
                </div>
              )
            )}
            <p className="text-[11px] text-slate-400">{new Date(p.createdAt).toLocaleString(i18n.language)}</p>
          </article>
        );
      })}
    </div>
  );
}
