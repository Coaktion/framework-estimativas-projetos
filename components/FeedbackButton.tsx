'use client';

/**
 * "Sugestões / Bugs": abre uma janelinha no canto da tela, sem sair da página
 * (como o rascunho de e-mail do Gmail), que pode ser minimizada ou expandida.
 * Campos: ferramenta, tipo (bug ou sugestão) e texto, todos obrigatórios;
 * anexos (imagens e arquivos de texto) opcionais — dá para colar print direto
 * no texto ou arrastar arquivos. SE e admin acompanham tudo em /reports.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Loader2, Maximize2, MessageSquarePlus, Minimize2, Minus, Paperclip, X } from 'lucide-react';
import { createFeedbackAction } from '@/app/reports/actions';
import { canUseSeTools } from '@/lib/segments';
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MAX_COUNT, TOOL_FEATURES, isAllowedAttachment } from '@/lib/tool-features';

type Mode = 'closed' | 'open' | 'minimized' | 'maximized';

/** Ferramenta provável a partir da página aberta. */
function featureFromPath(path: string): string {
  if (path.startsWith('/sc')) return 'estimates';
  if (path.startsWith('/ae')) return 'aeCalculator';
  if (path.startsWith('/booking')) return 'booking';
  if (path.startsWith('/folders')) return 'folders';
  if (path.startsWith('/pre-sales-ops')) return 'radar';
  if (path.startsWith('/estudos')) return 'estudos';
  if (path.startsWith('/zd-auto-config')) return 'zdAutoConfig';
  if (path.startsWith('/admin')) return 'admin';
  if (path.startsWith('/changelog')) return 'changelog';
  return '';
}

