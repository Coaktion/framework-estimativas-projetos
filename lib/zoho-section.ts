import { zohoPromptSectionAction } from './zoho-actions';
import { ZOHO_TEXT, zohoLocale } from './zoho-config';

/**
 * Busca a seção [ZOHO CRM] na hora de copiar o prompt, no idioma do bloco.
 * Uma falha de rede não impede a cópia: o prompt sai com uma linha de aviso no
 * lugar dos campos.
 */
export async function zohoSectionFor(link: string | null | undefined, locale?: string | null): Promise<string[] | null> {
  if (!String(link || '').trim()) return null;
  try {
    return await zohoPromptSectionAction(link, locale);
  } catch {
    const T = ZOHO_TEXT[zohoLocale(locale)];
    return [T.failed(T.connection)];
  }
}
