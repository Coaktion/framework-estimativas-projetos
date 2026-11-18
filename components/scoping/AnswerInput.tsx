'use client';

/**
 * Controle de resposta por tipo de pergunta (RF-10 e RF-11). Controlado: recebe
 * o valor { v, note } e devolve o novo valor a cada alteração; quem grava é o
 * autosave da sessão.
 */

import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { INPUT, chipClass } from '@/components/booking/ui';
import { tr } from '@/lib/scoping/i18n';
import { YES_NO_LABEL } from '@/lib/scoping/format';
import { YES_NO_VALUES, type AnswerValue, type BankQuestion, type ScopingLang, type TableColumn, type TableRow } from '@/lib/scoping/types';

const TEXTAREA =
  'w-full bg-white dark:bg-[color:var(--bg-input-solid)] border border-slate-300 rounded-[10px] px-3 py-2.5 text-body text-brand-dark outline-none focus:border-brand-primary focus:ring-[3px] focus:ring-[color:var(--focus-ring)] placeholder:text-slate-400 disabled:opacity-50';

interface Props {
  q: BankQuestion;
  value: AnswerValue | null;
  onChange: (v: AnswerValue) => void;
  lang: ScopingLang;
  disabled?: boolean;
  autoFocus?: boolean;
  large?: boolean;
  idPrefix?: string;
}

const toNum = (s: string): number | undefined => {
  if (s.trim() === '') return undefined;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

function NumberInput({ q, value, onChange, lang, disabled, autoFocus, large, idPrefix }: Props) {
  const { t } = useTranslation();
  const v = value?.v;
  const isRange = !!v && typeof v === 'object' && !Array.isArray(v);
  const unit = tr(q.unit, lang);
  const size = large ? 'h-14 text-[22px]' : '';
  const set = (nv: AnswerValue['v']) => onChange({ ...(value || {}), v: nv });
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {!isRange ? (
          <input
            id={`${idPrefix}-num`}
            type="number"
            inputMode="decimal"
            min={q.min ?? undefined}
            max={q.max ?? undefined}
            disabled={disabled}
            autoFocus={autoFocus}
            value={typeof v === 'number' ? v : ''}
            onChange={(e) => set(toNum(e.target.value) ?? null)}
            className={`${INPUT} w-40 tabular-nums ${size}`}
            aria-label={tr(q.text, lang)}
          />
        ) : (
          <>
            <input
              type="number" inputMode="decimal" disabled={disabled} autoFocus={autoFocus}
              value={(v as any).min ?? ''} aria-label={t('scoping.answer.min')} placeholder={t('scoping.answer.min')}
              onChange={(e) => set({ min: toNum(e.target.value) ?? 0, max: (v as any).max ?? 0 })}
              className={`${INPUT} w-28 tabular-nums ${size}`}
            />
            <span className="text-slate-400">–</span>
            <input
              type="number" inputMode="decimal" disabled={disabled}
              value={(v as any).max ?? ''} aria-label={t('scoping.answer.max')} placeholder={t('scoping.answer.max')}
              onChange={(e) => set({ min: (v as any).min ?? 0, max: toNum(e.target.value) ?? 0 })}
              className={`${INPUT} w-28 tabular-nums ${size}`}
            />
          </>
        )}
        {unit && <span className="text-label text-slate-500">{unit}</span>}
        <button
          type="button"
          disabled={disabled}
          onClick={() => set(isRange ? ((v as any).max ?? null) : { min: typeof v === 'number' ? v : 0, max: typeof v === 'number' ? v : 0 })}
          className="text-caption text-slate-500 underline-offset-2 hover:underline hover:text-brand-dark"
        >
          {isRange ? t('scoping.answer.exact') : t('scoping.answer.range')}
        </button>
      </div>
      {isRange && <p className="text-caption text-slate-500">{t('scoping.answer.rangeHint')}</p>}
    </div>
  );
}

function ChoiceInput({ q, value, onChange, lang, disabled }: Props) {
  const multi = q.type === 'multi';
  const yesNo = q.type === 'yes_no';
  const options = yesNo
    ? YES_NO_VALUES.map((x) => ({ value: x, text: YES_NO_LABEL[x][lang] }))
    : q.options.map((o) => ({ value: o.value, text: tr(o.label, lang) }));
  const cur = value?.v;
  const selected = (val: string) => (multi ? Array.isArray(cur) && (cur as string[]).includes(val) : cur === val);
  const toggle = (val: string) => {
    if (multi) {
      const list = Array.isArray(cur) ? (cur as string[]) : [];
      onChange({ ...(value || {}), v: list.includes(val) ? list.filter((x) => x !== val) : [...list, val] });
    } else {
      onChange({ ...(value || {}), v: cur === val ? null : val });
    }
  };
  return (
    <div role={multi ? 'group' : 'radiogroup'} aria-label={tr(q.text, lang)} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role={multi ? 'checkbox' : 'radio'}
          aria-checked={selected(o.value)}
          disabled={disabled}
          onClick={() => toggle(o.value)}
          className={`${chipClass(selected(o.value))} text-label`}
        >
          {o.text}
        </button>
      ))}
    </div>
  );
}

