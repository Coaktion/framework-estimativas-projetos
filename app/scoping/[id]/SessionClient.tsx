'use client';

/**
 * Sessão de scoping: Modo completo (três colunas) e Modo reunião, alternados
 * pelo botão ou pela tecla M (4.1). Notas em "/" (ou Ctrl+/), autosave sem
 * botão de salvar, medidor de horas e essenciais em aberto no rodapé.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Download, NotebookPen, Presentation, LayoutPanelLeft, Search, Settings2, Sparkles } from 'lucide-react';
import { Banner, Button, CARD, Check, INPUT, Label, SELECT, TextInput, chipClass } from '@/components/booking/ui';
import QuestionCard from '@/components/scoping/QuestionCard';
import MeetingMode from '@/components/scoping/MeetingMode';
import ContextPanel from '@/components/scoping/ContextPanel';
import HoursMeter from '@/components/scoping/HoursMeter';
import NotesDrawer from '@/components/scoping/NotesDrawer';
import QuickJump from '@/components/scoping/QuickJump';
import BulkNaButton from '@/components/scoping/BulkNaButton';
import { TIERS, groupByStage, inTier, normalizeTier, stageOf } from '@/lib/scoping/themes';
import { useAnswerStore, type AnswerPatch } from '@/components/scoping/useAnswerStore';
import { tr } from '@/lib/scoping/i18n';
import { formatValue } from '@/lib/scoping/format';
import { completeness, isAddressed, pendingItems, suggestedByAnswers, visibleQuestions, DEFAULT_MINUTES } from '@/lib/scoping/rules';
import type { SessionEstimate, SessionRecord } from '@/lib/scoping/server';
import { PLANS, type Bank, type BankQuestion, type ScopingLang, type SessionAnswer } from '@/lib/scoping/types';
import {
  acceptManyAction, acceptProposalAction, completeSessionAction, listProposalsAction, previewEstimateAction,
  rejectProposalAction, reopenSessionAction, updateSessionAction,
} from '../actions';
import ReviewPanel from '@/components/scoping/ReviewPanel';
import type { MeetingUsed, ProposalView } from '@/lib/scoping/proposals';

type Filter = 'all' | 'essential' | 'open' | 'pending';
const FILTERS: Filter[] = ['all', 'essential', 'open', 'pending'];

const isTyping = (el: EventTarget | null) => {
  const tag = (el as HTMLElement | null)?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!(el as HTMLElement | null)?.isContentEditable;
};

function Ring({ done, pending, total, label }: { done: number; pending: number; total: number; label: string }) {
  const r = 8;
  const c = 2 * Math.PI * r;
  const fDone = total ? done / total : 0;
  const fPend = total ? pending / total : 0;
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" role="img" aria-label={label} className="shrink-0">
      <circle cx="11" cy="11" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-200" />
      <circle cx="11" cy="11" r={r} fill="none" stroke="#7FD171" strokeWidth="3" strokeDasharray={`${fDone * c} ${c}`} transform="rotate(-90 11 11)" />
      <circle cx="11" cy="11" r={r} fill="none" stroke="#F59E0B" strokeWidth="3" strokeDasharray={`${fPend * c} ${c}`} strokeDashoffset={-fDone * c} transform="rotate(-90 11 11)" />
    </svg>
  );
}

export default function SessionClient({
  session: initialSession, bank, initialAnswers, initialNote, initialEstimate, initialProposals, initialMeetings,
}: {
  session: SessionRecord;
  bank: Bank;
  initialAnswers: SessionAnswer[];
  initialNote: { content: string; version: number };
  initialEstimate: SessionEstimate | null;
  initialProposals: ProposalView[];
  initialMeetings: MeetingUsed[];
  canDelete: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [session, setSession] = useState(initialSession);
  const lang: ScopingLang = session.language;
  const readOnly = session.status === 'concluida';

  const [estimate, setEstimate] = useState<SessionEstimate | null>(initialEstimate);
  const [estimating, setEstimating] = useState(false);
  const estTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshEstimate = useCallback(() => {
    if (estTimer.current) clearTimeout(estTimer.current);
    estTimer.current = setTimeout(async () => {
      setEstimating(true);
      const res = await previewEstimateAction(initialSession.id).catch(() => null);
      setEstimating(false);
      if (res && res.ok) setEstimate({ mapping: res.mapping, estimate: res.estimate });
    }, 500);
  }, [initialSession.id]);

  const { answers, update, saveState, conflicts, resolveConflict, readOnlyError, applyServer } = useAnswerStore(initialSession.id, initialAnswers, { readOnly, onSaved: refreshEstimate });
  const answerList = useMemo(() => Object.values(answers), [answers]);

  const [mode, setMode] = useState<'full' | 'meeting' | 'review'>('full');
  const [proposals, setProposals] = useState<ProposalView[]>(initialProposals);
  const [meetings, setMeetings] = useState<MeetingUsed[]>(initialMeetings);
  // Link de revisão que o Claude devolve pelo MCP: /scoping/<id>#revisar
  useEffect(() => { try { if (window.location.hash === '#revisar') setMode('review'); } catch { /* sem hash */ } }, []);

  const reloadProposals = useCallback(async () => {
    const res = await listProposalsAction(initialSession.id).catch(() => null);
    if (res && res.ok) { setProposals(res.proposals); setMeetings(res.meetings); }
  }, [initialSession.id]);
  const reviewError = (error?: string) => setMessage({ tone: 'error', text: t(`scoping.errors.${error || 'server_error'}`, { defaultValue: t('scoping.errors.server_error') }) });
  const acceptOne = async (id: string, edited?: unknown) => {
    const res = await acceptProposalAction(id, edited);
    if (!res.ok) { reviewError(res.error); return false; }
    applyServer(res.answer);
    await reloadProposals();
    refreshEstimate();
    return true;
  };
  const rejectOne = async (id: string, reason?: string) => {
    const res = await rejectProposalAction(id, reason);
    if (!res.ok) { reviewError(res.error); return false; }
    setProposals((cur) => cur.filter((p) => p.id !== id));
    return true;
  };
  const acceptMany = async (ids: string[]) => {
    const res = await acceptManyAction(ids);
    if (!res.ok) { reviewError(res.error); return; }
    res.answers.forEach(applyServer);
    if (res.failed) setMessage({ tone: 'warn', text: t('scoping.review.someFailed', { n: res.failed }) });
    await reloadProposals();
    refreshEstimate();
  };
  const [notesOpen, setNotesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [stageKey, setStageKey] = useState<string | null>(null);
  /** Modo completo: só as perguntas do porte (as de depois da reunião sempre aparecem). */
  const [tierOnly, setTierOnly] = useState(true);
  const [message, setMessage] = useState<{ tone: 'error' | 'ok' | 'warn'; text: string } | null>(null);
  const [busy, startTransition] = useTransition();
  // Rodapé e notas vão direto no <body>: o layout largo usa transform, que prende `fixed`.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const visible = useMemo(() => visibleQuestions(bank, session.trackKeys, answerList), [bank, session.trackKeys, answerList]);
  const comp = useMemo(() => completeness(bank, session.trackKeys, answerList), [bank, session.trackKeys, answerList]);
  const owners = useMemo(() => Array.from(new Set(answerList.map((a) => a.pendingOwner).filter((x): x is string => !!x))).sort(), [answerList]);
  const minutesEssential = session.settings.minutesEssential ?? DEFAULT_MINUTES.essential;

  const matches = useCallback((q: BankQuestion) => {
    const a = answers[q.key];
    if (filter === 'essential' && q.priority !== 'essencial') return false;
    if (filter === 'open' && isAddressed(a)) return false;
    if (filter === 'pending' && a?.status !== 'pendente') return false;
    const term = search.trim().toLowerCase();
    if (term && !tr(q.text, lang).toLowerCase().includes(term)) return false;
    return true;
  }, [answers, filter, search, lang]);

  const tier = normalizeTier(session.settings.tier);
  const inScope = useCallback((q: BankQuestion) => !tierOnly || stageOf(q) === 'after' || inTier(q, tier), [tierOnly, tier]);
  const filtered = useMemo(() => visible.filter((q) => inScope(q) && matches(q)), [visible, matches, inScope]);

  /** Perguntas por etapa do roteiro (e "Depois da reunião"), já no porte. */
  const groups = useMemo(() => groupByStage(bank, visible.filter(inScope)), [visible, bank, inScope]);

  const [quickOpen, setQuickOpen] = useState(false);
  const [jump, setJump] = useState<{ key: string; n: number } | null>(null);
  const [dismissedTracks, setDismissedTracks] = useState<string[]>([]);
  const conversationTracks = useMemo(
    () => suggestedByAnswers(bank.tracks, session.trackKeys, answerList).filter((k) => !dismissedTracks.includes(k)),
    [bank.tracks, session.trackKeys, answerList, dismissedTracks],
  );

  /** "Não se aplica" em lote (tema ou seção), com um único motivo. */
  const bulkNa = useCallback((keys: string[], reason: string) => {
    keys.forEach((k) => update(k, { status: 'nao_se_aplica', naReason: reason, pendingOwner: null, pendingDue: null }, { immediate: true }));
  }, [update]);

  const currentStage = stageKey && groups.some((g) => g.stage.key === stageKey) ? stageKey : groups[0]?.stage.key ?? null;
  const stageMeta = groups.find((g) => g.stage.key === currentStage)?.stage;
  const sectionQuestions = filter === 'all' && !search.trim()
    ? (groups.find((g) => g.stage.key === currentStage)?.questions || []).filter(matches)
    : filtered;
  const focusQ = bank.questions.find((q) => q.key === focusKey) || null;
  const sectionTitle = useCallback((key: string) => tr(bank.sections.find((s) => s.key === key)?.title, lang), [bank, lang]);

  const jumpTo = useCallback((key: string) => {
    const q = visible.find((x) => x.key === key);
    if (!q) return;
    if (mode === 'meeting' && stageOf(q) !== 'after') { setJump((j) => ({ key, n: (j?.n ?? 0) + 1 })); return; }
    setMode('full');
    setFilter('all');
    setSearch('');
    if (!inScope(q)) setTierOnly(false);
    setStageKey(stageOf(q));
    setFocusKey(key);
    setTimeout(() => document.getElementById(`q-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  }, [visible, mode, inScope]);

  /** Responder e avançar sozinho para a próxima sem resposta (Modo completo). */
  const onPatch = useCallback((q: BankQuestion, p: AnswerPatch, immediate?: boolean) => {
    update(q.key, p, { immediate });
    const choice = (q.type === 'yes_no' || q.type === 'single') && p.value?.v;
    if ((p.status === 'respondida' && immediate) || choice) {
      setTimeout(() => {
        const list = sectionQuestions;
        const i = list.findIndex((x) => x.key === q.key);
        const next = list.find((x, j) => j > i && !isAddressed(answers[x.key]) && x.key !== q.key);
        if (next) setFocusKey(next.key);
      }, 350);
    }
  }, [update, sectionQuestions, answers]);

  // Atalhos globais: M alterna o modo; "/" ou Ctrl+/ abre as notas.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setNotesOpen((o) => !o); return; }
      if (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setQuickOpen(true); return; }
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); setNotesOpen(true); }
      else if (e.key.toLowerCase() === 'm') { e.preventDefault(); setMode((m) => (m === 'full' ? 'meeting' : 'full')); }
      else if (e.key === 'Escape') setNotesOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const saveSettings = (patch: Partial<SessionRecord>) => {
    startTransition(async () => {
      const res = await updateSessionAction(session.id, patch as any);
      if (!res.ok) { setMessage({ tone: 'error', text: t(`scoping.errors.${res.error}`, { defaultValue: t('scoping.errors.server_error') }) }); return; }
      setSession((s) => ({ ...s, ...patch }));
      refreshEstimate();
    });
  };

  const complete = () => {
    startTransition(async () => {
      const res = await completeSessionAction(session.id);
      if (res.ok) {
        setSession((s) => ({ ...s, status: 'concluida' }));
        setMessage({ tone: 'ok', text: t('scoping.session.completedMsg') });
        router.refresh();
      } else if (res.error === 'incomplete') {
        setFilter('open');
        setMessage({ tone: 'warn', text: t('scoping.session.incomplete', { n: (res as any).open?.length ?? comp.essentialOpen.length }) });
      } else {
        setMessage({ tone: 'error', text: t(`scoping.errors.${res.error}`, { defaultValue: t('scoping.errors.server_error') }) });
      }
    });
  };

  const reopen = () => {
    startTransition(async () => {
      const res = await reopenSessionAction(session.id);
      if (res.ok) { setSession((s) => ({ ...s, status: 'em_andamento' })); setMessage(null); router.refresh(); }
    });
  };

  const pend = useMemo(() => pendingItems(bank, session.trackKeys, answerList), [bank, session.trackKeys, answerList]);
  const triggerText = focusQ?.showIf ? tr(bank.questions.find((x) => x.key === focusQ.showIf!.questionKey)?.text, lang) : null;

  return (
    <div className="pb-28">
      {/* Cabeçalho */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
        <div className="min-w-0">
          <Link href="/scoping" className="inline-flex items-center gap-1 text-label text-slate-500 hover:text-brand-dark mb-2"><ArrowLeft className="w-4 h-4" /> {t('scoping.session.back')}</Link>
          <h1 className="text-brand-dark font-heading text-page leading-none">{session.clientName}</h1>
          <p className="text-label text-slate-500 mt-2">
            {[session.title, t('scoping.tier.current', { name: t(`scoping.tier.${tier}`) }), `${session.sku} · ${session.plan}`, session.deploymentType === 'new' ? t('scoping.wizard.deploymentNew') : t('scoping.wizard.deploymentOpt'), session.language.toUpperCase(), t('scoping.session.bankVersion', { v: bank.version })].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-3 py-1 text-caption font-medium ${readOnly ? 'brand-bg-primary text-brand-ink border-transparent' : 'border-slate-300 text-slate-600'}`}>{t(`scoping.sessionStatus.${session.status}`)}</span>
          <Button size="sm" onClick={() => setMode((m) => (m === 'full' ? 'meeting' : 'full'))} title="M">
            {mode === 'full' ? <Presentation className="w-4 h-4" /> : <LayoutPanelLeft className="w-4 h-4" />}
            {mode === 'full' ? t('scoping.session.meetingMode') : t('scoping.session.fullMode')} <kbd className="text-[10px] opacity-60">M</kbd>
          </Button>
          <Button size="sm" variant={mode === 'review' ? 'primary' : 'secondary'} onClick={() => setMode((m) => (m === 'review' ? 'full' : 'review'))}>
            <Sparkles className="w-4 h-4" /> {t('scoping.review.button')}
            {proposals.length > 0 && <span className="ml-1 rounded-full bg-[#F87171] text-white px-1.5 text-[11px] tabular-nums">{proposals.length}</span>}
          </Button>
          <Button size="sm" onClick={() => setQuickOpen(true)} title="Ctrl+K"><Search className="w-4 h-4" /> {t('scoping.quickJump.button')} <kbd className="text-[10px] opacity-60">Ctrl+K</kbd></Button>
          <Button size="sm" onClick={() => setSettingsOpen((o) => !o)} aria-expanded={settingsOpen}><Settings2 className="w-4 h-4" /> {t('scoping.session.settings')}</Button>
          <div className="relative">
            <Button size="sm" onClick={() => setExportOpen((o) => !o)} aria-expanded={exportOpen}><Download className="w-4 h-4" /> {t('scoping.session.export')}</Button>
            {exportOpen && (
              <div className="absolute right-0 top-11 z-40 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                {(['md', 'xlsx'] as const).map((f) => (
                  <div key={f} className="px-2 py-1.5">
                    <div className="text-caption font-semibold text-slate-500 mb-1">{f === 'md' ? 'Markdown' : 'Excel (.xlsx)'}</div>
                    <div className="flex gap-1">
                      {(['pt', 'en', 'es'] as const).map((l) => (
                        <a key={l} href={`/api/scoping/${session.id}/export?format=${f}&lang=${l}`} className={chipClass(false)} onClick={() => setExportOpen(false)}>{l.toUpperCase()}</a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {readOnly
            ? <Button size="sm" onClick={reopen} busy={busy}>{t('scoping.session.reopen')}</Button>
            : <Button size="sm" variant="primary" onClick={complete} busy={busy} title={comp.canComplete ? '' : t('scoping.session.completeHint')}>{t('scoping.session.complete')}</Button>}
        </div>
      </div>

      {saveState === 'error' && (
        <div className="sticky top-0 z-40 mb-4 rounded-xl bg-[#F87171] text-white px-4 py-3 text-label font-medium" role="alert">{t('scoping.save.offline')}</div>
      )}
      {readOnlyError && <div className="mb-4"><Banner tone="error">{t(`scoping.errors.${readOnlyError}`)}</Banner></div>}
      {message && <div className="mb-4"><Banner tone={message.tone}>{message.text}</Banner></div>}
      {readOnly && <div className="mb-4"><Banner tone="info">{t('scoping.session.readOnly')}</Banner></div>}

      {conflicts.map((c) => {
        const q = bank.questions.find((x) => x.key === c.questionKey);
        if (!q) return null;
        return (
          <div key={c.questionKey} className="mb-4 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 space-y-3" role="alertdialog" aria-label={t('scoping.conflict.title')}>
            <div className="text-label font-semibold text-amber-900">{t('scoping.conflict.title')}: {tr(q.text, lang)}</div>
            <div className="grid gap-3 sm:grid-cols-2 text-label">
              <div className="rounded-xl bg-white p-3"><div className="text-caption text-slate-500 mb-1">{t('scoping.conflict.mine')}</div><div className="whitespace-pre-line">{formatValue(q, c.mine.value?.v, lang) || '—'}</div><div className="text-caption text-slate-500 mt-1">{t(`scoping.status.${c.mine.status}`)}</div></div>
              <div className="rounded-xl bg-white p-3"><div className="text-caption text-slate-500 mb-1">{t('scoping.conflict.theirs', { name: c.theirs.updatedByName || '—' })}</div><div className="whitespace-pre-line">{formatValue(q, c.theirs.value?.v, lang) || '—'}</div><div className="text-caption text-slate-500 mt-1">{t(`scoping.status.${c.theirs.status}`)}</div></div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="primary" onClick={() => resolveConflict(c.questionKey, 'mine')}>{t('scoping.conflict.keepMine')}</Button>
              <Button size="sm" onClick={() => resolveConflict(c.questionKey, 'theirs')}>{t('scoping.conflict.useTheirs')}</Button>
            </div>
          </div>
        );
      })}

      {!readOnly && conversationTracks.map((key) => {
        const tk = bank.tracks.find((x) => x.key === key);
        if (!tk) return null;
        return (
          <div key={key} className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-[color:var(--primary)] px-4 py-3">
            <span className="text-label text-brand-dark flex-1 min-w-[200px]">{t('scoping.suggest.text', { name: tr(tk.name, lang) })}</span>
            <Button size="sm" variant="primary" onClick={() => saveSettings({ trackKeys: [...session.trackKeys, key] })}>{t('scoping.suggest.add')}</Button>
            <Button size="sm" variant="ghost" onClick={() => setDismissedTracks((d) => [...d, key])}>{t('scoping.suggest.dismiss')}</Button>
          </div>
        );
      })}

      {settingsOpen && (
        <section className={`${CARD} p-5 mb-6 space-y-5`}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Label htmlFor="ss-client">{t('scoping.wizard.client')}</Label>
              <TextInput id="ss-client" defaultValue={session.clientName} disabled={readOnly} onBlur={(e) => e.target.value.trim() !== session.clientName && e.target.value.trim().length >= 2 && saveSettings({ clientName: e.target.value.trim() })} />
            </div>
            <div>
              <Label htmlFor="ss-lang" tip={t('scoping.wizard.languageTip')}>{t('scoping.wizard.language')}</Label>
              <select id="ss-lang" className={SELECT} value={session.language} disabled={readOnly} onChange={(e) => saveSettings({ language: e.target.value as ScopingLang })}>
                <option value="pt">Português (BR)</option><option value="en">English</option><option value="es">Español</option>
              </select>
            </div>
            <div>
              <Label htmlFor="ss-sku">SKU</Label>
              <select id="ss-sku" className={SELECT} value={session.sku} disabled={readOnly} onChange={(e) => saveSettings({ sku: e.target.value })}>
                <option value="CS">CS</option><option value="ES">ES</option>
              </select>
            </div>
            <div>
              <Label htmlFor="ss-tier">{t('scoping.tier.label')}</Label>
              <select id="ss-tier" className={SELECT} value={tier} disabled={readOnly} onChange={(e) => saveSettings({ settings: { ...session.settings, tier: normalizeTier(e.target.value) } } as any)}>
                {TIERS.map((x) => <option key={x} value={x}>{t(`scoping.tier.${x}`)}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="ss-plan">{t('scoping.wizard.plan')}</Label>
              <select id="ss-plan" className={SELECT} value={session.plan} disabled={readOnly} onChange={(e) => saveSettings({ plan: e.target.value })}>
                {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div className="text-label font-medium text-brand-dark mb-1">{t('scoping.wizard.tracksLabel')}</div>
            <p className="text-caption text-slate-500 mb-2">{t('scoping.session.tracksHint')}</p>
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {bank.tracks.filter((tk) => tk.type !== 'core').map((tk) => (
                <Check
                  key={tk.key}
                  checked={session.trackKeys.includes(tk.key)}
                  label={tr(tk.name, lang)}
                  onChange={(on) => !readOnly && saveSettings({ trackKeys: on ? [...session.trackKeys, tk.key] : session.trackKeys.filter((k) => k !== tk.key) })}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {mode === 'review' ? (
        <ReviewPanel
          proposals={proposals}
          meetings={meetings}
          bank={bank}
          answers={answers}
          lang={lang}
          readOnly={readOnly}
          onAccept={acceptOne}
          onReject={rejectOne}
          onAcceptMany={acceptMany}
        />
      ) : mode === 'meeting' ? (
        <MeetingMode
          bank={bank}
          tier={tier}
          questions={visible}
          jump={jump}
          onBulkNa={bulkNa}
          answers={answers}
          onPatch={(key, p, imm) => update(key, p, { immediate: imm })}
          lang={lang}
          owners={owners}
          disabled={readOnly}
          minutesEssential={minutesEssential}
          sectionTitle={sectionTitle}
          onFocusChange={setFocusKey}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[270px_minmax(0,1fr)_330px]">
          {/* Esquerda: navegação */}
          <nav aria-label={t('scoping.nav.label')} className="space-y-4 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto pr-1">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('scoping.nav.search')} aria-label={t('scoping.nav.search')} className={`${INPUT} h-10 pl-9 text-label`} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={chipClass(filter === f)}>{t(`scoping.nav.filter.${f}`)}</button>
              ))}
            </div>
            <button type="button" aria-pressed={tierOnly} onClick={() => setTierOnly((v) => !v)} className={chipClass(tierOnly)}>
              {t('scoping.tier.only', { name: t(`scoping.tier.${tier}`) })}
            </button>
            <ul className="space-y-0.5">
              {groups.map(({ stage, questions }, gi) => {
                const done = questions.filter((q) => isAddressed(answers[q.key]) && answers[q.key]?.status !== 'pendente').length;
                const pending = questions.filter((q) => answers[q.key]?.status === 'pendente').length;
                const reqOpen = questions.filter((q) => q.priority === 'essencial' && !isAddressed(answers[q.key])).length;
                const active = currentStage === stage.key && filter === 'all' && !search;
                return (
                  <li key={stage.key} className={stage.afterMeeting ? 'pt-3 mt-2 border-t border-slate-200 dark:border-[color:var(--border-main)]' : ''}>
                    <button
                      type="button"
                      onClick={() => { setStageKey(stage.key); setFilter('all'); setSearch(''); }}
                      aria-current={active ? 'true' : undefined}
                      className={`w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left text-label ${active ? 'bg-slate-100 font-medium text-brand-dark' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <span className="font-heading text-[20px] leading-none w-4 tabular-nums text-brand-primary" aria-hidden>{stage.afterMeeting ? '+' : gi + 1}</span>
                      <span className="flex-1 min-w-0 truncate">{tr(stage.title, lang)}</span>
                      {reqOpen > 0 && <span className="h-2 w-2 rounded-full bg-[#F87171]" title={t('scoping.meeting.requiredOpen', { n: reqOpen })} aria-label={t('scoping.meeting.requiredOpen', { n: reqOpen })} />}
                      <Ring done={done} pending={pending} total={questions.length} label={t('scoping.nav.ring', { done, pending, total: questions.length })} />
                      <span className="text-caption tabular-nums text-slate-400">{done + pending}/{questions.length}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Centro: perguntas */}
          <main className="space-y-3 min-w-0">
            {filter === 'all' && !search.trim() && stageMeta && (
              <div className="mb-2 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="font-heading text-section text-brand-dark">{tr(stageMeta.title, lang)}</h2>
                  <BulkNaButton
                    label={t('scoping.bulkNa.theme')}
                    count={sectionQuestions.filter((q) => !isAddressed(answers[q.key])).length}
                    disabled={readOnly}
                    onApply={(reason) => bulkNa(sectionQuestions.filter((q) => !isAddressed(answers[q.key])).map((q) => q.key), reason)}
                  />
                </div>
                <p className="text-label text-slate-500">{tr(stageMeta.goal, lang)}</p>
              </div>
            )}
            {filter !== 'all' || search.trim() ? <p className="text-label text-slate-500">{t('scoping.nav.results', { n: sectionQuestions.length })}</p> : null}
            {sectionQuestions.length === 0 && <p className="text-body text-slate-500 py-10 text-center">{t('scoping.nav.noResults')}</p>}
            {sectionQuestions.map((q) => {
              const items = q.catalogMappings.length && !q.noCatalogItem ? t('scoping.catalogLinked') : null;
              return (
                <QuestionCard
                  key={q.key}
                  q={q}
                  answer={answers[q.key]}
                  lang={lang}
                  open={focusKey === q.key}
                  onOpen={() => setFocusKey(focusKey === q.key ? null : q.key)}
                  onPatch={(p, imm) => onPatch(q, p, imm)}
                  owners={owners}
                  disabled={readOnly}
                  indent={!!q.showIf}
                  catalogHint={items}
                />
              );
            })}
          </main>

          {/* Direita: contexto */}
          <aside className={`hidden xl:block ${CARD} p-5 self-start sticky top-4 max-h-[calc(100vh-12rem)] overflow-y-auto`} aria-label={t('scoping.context.label')}>
            {focusQ && <h3 className="text-label font-semibold text-brand-dark mb-4">{tr(focusQ.text, lang)}</h3>}
            <ContextPanel sessionId={session.id} q={focusQ} answer={focusKey ? answers[focusKey] : undefined} lang={lang} estimate={estimate} trigger={triggerText} />
          </aside>
        </div>
      )}

      {/* Rodapé fixo */}
      {mounted && createPortal(
      <footer className="fixed bottom-0 left-0 right-0 z-[80] border-t border-slate-200 dark:border-[color:var(--border-main)] bg-[color:var(--bg-card-solid)] text-[color:var(--text-main)] shadow-[0_-4px_16px_rgba(0,0,0,0.08)] px-4 py-3">
        <div className="mx-auto w-[min(1600px,100%)] flex flex-wrap items-center gap-3">
          <HoursMeter data={estimate} loading={estimating} bank={bank} lang={lang} onJump={jumpTo} />
          <button type="button" onClick={() => { setMode('full'); setFilter('open'); setSearch(''); }} className="rounded-full border border-slate-200 dark:border-[color:var(--border-strong)] px-4 h-11 text-label text-[color:var(--text-main)] hover:border-slate-400">
            <span className="tabular-nums font-semibold text-[#F87171]">{comp.essentialOpen.length}</span> {t('scoping.footer.essentialsOpen')}
          </button>
          <button type="button" onClick={() => { setMode('full'); setFilter('pending'); setSearch(''); }} className="rounded-full border border-slate-200 dark:border-[color:var(--border-strong)] px-4 h-11 text-label text-[color:var(--text-main)] hover:border-slate-400">
            <span className="tabular-nums font-semibold text-amber-600">{pend.length}</span> {t('scoping.footer.pending')}
          </button>
          <div className="ml-auto flex items-center gap-3">
            <span className={`text-caption ${saveState === 'error' ? 'text-red-600' : 'text-[color:var(--text-muted)]'}`} aria-live="polite">{saveState === 'idle' ? '' : t(`scoping.save.${saveState}`)}</span>
            <Button size="sm" onClick={() => setNotesOpen((o) => !o)} title="/"><NotebookPen className="w-4 h-4" /> {t('scoping.notes.title')} <kbd className="text-[10px] opacity-60">/</kbd></Button>
          </div>
        </div>
      </footer>,
      document.body)}

      <NotesDrawer sessionId={session.id} initial={initialNote} open={notesOpen} onClose={() => setNotesOpen(false)} />
      <QuickJump open={quickOpen} onClose={() => setQuickOpen(false)} questions={visible} answers={answers} lang={lang} onPick={jumpTo} />
    </div>
  );
}
