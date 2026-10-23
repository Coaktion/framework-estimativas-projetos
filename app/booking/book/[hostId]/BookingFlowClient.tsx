'use client';

/**
 * Fluxo de agendamento com um SE: tipo → detalhes → horário → confirmação.
 * Os horários vêm do servidor (motor do Agendamento) e são exibidos no fuso
 * escolhido por quem agenda (lembrado neste navegador).
 */
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CalendarDays, Check as CheckIcon, CheckCircle2, ChevronLeft, ChevronRight, Copy, List, Plus, RefreshCw, Video, X } from 'lucide-react';
import { DATE_LOCALE, normalizeLanguage } from '@/app/i18n/settings';
import { effectiveDurations, isEmail, type PublicType } from '@/lib/booking/config';
import { humanMinutes, nextYmd, weekdayOfYmd, ymdInTz } from '@/lib/booking/time';
import { Banner, Button, CARD, Check, Chip, Hint, Label, PageHeader, Switch, TextArea, TextInput, errorText } from '@/components/booking/ui';
import TimeZonePicker, { browserTimeZone } from '@/components/booking/TimeZonePicker';
import { bookAction, findSlotsAction, type BookSuccess } from '../../actions';

type Step = 'type' | 'details' | 'slots' | 'confirm' | 'done';
type Guest = { email: string; check: boolean };

const PAGE_DAYS = 21;
const RETRY_ERRORS = ['conflict', 'blocks_dont_fit', 'too_soon', 'type_gap', 'outside_hours'];

