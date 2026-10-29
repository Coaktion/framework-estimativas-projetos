'use client';

/**
 * Agendamentos recebidos pelo anfitrião: estado real de cada evento no Google
 * Agenda, exclusão por escopo e limpeza de bloqueios de reuniões apagadas ou
 * recusadas (manual ou automática, de hora em hora).
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Search } from 'lucide-react';
import { DATE_LOCALE, normalizeLanguage } from '@/app/i18n/settings';
import type { BookingConfig } from '@/lib/booking/config';
import {
  deleteBookingEventsAction, listHostBookingsAction, scanOrphansAction, setAutoCleanupAction, type HostBooking,
} from '@/app/booking/actions';
import { Banner, Button, CARD, Check, INPUT, SELECT, Section, Switch, errorText } from './ui';

type Orphan = { group: string; title: string; requester: string; typeName: string; start: string | null; blocks: number; declinedBy: string | null };
type Sort = 'meeting_desc' | 'meeting_asc' | 'created_desc' | 'created_asc' | 'title' | 'requester' | 'type';

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export default function BookingsManager({ config, connected, onAutoCleanup }: { config: BookingConfig; connected: boolean; onAutoCleanup: (on: boolean) => void }) {
  const { t, i18n } = useTranslation();
  const locale = DATE_LOCALE[normalizeLanguage(i18n.language)];
  const [list, setList] = useState<HostBooking[] | null>(null);
  const [truncated, setTruncated] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [scan, setScan] = useState<{ kind: 'deleted' | 'declined'; found: Orphan[]; sel: Set<string> } | null>(null);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sort, setSort] = useState<Sort>('meeting_desc');
  const [hidePast, setHidePast] = useState(true);
  const [hideGone, setHideGone] = useState(true);
  const auto = config.settings.autoCleanup;

  const fmt = (iso: string) => new Intl.DateTimeFormat(locale, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  const fmtDate = (iso: string) => new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(iso));

  const load = async () => {
    setError(null);
    setList(null);
    const res = await listHostBookingsAction();
    if (!res.ok) { setError(errorText(t, res)); setList([]); return; }
    setList(res.bookings);
    setTruncated(res.truncated);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const shown = useMemo(() => {
    const now = Date.now();
    const words = fold(q.trim()).split(/\s+/).filter(Boolean);
    const out = (list || []).filter((x) => {
      if (typeFilter && x.typeId !== typeFilter) return false;
      if (hideGone && x.fullyDeleted) return false;
      if (hidePast && x.lastMeetingEnd && new Date(x.lastMeetingEnd).getTime() < now) return false;
      if (words.length) {
        const hay = fold([x.title, x.requester, x.email, x.typeName].join(' '));
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    const meeting = (x: HostBooking) => (x.lastMeetingEnd ? new Date(x.lastMeetingEnd).getTime() : 0);
    const created = (x: HostBooking) => new Date(x.createdAt).getTime();
    const cmp: Record<Sort, (a: HostBooking, b: HostBooking) => number> = {
      meeting_desc: (a, b) => meeting(b) - meeting(a),
      meeting_asc: (a, b) => meeting(a) - meeting(b),
      created_desc: (a, b) => created(b) - created(a),
      created_asc: (a, b) => created(a) - created(b),
      title: (a, b) => a.title.localeCompare(b.title, locale),
      requester: (a, b) => a.requester.localeCompare(b.requester, locale),
      type: (a, b) => a.typeName.localeCompare(b.typeName, locale),
    };
    return out.sort(cmp[sort]);
  }, [list, q, typeFilter, sort, hidePast, hideGone, locale]);

  const toggleAuto = async (on: boolean) => {
    setBusy('auto');
    setError(null);
    const res = await setAutoCleanupAction(on);
    setBusy(null);
    if (!res.ok) { setError(errorText(t, res)); return; }
    onAutoCleanup(on);
    setNote(t(on ? 'booking.bookings.autoOn' : 'booking.bookings.autoOff'));
  };

  const runScan = async (kind: 'deleted' | 'declined') => {
    setBusy(`scan-${kind}`);
    setError(null);
    const res = await scanOrphansAction(kind);
    setBusy(null);
    if (!res.ok) { setError(errorText(t, res)); return; }
    setScan({ kind, found: res.found, sel: new Set(res.found.map((f) => f.group)) });
  };

  const del = async (groups: string[], scope: 'all' | 'blocks' | 'before' | 'after', key: string) => {
    if (!window.confirm(t(`booking.bookings.confirm.${scope}`, { count: groups.length }))) return;
    setBusy(key);
    setError(null);
    const res = await deleteBookingEventsAction(groups, scope);
    setBusy(null);
    if (!res.ok) { setError(errorText(t, res)); return; }
    setNote(res.removed ? t('booking.bookings.removed', { count: res.removed }) : t('booking.bookings.nothingRemoved'));
    setScan(null);
    await load();
  };

  if (!connected) return <Banner tone="warn">{t('booking.errors.calendar_not_connected')}</Banner>;

  return (
    <div className="space-y-6">
      <Section title={t('booking.bookings.cleanupTitle')}>
        <div className="space-y-4">
          <Switch checked={auto} disabled={busy === 'auto'} onChange={toggleAuto} label={t('booking.bookings.auto')} tip={t('booking.bookings.autoTip')} hint={t('booking.bookings.autoHint')} />
          {!auto && (
            <div className="flex flex-wrap gap-3">
              <Button size="sm" busy={busy === 'scan-deleted'} onClick={() => runScan('deleted')}>{t('booking.bookings.scanDeleted')}</Button>
              <Button size="sm" busy={busy === 'scan-declined'} onClick={() => runScan('declined')}>{t('booking.bookings.scanDeclined')}</Button>
            </div>
          )}
          {scan && (scan.found.length === 0 ? (
            <Banner tone="ok">{t(`booking.bookings.scanNone.${scan.kind}`)}</Banner>
          ) : (
            <div className="rounded-xl border border-slate-200 p-4 space-y-2">
              <p className="text-label font-medium text-brand-dark">{t(`booking.bookings.scanFound.${scan.kind}`, { count: scan.found.length })}</p>
              {scan.found.map((f) => (
                <Check
                  key={f.group}
                  checked={scan.sel.has(f.group)}
                  onChange={(on) => {
                    const sel = new Set(scan.sel);
                    if (on) sel.add(f.group); else sel.delete(f.group);
                    setScan({ ...scan, sel });
                  }}
                  label={f.title || t('booking.bookings.untitled')}
                  hint={[f.requester, f.typeName, f.start ? fmt(f.start) : '—', t('booking.bookings.blocksCount', { count: f.blocks }), f.declinedBy ? t('booking.bookings.declinedBy', { email: f.declinedBy }) : ''].filter(Boolean).join(' · ')}
                />
              ))}
              <div className="flex flex-wrap gap-3 pt-2">
                <Button size="sm" variant="danger" disabled={!scan.sel.size} busy={busy === 'purge'} onClick={() => del(Array.from(scan.sel), 'blocks', 'purge')}>{t('booking.bookings.purge')}</Button>
                <Button size="sm" variant="ghost" onClick={() => setScan(null)}>{t('common.cancel')}</Button>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {error && <Banner tone="error">{error}</Banner>}
      {note && <Banner tone="ok">{note}</Banner>}

      <section className={`${CARD} p-6 space-y-4`}>
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative flex-1 min-w-[220px]">
            <span className="sr-only">{t('booking.bookings.search')}</span>
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('booking.bookings.search')} className={`${INPUT} pl-10`} />
          </label>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={SELECT}>
            <option value="">{t('booking.bookings.allTypes')}</option>
            {config.types.map((tp) => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={SELECT}>
            {(['meeting_desc', 'meeting_asc', 'created_desc', 'created_asc', 'title', 'requester', 'type'] as Sort[]).map((s) => (
              <option key={s} value={s}>{t(`booking.bookings.sort.${s}`)}</option>
            ))}
          </select>
          <Button size="sm" variant="ghost" busy={list === null} onClick={load}><RefreshCw className="w-4 h-4" /> {t('booking.flow.refresh')}</Button>
        </div>
        <div className="flex flex-wrap gap-x-6">
          <Check checked={hidePast} onChange={setHidePast} label={t('booking.bookings.hidePast')} />
          <Check checked={hideGone} onChange={setHideGone} label={t('booking.bookings.hideGone')} />
        </div>

        {list === null ? (
          <p className="text-body text-slate-500 py-6">{t('booking.bookings.loading')}</p>
        ) : shown.length === 0 ? (
          <p className="text-body text-slate-500 py-6">{t('booking.bookings.empty')}</p>
        ) : (
          <>
            <p className="text-label text-slate-500">
              {t('booking.bookings.count', { shown: shown.length, total: list.length })}
              {truncated > 0 && ` · ${t('booking.bookings.truncated', { count: truncated })}`}
            </p>
            <ul className="divide-y divide-slate-200">
              {shown.map((x) => {
                const live: Record<string, number> = {};
                x.blocks.forEach((b) => { if (b.state !== 'deleted') live[b.role] = (live[b.role] || 0) + 1; });
                const blocksText = Object.entries(live).map(([r, n]) => `${t(`booking.roles.${r}`, { defaultValue: r })}${n > 1 ? ` ×${n}` : ''}`).join(', ') || t('booking.bookings.noLiveBlocks');
                return (
                  <li key={x.group} className="py-4 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-brand-dark">{x.title || t('booking.bookings.untitled')}</span>
                      {x.fullyDeleted ? <Badge tone="gone">{t('booking.bookings.badgeGone')}</Badge> : x.meetingDeleted && <Badge tone="warn">{t('booking.bookings.badgeMeetingDeleted')}</Badge>}
                      {x.declined && <Badge tone="warn">{t('booking.bookings.badgeDeclined')}</Badge>}
                      {x.multi && <Badge>{t('booking.home.multiHold')}</Badge>}
                    </div>
                    <dl className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-x-6 gap-y-1 text-label">
                      <div><dt className="text-slate-400">{t('booking.bookings.requester')}</dt><dd className="text-brand-dark">{x.requester}{x.email !== x.requester && <span className="text-slate-500"> &lt;{x.email}&gt;</span>}</dd></div>
                      <div><dt className="text-slate-400">{t('booking.flow.confType')}</dt><dd className="text-brand-dark">{x.typeName}</dd></div>
                      <div><dt className="text-slate-400">{t('booking.bookings.requestedAt')}</dt><dd className="text-brand-dark">{fmtDate(x.createdAt)}</dd></div>
                      <div>
                        <dt className="text-slate-400">{t(x.meetings.length > 1 ? 'booking.flow.confTimes' : 'booking.flow.confTime')}</dt>
                        <dd className="text-brand-dark tabular-nums">
                          {x.meetings.map((m) => (
                            <span key={m.id} className={`block ${m.state === 'deleted' ? 'line-through text-slate-400' : ''}`}>
                              {fmt(m.start)}
                              {m.state === 'declined' && ` (${t('booking.bookings.declinedShort')}${m.declinedBy ? ` · ${m.declinedBy}` : ''})`}
                            </span>
                          ))}
                        </dd>
                      </div>
                      <div><dt className="text-slate-400">{t('booking.bookings.liveBlocks')}</dt><dd className="text-brand-dark">{blocksText}</dd></div>
                    </dl>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" variant="danger" disabled={x.fullyDeleted} busy={busy === `${x.group}-all`} onClick={() => del([x.group], 'all', `${x.group}-all`)}>{t('booking.bookings.deleteAll')}</Button>
                      {(['blocks', 'before', 'after'] as const).map((scope) => (
                        <Button key={scope} size="sm" disabled={x.liveBlocks === 0} busy={busy === `${x.group}-${scope}`} onClick={() => del([x.group], scope, `${x.group}-${scope}`)}>
                          {t(`booking.bookings.delete.${scope}`)}
                        </Button>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function Badge({ tone, children }: { tone?: 'warn' | 'gone'; children: React.ReactNode }) {
  const cls = tone === 'warn' ? 'bg-amber-50 text-amber-800 border-amber-200' : tone === 'gone' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-white text-slate-600 border-slate-200';
  return <span className={`text-caption font-medium border rounded-full px-2 py-0.5 ${cls}`}>{children}</span>;
}
