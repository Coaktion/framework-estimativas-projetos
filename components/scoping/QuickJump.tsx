'use client';

/**
 * Busca rápida (Ctrl+K): digita parte da pergunta e salta direto para ela,
 * em qualquer tema, nos dois modos. Setas escolhem, Enter abre, Esc fecha.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { tr } from '@/lib/scoping/i18n';
import { isAddressed } from '@/lib/scoping/rules';
import { STAGES, stageOf } from '@/lib/scoping/themes';
import type { BankQuestion, ScopingLang, SessionAnswer } from '@/lib/scoping/types';
import { PRIORITY_DOT, StatusIcon } from './QuestionCard';

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function QuickJump({
  open, onClose, questions, answers, lang, onPick,
}: {
  open: boolean;
  onClose: () => void;
  questions: BankQuestion[];
  answers: Record<string, SessionAnswer>;
  lang: ScopingLang;
  onPick: (key: string) => void;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setQ(''); setSel(0); setTimeout(() => input.current?.focus(), 20); } }, [open]);

  const themeTitle = (q: BankQuestion) => tr(STAGES.find((s) => s.key === stageOf(q))?.title, lang);
  const results = useMemo(() => {
    const terms = fold(q).split(/\s+/).filter(Boolean);
    const list = terms.length
      ? questions.filter((x) => { const text = fold(`${tr(x.text, lang)} ${themeTitle(x)}`); return terms.every((w) => text.includes(w)); })
      : questions.filter((x) => !isAddressed(answers[x.key]));
    return list.slice(0, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, questions, answers, lang]);

  if (!open) return null;
  const pick = (key: string) => { onPick(key); onClose(); };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 p-4 pt-[12vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label={t('scoping.quickJump.title')}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-[min(640px,100%)] rounded-2xl border border-slate-300 dark:border-[color:var(--border-main)] bg-white dark:bg-[color:var(--bg-card-solid)] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-[color:var(--border-main)] px-4">
          <Search className="w-4 h-4 text-slate-400" aria-hidden />
          <input
            ref={input}
            value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
              else if (e.key === 'Enter' && results[sel]) { e.preventDefault(); pick(results[sel].key); }
            }}
            placeholder={t('scoping.quickJump.placeholder')}
            className="flex-1 h-12 bg-transparent outline-none text-body text-brand-dark border-0"
            aria-label={t('scoping.quickJump.title')}
          />
          <kbd className="text-[10px] text-slate-400">Esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto py-1" role="listbox">
          {results.length === 0 && <li className="px-4 py-3 text-label text-slate-500">{t('scoping.nav.noResults')}</li>}
          {results.map((x, i) => (
            <li key={x.key} role="option" aria-selected={i === sel}>
              <button
                type="button"
                onMouseEnter={() => setSel(i)}
                onClick={() => pick(x.key)}
                className={`w-full text-left px-4 py-2 flex items-start gap-3 ${i === sel ? 'bg-slate-100' : ''}`}
              >
                <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${PRIORITY_DOT[x.priority]}`} aria-hidden />
                <span className="flex-1 min-w-0">
                  <span className="block text-label text-brand-dark">{tr(x.text, lang)}</span>
                  <span className="block text-caption text-slate-500">{themeTitle(x)}</span>
                </span>
                <StatusIcon answer={answers[x.key]} />
              </button>
            </li>
          ))}
        </ul>
        {!q.trim() && <p className="px-4 py-2 border-t border-slate-100 dark:border-[color:var(--border-main)] text-caption text-slate-500">{t('scoping.quickJump.hint')}</p>}
      </div>
    </div>,
    document.body,
  );
}
