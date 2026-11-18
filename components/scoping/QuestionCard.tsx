'use client';

/**
 * Cartão de pergunta (Modo completo) e os controles de status (RF-12),
 * reaproveitados no Modo reunião.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleDashed, CircleSlash, Clock, CheckCircle2 } from 'lucide-react';
import { Button, INPUT } from '@/components/booking/ui';
import AnswerInput from './AnswerInput';
import { tr } from '@/lib/scoping/i18n';
import { formatValue } from '@/lib/scoping/format';
import { isAddressed, valueOf } from '@/lib/scoping/rules';
import type { AnswerValue, BankQuestion, ScopingLang, SessionAnswer } from '@/lib/scoping/types';
import type { AnswerPatch } from './useAnswerStore';

export const PRIORITY_DOT: Record<string, string> = {
  essencial: 'bg-[#F87171]',
  recomendada: 'bg-[#7FD171]',
  opcional: 'bg-slate-300',
};

/** Ao mexer no valor: quem estava sem status ou "não se aplica" passa a respondida; valor apagado volta a sem status. */
export function patchForValue(prev: SessionAnswer | undefined, value: AnswerValue): AnswerPatch {
  const hasValue = valueOf({ ...(prev as any), value }) !== undefined || !!value.note?.trim();
  const status = prev?.status || 'nao_perguntada';
  if (hasValue && (status === 'nao_perguntada' || status === 'nao_se_aplica')) return { value, status: 'respondida', naReason: null };
  if (!hasValue && status === 'respondida') return { value, status: 'nao_perguntada' };
  return { value };
}

export function StatusIcon({ answer }: { answer: SessionAnswer | undefined }) {
  const { t } = useTranslation();
  const status = answer && isAddressed(answer) ? answer.status : 'nao_perguntada';
  const label = t(`scoping.status.${status}`);
  const cls = 'w-4 h-4 shrink-0';
  if (status === 'respondida') return <CheckCircle2 className={`${cls} text-brand-primary`} aria-label={label} role="img" />;
  if (status === 'pendente') return <Clock className={`${cls} text-amber-500`} aria-label={label} role="img" />;
  if (status === 'nao_se_aplica') return <CircleSlash className={`${cls} text-slate-400`} aria-label={label} role="img" />;
  return <CircleDashed className={`${cls} text-slate-300`} aria-label={label} role="img" />;
}

