'use client';

/**
 * Minhas regras de agendamento: conexão com o Google Agenda, tipos de
 * reunião, quem pode agendar, agendamentos recebidos e configurações. As
 * regras são editadas num rascunho e gravadas pelo botão Salvar.
 */
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CalendarCheck2, Eye, ListChecks, PlugZap, Plus, Save, Settings2, Stethoscope, Trash2, Unplug, Users } from 'lucide-react';
import { DATE_LOCALE, normalizeLanguage } from '@/app/i18n/settings';
import { SEGMENTS, SEGMENT_LABEL_KEYS, type Segment } from '@/lib/segments';
import { newId, type AuthRule, type BookingConfig } from '@/lib/booking/config';
import { useAppRouter } from '@/components/AppBlockingLoader';
import { useUnsavedChangesGuard } from '@/lib/use-unsaved-changes';
import { Banner, Button, CARD, Chip, Hint, INPUT, PageHeader, SELECT, Section, Switch, errorText } from '@/components/booking/ui';
import TypesEditor from '@/components/booking/TypesEditor';
import BookingsManager from '@/components/booking/BookingsManager';
import SettingsEditor from '@/components/booking/SettingsEditor';
import { disconnectGoogleAction, saveBookingRulesAction, setAcceptingAction, testConnectionAction } from '../actions';

export type RulesTab = 'connection' | 'types' | 'auths' | 'bookings' | 'settings';

type Connection = {
  configured: boolean;
  connected: boolean;
  googleEmail: string | null;
  timeZone: string | null;
  connectedAt: string | null;
  accepting: boolean;
  saved: boolean;
};

