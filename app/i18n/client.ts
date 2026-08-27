'use client';

import i18next, { type i18n as I18nInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './resources';
import {
  DEFAULT_LANGUAGE,
  DEFAULT_NAMESPACE,
  type Language,
} from './settings';

let instance: I18nInstance | null = null;

/**
 * Devolve (criando na primeira chamada) a instância única do i18next.
 * O idioma inicial vem do servidor, então a primeira renderização no cliente
 * casa exatamente com o HTML enviado — sem "flash" de idioma errado.
 */
export function getI18n(initialLanguage: Language = DEFAULT_LANGUAGE): I18nInstance {
  if (!instance) {
    instance = i18next.createInstance();
    instance.use(initReactI18next).init({
      resources,
      lng: initialLanguage,
      fallbackLng: DEFAULT_LANGUAGE,
      ns: [DEFAULT_NAMESPACE],
      defaultNS: DEFAULT_NAMESPACE,
      interpolation: {
        // O React já escapa tudo que renderiza.
        escapeValue: false,
      },
      react: { useSuspense: false },
    });
  }
  return instance;
}
