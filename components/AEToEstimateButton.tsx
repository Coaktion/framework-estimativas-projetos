'use client';

/**
 * Botão "Criar estimativa" da estimativa da Calculadora AE (só SE e admin):
 * leva as quantidades da Calculadora para uma estimativa do Framework, num
 * projeto novo ou como versão nova de um projeto existente.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, ExternalLink, FolderPlus, Loader2, Search, X } from 'lucide-react';
import { createEstimateFromAEAction, listProjectsForAEAction } from '@/app/ae/actions';

type Project = { id: number; name: string; owner: string; versions: number };
type Result = Extract<Awaited<ReturnType<typeof createEstimateFromAEAction>>, { ok: true }>;

export default function AEToEstimateButton({ estimateId, clientName }: { estimateId: number; clientName: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [name, setName] = useState(clientName);
  const [query, setQuery] = useState(clientName);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (!open || mode !== 'existing') return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const rows = await listProjectsForAEAction(query).catch(() => []);
      if (!cancelled) setProjects(rows);
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, mode, query]);

  const close = () => {
    setOpen(false);
    setError(null);
    setResult(null);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await createEstimateFromAEAction(
      estimateId,
      mode === 'new' ? { mode: 'new', name: name.trim() || clientName } : { mode: 'existing', projectId: Number(projectId) },
    );
    setBusy(false);
    if (!res.ok) { setError((res as { error: string }).error); return; }
    setResult(res);
  };

  const canSubmit = mode === 'new' ? Boolean(name.trim()) : projectId != null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t('aeToEstimate.buttonHint')}
        className="px-6 py-3 rounded-2xl text-label font-medium flex items-center gap-2 transition-all border-2 border-brand-dark text-brand-dark hover:bg-brand-dark hover:text-[color:var(--bg-main)]"
      >
        <FolderPlus className="w-4 h-4" />
        <span>{t('aeToEstimate.button')}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-[rgb(3_14_1/0.8)] backdrop-blur-md flex items-center justify-center z-[70] p-4"
          onClick={(e) => { if (e.target === e.currentTarget && !busy) close(); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="ae-to-estimate-title"
        >
          <div className="w-full max-w-lg bg-white dark:bg-[color:var(--bg-card-solid)] border border-slate-200 dark:border-[color:var(--border-main)] rounded-3xl shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="ae-to-estimate-title" className="font-heading text-[26px] leading-none text-brand-dark">{t('aeToEstimate.title')}</h2>
                <p className="text-label text-slate-500 mt-2">{t('aeToEstimate.subtitle')}</p>
              </div>
              <button type="button" onClick={close} disabled={busy} aria-label={t('common.close')} className="p-1.5 rounded-lg text-slate-400 hover:text-brand-dark">
                <X className="w-5 h-5" />
              </button>
            </div>

            {result ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/30 p-4">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-label text-emerald-800 dark:text-emerald-200">
                    {t('aeToEstimate.created', { count: result.itemCount, hours: Math.round(Number(result.totalHours) || 0) })}
                  </p>
                </div>
                {result.unmapped.length > 0 && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 p-4 space-y-2">
                    <p className="text-label font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> {t('aeToEstimate.unmappedTitle', { count: result.unmapped.length })}
                    </p>
                    <ul className="text-caption text-amber-800 dark:text-amber-200 list-disc pl-5 space-y-0.5">
                      {result.unmapped.map((u, i) => <li key={i}><code>{u.source}</code> × {u.quantity}</li>)}
                    </ul>
                    <p className="text-caption text-amber-700 dark:text-amber-300">{t('aeToEstimate.unmappedHint')}</p>
                  </div>
                )}
                {result.warnings.length > 0 && (
                  <ul className="text-caption text-slate-500 list-disc pl-5 space-y-0.5">
                    {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                )}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={close} className="h-10 px-4 rounded-full border border-slate-300 text-label font-medium text-slate-600">{t('common.close')}</button>
                  <a href={result.url} className="h-10 px-5 rounded-full brand-bg-primary text-label font-medium inline-flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" /> {t('aeToEstimate.open')}
                  </a>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2" role="radiogroup">
                  {(['new', 'existing'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={mode === m}
                      onClick={() => setMode(m)}
                      className={`rounded-2xl border-2 px-4 py-3 text-left text-label font-medium transition-colors ${mode === m ? 'border-brand-primary bg-brand-soft text-brand-dark' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}
                    >
                      {m === 'new' ? t('aeToEstimate.modeNew') : t('aeToEstimate.modeExisting')}
                    </button>
                  ))}
                </div>

                {mode === 'new' ? (
                  <label className="block space-y-1.5">
                    <span className="text-caption font-medium text-slate-500">{t('aeToEstimate.projectName')}</span>
                    <input
                      value={name}
                      maxLength={120}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full h-11 bg-white dark:bg-[color:var(--bg-input)] border border-slate-300 dark:border-[color:var(--border-main)] rounded-xl px-4 text-body text-brand-dark outline-none focus:border-brand-primary"
                    />
                  </label>
                ) : (
                  <div className="space-y-2">
                    <span className="relative block">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t('aeToEstimate.searchProjects')}
                        className="w-full h-11 bg-white dark:bg-[color:var(--bg-input)] border border-slate-300 dark:border-[color:var(--border-main)] rounded-xl pl-9 pr-3 text-body text-brand-dark outline-none focus:border-brand-primary"
                      />
                    </span>
                    <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-[color:var(--border-main)] divide-y divide-slate-100 dark:divide-[color:var(--border-main)]">
                      {projects === null && <p className="p-3 text-caption text-slate-400"><Loader2 className="w-4 h-4 animate-spin inline" /></p>}
                      {projects?.length === 0 && <p className="p-3 text-caption text-slate-500">{t('aeToEstimate.noProjects')}</p>}
                      {projects?.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setProjectId(p.id)}
                          className={`w-full text-left px-3 py-2.5 transition-colors ${projectId === p.id ? 'bg-brand-soft' : 'hover:bg-slate-50 dark:hover:bg-[color:var(--bg-input)]'}`}
                        >
                          <span className="block text-label font-medium text-brand-dark">{p.name}</span>
                          <span className="block text-caption text-slate-500">{t('aeToEstimate.projectMeta', { owner: p.owner || '—', count: p.versions })}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-caption text-slate-500">{t('aeToEstimate.roundingNote')}</p>
                {error && <p role="alert" className="text-label text-red-600">{error}</p>}

                <div className="flex justify-end gap-2">
                  <button type="button" onClick={close} disabled={busy} className="h-10 px-4 rounded-full border border-slate-300 text-label font-medium text-slate-600">{t('common.cancel')}</button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={!canSubmit || busy}
                    className="h-10 px-5 rounded-full brand-bg-primary text-label font-medium inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
                    {t('aeToEstimate.create')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