export default function FeedbackButton() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mode, setMode] = useState<Mode>('closed');
  const [feature, setFeature] = useState('');
  const [kind, setKind] = useState<'bug' | 'suggestion' | ''>('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentId, setSentId] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // A janela vai direto no <body>: o cabeçalho tem backdrop-blur, que prende
  // elementos 'fixed' dentro dele (a janela ficava cortada no topo da tela).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (mode !== 'closed' && !feature) setFeature(featureFromPath(pathname || ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const addFiles = (list: FileList | File[]) => {
    setError(null);
    const incoming = Array.from(list);
    const next = [...files];
    for (const file of incoming) {
      if (!isAllowedAttachment(file.type)) { setError(t('feedback.errorType', { name: file.name })); continue; }
      if (file.size > ATTACHMENT_MAX_BYTES) { setError(t('feedback.errorSize', { name: file.name })); continue; }
      if (next.length >= ATTACHMENT_MAX_COUNT) { setError(t('feedback.errorCount', { count: ATTACHMENT_MAX_COUNT })); break; }
      next.push(file);
    }
    setFiles(next);
  };

  const reset = () => {
    setKind('');
    setBody('');
    setFiles([]);
    setError(null);
  };

  const submit = async () => {
    if (!feature || !kind || !body.trim()) { setError(t('feedback.errorRequired')); return; }
    setBusy(true);
    setError(null);
    const res = await createFeedbackAction({ feature, kind, body, pageUrl: typeof window !== 'undefined' ? window.location.href : null }).catch(() => null);
    if (!res || !res.ok) { setBusy(false); setError(t('feedback.errorSend')); return; }
    const failed: string[] = [];
    for (const file of files) {
      const form = new FormData();
      form.append('reportId', String(res.id));
      form.append('file', file);
      const up = await fetch('/api/feedback/attachments', { method: 'POST', body: form }).catch(() => null);
      if (!up || !up.ok) failed.push(file.name);
    }
    setBusy(false);
    reset();
    setSentId(res.id);
    if (failed.length) setError(t('feedback.errorAttachments', { names: failed.join(', ') }));
  };

  const close = () => {
    if ((body.trim() || files.length) && !confirm(t('feedback.discardConfirm'))) return;
    reset();
    setSentId(null);
    setMode('closed');
  };

  const windowClass = mode === 'maximized'
    ? 'fixed inset-4 md:inset-10 z-[90]'
    : 'fixed bottom-0 right-4 md:right-8 z-[90] w-[min(440px,calc(100vw-2rem))]';

  return (
    <>
      <button
        type="button"
        onClick={() => setMode(mode === 'closed' ? 'open' : mode === 'minimized' ? 'open' : mode)}
        title={t('nav.feedbackTitle')}
        aria-label={t('nav.feedbackTitle')}
        className="inline-flex items-center gap-2 h-9 px-3 rounded-full border border-slate-300 bg-white text-brand-dark hover:border-slate-500 transition-colors"
      >
        <MessageSquarePlus className="w-4 h-4" />
        <span className="hidden xl:inline text-label font-medium leading-none">{t('nav.feedback')}</span>
      </button>

      {mode !== 'closed' && mounted && createPortal(
        <div
          role="dialog"
          aria-label={t('feedback.title')}
          className={`${windowClass} flex flex-col bg-white dark:bg-[color:var(--bg-card-solid)] border border-slate-300 dark:border-[color:var(--border-main)] shadow-2xl ${mode === 'maximized' ? 'rounded-2xl' : 'rounded-t-2xl'}`}
        >
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-brand-dark text-[color:var(--bg-main)] rounded-t-2xl cursor-default select-none">
            <button type="button" onClick={() => setMode(mode === 'minimized' ? 'open' : 'minimized')} className="text-label font-medium truncate text-left flex-1">
              {t('feedback.title')}
            </button>
            <div className="flex items-center gap-1 shrink-0">
              <button type="button" onClick={() => setMode(mode === 'minimized' ? 'open' : 'minimized')} title={t('feedback.minimize')} aria-label={t('feedback.minimize')} className="p-1 rounded hover:bg-white/15"><Minus className="w-4 h-4" /></button>
              <button type="button" onClick={() => setMode(mode === 'maximized' ? 'open' : 'maximized')} title={mode === 'maximized' ? t('feedback.restore') : t('feedback.maximize')} aria-label={mode === 'maximized' ? t('feedback.restore') : t('feedback.maximize')} className="p-1 rounded hover:bg-white/15">
                {mode === 'maximized' ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button type="button" onClick={close} title={t('common.close')} aria-label={t('common.close')} className="p-1 rounded hover:bg-white/15"><X className="w-4 h-4" /></button>
            </div>
          </div>

          {mode !== 'minimized' && (
            <div
              className={`flex flex-col gap-3 p-4 overflow-y-auto ${mode === 'maximized' ? 'flex-1' : 'max-h-[70vh]'}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); }}
            >
              {sentId ? (
                <div className="space-y-3">
                  <p className="flex items-start gap-2 text-label text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-5 h-5 shrink-0" /> {t('feedback.sent', { id: sentId })}
                  </p>
                  {error && <p role="alert" className="text-caption text-amber-700">{error}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setSentId(null)} className="h-9 px-4 rounded-full border border-slate-300 text-label font-medium">{t('feedback.another')}</button>
                    <button type="button" onClick={() => { setSentId(null); setMode('closed'); }} className="h-9 px-4 rounded-full brand-bg-primary text-label font-medium">{t('common.close')}</button>
                  </div>
                </div>
              ) : (
                <>
                  <label className="space-y-1">
                    <span className="text-caption font-medium text-slate-500">{t('feedback.feature')} *</span>
                    <select value={feature} onChange={(e) => setFeature(e.target.value)} className="w-full h-10 bg-white dark:bg-[color:var(--bg-input-solid)] border border-slate-300 dark:border-[color:var(--border-main)] rounded-lg px-3 text-label text-brand-dark outline-none focus:border-brand-primary">
                      <option value="">{t('feedback.pickFeature')}</option>
                      {TOOL_FEATURES.map((f) => <option key={f.key} value={f.key}>{t(f.labelKey)}</option>)}
                    </select>
                  </label>
                  <div className="space-y-1">
                    <span className="text-caption font-medium text-slate-500">{t('feedback.kind')} *</span>
                    <div className="grid grid-cols-2 gap-2" role="radiogroup">
                      {(['bug', 'suggestion'] as const).map((k) => (
                        <button
                          key={k}
                          type="button"
                          role="radio"
                          aria-checked={kind === k}
                          onClick={() => setKind(k)}
                          className={`h-9 rounded-lg border-2 text-label font-medium transition-colors ${kind === k ? 'border-brand-primary bg-brand-soft text-brand-dark' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}
                        >
                          {k === 'bug' ? t('feedback.kindBug') : t('feedback.kindSuggestion')}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className={`space-y-1 ${mode === 'maximized' ? 'flex-1 flex flex-col' : ''}`}>
                    <span className="text-caption font-medium text-slate-500">{t('feedback.body')} *</span>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      onPaste={(e) => {
                        const pasted = Array.from(e.clipboardData?.files || []);
                        if (pasted.length) { e.preventDefault(); addFiles(pasted); }
                      }}
                      rows={mode === 'maximized' ? 14 : 6}
                      placeholder={t('feedback.bodyPlaceholder')}
                      className={`w-full bg-white dark:bg-[color:var(--bg-input-solid)] border border-slate-300 dark:border-[color:var(--border-main)] rounded-lg px-3 py-2 text-label text-brand-dark outline-none focus:border-brand-primary resize-y ${mode === 'maximized' ? 'flex-1' : ''}`}
                    />
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-1.5 text-caption font-medium text-brand-dark hover:underline">
                        <Paperclip className="w-3.5 h-3.5" /> {t('feedback.attach')}
                      </button>
                      <span className="text-caption text-slate-400">{t('feedback.attachHint', { count: ATTACHMENT_MAX_COUNT })}</span>
                      <input
                        ref={fileInput}
                        type="file"
                        multiple
                        accept="image/*,text/*,.txt,.csv,.log,.json,.pdf"
                        className="hidden"
                        onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
                      />
                    </div>
                    {files.length > 0 && (
                      <ul className="space-y-1">
                        {files.map((file, i) => (
                          <li key={`${file.name}-${i}`} className="flex items-center justify-between gap-2 text-caption bg-slate-50 dark:bg-[color:var(--bg-input)] rounded-lg px-2.5 py-1.5">
                            <span className="truncate">{file.name} · {Math.max(1, Math.round(file.size / 1024))} KB</span>
                            <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={t('feedback.removeFile')} className="text-slate-400 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {error && <p role="alert" className="text-caption text-red-600">{error}</p>}
                  <div className="flex items-center justify-between gap-2 pt-1">
                    {canUseSeTools(session?.user as any) ? (
                      <Link href="/reports" onClick={() => setMode('minimized')} className="text-caption font-medium text-slate-500 hover:text-brand-dark hover:underline">{t('feedback.viewReports')}</Link>
                    ) : <span />}
                    <button type="button" onClick={submit} disabled={busy} className="h-10 px-5 rounded-full brand-bg-primary text-label font-medium inline-flex items-center gap-2 disabled:opacity-50">
                      {busy && <Loader2 className="w-4 h-4 animate-spin" />} {t('feedback.send')}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
