import type { Language } from './settings';
import { DEFAULT_NAMESPACE } from './settings';

import pt from './locales/pt/common.json';
import en from './locales/en/common.json';

/**
 * Os dicionários são importados estaticamente (e não carregados sob demanda)
 * para que o idioma troque instantaneamente, sem nenhum request de rede.
 * Ao adicionar um idioma novo, importe o JSON e registre-o aqui.
 */
export const dictionaries: Record<Language, Record<string, any>> = { pt, en };

export const resources = {
  pt: { [DEFAULT_NAMESPACE]: pt },
  en: { [DEFAULT_NAMESPACE]: en },
} as const;
