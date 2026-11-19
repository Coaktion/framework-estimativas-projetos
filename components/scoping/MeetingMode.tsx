'use client';

/**
 * Modo reunião (4.3), navegado por tema: à esquerda os temas da conversa com o
 * quanto já foi coberto; à direita uma pergunta por vez, em fonte maior, com a
 * próxima visível. O pré-vendas pula para o tema que o cliente puxar, em vez
 * de seguir uma lista fixa. Dentro do tema: obrigatórias primeiro; as
 * situacionais aparecem quando a resposta que as dispara chega.
 *
 * Atalhos: Enter responde e avança (Ctrl+Enter em texto longo), P pendente,
 * N não se aplica, S pula, J/K próxima/anterior, Esc sai do campo. As notas
 * ("/"), a busca (Ctrl+K) e a troca de modo ("M") ficam na sessão.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Timer } from 'lucide-react';
import { Button, chipClass } from '@/components/booking/ui';
import AnswerInput from './AnswerInput';
import BulkNaButton from './BulkNaButton';
import { PRIORITY_DOT, StatusControls, StatusIcon, patchForValue } from './QuestionCard';
import { tr } from '@/lib/scoping/i18n';
import { isAddressed, valueOf } from '@/lib/scoping/rules';
import { groupByTheme, themeOf } from '@/lib/scoping/themes';
import type { Bank, BankQuestion, ScopingLang, SessionAnswer } from '@/lib/scoping/types';
import type { AnswerPatch } from './useAnswerStore';

const isTyping = (el: EventTarget | null) => {
  const tag = (el as HTMLElement | null)?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!(el as HTMLElement | null)?.isContentEditable;
};


export default function MeetingMode({
  bank, questions, answers, onPatch, lang, owners, disabled, minutesEssential, sectionTitle, jump, onFocusChange, onBulkNa,
}: {
  bank: Bank;
  /** perguntas visíveis da sessão (todas as prioridades) */
  questions: BankQuestion[];
  answers: Record<string, SessionAnswer>;
  onPatch: (key: string, p: AnswerPatch, immediate?: boolean) => void;
  lang: ScopingLang;
  owners: string[];
  disabled?: boolean;
  minutesEssential: number;
  sectionTitle: (key: string) => string;
  /** salto vindo de fora (busca, medidor): a pergunta e um contador para repetir o mesmo salto */
  jump: { key: string; n: number } | null;
  onFocusChange?: (key: string) => void;
  onBulkNa: (keys: string[], reason: string) => void;
}) {
  const { t } = useTranslation();
  const [only30, setOnly30] = useState(false);
  const [deep, setDeep] = useState(false);
  const groups = useMemo(() => groupByTheme(bank, questions), [bank, questions]);
  const [themeKey, setThemeKey] = useState<string>(() => {
    const open = groups.find((g) => g.questions.some((q) => q.priority === 'essencial' && !isAddressed(answers[q.key])));
    return (open || groups[0])?.theme.key ?? 'context';
  });
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [form, setForm] = useState<{ key: string; kind: 'pendente' | 'nao_se_aplica' } | null>(null);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  /** Perguntas do tema na ordem da reunião: obrigatórias primeiro, sem aprofundamento (a não ser que peça). */
  const list = useMemo(() => {
    if (only30) return groups.flatMap((g) => g.questions.filter((q) => q.priority === 'essencial'));
    const g = groups.find((x) => x.theme.key === themeKey);
    const qs = (g?.questions || []).filter((q) => deep || q.priority !== 'opcional');
    // Obrigatórias primeiro; o resto na ordem do banco, que já põe a situacional logo depois da que a dispara.
    return [...qs.filter((x) => x.priority === 'essencial'), ...qs.filter((x) => x.priority !== 'essencial')];
  }, [groups, themeKey, only30, deep]);

  // Salto externo: abre o tema da pergunta e a pergunta.
  useEffect(() => {
    if (!jump) return;
    const q = questions.find((x) => x.key === jump.key);
    if (!q) return;
    setOnly30(false);
    if (q.priority === 'opcional') setDeep(true);
    setThemeKey(themeOf(q.sectionKey));
    setCurrentKey(q.key);
    setForm(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump?.n]);

  const index = Math.max(0, currentKey ? list.findIndex((q) => q.key === currentKey) : list.findIndex((q) => !isAddressed(answers[q.key])));
  const q = list[index];
  const next = list[index + 1];
  useEffect(() => { if (q) onFocusChange?.(q.key); }, [q, onFocusChange]);

  const themeIdx = groups.findIndex((g) => g.theme.key === themeKey);
  const nextTheme = groups.slice(themeIdx + 1).find((g) => g.questions.some((x) => x.priority !== 'opcional' && !isAddressed(answers[x.key]))) || groups[themeIdx + 1];

  const allEss = questions.filter((x) => x.priority === 'essencial');
  const essDone = allEss.filter((x) => isAddressed(answers[x.key])).length;
  const remainingEss = allEss.length - essDone;
  const fits = remainingEss * minutesEssential <= 30;
  const elapsed = Math.floor((now - startedAt) / 1000);
  const clock = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;

  const goTo = (i: number) => { setForm(null); const target = list[Math.min(Math.max(0, i), Math.max(0, list.length - 1))]; if (target) setCurrentKey(target.key); };
  const advance = () => {
    setForm(null);
    const after = list.find((x, i) => i > index && !isAddressed(answers[x.key]));
    if (after) setCurrentKey(after.key);
    else if (index + 1 < list.length) setCurrentKey(list[index + 1].key);
    else setCurrentKey('__end__');
  };
  const openTheme = (key: string) => { setOnly30(false); setThemeKey(key); setCurrentKey(null); setForm(null); };

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
      if (!q || disabled || currentKey === '__end__') return;
      const typing = isTyping(e.target);
      const inTextarea = (e.target as HTMLElement | null)?.tagName === 'TEXTAREA';
      if (e.key === 'Enter' && !e.shiftKey && (!inTextarea || e.ctrlKey || e.metaKey)) {
        if (form && typing) return;
        if ((e.target as HTMLElement | null)?.tagName === 'BUTTON') return;
        e.preventDefault();
        answerAndAdvance();
        return;
      }
      // Em campo de texto, as letras são texto: Esc sai do campo (ou use Alt+letra).
      const el = e.target as HTMLInputElement | null;
      const textual = typing && !(el?.tagName === 'INPUT' && ['number', 'date'].includes(el.type));
      if (e.key === 'Escape' && typing) { el?.blur(); return; }
      if ((textual && !e.altKey) || e.ctrlKey || e.metaKey) return;
      const k = e.key.toLowerCase();
      if (k === 'p') { e.preventDefault(); setForm({ key: q.key, kind: 'pendente' }); }
      else if (k === 'n') { e.preventDefault(); setForm({ key: q.key, kind: 'nao_se_aplica' }); }
      else if (k === 's' || k === 'j') { e.preventDefault(); goTo(index + 1); }
      else if (k === 'k') { e.preventDefault(); goTo(index - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const a = q ? answers[q.key] : undefined;
  const currentGroup = groups.find((g) => g.theme.key === themeKey);
  const openInTheme = (currentGroup?.questions || []).filter((x) => !isAddressed(answers[x.key]));

  return (
    <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
      {/* Temas */}
      <nav aria-label={t('scoping.meeting.themes')} className="lg:sticky lg:top-4 lg:self-start space-y-3">
        <div className="flex items-center gap-2 text-label text-slate-500 tabular-nums" aria-label={t('scoping.meeting.timer')}>
          <Timer className="w-4 h-4" />{clock}
          <span className="ml-auto text-caption">{t('scoping.meeting.required')} {essDone}/{allEss.length}</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={allEss.length} aria-valuenow={essDone}>
          <div className="h-full brand-bg-primary transition-all" style={{ width: `${allEss.length ? (essDone / allEss.length) * 100 : 0}%` }} />
        </div>
        <ul className="flex lg:flex-col gap-1 overflow-x-auto pb-1">
          {groups.map(({ theme, questions: qs }) => {
            const shown = qs.filter((x) => x.priority !== 'opcional');
            const done = shown.filter((x) => isAddressed(answers[x.key])).length;
            const essOpen = qs.filter((x) => x.priority === 'essencial' && !isAddressed(answers[x.key])).length;
            const active = !only30 && theme.key === themeKey;
            return (
              <li key={theme.key} className="shrink-0">
                <button
                  type="button"
                  onClick={() => openTheme(theme.key)}
                  aria-current={active ? 'true' : undefined}
                  className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-label whitespace-nowrap ${active ? 'brand-bg-primary text-brand-ink font-medium' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  <span className="flex-1 min-w-0 truncate">{tr(theme.title, lang)}</span>
                  {essOpen > 0 && <span className="h-2 w-2 rounded-full bg-[#F87171]" title={t('scoping.meeting.requiredOpen', { n: essOpen })} aria-label={t('scoping.meeting.requiredOpen', { n: essOpen })} />}
                  <span className={`text-caption tabular-nums ${active ? '' : 'text-slate-400'}`}>{done}/{shown.length}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={only30} onClick={() => { setOnly30((v) => !v); setCurrentKey(null); }} className={chipClass(only30)}>{t('scoping.meeting.only30')}</button>
          <button type="button" aria-pressed={deep} onClick={() => setDeep((v) => !v)} className={chipClass(deep)}>{t('scoping.meeting.deep')}</button>
        </div>
        {only30 && (
          <p className={`text-caption ${fits ? 'text-slate-600' : 'text-red-600'}`}>
            {t(fits ? 'scoping.meeting.fits' : 'scoping.meeting.noFit', { n: remainingEss, min: remainingEss * minutesEssential })}
          </p>
        )}
      </nav>

      {/* Pergunta */}
      <div className="max-w-3xl w-full space-y-5">
        {!only30 && currentGroup && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-section text-brand-dark">{tr(currentGroup.theme.title, lang)}</h2>
            <BulkNaButton
              label={t('scoping.bulkNa.theme')}
              count={openInTheme.length}
              disabled={disabled}
              onApply={(reason) => onBulkNa(openInTheme.map((x) => x.key), reason)}
            />
          </div>
        )}

        {currentKey === '__end__' || !q ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
            <p className="text-body text-brand-dark">{list.length ? t('scoping.meeting.themeDone') : t('scoping.meeting.empty')}</p>
            {nextTheme && !only30 && (
              <Button variant="primary" onClick={() => openTheme(nextTheme.theme.key)}>
                {t('scoping.meeting.nextTheme', { name: tr(nextTheme.theme.title, lang) })} <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        ) : (
          <>
            <article className="rounded-2xl border-2 border-[color:var(--primary)] bg-white p-6 space-y-5 shadow-md">
              <div className="flex items-start gap-3">
                <span className={`mt-3 h-3 w-3 rounded-full shrink-0 ${PRIORITY_DOT[q.priority]}`} aria-label={t(`scoping.priority.${q.priority}`)} role="img" />
                <div className="flex-1">
                  <div className="text-caption uppercase tracking-wide text-slate-500">
                    {sectionTitle(q.sectionKey)} · {index + 1}/{list.length}
                    {q.priority === 'essencial' && <span className="ml-2 normal-case tracking-normal text-[#F87171]">{t('scoping.priority.essencial')}</span>}
                  </div>
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
                <Button size="sm" variant="ghost" onClick={() => goTo(index - 1)} disabled={index === 0}><ChevronLeft className="w-4 h-4" /> K</Button>
                <span className="hidden sm:inline text-caption text-slate-400">{t('scoping.meeting.keys')}</span>
                <Button size="sm" variant="primary" onClick={answerAndAdvance}>{t('scoping.meeting.next')} <ChevronRight className="w-4 h-4" /></Button>
              </div>
            </article>

            {next ? (
              <button type="button" onClick={() => goTo(index + 1)} className="w-full text-left rounded-2xl border border-slate-200 bg-white/70 px-5 py-4 opacity-70 hover:opacity-100">
                <div className="text-caption uppercase tracking-wide text-slate-500">{t('scoping.meeting.upNext')}</div>
                <div className="text-body text-brand-dark">{tr(next.text, lang)}</div>
              </button>
            ) : nextTheme && !only30 ? (
              <button type="button" onClick={() => openTheme(nextTheme.theme.key)} className="w-full text-left rounded-2xl border border-dashed border-slate-300 px-5 py-4 hover:border-slate-400">
                <div className="text-caption uppercase tracking-wide text-slate-500">{t('scoping.meeting.endOfTheme')}</div>
                <div className="text-body text-brand-dark">{t('scoping.meeting.nextTheme', { name: tr(nextTheme.theme.title, lang) })}</div>
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
