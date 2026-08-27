import { cookies } from 'next/headers';
import { dictionaries } from './resources';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_COOKIE,
  normalizeLanguage,
  type Language,
} from './settings';

/** Lê o idioma escolhido a partir do cookie (usado em Server Components). */
export function getServerLanguage(): Language {
  try {
    return normalizeLanguage(cookies().get(LANGUAGE_COOKIE)?.value);
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function lookup(dict: Record<string, any>, key: string): string | undefined {
  const value = key.split('.').reduce<any>((node, part) => {
    return node && typeof node === 'object' ? node[part] : undefined;
  }, dict);
  return typeof value === 'string' ? value : undefined;
}

/**
 * Equivalente ao t() do i18next para Server Components, com a mesma
 * interpolação {{variavel}}. Cai no português caso a chave não exista.
 */
export function getServerT(language?: Language) {
  const lang = language ?? getServerLanguage();
  return function t(key: string, params?: Record<string, string | number>): string {
    const raw =
      lookup(dictionaries[lang], key) ??
      lookup(dictionaries[DEFAULT_LANGUAGE], key) ??
      key;
    if (!params) return raw;
    return raw.replace(/\{\{(\w+)\}\}/g, (match, name) =>
      params[name] !== undefined ? String(params[name]) : match,
    );
  };
}
