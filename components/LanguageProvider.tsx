'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { getI18n } from '@/app/i18n/client';
import {
  DATE_LOCALE,
  DEFAULT_LANGUAGE,
  HTML_LANG,
  LANGUAGE_COOKIE,
  normalizeLanguage,
  type Language,
} from '@/app/i18n/settings';
import { updateUserPreferenceAction } from '@/lib/preferences';

interface LanguageContextType {
  /** Idioma atual ('pt' | 'en'). */
  language: Language;
  /** Define um idioma específico. */
  setLanguage: (lang: Language) => void;
  /** Alterna entre português e inglês. */
  toggleLanguage: () => void;
  /** Locale para toLocaleDateString / toLocaleString (ex.: 'pt-BR'). */
  dateLocale: string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function persistCookie(lang: Language) {
  if (typeof document === 'undefined') return;
  // 1 ano. SameSite=Lax para que o SSR enxergue o valor já na próxima navegação.
  document.cookie = `${LANGUAGE_COOKIE}=${lang}; path=/; max-age=31536000; SameSite=Lax`;
}

export function LanguageProvider({
  children,
  initialLanguage = DEFAULT_LANGUAGE,
}: {
  children: React.ReactNode;
  initialLanguage?: Language;
}) {
  const safeInitial = normalizeLanguage(initialLanguage);
  const [language, setLanguageState] = useState<Language>(safeInitial);
  const [i18n] = useState(() => getI18n(safeInitial));

  const setLanguage = useCallback(
    (next: Language) => {
      const lang = normalizeLanguage(next);
      if (lang === language) return;

      setLanguageState(lang);
      i18n.changeLanguage(lang);
      persistCookie(lang);

      if (typeof document !== 'undefined') {
        document.documentElement.lang = HTML_LANG[lang];
      }

      // Persiste no banco também, para o usuário reencontrar seu idioma em
      // outro dispositivo. Falha silenciosa: o cookie já garante a preferência.
      void updateUserPreferenceAction({ language: lang }).catch(() => {});
    },
    [language, i18n],
  );

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'pt' ? 'en' : 'pt');
  }, [language, setLanguage]);

  const value = useMemo<LanguageContextType>(
    () => ({ language, setLanguage, toggleLanguage, dateLocale: DATE_LOCALE[language] }),
    [language, setLanguage, toggleLanguage],
  );

  return (
    <I18nextProvider i18n={i18n}>
      <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
    </I18nextProvider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