export default function BookingFlowClient({ host, me, types, unavailable, preview }: {
  host: { id: number; name: string; email: string; timeZone: string };
  me: { id: number; email: string; name: string };
  types: PublicType[];
  unavailable: string | null;
  preview: boolean;
}) {
  const { t, i18n } = useTranslation();
  const locale = DATE_LOCALE[normalizeLanguage(i18n.language)];

  const [step, setStep] = useState<Step>('type');
  const [type, setType] = useState<PublicType | null>(null);
  const [title, setTitle] = useState('');
  const [zoho, setZoho] = useState('');
  const [items, setItems] = useState<string[]>([]);
  const [dur, setDur] = useState(60);
  const [durTouched, setDurTouched] = useState(false);
  const [multi, setMulti] = useState(false);
  const [checkMine, setCheckMine] = useState(false);
  const [wdFilter, setWdFilter] = useState<number[] | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [guestInput, setGuestInput] = useState('');
  const [notes, setNotes] = useState('');

  const [slots, setSlots] = useState<string[]>([]);
  const [fetchedDays, setFetchedDays] = useState(0);
  const [hasMoreDays, setHasMoreDays] = useState(false);
  const [unavailableCals, setUnavailableCals] = useState<string[]>([]);
  const [maxBlocks, setMaxBlocks] = useState(3);
  const [blockBufMin, setBlockBufMin] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ code: string; text: string } | null>(null);

  const [view, setView] = useState<'cal' | 'list'>('cal');
  const [tz, setTz] = useState(host.timeZone);
  const [calOffset, setCalOffset] = useState(0);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [listDays, setListDays] = useState(10);
  const [selected, setSelected] = useState<string[]>([]);

  const [requestId, setRequestId] = useState('');
  const [booking, setBooking] = useState(false);
  const [slow, setSlow] = useState(false);
  const [result, setResult] = useState<BookSuccess | null>(null);
  const [copied, setCopied] = useState(false);

  // Fuso de exibição lembrado por usuário (padrão: o do navegador).
  const tzKey = `tcBookingTz:${me.id}`;
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(tzKey); } catch { /* sem storage */ }
    setTz(saved || browserTimeZone());
  }, [tzKey]);
  const changeTz = (z: string) => {
    setTz(z);
    setOpenDay(null);
    try { localStorage.setItem(tzKey, z); } catch { /* sem storage */ }
  };

  const fmt = useMemo(() => ({
    time: new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: tz }),
    dayLong: new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz }),
    full: new Intl.DateTimeFormat(locale, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: tz }),
    cell: new Intl.DateTimeFormat(locale, { day: '2-digit', timeZone: 'UTC' }),
    month: new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', timeZone: 'UTC' }),
    weekday: new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }),
  }), [locale, tz]);
  const ymdDate = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12));
  };
  const weekdayNames = [0, 1, 2, 3, 4, 5, 6].map((d) => fmt.weekday.format(new Date(Date.UTC(2026, 0, 4 + d, 12))));

  const durations = type ? effectiveDurations(type, items) : { minDur: 30, defDur: 60, maxDur: 240 };
  useEffect(() => {
    if (!type) return;
    setDur((d) => Math.min(Math.max(durTouched ? d : durations.defDur, durations.minDur), durations.maxDur));
  }, [type, items, durTouched, durations.defDur, durations.minDur, durations.maxDur]);

  const pickType = (tp: PublicType) => {
    setType(tp);
    setTitle('');
    setZoho('');
    setItems([]);
    setDurTouched(false);
    setDur(tp.defDur);
    setMulti(false);
    setCheckMine(false);
    setWdFilter(null);
    setGuests([]);
    setNotes('');
    setError(null);
    setStep('details');
  };

  /* ------------------------------ Horários ------------------------------ */

  const payload = (fromDay: number) => ({
    hostId: host.id, typeId: type!.id, itemIds: items, durationMin: dur, multi,
    checkMine, checkEmails: guests.filter((g) => g.check).map((g) => g.email), fromDay, days: PAGE_DAYS,
  });

  const search = async () => {
    if (!type) return;
    if (!title.trim()) { setError({ code: 'title_required', text: t('booking.errors.title_required') }); return; }
    if (items.length < type.minItems) { setError({ code: 'items_required', text: t('booking.flow.itemsMin', { count: type.minItems }) }); return; }
    setLoading(true);
    setError(null);
    const res = await findSlotsAction(payload(0));
    setLoading(false);
    if (!res.ok) { setError({ code: (res as { error?: string }).error || 'server_error', text: errorText(t, res) }); return; }
    setSlots(res.slots);
    setFetchedDays(res.days);
    setHasMoreDays(res.hasMoreDays);
    setUnavailableCals(res.unavailable);
    setMaxBlocks(res.maxBlocks);
    setBlockBufMin(res.blockBufferMin);
    setDur(res.durationMin);
    setSelected([]);
    setOpenDay(null);
    setCalOffset(0);
    setListDays(10);
    setStep('slots');
  };

  const fetchingMore = useRef(false);
  const ensureDays = async (needed: number) => {
    let have = fetchedDays;
    let more = hasMoreDays;
    if (have >= needed || !more || fetchingMore.current) return;
    fetchingMore.current = true;
    setLoading(true);
    try {
      for (let i = 0; i < 2 && have < needed && more; i++) {
        const res = await findSlotsAction(payload(have));
        if (!res.ok) { setError({ code: (res as { error?: string }).error || 'server_error', text: errorText(t, res) }); break; }
        setSlots((s) => [...s, ...res.slots.filter((x) => !s.includes(x))]);
        have += res.days;
        more = res.hasMoreDays;
        setFetchedDays(have);
        setHasMoreDays(more);
      }
    } finally {
      fetchingMore.current = false;
      setLoading(false);
    }
  };

  const visibleSlots = useMemo(
    () => slots.filter((iso) => !wdFilter || wdFilter.includes(weekdayOfYmd(ymdInTz(new Date(iso).getTime(), tz)))),
    [slots, wdFilter, tz],
  );
  const byDay = useMemo(() => {
    const map = new Map<string, string[]>();
    visibleSlots.forEach((iso) => {
      const k = ymdInTz(new Date(iso).getTime(), tz);
      map.set(k, [...(map.get(k) || []), iso]);
    });
    return map;
  }, [visibleSlots, tz]);

  const today = ymdInTz(Date.now(), tz);
  const gridStart = nextYmd(today, -weekdayOfYmd(today) + calOffset * 14);
  const gridDays = Array.from({ length: 14 }, (_, i) => nextYmd(gridStart, i));
  const daysUntil = (ymd: string) => Math.round((ymdDate(ymd).getTime() - ymdDate(today).getTime()) / 86400000);

  useEffect(() => {
    if (step !== 'slots' || view !== 'cal') return;
    void ensureDays(daysUntil(gridDays[13]) + 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calOffset, step, view]);

  const listGroups = Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const showMoreList = async () => {
    setListDays((n) => n + 10);
    if (listGroups.length < listDays + 10) await ensureDays(fetchedDays + PAGE_DAYS);
  };

  const conflictsWithSelection = (iso: string) => {
    const s = new Date(iso).getTime();
    const span = (dur + blockBufMin) * 60000;
    return selected.some((x) => {
      const o = new Date(x).getTime();
      return x !== iso && s < o + span && o < s + span;
    });
  };

  const clickSlot = (iso: string) => {
    if (multi) {
      if (selected.includes(iso)) setSelected(selected.filter((x) => x !== iso));
      else if (selected.length < maxBlocks && !conflictsWithSelection(iso)) setSelected([...selected, iso].sort());
      return;
    }
    setSelected([iso]);
    goConfirm();
  };

  const goConfirm = () => {
    setRequestId(typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `r${Date.now()}${Math.random()}`);
    setError(null);
    setStep('confirm');
  };

  /* ------------------------------ Agendar -------------------------------- */

  const confirm = async () => {
    if (!type || !selected.length) return;
    setBooking(true);
    setSlow(false);
    setError(null);
    const timer = setTimeout(() => setSlow(true), 2500);
    const res = await bookAction({
      hostId: host.id, typeId: type.id, itemIds: items, durationMin: dur, starts: selected, title,
      zoho, notes, guests: guests.map((g) => g.email), requestId,
    });
    clearTimeout(timer);
    setBooking(false);
    if (!res.ok) { setError({ code: (res as { error?: string }).error || 'server_error', text: errorText(t, res) }); return; }
    setResult(res);
    setStep('done');
  };

  const backToSlots = async () => {
    setError(null);
    await search();
  };

  const addGuest = () => {
    const g = guestInput.trim().toLowerCase();
    if (!isEmail(g)) { setError({ code: 'invalid_email', text: t('booking.errors.invalid_email') }); return; }
    if (g !== me.email && !guests.some((x) => x.email === g)) setGuests([...guests, { email: g, check: false }]);
    setGuestInput('');
    setError(null);
  };

  /* ------------------------------- Telas --------------------------------- */

  const back = (
    <Link href="/booking/book" className="inline-flex items-center gap-1.5 text-label font-medium text-slate-500 hover:text-brand-dark mb-3">
      <ArrowLeft className="w-4 h-4" /> {t('booking.picker.title')} {t('booking.picker.titleAccent')}
    </Link>
  );

  if (unavailable) {
    return (
      <div className="space-y-8">
        <PageHeader back={back} title={host.name || t('booking.flow.unknownHost')} />
        <Banner tone="warn">{t(`booking.errors.${unavailable}`)}</Banner>
      </div>
    );
  }

  const steps: { key: Step; label: string }[] = [
    { key: 'type', label: t('booking.flow.stepType') },
    { key: 'details', label: t('booking.flow.stepDetails') },
    { key: 'slots', label: t('booking.flow.stepSlots') },
    { key: 'confirm', label: t('booking.flow.stepConfirm') },
  ];
  const stepIndex = step === 'done' ? 4 : steps.findIndex((s) => s.key === step);

  const stepper = (
    <ol className="flex flex-wrap items-center gap-2 text-label">
      {steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-2">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-caption font-bold ${i < stepIndex ? 'brand-bg-primary text-brand-ink' : i === stepIndex ? 'bg-brand-dark text-[color:var(--bg-main)]' : 'bg-slate-100 text-slate-400'}`}>
            {i < stepIndex ? <CheckIcon className="w-3.5 h-3.5" /> : i + 1}
          </span>
          <span className={i === stepIndex ? 'font-medium text-brand-dark' : 'text-slate-500'}>{s.label}</span>
          {i < steps.length - 1 && <span className="w-6 h-px bg-slate-300" aria-hidden />}
        </li>
      ))}
    </ol>
  );

  const errorBanner = error && (
    <Banner tone="error">
      <span>{error.text}</span>
      {step === 'confirm' && RETRY_ERRORS.includes(error.code) && (
        <button type="button" onClick={backToSlots} className="ml-2 font-medium underline">{t('booking.flow.pickAnother')}</button>
      )}
    </Banner>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        back={back}
        title={t('booking.flow.titleWith')}
        accent={host.name}
        subtitle={type && step !== 'type' ? `${type.name} · ${dur} ${t('booking.flow.min')}` : t('booking.flow.subtitle')}
      />
      {preview && <Banner tone="info">{t('booking.flow.previewNote')}</Banner>}
      {step !== 'done' && stepper}

      {step === 'type' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {types.map((tp) => (
            <button key={tp.id} type="button" onClick={() => pickType(tp)} className={`group text-left ${CARD} p-6 flex flex-col gap-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:border-slate-300`}>
              <span className="text-title font-bold text-brand-dark">{tp.name}</span>
              {tp.desc && <span className="text-body text-slate-500 whitespace-pre-line">{tp.desc}</span>}
              <span className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-caption font-medium text-slate-500">
                <span className="rounded-full bg-slate-100 px-2.5 py-1">
                  {tp.minDur === tp.maxDur ? `${tp.minDur} ${t('booking.flow.min')}` : `${tp.minDur}–${tp.maxDur} ${t('booking.flow.min')}`}
                </span>
                {tp.meet && <span className="rounded-full bg-slate-100 px-2.5 py-1 inline-flex items-center gap-1"><Video className="w-3 h-3" /> Google Meet</span>}
                {tp.multiBlock && <span className="rounded-full bg-slate-100 px-2.5 py-1">{t('booking.flow.multiBadge')}</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      {step === 'details' && type && (
        <div className={`${CARD} p-6 space-y-6 max-w-3xl`}>
          <div>
            <Label htmlFor="bk-title" tip={t('booking.flow.titleTip')}>{t('booking.flow.titleLabel')} *</Label>
            <TextInput id="bk-title" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('booking.flow.titlePlaceholder')} />
            <Hint>{t('booking.flow.titleHint')}</Hint>
          </div>
          {type.zohoField && (
            <div>
              <Label htmlFor="bk-zoho" tip={t('booking.flow.zohoTip')}>{t('booking.flow.zohoLabel')}</Label>
              <TextInput id="bk-zoho" type="url" maxLength={500} value={zoho} onChange={(e) => setZoho(e.target.value)} placeholder="https://…" />
            </div>
          )}
          {type.items.length > 0 && (
            <div>
              <Label tip={t('booking.flow.itemsTip')}>{t('booking.flow.itemsLabel')}</Label>
              <Hint className="mb-2">
                {t('booking.flow.itemsHint')}
                {type.minItems > 0 && ` ${t('booking.flow.itemsMin', { count: type.minItems })}`}
              </Hint>
              {type.items.map((it) => (
                <Check key={it.id} checked={items.includes(it.id)} onChange={(on) => setItems(on ? [...items, it.id] : items.filter((x) => x !== it.id))} label={it.name} />
              ))}
            </div>
          )}
          {type.multiBlock && (
            <Switch checked={multi} onChange={setMulti} label={t('booking.flow.multiLabel')} tip={t('booking.flow.multiTip')} hint={t('booking.flow.multiHint', { count: type.maxBlocks })} />
          )}
          <div>
            <Label tip={t('booking.flow.durationTip')}>{t('booking.flow.durationLabel')}</Label>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => { setDurTouched(true); setDur((d) => Math.max(durations.minDur, d - 15)); }} disabled={dur <= durations.minDur}>−15</Button>
              <input
                type="number"
                inputMode="numeric"
                value={dur}
                min={durations.minDur}
                max={durations.maxDur}
                onChange={(e) => { setDurTouched(true); setDur(parseInt(e.target.value, 10) || durations.minDur); }}
                onBlur={() => setDur((d) => Math.min(Math.max(d, durations.minDur), durations.maxDur))}
                className="w-24 h-9 text-center bg-white border border-slate-300 rounded-[10px] text-body tabular-nums outline-none focus:border-brand-primary"
              />
              <Button size="sm" onClick={() => { setDurTouched(true); setDur((d) => Math.min(durations.maxDur, d + 15)); }} disabled={dur >= durations.maxDur}>+15</Button>
              <span className="text-caption text-slate-500">{humanMinutes(dur) && `= ${humanMinutes(dur)} · `}{durations.minDur}–{durations.maxDur} {t('booking.flow.min')}</span>
            </div>
          </div>
          <Switch checked={checkMine} onChange={setCheckMine} label={t('booking.flow.checkMineLabel')} tip={t('booking.flow.checkMineTip')} hint={t('booking.flow.checkMineHint')} />
          <div>
            <Label tip={t('booking.flow.weekdaysTip')}>{t('booking.flow.weekdaysLabel')}</Label>
            <div className="flex flex-wrap gap-2">
              {type.weekdays.map((d) => {
                const on = !wdFilter || wdFilter.includes(d);
                return (
                  <Chip key={d} on={on} onClick={() => {
                    const cur = wdFilter || type.weekdays;
                    const next = on ? cur.filter((x) => x !== d) : [...cur, d].sort();
                    if (next.length) setWdFilter(next.length === type.weekdays.length ? null : next);
                  }}>
                    {weekdayNames[d]}
                  </Chip>
                );
              })}
            </div>
          </div>
          <div>
            <Label htmlFor="bk-guest" tip={t('booking.flow.guestsTip')}>{t('booking.flow.guestsLabel')}</Label>
            <div className="flex gap-2 max-w-md">
              <TextInput id="bk-guest" type="email" value={guestInput} onChange={(e) => setGuestInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGuest(); } }} placeholder="nome@empresa.com" />
              <Button onClick={addGuest}><Plus className="w-4 h-4" /> {t('booking.flow.guestsAdd')}</Button>
            </div>
            <Hint>{t('booking.flow.guestsHint')}</Hint>
            {guests.length > 0 && (
              <ul className="mt-3 divide-y divide-slate-200 border border-slate-200 rounded-xl">
                {guests.map((g, i) => (
                  <li key={g.email} className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <span className="flex-1 min-w-0 truncate text-body text-brand-dark">{g.email}</span>
                    <Switch checked={g.check} onChange={(v) => setGuests(guests.map((x, j) => (j === i ? { ...x, check: v } : x)))} label={<span className="text-label font-normal">{t('booking.flow.guestCheck')}</span>} />
                    <button type="button" aria-label={t('common.delete')} onClick={() => setGuests(guests.filter((_, j) => j !== i))} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {errorBanner}
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" busy={loading} onClick={search}>{loading ? t('booking.flow.searching') : t('booking.flow.search')}</Button>
            <Button variant="ghost" onClick={() => { setError(null); setStep('type'); }}>{t('booking.flow.back')}</Button>
          </div>
        </div>
      )}

      {step === 'slots' && type && (
        <div className={`${CARD} p-6 space-y-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1" role="tablist">
              {(['cal', 'list'] as const).map((v) => (
                <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`px-4 h-9 rounded-full text-label font-medium inline-flex items-center gap-2 ${view === v ? 'bg-white text-brand-dark shadow-sm' : 'text-slate-500 hover:text-brand-dark'}`}>
                  {v === 'cal' ? <CalendarDays className="w-4 h-4" /> : <List className="w-4 h-4" />}
                  {t(v === 'cal' ? 'booking.flow.viewCal' : 'booking.flow.viewList')}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <TimeZonePicker value={tz} onChange={changeTz} />
              <Button size="sm" variant="ghost" busy={loading} onClick={search}><RefreshCw className="w-4 h-4" /> {t('booking.flow.refresh')}</Button>
              <Button size="sm" variant="ghost" onClick={() => setStep('details')}>{t('booking.flow.adjust')}</Button>
            </div>
          </div>

          {unavailableCals.length > 0 && <Banner tone="warn">{t('booking.flow.unavailableCals', { list: unavailableCals.join(', '), count: unavailableCals.length })}</Banner>}
          {errorBanner}
          {multi && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-label text-brand-dark">
                {selected.length ? t('booking.flow.multiBar', { count: selected.length, max: maxBlocks }) : t('booking.flow.multiNone')}
              </span>
              <Button size="sm" variant="primary" disabled={!selected.length} onClick={goConfirm}>{t('booking.flow.continue')}</Button>
            </div>
          )}

          {visibleSlots.length === 0 && !loading && !hasMoreDays ? (
            <p className="text-body text-slate-500 py-8 text-center">{t('booking.flow.noSlots')}</p>
          ) : view === 'cal' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button size="sm" variant="ghost" disabled={calOffset === 0} onClick={() => { setCalOffset((o) => o - 1); setOpenDay(null); }}>
                  <ChevronLeft className="w-4 h-4" /> {t('booking.flow.prevWeeks')}
                </Button>
                <span className="text-label font-medium text-brand-dark">
                  {fmt.month.format(ymdDate(gridDays[0]))} – {fmt.month.format(ymdDate(gridDays[13]))}
                </span>
                <Button size="sm" variant="ghost" disabled={!hasMoreDays && daysUntil(gridDays[13]) >= fetchedDays} onClick={() => { setCalOffset((o) => o + 1); setOpenDay(null); }}>
                  {t('booking.flow.nextWeeks')} <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-1.5 text-center">
                {weekdayNames.map((w) => <span key={w} className="text-caption font-medium uppercase text-slate-400 py-1">{w}</span>)}
                {gridDays.map((d) => {
                  const count = byDay.get(d)?.length || 0;
                  const past = d < today;
                  const on = openDay === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={!count}
                      onClick={() => setOpenDay(on ? null : d)}
                      className={`rounded-xl border px-1 py-2.5 flex flex-col items-center gap-0.5 transition-colors ${
                        on ? 'brand-bg-primary text-brand-ink border-transparent' : count ? 'bg-white border-slate-200 hover:border-slate-400 text-brand-dark' : 'bg-slate-50 border-transparent text-slate-300'
                      } ${past ? 'opacity-60' : ''}`}
                    >
                      <span className="text-body font-bold tabular-nums">{fmt.cell.format(ymdDate(d))}</span>
                      <span className="text-[11px] leading-none">{count ? t('booking.flow.slotsCount', { count }) : '—'}</span>
                    </button>
                  );
                })}
              </div>
              {loading && <p className="text-label text-slate-500">{t('booking.flow.loadingMore')}</p>}
              {openDay && byDay.get(openDay) && (
                <div>
                  <p className="text-label font-medium text-brand-dark mb-2 first-letter:uppercase">{fmt.dayLong.format(new Date(byDay.get(openDay)![0]))}</p>
                  {slotButtons(byDay.get(openDay)!)}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {listGroups.slice(0, listDays).map(([d, list]) => (
                <div key={d}>
                  <p className="text-label font-medium text-brand-dark mb-2 first-letter:uppercase">{fmt.dayLong.format(new Date(list[0]))}</p>
                  {slotButtons(list)}
                </div>
              ))}
              {(listGroups.length > listDays || hasMoreDays) && (
                <Button size="sm" busy={loading} onClick={showMoreList}>{t('booking.flow.moreDays')}</Button>
              )}
            </div>
          )}
        </div>
      )}

      {step === 'confirm' && type && (
        <div className={`${CARD} p-6 space-y-5 max-w-3xl`}>
          <dl className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-x-6 gap-y-3 text-body">
            <dt className="text-slate-500">{t('booking.flow.confWith')}</dt><dd className="text-brand-dark font-medium">{host.name}</dd>
            <dt className="text-slate-500">{t('booking.flow.confType')}</dt><dd className="text-brand-dark">{type.name}</dd>
            <dt className="text-slate-500">{t('booking.flow.titleLabel')}</dt><dd className="text-brand-dark">{title}</dd>
            <dt className="text-slate-500">{t(selected.length > 1 ? 'booking.flow.confTimes' : 'booking.flow.confTime')}</dt>
            <dd className="text-brand-dark tabular-nums">{selected.map((iso) => <span key={iso} className="block first-letter:uppercase">{fmt.full.format(new Date(iso))}</span>)}</dd>
            <dt className="text-slate-500">{t('booking.flow.confDuration')}</dt><dd className="text-brand-dark">{dur} {t('booking.flow.min')}</dd>
            <dt className="text-slate-500">{t('booking.flow.confWho')}</dt>
            <dd className="text-brand-dark">{[host.email, me.email, ...guests.map((g) => g.email)].filter((v, i, a) => v && a.indexOf(v) === i).join(', ')}</dd>
            {type.meet && (<><dt className="text-slate-500">{t('booking.flow.confMeet')}</dt><dd className="text-brand-dark">{t('booking.flow.confMeetYes')}</dd></>)}
          </dl>
          <div>
            <Label htmlFor="bk-notes">{t('booking.flow.notesLabel')}</Label>
            <TextArea id="bk-notes" rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {errorBanner}
          {booking && slow && <p className="text-label text-slate-500">{t('booking.flow.slowNote')}</p>}
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" busy={booking} onClick={confirm}>{booking ? t('booking.flow.booking') : t('booking.flow.confirm')}</Button>
            <Button variant="ghost" disabled={booking} onClick={() => { setError(null); setStep('slots'); }}>{t('booking.flow.back')}</Button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div className={`${CARD} p-8 space-y-5 max-w-3xl`}>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-brand-primary" />
            <h2 className="text-section font-heading text-brand-dark">{t(result.multi ? 'booking.flow.doneTitleMulti' : 'booking.flow.doneTitle')}</h2>
          </div>
          <p className="text-body text-slate-500">{t('booking.flow.doneMail', { email: me.email })}</p>
          <ul className="space-y-1 text-body text-brand-dark tabular-nums">
            {result.bookings.map((b) => <li key={b.eventId} className="first-letter:uppercase">{fmt.full.format(new Date(b.start))} – {fmt.time.format(new Date(b.end))}</li>)}
          </ul>
          {result.bookings[0]?.meetLink && (
            <div className="flex flex-wrap gap-3">
              <a href={result.bookings[0].meetLink} target="_blank" rel="noopener noreferrer" className="h-11 px-5 rounded-full brand-bg-primary text-brand-ink btn-premium text-body font-medium inline-flex items-center gap-2">
                <Video className="w-4 h-4" /> {t('booking.flow.doneMeet')}
              </a>
              <Button onClick={async () => { try { await navigator.clipboard.writeText(result.bookings[0].meetLink!); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* sem clipboard */ } }}>
                <Copy className="w-4 h-4" /> {copied ? t('booking.flow.copied') : t('booking.flow.doneCopy')}
              </Button>
            </div>
          )}
          <div className="flex flex-wrap gap-3 pt-2">
            <Button onClick={() => { setResult(null); setSelected([]); setStep('type'); }}>{t('booking.flow.doneAgain')}</Button>
            <Link href="/booking" className="h-11 px-5 rounded-full text-body font-medium inline-flex items-center text-slate-500 hover:text-brand-dark hover:bg-slate-100">{t('booking.flow.doneHome')}</Link>
          </div>
        </div>
      )}
    </div>
  );

  function slotButtons(list: string[]) {
    return (
      <div className="flex flex-wrap gap-2">
        {list.map((iso) => {
          const on = selected.includes(iso);
          const blocked = multi && !on && (selected.length >= maxBlocks || conflictsWithSelection(iso));
          return (
            <button
              key={iso}
              type="button"
              disabled={blocked}
              onClick={() => clickSlot(iso)}
              className={`h-10 min-w-[84px] px-3 rounded-xl border text-body font-medium tabular-nums transition-colors ${
                on ? 'brand-bg-primary text-brand-ink border-transparent' : 'bg-white border-slate-200 text-brand-dark hover:border-[color:var(--primary)]'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {fmt.time.format(new Date(iso))}
            </button>
          );
        })}
      </div>
    );
  }
}
