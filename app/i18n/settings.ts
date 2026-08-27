// Configuração central de idiomas / Central language configuration.
// Para adicionar um novo idioma: crie app/i18n/locales/<code>/common.json,
// registre-o em LANGUAGES abaixo e importe-o em app/i18n/resources.ts.

export const LANGUAGES = ['pt', 'en'] as const;

export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'pt';

/** Nome do cookie usado para lembrar o idioma entre sessões e no SSR. */
export const LANGUAGE_COOKIE = 'presales_lang';

/** Namespace único do i18next usado no projeto. */
export const DEFAULT_NAMESPACE = 'common';

/** Rótulos exibidos no seletor de idioma. */
export const LANGUAGE_LABELS: Record<Language, { short: string; full: string }> = {
  pt: { short: 'PT', full: 'Português (BR)' },
  en: { short: 'EN', full: 'English (US)' },
};

/** Valor usado no atributo lang do <html>. */
export const HTML_LANG: Record<Language, string> = {
  pt: 'pt-BR',
  en: 'en-US',
};

/** Locale usado em toLocaleDateString / toLocaleString. */
export const DATE_LOCALE: Record<Language, string> = {
  pt: 'pt-BR',
  en: 'en-US',
};

/** Normaliza qualquer string para um idioma suportado. */
export function normalizeLanguage(value?: string | null): Language {
  if (!value) return DEFAULT_LANGUAGE;
  const base = value.toLowerCase().split('-')[0];
  return (LANGUAGES as readonly string[]).includes(base)
    ? (base as Language)
    : DEFAULT_LANGUAGE;
}
