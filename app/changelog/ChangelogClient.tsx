'use client';

/**
 * /changelog. Feed das publicações (todos), rascunhos e editor (SE e admin) e
 * o registro das alterações feitas no Admin, com "publicado" para marcar o que
 * já foi comunicado (vai para o arquivo; dá para desmarcar).
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Archive, Bug, Code2, FileText, Loader2, Pencil, Plus, Send, Sparkles, Trash2, TrendingUp, Undo2, X } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';
import { saveChangelogEntryAction, setAdminChangesPublishedAction, setChangelogStatusAction } from './actions';
import { CHANGELOG_KINDS, pickText, type ChangelogEntryData, type ChangelogItem, type ChangelogKind } from '@/lib/changelog';
import { TOOL_FEATURES, featureLabelKey } from '@/lib/tool-features';

type Entry = ChangelogEntryData & {
  id: number;
  status: string;
  source: string;
  createdAt: string;
  publishedAt: string | null;
  publishedBy: string | null;
};
type AdminChangeRow = {
  id: string;
  createdAt: string;
  user: string;
  area: string;
  action: string;
  summary: string;
  publishedAt: string | null;
  publishedBy: string | null;
};
type Tab = 'feed' | 'drafts' | 'admin';

const KIND_ICON: Record<ChangelogKind, any> = { new: Sparkles, improved: TrendingUp, fixed: Bug };
const KIND_TONE: Record<ChangelogKind, string> = {
  new: 'text-emerald-700 dark:text-emerald-300',
  improved: 'text-sky-700 dark:text-sky-300',
  fixed: 'text-amber-700 dark:text-amber-300',
};
const LANGS = ['pt', 'en', 'es'] as const;
const INPUT = 'w-full bg-white dark:bg-[color:var(--bg-input-solid)] border border-slate-300 dark:border-[color:var(--border-main)] rounded-lg px-3 py-2 text-label text-brand-dark outline-none focus:border-brand-primary';

const emptyEntry = (): ChangelogEntryData => ({
  release: '',
  title: { pt: '', en: '', es: '' },
  summary: { pt: '', en: '', es: '' },
  items: [{ kind: 'new', feature: 'website', text: { pt: '', en: '', es: '' } }],
});

export default function ChangelogClient({ canEdit, entries, adminChanges }: { canEdit: boolean; entries: Entry[]; adminChanges: AdminChangeRow[] }) {
  const { t } = useTranslation();
  const { language, dateLocale } = useLanguage();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('feed');
  const [editing, setEditing] = useState<{ id: number | null; data: ChangelogEntryData } | null>(null);
  const [editLang, setEditLang] = useState<(typeof LANGS)[number]>('pt');
  const [busy, setBusy] = useState(false);
  const [archived, setArchived] = useState(false);
  const [changes, setChanges] = useState(adminChanges);

  const published = entries.filter((e) => e.status === 'published');
  const drafts = entries.filter((e) => e.status === 'draft');
  const visibleChanges = useMemo(() => changes.filter((c) => (archived ? c.publishedAt : !c.publishedAt)), [changes, archived]);
  const pendingCount = changes.filter((c) => !c.publishedAt).length;

  const save = async (publish: boolean) => {
    if (!editing) return;
    setBusy(true);
    const res = await saveChangelogEntryAction(editing.id, editing.data, publish);
    setBusy(false);
    if (!res.ok) { alert(res.error === 'title_required' ? t('changelog.titleRequired') : res.error); return; }
    setEditing(null);
    router.refresh();
  };
  const setStatus = async (id: number, status: 'draft' | 'discarded' | 'published') => {
    if (status === 'discarded' && !confirm(t('changelog.discardConfirm'))) return;
    if (status === 'published' && !confirm(t('changelog.publishConfirm'))) return;
    const res = await setChangelogStatusAction(id, status);
    if (!res.ok) { alert(res.error); return; }
    router.refresh();
  };
  const togglePublished = async (ids: string[], value: boolean) => {
    const previous = changes;
    const now = new Date().toISOString();
    setChanges((list) => list.map((c) => (ids.includes(c.id) ? { ...c, publishedAt: value ? now : null } : c)));
    const res = await setAdminChangesPublishedAction(ids, value);
    if (!res.ok) { setChanges(previous); alert(res.error); }
  };

  const updateItem = (index: number, patch: Partial<ChangelogItem>) =>
    setEditing((e) => (e ? { ...e, data: { ...e.data, items: e.data.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) } } : e));

  const renderEntry = (entry: Entry, mode: 'feed' | 'draft') => {
    const grouped = CHANGELOG_KINDS.map((kind) => ({ kind, items: entry.items.filter((i) => i.kind === kind) })).filter((g) => g.items.length);
    const date = entry.publishedAt || entry.createdAt;
    return (
      <article key={entry.id} className="bg-white dark:bg-[color:var(--bg-card)] border border-slate-200 dark:border-[color:var(--border-main)] rounded-3xl p-6 md:p-8 space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-caption text-slate-500">
              {entry.release && <span className="px-2.5 py-1 rounded-full bg-brand-soft text-brand-dark font-medium">{entry.release}</span>}
              <span suppressHydrationWarning>{new Date(date).toLocaleDateString(dateLocale, { day: '2-digit', month: 'long', year: 'numeric' })}</span>
              {mode === 'draft' && entry.source === 'code' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"><Code2 className="w-3 h-3" />{t('changelog.fromCode')}</span>
              )}
            </div>
            <h2 className="text-title font-bold text-brand-dark">{pickText(entry.title, language) || t('changelog.untitled')}</h2>
            {pickText(entry.summary, language) && <p className="text-body text-slate-600 whitespace-pre-line max-w-3xl">{pickText(entry.summary, language)}</p>}
          </div>
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => { setEditLang('pt'); setEditing({ id: entry.id, data: { release: entry.release, title: entry.title, summary: entry.summary, items: entry.items } }); }} className="h-9 px-3 rounded-full border border-slate-300 text-label font-medium inline-flex items-center gap-1.5"><Pencil className="w-3.5 h-3.5" />{t('changelog.edit')}</button>
              {mode === 'draft' ? (
                <>
                  <button type="button" onClick={() => void setStatus(entry.id, 'published')} className="h-9 px-3 rounded-full brand-bg-primary text-label font-medium inline-flex items-center gap-1.5"><Send className="w-3.5 h-3.5" />{t('changelog.publish')}</button>
                  <button type="button" onClick={() => void setStatus(entry.id, 'discarded')} title={t('changelog.discard')} className="h-9 px-3 rounded-full text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </>
              ) : (
                <button type="button" onClick={() => void setStatus(entry.id, 'draft')} title={t('changelog.unpublish')} className="h-9 px-3 rounded-full text-slate-400 hover:text-brand-dark inline-flex items-center gap-1 text-label"><Undo2 className="w-3.5 h-3.5" />{t('changelog.unpublish')}</button>
              )}
            </div>
          )}
        </header>
        {grouped.map(({ kind, items }) => {
          const Icon = KIND_ICON[kind];
          return (
            <section key={kind} className="space-y-2">
              <h3 className={`text-label font-bold inline-flex items-center gap-1.5 ${KIND_TONE[kind]}`}><Icon className="w-4 h-4" />{t(`changelog.kind_${kind}`)}</h3>
              <ul className="space-y-2">
                {items.map((item, i) => (
                  <li key={i} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                    <span className="shrink-0 text-caption font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 w-fit">{t(featureLabelKey(item.feature))}</span>
                    <span className="text-body text-brand-dark whitespace-pre-line">{pickText(item.text, language)}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </article>
    );
  };

  return (
    <div className="max-w-5xl mx-auto py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-brand-dark font-heading text-page">{t('changelog.title')}</h1>
          <p className="text-slate-500 text-[18px] font-light mt-2">{t('changelog.subtitle')}</p>
        </div>
        {canEdit && (
          <button type="button" onClick={() => { setEditLang('pt'); setEditing({ id: null, data: emptyEntry() }); }} className="h-11 px-5 rounded-full brand-bg-primary text-body font-medium inline-flex items-center gap-2 self-start md:self-auto">
            <Plus className="w-5 h-5" />{t('changelog.new')}
          </button>
        )}
      </div>

      {canEdit && (
        <div className="inline-flex items-center gap-0.5 p-[3px] h-11 rounded-full border border-slate-300 bg-white" role="tablist">
          {([
            ['feed', t('changelog.tabFeed'), FileText, published.length],
            ['drafts', t('changelog.tabDrafts'), Pencil, drafts.length],
            ['admin', t('changelog.tabAdmin'), Archive, pendingCount],
          ] as Array<[Tab, string, any, number]>).map(([id, label, Icon, count]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`h-full px-4 rounded-full inline-flex items-center gap-1.5 text-body font-medium transition-colors ${tab === id ? 'bg-brand-dark text-[color:var(--bg-main)]' : 'text-slate-500 hover:text-brand-dark'}`}>
              <Icon className="w-3.5 h-3.5" />{label}{count > 0 && <span className="tabular-nums opacity-80">({count})</span>}
            </button>
          ))}
        </div>
      )}

      {tab === 'feed' && (
        <div className="space-y-6">
          {published.length === 0 ? <p className="py-16 text-center text-slate-500">{t('changelog.emptyFeed')}</p> : published.map((e) => renderEntry(e, 'feed'))}
        </div>
      )}

      {tab === 'drafts' && canEdit && (
        <div className="space-y-6">
          <p className="text-label text-slate-500">{t('changelog.draftsHint')}</p>
          {drafts.length === 0 ? <p className="py-16 text-center text-slate-500">{t('changelog.emptyDrafts')}</p> : drafts.map((e) => renderEntry(e, 'draft'))}
        </div>
      )}

      {tab === 'admin' && canEdit && (
        <div className="bg-white dark:bg-[color:var(--bg-card)] border border-slate-200 dark:border-[color:var(--border-main)] rounded-2xl overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200">
            <p className="text-label text-slate-500 max-w-2xl">{archived ? t('changelog.archiveHint') : t('changelog.adminHint')}</p>
            <div className="flex items-center gap-2">
              {!archived && visibleChanges.length > 0 && (
                <button type="button" onClick={() => void togglePublished(visibleChanges.map((c) => c.id), true)} className="h-9 px-3 rounded-full border border-slate-300 text-label font-medium">{t('changelog.markAll')}</button>
              )}
              <button type="button" onClick={() => setArchived((v) => !v)} className="h-9 px-3 rounded-full border border-slate-300 text-label font-medium inline-flex items-center gap-1.5">
                <Archive className="w-3.5 h-3.5" />{archived ? t('changelog.showPending') : t('changelog.showArchive')}
              </button>
            </div>
          </div>
          {visibleChanges.length === 0 ? (
            <p className="py-14 text-center text-slate-500">{archived ? t('changelog.emptyArchive') : t('changelog.emptyPending')}</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-300 text-left text-label text-slate-500">
                  <th className="px-4 py-3 font-medium w-28">{t('changelog.colPublished')}</th>
                  <th className="px-4 py-3 font-medium">{t('changelog.colChange')}</th>
                  <th className="px-4 py-3 font-medium">{t('changelog.colArea')}</th>
                  <th className="px-4 py-3 font-medium">{t('changelog.colWhen')}</th>
                </tr>
              </thead>
              <tbody>
                {visibleChanges.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 last:border-b-0 align-top">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={Boolean(c.publishedAt)} onChange={(e) => void togglePublished([c.id], e.target.checked)} aria-label={t('changelog.colPublished')} className="w-4 h-4 accent-[color:var(--primary)]" />
                    </td>
                    <td className="px-4 py-3 text-body text-brand-dark">{c.summary}</td>
                    <td className="px-4 py-3 text-label text-slate-600 whitespace-nowrap">{t(`changelog.area_${c.area}`, { defaultValue: c.area })}</td>
                    <td suppressHydrationWarning className="px-4 py-3 text-label text-slate-600 whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleString(dateLocale)}
                      <span className="block text-caption text-slate-400">{c.user}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-[rgb(3_14_1/0.8)] backdrop-blur-md flex items-center justify-center z-[70] p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-3xl bg-white dark:bg-[color:var(--bg-card-solid)] rounded-3xl shadow-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200">
              <h2 className="font-heading text-[26px] leading-none text-brand-dark">{editing.id ? t('changelog.editTitle') : t('changelog.new')}</h2>
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-full border border-slate-300 p-0.5">
                  {LANGS.map((l) => (
                    <button key={l} type="button" onClick={() => setEditLang(l)} className={`h-8 px-3 rounded-full text-label font-medium ${editLang === l ? 'bg-brand-dark text-[color:var(--bg-main)]' : 'text-slate-500'}`}>{l.toUpperCase()}</button>
                  ))}
                </div>
                <button type="button" onClick={() => setEditing(null)} aria-label={t('common.close')} className="p-1.5 text-slate-400 hover:text-brand-dark"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <p className="text-caption text-slate-500">{t('changelog.langHint')}</p>
              <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)] gap-3">
                <label className="space-y-1"><span className="text-caption font-medium text-slate-500">{t('changelog.release')}</span>
                  <input className={INPUT} value={editing.data.release} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, release: e.target.value } })} placeholder="V3 · 2026-11" />
                </label>
                <label className="space-y-1"><span className="text-caption font-medium text-slate-500">{t('changelog.entryTitle')} ({editLang.toUpperCase()})</span>
                  <input className={INPUT} value={editing.data.title[editLang]} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, title: { ...editing.data.title, [editLang]: e.target.value } } })} />
                </label>
              </div>
              <label className="block space-y-1"><span className="text-caption font-medium text-slate-500">{t('changelog.summary')} ({editLang.toUpperCase()})</span>
                <textarea rows={3} className={INPUT} value={editing.data.summary[editLang]} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, summary: { ...editing.data.summary, [editLang]: e.target.value } } })} />
              </label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-body font-bold text-brand-dark">{t('changelog.items')}</span>
                  <button type="button" onClick={() => setEditing({ ...editing, data: { ...editing.data, items: [...editing.data.items, { kind: 'improved', feature: 'website', text: { pt: '', en: '', es: '' } }] } })} className="h-9 px-3 rounded-full border border-brand-primary text-label font-medium inline-flex items-center gap-1.5"><Plus className="w-4 h-4" />{t('changelog.addItem')}</button>
                </div>
                {editing.data.items.map((item, i) => (
                  <div key={i} className="rounded-2xl border border-slate-200 p-3 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <select value={item.kind} onChange={(e) => updateItem(i, { kind: e.target.value as ChangelogKind })} className={`${INPUT} w-40`}>
                        {CHANGELOG_KINDS.map((k) => <option key={k} value={k}>{t(`changelog.kind_${k}`)}</option>)}
                      </select>
                      <select value={item.feature} onChange={(e) => updateItem(i, { feature: e.target.value })} className={`${INPUT} w-56`}>
                        {TOOL_FEATURES.map((f) => <option key={f.key} value={f.key}>{t(f.labelKey)}</option>)}
                      </select>
                      <button type="button" onClick={() => setEditing({ ...editing, data: { ...editing.data, items: editing.data.items.filter((_, j) => j !== i) } })} className="ml-auto p-2 text-slate-400 hover:text-red-600" aria-label={t('changelog.removeItem')}><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <textarea rows={2} className={INPUT} value={item.text[editLang]} placeholder={t('changelog.itemPlaceholder')} onChange={(e) => updateItem(i, { text: { ...item.text, [editLang]: e.target.value } })} />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200">
              <button type="button" onClick={() => void save(false)} disabled={busy} className="h-10 px-4 rounded-full border border-slate-300 text-label font-medium disabled:opacity-50">{t('changelog.saveDraft')}</button>
              <button type="button" onClick={() => void save(true)} disabled={busy} className="h-10 px-5 rounded-full brand-bg-primary text-label font-medium inline-flex items-center gap-2 disabled:opacity-50">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}{t('changelog.publish')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
