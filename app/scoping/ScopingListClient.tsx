'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Trash2 } from 'lucide-react';
import { Banner, Button, CARD, PageHeader, TextInput } from '@/components/booking/ui';
import { tr, normalizeScopingLang } from '@/lib/scoping/i18n';
import type { I18nText } from '@/lib/scoping/types';
import { deleteSessionAction } from './actions';

export interface SessionRow {
  id: string;
  clientName: string;
  title: string;
  status: string;
  language: string;
  trackNames: I18nText[];
  essentialDone: number;
  essentialTotal: number;
  pending: number;
  createdByName: string | null;
  canDelete: boolean;
  updatedAt: string;
}

export default function ScopingListClient({ rows }: { rows: SessionRow[] }) {
  const { t, i18n } = useTranslation();
  const lang = normalizeScopingLang(i18n.language);
  const router = useRouter();
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? rows.filter((r) => `${r.clientName} ${r.title}`.toLowerCase().includes(term)) : rows;
  }, [rows, q]);

  const remove = (row: SessionRow) => {
    if (!window.confirm(t('scoping.list.confirmDelete', { name: row.clientName }))) return;
    startTransition(async () => {
      const res = await deleteSessionAction(row.id);
      if (!res.ok) setError(t(`scoping.errors.${res.error}`, { defaultValue: t('scoping.errors.server_error') }));
      else router.refresh();
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={t('scoping.list.titleA')}
        accent={t('scoping.list.titleB')}
        subtitle={t('scoping.list.subtitle')}
        actions={
          <Link href="/scoping/new" className="h-11 px-5 rounded-full font-medium inline-flex items-center gap-2 brand-bg-primary text-brand-ink btn-premium">
            <Plus className="w-4 h-4" /> {t('scoping.list.new')}
          </Link>
        }
      />
      {error && <Banner tone="error">{error}</Banner>}

      <div className={`${CARD} p-4 sm:p-6 space-y-4`}>
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('scoping.list.search')} className="pl-9" aria-label={t('scoping.list.search')} />
        </div>

        {filtered.length === 0 ? (
          <p className="text-body text-slate-500 py-8 text-center">{rows.length ? t('scoping.list.noMatch') : t('scoping.list.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-caption uppercase tracking-wide text-slate-500 border-b border-slate-200">
                  <th className="py-2 pr-4 font-semibold">{t('scoping.list.client')}</th>
                  <th className="py-2 pr-4 font-semibold">{t('scoping.list.tracks')}</th>
                  <th className="py-2 pr-4 font-semibold">{t('scoping.list.essentials')}</th>
                  <th className="py-2 pr-4 font-semibold">{t('scoping.list.pending')}</th>
                  <th className="py-2 pr-4 font-semibold">{t('scoping.list.status')}</th>
                  <th className="py-2 pr-4 font-semibold">{t('scoping.list.updated')}</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0 align-top">
                    <td className="py-3 pr-4">
                      <Link href={`/scoping/${r.id}`} className="text-body font-medium text-brand-dark hover:underline">{r.clientName}</Link>
                      <div className="text-caption text-slate-500">
                        {[r.title, r.createdByName, r.language.toUpperCase()].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-label text-slate-600">
                      {r.trackNames.length ? r.trackNames.map((n) => tr(n, lang)).join(', ') : t('scoping.list.coreOnly')}
                    </td>
                    <td className="py-3 pr-4 text-label tabular-nums">
                      {r.essentialDone}/{r.essentialTotal}
                      <div className="mt-1 h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full brand-bg-primary" style={{ width: `${r.essentialTotal ? (r.essentialDone / r.essentialTotal) * 100 : 0}%` }} />
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-label tabular-nums">{r.pending}</td>
                    <td className="py-3 pr-4">
                      <span className={`inline-block rounded-full border px-2 py-[3px] text-caption font-medium ${r.status === 'concluida' ? 'border-transparent brand-bg-primary text-brand-ink' : 'border-slate-300 text-slate-600'}`}>
                        {t(`scoping.sessionStatus.${r.status}`)}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-label text-slate-500 whitespace-nowrap">{new Date(r.updatedAt).toLocaleString(i18n.language)}</td>
                    <td className="py-3 text-right">
                      {r.canDelete && (
                        <Button variant="ghost" size="sm" onClick={() => remove(r)} disabled={busy} aria-label={t('scoping.list.delete')} title={t('scoping.list.delete')}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
