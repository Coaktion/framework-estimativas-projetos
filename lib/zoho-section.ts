import { zohoPromptSectionAction } from './zoho-actions';

/**
 * Busca a seção [ZOHO CRM] na hora de copiar o prompt. Uma falha de rede não
 * impede a cópia: o prompt sai com uma linha de aviso no lugar dos campos.
 */
export async function zohoSectionFor(link: string | null | undefined): Promise<string[] | null> {
  if (!String(link || '').trim()) return null;
  try {
    return await zohoPromptSectionAction(link);
  } catch {
    return ['Não foi possível consultar o Zoho CRM agora (erro de conexão).'];
  }
}