export function StatusControls({
  answer, onPatch, owners, disabled, compact, focusForm,
}: {
  answer: SessionAnswer | undefined;
  onPatch: (p: AnswerPatch, immediate?: boolean) => void;
  owners: string[];
  disabled?: boolean;
  compact?: boolean;
  /** abre direto o mini-form de pendente ('P') ou de não se aplica ('N') */
  focusForm?: 'pendente' | 'nao_se_aplica' | null;
}) {
  const { t } = useTranslation();
  const status = answer?.status || 'nao_perguntada';
  const [open, setOpen] = useState<'pendente' | 'nao_se_aplica' | null>(focusForm ?? null);
  const showPending = open === 'pendente' || (status === 'pendente' && open !== 'nao_se_aplica');
  const showNa = open === 'nao_se_aplica' || (status === 'nao_se_aplica' && open !== 'pendente');
  const listId = `owners-${answer?.questionKey || 'x'}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={status === 'respondida' ? 'primary' : 'secondary'} disabled={disabled} onClick={() => { setOpen(null); onPatch({ status: 'respondida' }, true); }}>
          {t('scoping.status.respondida')}
        </Button>
        <Button size="sm" variant={status === 'pendente' ? 'primary' : 'secondary'} disabled={disabled} onClick={() => setOpen('pendente')} title="P">
          {t('scoping.status.pendente')}{!compact && <kbd className="ml-1 text-[10px] opacity-60">P</kbd>}
        </Button>
        <Button size="sm" variant={status === 'nao_se_aplica' ? 'primary' : 'secondary'} disabled={disabled} onClick={() => setOpen('nao_se_aplica')} title="N">
          {t('scoping.status.nao_se_aplica')}{!compact && <kbd className="ml-1 text-[10px] opacity-60">N</kbd>}
        </Button>
        {status !== 'nao_perguntada' && (
          <Button size="sm" variant="ghost" disabled={disabled} onClick={() => { setOpen(null); onPatch({ status: 'nao_perguntada', pendingOwner: null, pendingDue: null, naReason: null }, true); }}>
            {t('scoping.status.clear')}
          </Button>
        )}
      </div>

      {showPending && (
        <div className="grid gap-2 sm:grid-cols-[1fr_180px] rounded-xl border border-amber-200 bg-amber-50/60 p-3">
          <div>
            <label className="block text-caption font-medium text-brand-dark mb-1">{t('scoping.pending.owner')}</label>
            <input
              list={listId}
              autoFocus={open === 'pendente'}
              disabled={disabled}
              defaultValue={answer?.pendingOwner || ''}
              onBlur={(e) => onPatch({ status: 'pendente', pendingOwner: e.target.value.trim() || null }, true)}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              className={`${INPUT} h-10`}
              placeholder={t('scoping.pending.ownerPh')}
            />
            <datalist id={listId}>{owners.map((o) => <option key={o} value={o} />)}</datalist>
          </div>
          <div>
            <label className="block text-caption font-medium text-brand-dark mb-1">{t('scoping.pending.due')}</label>
            <input
              type="date"
              disabled={disabled}
              defaultValue={answer?.pendingDue || ''}
              onChange={(e) => onPatch({ status: 'pendente', pendingDue: e.target.value || null }, true)}
              className={`${INPUT} h-10`}
            />
          </div>
          {status === 'pendente' && (!answer?.pendingOwner || !answer?.pendingDue) && (
            <p className="sm:col-span-2 text-caption text-amber-800">{t('scoping.pending.required')}</p>
          )}
        </div>
      )}

      {showNa && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <label className="block text-caption font-medium text-brand-dark mb-1">{t('scoping.na.reason')}</label>
          <input
            autoFocus={open === 'nao_se_aplica'}
            disabled={disabled}
            maxLength={300}
            defaultValue={answer?.naReason || ''}
            onBlur={(e) => onPatch({ status: 'nao_se_aplica', naReason: e.target.value.trim() || null }, true)}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className={`${INPUT} h-10`}
            placeholder={t('scoping.na.reasonPh')}
          />
          {status === 'nao_se_aplica' && !answer?.naReason && <p className="mt-1 text-caption text-slate-600">{t('scoping.na.required')}</p>}
        </div>
      )}
    </div>
  );
}

export default function QuestionCard({
  q, answer, lang, open, onOpen, onPatch, owners, disabled, indent, catalogHint,
}: {
  q: BankQuestion;
  answer: SessionAnswer | undefined;
  lang: ScopingLang;
  open: boolean;
  onOpen: () => void;
  onPatch: (p: AnswerPatch, immediate?: boolean) => void;
  owners: string[];
  disabled?: boolean;
  indent?: boolean;
  catalogHint?: string | null;
}) {
  const { t } = useTranslation();
  const summary = answer ? formatValue(q, valueOf(answer), lang) : '';
  return (
    <article
      id={`q-${q.key}`}
      className={`rounded-2xl border bg-white transition-shadow ${open ? 'border-[color:var(--primary)] shadow-md' : 'border-slate-200 hover:border-slate-300'} ${indent ? 'ml-6' : ''}`}
    >
      <button type="button" onClick={onOpen} aria-expanded={open} className="w-full text-left px-4 py-3 flex items-start gap-3">
        <span className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${PRIORITY_DOT[q.priority]}`} title={t(`scoping.priority.${q.priority}`)} aria-label={t(`scoping.priority.${q.priority}`)} role="img" />
        <span className="flex-1 min-w-0">
          <span className="block text-body font-medium text-brand-dark">{tr(q.text, lang)}</span>
          {!open && summary && <span className="block text-label text-slate-600 mt-0.5 line-clamp-2 whitespace-pre-line">{summary}</span>}
          {!open && answer?.status === 'pendente' && (
            <span className="block text-caption text-amber-700 mt-0.5">{t('scoping.pending.short', { owner: answer.pendingOwner || '—', due: answer.pendingDue || '—' })}</span>
          )}
          {!open && answer?.status === 'nao_se_aplica' && answer.naReason && <span className="block text-caption text-slate-500 mt-0.5">{answer.naReason}</span>}
          {q.noCatalogItem && <span className="mt-1 inline-block rounded-full border border-dashed border-slate-300 px-2 py-[1px] text-[11px] text-slate-500">{t('scoping.noCatalogItem')}</span>}
          {!open && catalogHint && <span className="mt-1 ml-1 inline-block text-[11px] text-slate-400">{catalogHint}</span>}
        </span>
        <StatusIcon answer={answer} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-4">
          <AnswerInput
            q={q}
            value={answer?.value ?? null}
            lang={lang}
            disabled={disabled}
            autoFocus
            idPrefix={q.key}
            onChange={(v) => onPatch(patchForValue(answer, v))}
          />
          <StatusControls answer={answer} onPatch={onPatch} owners={owners} disabled={disabled} />
        </div>
      )}
    </article>
  );
}
