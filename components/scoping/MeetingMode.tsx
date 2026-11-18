'use client';

/**
 * Modo reunião (4.3): uma coluna, fonte maior, uma pergunta por vez com a
 * próxima visível. Atalhos: Enter responde e avança (Ctrl+Enter em texto
 * longo), P pendente, N não se aplica, S pula, J/K próxima/anterior. As notas
 * ("/") e a troca de modo ("M") ficam na sessão.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Timer } from 'lucide-react';
import { Button, chipClass } from '@/components/booking/ui';
import AnswerInput from './AnswerInput';
import { PRIORITY_DOT, StatusControls, StatusIcon, patchForValue } from './QuestionCard';
import { tr } from '@/lib/scoping/i18n';
import { isAddressed, valueOf } from '@/lib/scoping/rules';
import type { BankQuestion, ScopingLang, SessionAnswer } from '@/lib/scoping/types';
import type { AnswerPatch } from './useAnswerStore';

const isTyping = (el: EventTarget | null) => {
  const tag = (el as HTMLElement | null)?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement | null)?.isContentEditable;
};

export default function MeetingMode({
  questions, answers, onPatch, lang, owners, disabled, minutesEssential, sectionTitle, startKey, onFocusChange,
}: {
  questions: BankQuestion[];
  answers: Record<string, SessionAnswer>;
  onPatch: (key: string, p: AnswerPatch, immediate?: boolean) => void;
  lang: ScopingLang;
  owners: string[];
  disabled?: boolean;
  minutesEssential: number;
  sectionTitle: (key: string) => string;
  startKey?: string | null;
  onFocusChange?: (key: string) => void;
}) {
  const { t } = useTranslation();
  const [only30, setOnly30] = useState(false);
  const list = useMemo(() => (only30 ? questions.filter((q) => q.priority === 'essencial') : questions.filter((q) => q.priority !== 'opcional')), [questions, only30]);
  const [index, setIndex] = useState(() => Math.max(0, list.findIndex((q) => q.key === startKey)));
  const [form, setForm] = useState<{ key: string; kind: 'pendente' | 'nao_se_aplica' } | null>(null);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { if (index >= list.length) setIndex(Math.max(0, list.length - 1)); }, [list.length, index]);

  const q = list[index];
  const next = list[index + 1];
  useEffect(() => { if (q) onFocusChange?.(q.key); }, [q, onFocusChange]);

  const essentials = questions.filter((x) => x.priority === 'essencial');
  const essentialsDone = essentials.filter((x) => isAddressed(answers[x.key])).length;
  const remainingEss = essentials.length - essentialsDone;
  const fits = remainingEss * minutesEssential <= 30;
  const elapsed = Math.floor((now - startedAt) / 1000);
  const clock = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  const go = (delta: number) => { setForm(null); setIndex((i) => Math.min(Math.max(0, i + delta), Math.max(0, list.length - 1))); };
  const advance = () => {
    setForm(null);
    const after = list.findIndex((x, i) => i > index && !isAddressed(answers[x.key]));
    setIndex(after >= 0 ? after : Math.min(index + 1, list.length - 1));
  };

  const answerAndAdvance = () => {
    if (!q) return;
    const a = answers[q.key];
    if (a && (valueOf(a) !== undefined || a.value?.note?.trim()) && a.status !== 'respondida' && a.status !== 'pendente') {
      onPatch(q.key, { status: 'respondida' }, true);
    }
    advance();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!q || disabled) return;
      const typing = isTyping(e.target);
      const inTextarea = (e.target as HTMLElement | null)?.tagName === 'TEXTAREA';
      if (e.key === 'Enter' && !e.shiftKey && (!inTextarea || e.ctrlKey || e.metaKey)) {
        // Enter no mini-form de pendente/NA só confirma o campo (o próprio input trata).
        if (form && typing) return;
        e.preventDefault();
        answerAndAdvance();
        return;
      }
      // Em campo de texto, as letras são texto: Esc sai do campo (ou use Alt+letra).
      // Campo numérico e de data não recebem letras, então os atalhos valem lá.
      const el = e.target as HTMLInputElement | null;
      const textual = typing && !(el?.tagName === 'INPUT' && ['number', 'date'].includes(el.type));
      if (e.key === 'Escape' && typing) { el?.blur(); return; }
      if ((textual && !e.altKey) || e.ctrlKey || e.metaKey) return;
      const k = e.key.toLowerCase();
      if (k === 'p') { e.preventDefault(); setForm({ key: q.key, kind: 'pendente' }); }
      else if (k === 'n') { e.preventDefault(); setForm({ key: q.key, kind: 'nao_se_aplica' }); }
      else if (k === 's') { e.preventDefault(); go(1); }
      else if (k === 'j') { e.preventDefault(); go(1); }
      else if (k === 'k') { e.preventDefault(); go(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!q) return <p className="text-body text-slate-500 text-center py-16">{t('scoping.meeting.empty')}</p>;
  const a = answers[q.key];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1 text-label text-slate-500 tabular-nums" aria-label={t('scoping.meeting.timer')}><Timer className="w-4 h-4" />{clock}</span>
        <div className="flex-1 min-w-[160px]">
          <div className="flex justify-between text-caption text-slate-500 mb-1">
            <span>{t('scoping.meeting.essentials')}</span>
            <span className="tabular-nums">{essentialsDone}/{essentials.length}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={essentials.length} aria-valuenow={essentialsDone}>
            <div className="h-full brand-bg-primary transition-all" style={{ width: `${essentials.length ? (essentialsDone / essentials.length) * 100 : 0}%` }} />
          </div>
        </div>
        <button type="button" aria-pressed={only30} onClick={() => setOnly30((v) => !v)} className={chipClass(only30)}>
          {t('scoping.meeting.only30')}
        </button>
      </div>
      {only30 && (
        <p className={`text-label ${fits ? 'text-slate-600' : 'text-red-600'}`}>
          {t(fits ? 'scoping.meeting.fits' : 'scoping.meeting.noFit', { n: remainingEss, min: remainingEss * minutesEssential })}
        </p>
      )}

      <article className="rounded-2xl border-2 border-[color:var(--primary)] bg-white p-6 space-y-5 shadow-md">
        <div className="flex items-start gap-3">
          <span className={`mt-3 h-3 w-3 rounded-full shrink-0 ${PRIORITY_DOT[q.priority]}`} aria-label={t(`scoping.priority.${q.priority}`)} role="img" />
          <div className="flex-1">
            <div className="text-caption uppercase tracking-wide text-slate-500">{sectionTitle(q.sectionKey)} · {index + 1}/{list.length}</div>
            <h2 className="text-[26px] leading-snug font-semibold text-brand-dark mt-1">{tr(q.text, lang)}</h2>
            {tr(q.help, lang) && <p className="text-label text-slate-500 mt-1">{tr(q.help, lang)}</p>}
          </div>
          <StatusIcon answer={a} />
        </div>
        <AnswerInput key={q.key} q={q} value={a?.value ?? null} lang={lang} disabled={disabled} autoFocus large idPrefix={`m-${q.key}`} onChange={(v) => onPatch(q.key, patchForValue(a, v))} />
        <StatusControls
          key={`${q.key}-${form?.kind || ''}`}
          answer={a}
          owners={owners}
          disabled={disabled}
          focusForm={form?.key === q.key ? form.kind : null}
          onPatch={(p, imm) => onPatch(q.key, p, imm)}
        />
        <div className="flex items-center justify-between pt-2">
          <Button size="sm" variant="ghost" onClick={() => go(-1)} disabled={index === 0}><ChevronLeft className="w-4 h-4" /> K</Button>
          <span className="text-caption text-slate-400">{t('scoping.meeting.keys')}</span>
          <Button size="sm" variant="primary" onClick={answerAndAdvance}>{t('scoping.meeting.next')} <ChevronRight className="w-4 h-4" /></Button>
        </div>
      </article>

      {next && (
        <button type="button" onClick={() => go(1)} className="w-full text-left rounded-2xl border border-slate-200 bg-white/70 px-5 py-4 opacity-70 hover:opacity-100">
          <div className="text-caption uppercase tracking-wide text-slate-500">{t('scoping.meeting.upNext')}</div>
          <div className="text-body text-brand-dark">{tr(next.text, lang)}</div>
        </button>
      )}
    </div>
  );
}
