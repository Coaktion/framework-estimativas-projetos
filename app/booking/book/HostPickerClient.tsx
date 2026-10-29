'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ChevronRight, Search, UserRound } from 'lucide-react';
import { CARD, PageHeader } from '@/components/booking/ui';

export type HostCard = {
  id: number;
  name: string;
  email: string;
  segment: string;
  status: 'available' | 'not_connected' | 'paused' | 'no_types';
  typeNames: string[];
};

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export default function HostPickerClient({ hosts }: { hosts: HostCard[] }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = fold(query.trim());
    const list = q ? hosts.filter((h) => fold(`${h.name} ${h.email}`).includes(q)) : hosts;
    // Disponíveis primeiro, mantendo a ordem alfabética.
    return [...list].sort((a, b) => Number(b.status === 'available') - Number(a.status === 'available'));
  }, [hosts, query]);

  return (
    <div className="space-y-8">
      <PageHeader
        back={
          <Link href="/booking" className="inline-flex items-center gap-1.5 text-label font-medium text-slate-500 hover:text-brand-dark mb-3">
            <ArrowLeft className="w-4 h-4" /> {t('nav.booking')}
          </Link>
        }
        title={t('booking.picker.title')}
        accent={t('booking.picker.titleAccent')}
        subtitle={t('booking.picker.subtitle')}
        actions={
          <label className="relative w-full sm:w-72">
            <span className="sr-only">{t('booking.picker.search')}</span>
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('booking.picker.search')}
              className="w-full h-11 bg-white border border-slate-300 rounded-[10px] pl-10 pr-3 text-body text-brand-dark outline-none focus:border-brand-primary focus:ring-[3px] focus:ring-[color:var(--focus-ring)] transition-colors placeholder:text-slate-500"
            />
          </label>
        }
      />

      {shown.length === 0 ? (
        <div className={`${CARD} py-16 text-center text-body text-slate-500`}>{t(query ? 'booking.picker.noMatch' : 'booking.picker.empty')}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {shown.map((h) => {
            const available = h.status === 'available';
            const body = (
              <>
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-full bg-brand-soft text-brand-soft-fg flex items-center justify-center shrink-0 font-bold">
                    {h.name ? h.name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') : <UserRound className="w-5 h-5" />}
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-brand-dark truncate">{h.name}</p>
                    <p className="text-label text-slate-500 truncate">{h.email}</p>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between gap-3 text-label">
                  <span className={`min-w-0 truncate ${available ? 'text-slate-500' : 'text-slate-400'}`}>
                    {available ? h.typeNames.join(' · ') : t(`booking.picker.status.${h.status}`)}
                  </span>
                  {available && <ChevronRight className="w-4 h-4 shrink-0 text-brand-dark transition-transform duration-200 group-hover:translate-x-1" />}
                </div>
              </>
            );
            return available ? (
              <Link key={h.id} href={`/booking/book/${h.id}`} className={`group ${CARD} p-5 flex flex-col gap-4 min-h-[132px] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:border-slate-300`}>
                {body}
              </Link>
            ) : (
              <div key={h.id} aria-disabled="true" className={`${CARD} p-5 flex flex-col gap-4 min-h-[132px] opacity-70`}>
                {body}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
