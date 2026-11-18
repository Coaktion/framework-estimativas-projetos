'use client';

/**
 * Notas livres da reunião (RF-17): sempre a um atalho de distância ("/" ou
 * Ctrl+/), salvam sozinhas 1 s depois de parar de digitar.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { saveNoteAction } from '@/app/scoping/actions';

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
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error' | 'conflict'>('idle');
  const version = useRef(initial.version);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const latest = useRef(content);
  latest.current = content;

  useEffect(() => { if (open) setTimeout(() => area.current?.focus(), 30); }, [open]);

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

  return (
    <aside
      aria-hidden={!open}
      aria-label={t('scoping.notes.title')}
      className={`fixed right-0 top-0 bottom-0 z-50 w-[min(480px,100vw)] bg-white border-l border-slate-200 shadow-2xl flex flex-col transition-transform ${open ? 'translate-x-0' : 'translate-x-full'}`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h2 className="text-title font-bold text-brand-dark">{t('scoping.notes.title')}</h2>
        <div className="flex items-center gap-3">
          <span className={`text-caption ${state === 'error' ? 'text-red-600' : 'text-slate-500'}`}>{state === 'idle' ? '' : t(`scoping.save.${state}`)}</span>
          <button type="button" onClick={onClose} aria-label={t('scoping.notes.close')} className="text-slate-500 hover:text-brand-dark"><X className="w-5 h-5" /></button>
        </div>
      </div>
      <textarea
        ref={area}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
        placeholder={t('scoping.notes.placeholder')}
        className="flex-1 w-full resize-none p-4 text-body text-brand-dark outline-none bg-white dark:bg-[color:var(--bg-input-solid)]"
      />
      <p className="px-4 py-2 text-caption text-slate-500 border-t border-slate-100">{t('scoping.notes.hint')}</p>
    </aside>
  );
}
