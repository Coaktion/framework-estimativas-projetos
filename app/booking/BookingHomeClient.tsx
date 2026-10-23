'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, CalendarPlus, ChevronRight, Settings2, Video, X } from 'lucide-react';
import { DATE_LOCALE, normalizeLanguage } from '@/app/i18n/settings';
import { useAppRouter } from '@/components/AppBlockingLoader';
import { Banner, Button, CARD, PageHeader, errorText } from '@/components/booking/ui';
import { cancelMyBookingAction } from './actions';

export type MyBooking = {
  group: string;
  title: string;
  typeName: string;
  hostName: string;
  multi: boolean;
  starts: string[];
  end: string;
  meetLink: string | null;
  cancelledAt: string | null;
};

type Status = { configured: boolean; connected: boolean; googleEmail: string | null; accepting: boolean; upcomingReceived: number };

export default function BookingHomeClient({ status, bookings }: { status: Status; bookings: MyBooking[] }) {
  const { t, i18n } = useTranslation();
  const router = useAppRouter();
  const locale = DATE_LOCALE[normalizeLanguage(i18n.language)];
  const [pending, startTransition] = useTransition();
  const [busyGroup, setBusyGroup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fmt = (iso: string) => new Intl.DateTimeFormat(locale, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

  const now = Date.now();
  const upcoming = bookings.filter((b) => new Date(b.end).getTime() >= now);
  const past = bookings.filter((b) => new Date(b.end).getTime() < now).reverse();

  const rulesMeta = !status.connected
    ? t('booking.home.rulesNotConnected')
    : !status.accepting
      ? t('booking.home.rulesPaused')
      : t('booking.home.rulesConnected', { email: status.googleEmail });

  const cancel = (b: MyBooking) => {
    if (!window.confirm(t('booking.home.cancelConfirm', { title: b.title }))) return;
    setBusyGroup(b.group);
    setError(null);
    startTransition(async () => {
      const res = await cancelMyBookingAction(b.group);
      setBusyGroup(null);
      if (!res.ok) setError(errorText(t, res));
      else router.refresh();
    });
  };

  const row = (b: MyBooking) => (
    <li key={b.group} className="flex flex-col sm:flex-row sm:items-center gap-3 py-4 border-t border-slate-200 first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className={`font-medium text-brand-dark ${b.cancelledAt ? 'line-through text-slate-400' : ''}`}>{b.title}</p>
        <p className="text-label text-slate-500">
          {b.hostName} · {b.typeName}
          {b.multi && ` · ${t('booking.home.multiHold')}`}
        </p>
        <p className="text-label text-slate-500 tabular-nums" suppressHydrationWarning>{b.starts.map(fmt).join(' · ')}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {b.cancelledAt ? (
          <span className="text-caption font-medium text-slate-500 bg-slate-100 rounded-full px-2.5 py-1">{t('booking.home.cancelled')}</span>
        ) : (
          <>
            {b.meetLink && new Date(b.end).getTime() >= now && (
              <a href={b.meetLink} target="_blank" rel="noopener noreferrer" className="h-9 px-3.5 rounded-full border border-slate-300 bg-white text-label font-medium text-brand-dark inline-flex items-center gap-2 hover:border-slate-400">
                <Video className="w-4 h-4" /> Meet
              </a>
            )}
            {new Date(b.end).getTime() >= now && (
              <Button size="sm" variant="danger" busy={pending && busyGroup === b.group} onClick={() => cancel(b)}>
                <X className="w-4 h-4" /> {t('booking.home.cancel')}
              </Button>
            )}
          </>
        )}
      </div>
    </li>
  );

  return (
    <div className="space-y-10">
      <PageHeader title="" accent={t('nav.booking')} subtitle={t('booking.home.subtitle')} />

      {!status.configured && <Banner tone="warn">{t('booking.home.notConfigured')}</Banner>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/booking/book" className={`group ${CARD} p-7 flex flex-col gap-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:border-slate-300`}>
          <span className="w-11 h-11 rounded-xl bg-brand-soft text-brand-soft-fg flex items-center justify-center">
            <CalendarPlus className="w-[22px] h-[22px]" />
          </span>
          <h2 className="text-title font-bold text-brand-dark">{t('booking.home.bookTitle')}</h2>
          <p className="text-body text-slate-500">{t('booking.home.bookDesc')}</p>
          <span className="mt-auto flex items-center justify-between text-label font-medium">
            <span className="text-slate-500">{t('booking.home.bookMeta')}</span>
            <ChevronRight className="w-4 h-4 text-brand-dark transition-transform duration-200 group-hover:translate-x-1" />
          </span>
        </Link>
        <Link href="/booking/rules" className={`group ${CARD} p-7 flex flex-col gap-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:border-slate-300`}>
          <span className="w-11 h-11 rounded-xl bg-brand-soft text-brand-soft-fg flex items-center justify-center">
            <Settings2 className="w-[22px] h-[22px]" />
          </span>
          <h2 className="text-title font-bold text-brand-dark">{t('booking.home.rulesTitle')}</h2>
          <p className="text-body text-slate-500">{t('booking.home.rulesDesc')}</p>
          <span className="mt-auto flex items-center justify-between gap-3 text-label font-medium">
            <span className={`min-w-0 truncate ${status.connected && status.accepting ? 'text-slate-500' : 'text-amber-700'}`}>{rulesMeta}</span>
            <ChevronRight className="w-4 h-4 shrink-0 text-brand-dark transition-transform duration-200 group-hover:translate-x-1" />
          </span>
        </Link>
      </div>

      <section className={`${CARD} p-6`}>
        <div className="flex flex-wrap items-baseline justify-between gap-3 mb-2">
          <h2 className="text-title font-bold text-brand-dark inline-flex items-center gap-2">
            <CalendarClock className="w-5 h-5" /> {t('booking.home.myBookings')}
          </h2>
          {status.upcomingReceived > 0 && (
            <Link href="/booking/rules?tab=bookings" className="text-label font-medium text-brand-dark hover:underline decoration-[color:var(--primary)] decoration-2 underline-offset-[3px]">
              {t('booking.home.receivedLink', { count: status.upcomingReceived })}
            </Link>
          )}
        </div>
        {error && <div className="mb-3"><Banner tone="error">{error}</Banner></div>}
        {upcoming.length === 0 ? (
          <p className="text-body text-slate-500 py-6">{t('booking.home.noBookings')}</p>
        ) : (
          <ul>{upcoming.map(row)}</ul>
        )}
        {past.length > 0 && (
          <details className="mt-4">
            <summary className="text-label font-medium text-slate-500 cursor-pointer">{t('booking.home.pastBookings', { count: past.length })}</summary>
            <ul className="mt-2">{past.map(row)}</ul>
          </details>
        )}
      </section>
    </div>
  );
}
