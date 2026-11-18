'use client';

/**
 * /reports: bugs e sugestões do time, no mesmo desenho da lista da
 * Calculadora AE. Cada linha abre o texto completo e os anexos; o status muda
 * na própria linha.
 */
import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bug, ChevronDown, Lightbulb, Paperclip, Search } from 'lucide-react';
import { updateFeedbackStatusAction } from './actions';
import { useLanguage } from '@/components/LanguageProvider';
import { FEEDBACK_STATUSES, TOOL_FEATURES, featureLabelKey, type FeedbackStatus } from '@/lib/tool-features';

type Report = {
  id: number;
  createdAt: string;
  feature: string;
  kind: string;
  body: string;
  status: string;
  statusAt: string | null;
  statusBy: string | null;
  pageUrl: string | null;
  submitter: string;
  attachments: Array<{ id: string; fileName: string; mimeType: string; size: number }>;
};

const SEGMENTED = 'inline-flex items-center gap-0.5 p-[3px] h-11 rounded-full border border-slate-300 bg-white';
const SEGMENT_BTN = 'h-full px-4 rounded-full inline-flex items-center gap-1.5 text-body font-medium transition-colors';
const SEGMENT_ON = 'bg-brand-dark text-[color:var(--bg-main)]';
const SEGMENT_OFF = 'text-slate-500 hover:text-brand-dark';
const TH = 'px-4 py-3 text-left text-label font-medium text-slate-500 whitespace-nowrap';
const STATUS_DOT: Record<string, string> = {
  new: 'bg-sky-500', ongoing: 'bg-amber-500', pending: 'bg-violet-500', rejected: 'bg-slate-400', solved: 'bg-emerald-500',
};

