import { SCOPING_LANGS, type I18nText, type ScopingLang } from './types';

/** Normaliza o idioma da sessão ('pt-BR' → 'pt'). */
export function normalizeScopingLang(value: unknown): ScopingLang {
  const base = String(value || '').toLowerCase().split('-')[0];
  return (SCOPING_LANGS as readonly string[]).includes(base) ? (base as ScopingLang) : 'pt';
}

/**
 * Texto no idioma pedido, com o fallback do RF-03: idioma da sessão → pt-BR → en.
 * Devolve '' se nenhum dos três existir.
 */
export function tr(text: I18nText | null | undefined, lang: ScopingLang): string {
  if (!text) return '';
  return (text[lang] || text.pt || text.en || '').trim();
}

/** O texto exibido caiu no fallback (para marcar "sem tradução" na tela). */
export function isFallback(text: I18nText | null | undefined, lang: ScopingLang): boolean {
  return !!text && !text[lang] && !!(text.pt || text.en);
}
