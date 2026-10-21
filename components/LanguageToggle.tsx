'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Languages } from 'lucide-react';
import { LANGUAGES, LANGUAGE_LABELS } from '@/app/i18n/settings';
import { useLanguage } from './LanguageProvider';

/**
 * Seletor de idioma (PT / EN / ES). Mostra a sigla do idioma atual e abre um
 * menu com os três, no mesmo visual dos botões de tema e modo compacto.
 */
export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={t('nav.chooseLanguage')}
        aria-label={t('nav.language')}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-[10px] border border-slate-200 bg-white text-slate-500 hover:text-brand-dark hover:border-slate-400 transition-colors"
      >
        <Languages className="w-4 h-4" />
        <span className="text-label font-medium leading-none">
          {LANGUAGE_LABELS[language].short}
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-48 z-[70] bg-white dark:bg-[color:var(--bg-card-solid)] border border-slate-200 dark:border-[color:var(--border-main)] rounded-xl shadow-xl overflow-hidden"
        >
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              role="menuitemradio"
              aria-checked={lang === language}
              onClick={() => {
                setLanguage(lang);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left text-label text-brand-dark dark:text-[color:var(--text-main)] hover:bg-slate-50 dark:hover:bg-[color:var(--bg-input)] transition-colors"
            >
              <span>
                <span className="font-medium">{LANGUAGE_LABELS[lang].short}</span>
                <span className="text-slate-500 ml-2">{LANGUAGE_LABELS[lang].full}</span>
              </span>
              {lang === language && <Check className="w-4 h-4 text-brand-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
