'use client';

/**
 * Notas livres da reunião (RF-17) numa janela flutuante, no mesmo estilo da
 * janela de relatos (FeedbackButton): barra escura com minimizar, maximizar e
 * fechar. Abre com "/" (ou Ctrl+/) e salva sozinha 1 s depois de parar de
 * digitar. Vai direto no <body> (portal): o layout largo do Scoping usa
 * transform, que prenderia um elemento `fixed` dentro dele.
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Maximize2, Minimize2, Minus, NotebookPen, X } from 'lucide-react';
import { saveNoteAction } from '@/app/scoping/actions';

type Mode = 'open' | 'minimized' | 'maximized';

export default function NotesDrawer({
  sessionId, initial, open, onClose,
}: {
  sessionId: string;
  initial: { content: string; version: number };
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [content, setContent] = useState(initial.content);
  const [mode, setMode] = useState<Mode>('open');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error' | 'conflict'>('idle');
  const [mounted, setMounted] = useState(false);
  const version = useRef(initial.version);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const latest = useRef(content);
  latest.current = content;

  useEffect(() => setMounted(true), []);
  // Abrir pelo atalho sempre traz a janela aberta (mesmo se estava minimizada) e com o cursor no texto.
  useEffect(() => {
    if (!open) return;
    setMode((m) => (m === 'minimized' ? 'open' : m));
    setTimeout(() => area.current?.focus(), 30);
  }, [open]);

  const save = async () => {
    setState('saving');
    try {
      const res = await saveNoteAction(sessionId, latest.current, version.current);
      if (res.ok) { version.current = res.version; setState('saved'); return; }
      if (res.error === 'conflict' && 'content' in res) {
        // Outra pessoa editou as notas: junta as duas versões em vez de perder alguma.
        version.current = res.version;
        const merged = `${res.content}\n\n---\n${latest.current}`;
        setContent(merged);
        latest.current = merged;
        setState('conflict');
        const again = await saveNoteAction(sessionId, merged, version.current);
        if (again.ok) version.current = again.version;
        return;
      }
      setState('error');
    } catch {
      setState('error');
    }
  };

  const onChange = (v: string) => {
    setContent(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 1000);
  };

  if (!open || !mounted) return null;

  // Acima do rodapé fixo do Scoping (≈ 72 px), à direita.
  const windowClass = mode === 'maximized'
    ? 'fixed inset-4 md:inset-10 z-[95]'
    : 'fixed bottom-[84px] right-4 md:right-8 z-[95] w-[min(460px,calc(100vw-2rem))]';

  return createPortal(
    <div
      role="dialog"
      aria-label={t('scoping.notes.title')}
      className={`${windowClass} flex flex-col bg-white dark:bg-[color:var(--bg-card-solid)] border border-slate-300 dark:border-[color:var(--border-main)] shadow-2xl rounded-2xl`}
    >
      <div className={`flex items-center justify-between gap-2 px-4 py-2.5 bg-brand-dark text-[color:var(--bg-main)] select-none ${mode === 'minimized' ? 'rounded-2xl' : 'rounded-t-2xl'}`}>
        <button type="button" onClick={() => setMode(mode === 'minimized' ? 'open' : 'minimized')} className="inline-flex items-center gap-2 text-label font-medium truncate text-left flex-1">
          <NotebookPen className="w-4 h-4 shrink-0" /> {t('scoping.notes.title')}
          {state !== 'idle' && <span className={`text-caption font-normal ${state === 'error' ? 'text-[#F87171]' : 'opacity-70'}`}>· {t(`scoping.save.${state}`)}</span>}
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={() => setMode(mode === 'minimized' ? 'open' : 'minimized')} title={t('feedback.minimize')} aria-label={t('feedback.minimize')} className="p-1 rounded hover:bg-white/15"><Minus className="w-4 h-4" /></button>
          <button type="button" onClick={() => setMode(mode === 'maximized' ? 'open' : 'maximized')} title={mode === 'maximized' ? t('feedback.restore') : t('feedback.maximize')} aria-label={mode === 'maximized' ? t('feedback.restore') : t('feedback.maximize')} className="p-1 rounded hover:bg-white/15">
            {mode === 'maximized' ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button type="button" onClick={onClose} title={t('scoping.notes.close')} aria-label={t('scoping.notes.close')} className="p-1 rounded hover:bg-white/15"><X className="w-4 h-4" /></button>
        </div>
      </div>
      {mode !== 'minimized' && (
        <div className={`flex flex-col gap-2 p-3 ${mode === 'maximized' ? 'flex-1 min-h-0' : ''}`}>
          <textarea
            ref={area}
            value={content}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
            placeholder={t('scoping.notes.placeholder')}
            className={`w-full resize-y rounded-lg border border-slate-300 dark:border-[color:var(--border-main)] bg-white dark:bg-[color:var(--bg-input-solid)] px-3 py-2 text-body text-brand-dark outline-none focus:border-brand-primary ${mode === 'maximized' ? 'flex-1 resize-none' : 'h-[min(45vh,360px)]'}`}
          />
          <p className="text-caption text-slate-500 dark:text-[color:var(--text-muted)]">{t('scoping.notes.hint')}</p>
        </div>
      )}
    </div>,
    document.body,
  );
}