export default function ReportsClient({ reports: initial }: { reports: Report[] }) {
  const { t } = useTranslation();
  const { dateLocale } = useLanguage();
  const [reports, setReports] = useState(initial);
  const [status, setStatus] = useState<'open' | 'all' | FeedbackStatus>('open');
  const [kind, setKind] = useState<'all' | 'bug' | 'suggestion'>('all');
  const [feature, setFeature] = useState('');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reports.filter((r) =>
      (status === 'all' || (status === 'open' ? !['rejected', 'solved'].includes(r.status) : r.status === status))
      && (kind === 'all' || r.kind === kind)
      && (!feature || r.feature === feature)
      && (!q || r.body.toLowerCase().includes(q) || r.submitter.toLowerCase().includes(q) || String(r.id) === q.replace('#', '')));
  }, [reports, status, kind, feature, query]);

  const changeStatus = async (id: number, next: string) => {
    const previous = reports;
    // Resolvido: quem enviou é avisado no sininho; o texto opcional vai junto.
    let nota: string | null = null;
    if (next === 'solved' && reports.find((r) => r.id === id)?.status !== 'solved') {
      const resposta = window.prompt(t('reports.solvedNotePrompt'));
      if (resposta === null) return;
      nota = resposta.trim() || null;
    }
    setReports((list) => list.map((r) => (r.id === id ? { ...r, status: next } : r)));
    const res = await updateFeedbackStatusAction(id, next, nota).catch(() => null);
    if (!res || !res.ok) { setReports(previous); alert(t('reports.statusError')); }
  };

  return (
    <div className="max-w-7xl mx-auto py-10 space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h1 className="text-brand-dark font-heading text-page">{t('reports.title')}</h1>
          <p className="text-slate-500 text-[18px] font-light mt-2">{t('reports.subtitle')}</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
          <div className={SEGMENTED} role="group" aria-label={t('reports.kindFilter')}>
            {(['all', 'bug', 'suggestion'] as const).map((k) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`${SEGMENT_BTN} ${kind === k ? SEGMENT_ON : SEGMENT_OFF}`}>
                {k === 'bug' && <Bug className="w-3.5 h-3.5" />}
                {k === 'suggestion' && <Lightbulb className="w-3.5 h-3.5" />}
                {k === 'all' ? t('reports.allKinds') : k === 'bug' ? t('feedback.kindBug') : t('feedback.kindSuggestion')}
              </button>
            ))}
          </div>
          <label className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('reports.search')} className="w-full h-11 bg-white border border-slate-300 rounded-[10px] pl-10 pr-3 text-body text-brand-dark outline-none focus:border-brand-primary" />
          </label>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200">
          <span className="text-label text-slate-500">{t('reports.count', { count: visible.length })}</span>
          <div className="flex flex-wrap items-center gap-2">
            <select value={feature} onChange={(e) => setFeature(e.target.value)} className="h-9 bg-white border border-slate-300 rounded-lg px-2 text-label text-brand-dark">
              <option value="">{t('reports.allFeatures')}</option>
              {TOOL_FEATURES.map((f) => <option key={f.key} value={f.key}>{t(f.labelKey)}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="h-9 bg-white border border-slate-300 rounded-lg px-2 text-label text-brand-dark">
              <option value="open">{t('reports.openOnly')}</option>
              <option value="all">{t('reports.allStatuses')}</option>
              {FEEDBACK_STATUSES.map((s) => <option key={s} value={s}>{t(`reports.status_${s}`)}</option>)}
            </select>
          </div>
        </div>
        {visible.length === 0 ? (
          <p className="py-16 text-center text-body text-slate-500">{t('reports.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className={TH}>#</th>
                  <th className={TH}>{t('reports.colReport')}</th>
                  <th className={TH}>{t('reports.colFeature')}</th>
                  <th className={TH}>{t('reports.colSubmitter')}</th>
                  <th className={TH}>{t('reports.colDate')}</th>
                  <th className={TH}>{t('reports.colStatus')}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const open = expanded === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr className="border-b border-slate-200 hover:bg-[color:var(--accent-tint)] transition-colors align-top">
                        <td className="px-4 py-3.5 text-label text-slate-500 tabular-nums">{r.id}</td>
                        <td className="px-4 py-3.5 min-w-[280px] max-w-[520px]">
                          <button type="button" onClick={() => setExpanded(open ? null : r.id)} aria-expanded={open} className="w-full text-left">
                            <span className="flex items-center gap-2 mb-0.5">
                              {r.kind === 'bug'
                                ? <span className="inline-flex items-center gap-1 text-caption font-medium text-red-700"><Bug className="w-3.5 h-3.5" />{t('feedback.kindBug')}</span>
                                : <span className="inline-flex items-center gap-1 text-caption font-medium text-amber-700"><Lightbulb className="w-3.5 h-3.5" />{t('feedback.kindSuggestion')}</span>}
                              {r.attachments.length > 0 && <span className="inline-flex items-center gap-0.5 text-caption text-slate-400"><Paperclip className="w-3 h-3" />{r.attachments.length}</span>}
                              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                            </span>
                            <span className={`block text-body text-brand-dark ${open ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>{r.body}</span>
                          </button>
                        </td>
                        <td className="px-4 py-3.5 text-label text-slate-600 whitespace-nowrap">{t(featureLabelKey(r.feature))}</td>
                        <td className="px-4 py-3.5 text-label text-slate-600 whitespace-nowrap">{r.submitter}</td>
                        <td suppressHydrationWarning className="px-4 py-3.5 text-label text-slate-600 whitespace-nowrap">{new Date(r.createdAt).toLocaleString(dateLocale)}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${STATUS_DOT[r.status] || 'bg-slate-300'}`} />
                            <select value={r.status} onChange={(e) => void changeStatus(r.id, e.target.value)} className="h-8 bg-white border border-slate-300 rounded-lg px-2 text-label text-brand-dark">
                              {FEEDBACK_STATUSES.map((s) => <option key={s} value={s}>{t(`reports.status_${s}`)}</option>)}
                            </select>
                          </span>
                          {r.statusBy && <span className="block text-caption text-slate-400 mt-1">{r.statusBy}</span>}
                        </td>
                      </tr>
                      {open && (r.attachments.length > 0 || r.pageUrl) && (
                        <tr className="border-b border-slate-200 bg-slate-50/60">
                          <td />
                          <td colSpan={5} className="px-4 py-3 space-y-3">
                            {r.pageUrl && <p className="text-caption text-slate-500 break-all">{t('reports.sentFrom')}: {r.pageUrl}</p>}
                            {r.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-3">
                                {r.attachments.map((a) => (
                                  <a key={a.id} href={`/api/feedback/attachments/${a.id}`} target="_blank" rel="noreferrer" className="block rounded-xl border border-slate-200 bg-white p-2 hover:border-brand-primary">
                                    {/^image\/(png|jpe?g|gif|webp)$/i.test(a.mimeType) ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={`/api/feedback/attachments/${a.id}`} alt={a.fileName} className="h-28 w-auto max-w-[220px] object-contain rounded-lg" />
                                    ) : (
                                      <span className="flex items-center gap-1.5 text-caption text-brand-dark"><Paperclip className="w-3.5 h-3.5" />{a.fileName}</span>
                                    )}
                                    <span className="block text-caption text-slate-400 mt-1 truncate max-w-[220px]">{a.fileName} · {Math.max(1, Math.round(a.size / 1024))} KB</span>
                                  </a>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
