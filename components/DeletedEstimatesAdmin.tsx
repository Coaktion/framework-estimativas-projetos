'use client';

/**
 * Admin › Estimativas excluídas: projetos, versões e estimativas da
 * Calculadora AE que os usuários excluíram (só na tela). O admin abre e
 * restaura cada um; nada aqui apaga de verdade.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { listDeletedEstimatesAction, restoreDeletedAction, type DeletedRow } from '@/app/admin/deleted_actions';
import { useLanguage } from '@/components/LanguageProvider';

export default function DeletedEstimatesAdmin({ active }: { active: boolean }) {
  const { t } = useTranslation();
  const { dateLocale } = useLanguage();
  const [rows, setRows] = useState<DeletedRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | DeletedRow['kind']>('all');

  const load = async () => {
    setError(null);
    const res = await listDeletedEstimatesAction();
    if (!res.ok) { setError((res as { error: string }).error); setRows([]); return; }
    setRows(res.rows);
  };

  useEffect(() => {
    if (active && rows === null) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const restore = async (row: DeletedRow) => {
    if (!confirm(t('deletedAdmin.restoreConfirm', { name: row.title }))) return;
    setBusy(`${row.kind}-${row.id}`);
    const res = await restoreDeletedAction(row.kind, row.id);
    setBusy(null);
    if (!res.ok) { alert((res as { error: string }).error); return; }
    setRows((prev) => (prev || []).filter((r) => !(r.kind === row.kind && r.id === row.id)));
  };

  const kindLabel = (kind: DeletedRow['kind']) =>
    kind === 'project' ? t('deletedAdmin.kindProject') : kind === 'version' ? t('deletedAdmin.kindVersion') : t('deletedAdmin.kindAe');
  const visible = (rows || []).filter((r) => filter === 'all' || r.kind === filter);

  return (
    <div className="bg-white dark:bg-[color:var(--bg-card)] rounded-3xl border border-slate-200 dark:border-[color:var(--border-main)] shadow-sm overflow-hidden">
      <div className="px-6 md:px-8 py-6 border-b border-slate-200 dark:border-[color:var(--border-main)] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0"><Trash2 className="w-5 h-5" /></div>
          <div>
            <h2 className="text-title font-bold text-brand-dark">{t('deletedAdmin.title')}</h2>
            <p className="text-label text-slate-500 mt-1 max-w-2xl">{t('deletedAdmin.subtitle')}</p>
          </div>
        </div>
        <div className="inline-flex items-center gap-0.5 p-[3px] h-10 rounded-full border border-slate-300 bg-white" role="group">
          {(['all', 'project', 'version', 'ae'] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={filter === k}
              onClick={() => setFilter(k)}
              className={`h-full px-3 rounded-full text-label font-medium transition-colors ${filter === k ? 'bg-brand-dark text-[color:var(--bg-main)]' : 'text-slate-500 hover:text-brand-dark'}`}
            >
              {k === 'all' ? t('deletedAdmin.all') : kindLabel(k)}
            </button>
          ))}
        </div>
      </div>
      {rows === null ? (
        <div className="p-10 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
      ) : error ? (
        <p className="p-6 text-label text-red-600">{error}</p>
      ) : visible.length === 0 ? (
        <p className="p-10 text-center text-label text-slate-500">{t('deletedAdmin.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[color:var(--border-main)] text-left text-label text-slate-500">
                <th className="px-6 py-3 font-medium">{t('deletedAdmin.colItem')}</th>
                <th className="px-4 py-3 font-medium">{t('deletedAdmin.colKind')}</th>
                <th className="px-4 py-3 font-medium">{t('deletedAdmin.colDeleted')}</th>
                <th className="px-6 py-3"><span className="sr-only">{t('common.actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={`${row.kind}-${row.id}`} className="border-b border-slate-100 dark:border-[color:var(--border-main)] last:border-b-0">
                  <td className="px-6 py-3.5">
                    <div className="font-medium text-brand-dark">{row.title}</div>
                    {row.subtitle && <div className="text-caption text-slate-500 truncate max-w-md">{row.subtitle}</div>}
                    {row.hours != null && <div className="text-caption text-slate-400 tabular-nums">{Math.round(row.hours * 100) / 100}h</div>}
                  </td>
                  <td className="px-4 py-3.5 text-label text-slate-600 whitespace-nowrap">{kindLabel(row.kind)}</td>
                  <td className="px-4 py-3.5 text-label text-slate-600 whitespace-nowrap">
                    {new Date(row.deletedAt).toLocaleString(dateLocale)}
                    <div className="text-caption text-slate-400">{row.deletedBy}</div>
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex justify-end gap-2">
                      <a href={row.href} target="_blank" rel="noreferrer" className="h-9 px-3 rounded-full border border-slate-300 text-label font-medium text-brand-dark inline-flex items-center gap-1.5 hover:border-slate-500">
                        <ExternalLink className="w-3.5 h-3.5" /> {t('deletedAdmin.open')}
                      </a>
                      <button
                        type="button"
                        onClick={() => void restore(row)}
                        disabled={busy === `${row.kind}-${row.id}`}
                        className="h-9 px-3 rounded-full brand-bg-primary text-label font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {busy === `${row.kind}-${row.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                        {t('deletedAdmin.restore')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