function Cell({ col, value, onChange, lang, disabled }: { col: TableColumn; value: TableRow[string]; onChange: (v: TableRow[string]) => void; lang: ScopingLang; disabled?: boolean }) {
  const label = tr(col.label, lang);
  const base = `${INPUT} h-10 text-label`;
  if (col.type === 'number') {
    return <input type="number" aria-label={label} disabled={disabled} value={typeof value === 'number' ? value : ''} onChange={(e) => onChange(toNum(e.target.value) ?? null)} className={`${base} tabular-nums`} />;
  }
  if (col.type === 'single' || col.type === 'yes_no') {
    const opts = col.type === 'yes_no'
      ? YES_NO_VALUES.map((x) => ({ value: x, text: YES_NO_LABEL[x][lang] }))
      : (col.options || []).map((o) => ({ value: o.value, text: tr(o.label, lang) }));
    return (
      <select aria-label={label} disabled={disabled} value={String(value ?? '')} onChange={(e) => onChange(e.target.value || null)} className={`${base} pr-8`}>
        <option value="">—</option>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.text}</option>)}
      </select>
    );
  }
  const text = String(value ?? '');
  const over = col.maxLength ? text.length > col.maxLength : false;
  return (
    <div>
      {col.type === 'long_text' ? (
        <textarea aria-label={label} disabled={disabled} rows={2} value={text} onChange={(e) => onChange(e.target.value)} className={`${TEXTAREA} text-label ${over ? 'border-red-400' : ''}`} />
      ) : (
        <input type="text" aria-label={label} disabled={disabled} value={text} onChange={(e) => onChange(e.target.value)} className={`${base} ${over ? 'border-red-400' : ''}`} />
      )}
      {col.maxLength ? (
        <span className={`block text-right text-[11px] tabular-nums ${over ? 'text-red-600' : 'text-slate-400'}`}>{text.length}/{col.maxLength}</span>
      ) : null}
    </div>
  );
}

function TableInput({ q, value, onChange, lang, disabled }: Props) {
  const { t } = useTranslation();
  const rows: TableRow[] = Array.isArray(value?.v) ? (value!.v as TableRow[]) : [];
  const set = (next: TableRow[]) => onChange({ ...(value || {}), v: next });
  const cols = q.tableColumns;
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-y-1">
          <thead>
            <tr>
              {cols.map((c) => <th key={c.key} className="text-left text-caption font-semibold text-slate-500 px-1">{tr(c.label, lang)}</th>)}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <td key={c.key} className="px-1 align-top">
                    <Cell col={c} lang={lang} disabled={disabled} value={row[c.key] ?? null} onChange={(v) => set(rows.map((r, j) => (j === i ? { ...r, [c.key]: v } : r)))} />
                  </td>
                ))}
                <td className="px-1 align-top">
                  <button type="button" disabled={disabled} onClick={() => set(rows.filter((_, j) => j !== i))} className="h-10 w-10 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600" aria-label={t('scoping.answer.removeRow')}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" disabled={disabled} onClick={() => set([...rows, {}])} className="inline-flex items-center gap-1 text-label font-medium text-brand-dark hover:underline">
        <Plus className="w-4 h-4" /> {t('scoping.answer.addRow')}
      </button>
    </div>
  );
}

export default function AnswerInput(props: Props) {
  const { t } = useTranslation();
  const { q, value, onChange, lang, disabled, autoFocus, large, idPrefix = 'a' } = props;
  const text = typeof value?.v === 'string' ? value.v : '';
  let control;
  switch (q.type) {
    case 'number': control = <NumberInput {...props} idPrefix={idPrefix} />; break;
    case 'single':
    case 'multi':
    case 'yes_no': control = <ChoiceInput {...props} />; break;
    case 'table':
    case 'ai_usecases': control = <TableInput {...props} />; break;
    case 'date':
      control = <input type="date" disabled={disabled} autoFocus={autoFocus} value={text} onChange={(e) => onChange({ ...(value || {}), v: e.target.value || null })} className={`${INPUT} w-48`} aria-label={tr(q.text, lang)} />;
      break;
    case 'short_text':
      control = <input type="text" disabled={disabled} autoFocus={autoFocus} maxLength={500} value={text} onChange={(e) => onChange({ ...(value || {}), v: e.target.value })} className={`${INPUT} ${large ? 'h-14 text-[20px]' : ''}`} aria-label={tr(q.text, lang)} />;
      break;
    default:
      control = <textarea disabled={disabled} autoFocus={autoFocus} rows={large ? 5 : 3} maxLength={10000} value={text} onChange={(e) => onChange({ ...(value || {}), v: e.target.value })} className={`${TEXTAREA} ${large ? 'text-[18px]' : ''}`} aria-label={tr(q.text, lang)} />;
  }
  const showNote = q.type !== 'long_text';
  return (
    <div className="space-y-3">
      {control}
      {showNote && (
        <details open={!!value?.note} className="group">
          <summary className="cursor-pointer text-caption text-slate-500 hover:text-brand-dark list-none">+ {t('scoping.answer.note')}</summary>
          <textarea
            disabled={disabled}
            rows={2}
            maxLength={5000}
            value={value?.note || ''}
            onChange={(e) => onChange({ ...(value || {}), note: e.target.value })}
            className={`${TEXTAREA} mt-2 text-label`}
            aria-label={t('scoping.answer.note')}
          />
        </details>
      )}
    </div>
  );
}