export default function BookingRulesClient({ me, initialConfig, connection, initialTab, googleStatus }: {
  me: { id: number; email: string };
  initialConfig: BookingConfig;
  connection: Connection;
  initialTab: RulesTab;
  googleStatus: string | null;
}) {
  const { t, i18n } = useTranslation();
  const router = useAppRouter();
  const locale = DATE_LOCALE[normalizeLanguage(i18n.language)];
  const [tab, setTab] = useState<RulesTab>(initialTab);
  const [saved, setSaved] = useState(initialConfig);
  const [draft, setDraft] = useState(initialConfig);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [saving, startSaving] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [diag, setDiag] = useState<{ email: string; timeZone: string; records: number; upcoming: number } | null>(null);
  const [accepting, setAccepting] = useState(connection.accepting);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved);
  useUnsavedChangesGuard(isDirty, t('booking.rules.unsavedConfirm'));

  const save = () => {
    setMessage(null);
    startSaving(async () => {
      const res = await saveBookingRulesAction(draft);
      if (!res.ok) { setMessage({ tone: 'error', text: errorText(t, res) }); return; }
      setSaved(res.config);
      setDraft(res.config);
      setMessage({ tone: 'ok', text: t('booking.rules.saved') });
    });
  };

  const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: string; detail?: string }>, after?: () => void) => {
    setBusy(key);
    setMessage(null);
    const res = await fn();
    setBusy(null);
    if (!res.ok) setMessage({ tone: 'error', text: errorText(t, res) });
    else after?.();
  };

  const tabs: { id: RulesTab; label: string; Icon: typeof Settings2 }[] = [
    { id: 'connection', label: t('booking.rules.tabConnection'), Icon: PlugZap },
    { id: 'types', label: t('booking.rules.tabTypes'), Icon: ListChecks },
    { id: 'auths', label: t('booking.rules.tabAuths'), Icon: Users },
    { id: 'bookings', label: t('booking.rules.tabBookings'), Icon: CalendarCheck2 },
    { id: 'settings', label: t('booking.rules.tabSettings'), Icon: Settings2 },
  ];

  const googleBanner = googleStatus && (
    <Banner tone={googleStatus === 'connected' ? 'ok' : 'error'}>{t(`booking.google.${googleStatus}`, { defaultValue: t('booking.google.failed') })}</Banner>
  );

  /* ---------------------------- Conexão Google ---------------------------- */
  const connectionTab = (
    <div className="space-y-6">
      {googleBanner}
      <Section title={t('booking.rules.googleTitle')} description={t('booking.rules.googleDesc')}>
        {!connection.configured ? (
          <Banner tone="warn">{t('booking.home.notConfigured')}</Banner>
        ) : connection.connected ? (
          <div className="space-y-5">
            <dl className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-x-6 gap-y-2 text-body">
              <dt className="text-slate-500">{t('booking.rules.googleAccount')}</dt><dd className="text-brand-dark font-medium">{diag?.email || connection.googleEmail}</dd>
              <dt className="text-slate-500">{t('booking.rules.googleTimeZone')}</dt><dd className="text-brand-dark">{diag?.timeZone || connection.timeZone}</dd>
              {connection.connectedAt && (<><dt className="text-slate-500">{t('booking.rules.googleSince')}</dt><dd className="text-brand-dark" suppressHydrationWarning>{new Date(connection.connectedAt).toLocaleString(locale)}</dd></>)}
              {diag && (<><dt className="text-slate-500">{t('booking.rules.googleRecords')}</dt><dd className="text-brand-dark">{t('booking.rules.googleRecordsValue', { total: diag.records, upcoming: diag.upcoming })}</dd></>)}
            </dl>
            {diag && <Banner tone="ok">{t('booking.rules.testOk')}</Banner>}
            <div className="flex flex-wrap gap-3">
              <Button busy={busy === 'test'} onClick={() => run('test', async () => {
                const res = await testConnectionAction();
                if (res.ok) setDiag(res);
                return res;
              })}>
                <Stethoscope className="w-4 h-4" /> {t('booking.rules.test')}
              </Button>
              <a href="/api/booking/google/connect" className="h-11 px-5 rounded-full border border-slate-300 bg-white text-body font-medium text-brand-dark inline-flex items-center gap-2 hover:border-slate-400">
                <PlugZap className="w-4 h-4" /> {t('booking.rules.reconnect')}
              </a>
              <Button variant="danger" busy={busy === 'disconnect'} onClick={() => {
                if (!window.confirm(t('booking.rules.disconnectConfirm'))) return;
                void run('disconnect', disconnectGoogleAction, () => router.refresh());
              }}>
                <Unplug className="w-4 h-4" /> {t('booking.rules.disconnect')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-body text-slate-500">{t('booking.rules.googleNotConnected')}</p>
            <a href="/api/booking/google/connect" className="h-11 px-5 rounded-full brand-bg-primary text-brand-ink btn-premium text-body font-medium inline-flex items-center gap-2">
              <PlugZap className="w-4 h-4" /> {t('booking.rules.connect')}
            </a>
            <Hint>{t('booking.rules.connectHint')}</Hint>
          </div>
        )}
      </Section>

      <Section title={t('booking.rules.availabilityTitle')}>
        <div className="space-y-4">
          <Switch
            checked={accepting}
            disabled={busy === 'accepting'}
            onChange={(v) => run('accepting', () => setAcceptingAction(v), () => setAccepting(v))}
            label={t('booking.rules.accepting')}
            hint={t('booking.rules.acceptingHint')}
          />
          {connection.connected && (
            <Link href={`/booking/book/${me.id}`} className="inline-flex items-center gap-2 text-label font-medium text-brand-dark hover:underline decoration-[color:var(--primary)] decoration-2 underline-offset-[3px]">
              <Eye className="w-4 h-4" /> {t('booking.rules.previewLink')}
            </Link>
          )}
        </div>
      </Section>
    </div>
  );

  /* -------------------------- Quem pode agendar --------------------------- */
  const setAuths = (auths: AuthRule[]) => setDraft({ ...draft, auths });
  const updateAuth = (i: number, patch: Partial<AuthRule>) => setAuths(draft.auths.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const authsTab = (
    <Section title={t('booking.rules.authsTitle')} description={t('booking.rules.authsDesc')}>
      {!draft.types.length && <div className="mb-4"><Banner tone="warn">{t('booking.rules.authsNoTypes')}</Banner></div>}
      <div className="space-y-3">
        {draft.auths.length === 0 && <p className="text-body text-slate-500">{t('booking.rules.authsEmpty')}</p>}
        {draft.auths.map((a, i) => (
          <div key={a.id} className="rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={a.who}
                onChange={(e) => updateAuth(i, { who: e.target.value as AuthRule['who'], value: e.target.value === 'segment' ? 'SC' : '' })}
                className={SELECT}
              >
                <option value="all">{t('booking.rules.whoAll')}</option>
                <option value="segment">{t('booking.rules.whoSegment')}</option>
                <option value="email">{t('booking.rules.whoEmail')}</option>
              </select>
              {a.who === 'segment' && (
                <select value={a.value} onChange={(e) => updateAuth(i, { value: e.target.value })} className={SELECT}>
                  {SEGMENTS.map((s: Segment) => <option key={s} value={s}>{t(SEGMENT_LABEL_KEYS[s])}</option>)}
                </select>
              )}
              {a.who === 'email' && (
                <input value={a.value} onChange={(e) => updateAuth(i, { value: e.target.value.trim().toLowerCase() })} placeholder={t('booking.rules.emailPlaceholder')} className={`${INPUT} flex-1 min-w-[220px]`} />
              )}
              <button type="button" aria-label={t('common.delete')} onClick={() => setAuths(draft.auths.filter((_, j) => j !== i))} className="ml-auto p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {draft.types.map((tp) => {
                const on = a.types.includes(tp.id);
                return <Chip key={tp.id} on={on} onClick={() => updateAuth(i, { types: on ? a.types.filter((x) => x !== tp.id) : [...a.types, tp.id] })}>{tp.name}</Chip>;
              })}
            </div>
            {a.who === 'email' && a.value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(a.value) && !/^\*@[^\s@]+\.[^\s@]{2,}$/.test(a.value) && (
              <Hint className="text-red-600">{t('booking.rules.emailInvalid')}</Hint>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Button size="sm" onClick={() => setAuths([...draft.auths, { id: newId('a'), who: 'all', value: '', types: draft.types.slice(0, 1).map((x) => x.id) }])}>
          <Plus className="w-4 h-4" /> {t('booking.rules.authsAdd')}
        </Button>
      </div>
    </Section>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        back={
          <Link href="/booking" className="inline-flex items-center gap-1.5 text-label font-medium text-slate-500 hover:text-brand-dark mb-3">
            <ArrowLeft className="w-4 h-4" /> {t('nav.booking')}
          </Link>
        }
        title={t('booking.rules.title')}
        accent={t('booking.rules.titleAccent')}
        subtitle={t('booking.rules.subtitle')}
        actions={
          <>
            {isDirty && <span className="text-label font-medium text-amber-700">{t('booking.rules.unsaved')}</span>}
            {isDirty && <Button variant="ghost" onClick={() => setDraft(saved)}>{t('booking.rules.discard')}</Button>}
            <Button variant="primary" busy={saving} disabled={!isDirty && connection.saved} onClick={save}>
              <Save className="w-4 h-4" /> {t('booking.rules.save')}
            </Button>
          </>
        }
      />

      {message && <Banner tone={message.tone}>{message.text}</Banner>}

      <div role="tablist" className={`${CARD} p-1.5 w-fit max-w-full overflow-x-auto flex gap-1`}>
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 rounded-xl text-label font-medium whitespace-nowrap inline-flex items-center gap-2 transition-colors ${
              tab === id ? 'brand-bg-primary text-brand-ink' : 'text-slate-500 hover:text-brand-dark hover:bg-slate-100'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'connection' && connectionTab}
      {tab === 'types' && <TypesEditor config={draft} onChange={setDraft} />}
      {tab === 'auths' && authsTab}
      {tab === 'bookings' && <BookingsManager config={saved} connected={connection.connected} onAutoCleanup={(on) => {
        setSaved({ ...saved, settings: { ...saved.settings, autoCleanup: on } });
        setDraft({ ...draft, settings: { ...draft.settings, autoCleanup: on } });
      }} />}
      {tab === 'settings' && <SettingsEditor config={draft} onChange={setDraft} ownerEmail={me.email} />}
    </div>
  );
}
