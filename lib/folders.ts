/**
 * Criador de Pastas — cria no Google Drive a estrutura padrão de um cliente
 * (0 - SALES, 1 - PRESALES, 2 - DELIVERY, 3 - CUSTOMER SUCCESS).
 *
 * Quem cria as pastas é o Apps Script publicado como Web App (código em
 * scripts/apps-script/criador-pastas.gs). Ele roda com a conta do dono do
 * script, então o Tool Center não precisa de permissão no Drive: só manda o
 * nome do cliente e a região, autenticado por um token compartilhado.
 *
 * Variáveis de ambiente (só servidor):
 *   FOLDERS_SCRIPT_URL    URL do Web App (…/macros/s/<id>/exec)
 *   FOLDERS_SCRIPT_TOKEN  mesmo valor da propriedade TOOL_CENTER_TOKEN do script
 */

export const FOLDER_REGIONS = ['BRASIL', 'AMER_EMEA', 'SSAC'] as const;
export type FolderRegion = (typeof FOLDER_REGIONS)[number];

export const FOLDER_REGION_LABELS: Record<FolderRegion, string> = {
  BRASIL: 'Brasil',
  AMER_EMEA: 'AMER/EMEA',
  SSAC: 'SSAC',
};

export const CLIENT_NAME_MAX = 120;

export type FolderErrorCode =
  | 'not_authorized'
  | 'not_configured'
  | 'invalid_name'
  | 'invalid_region'
  | 'timeout'
  | 'script_error';

export class FolderError extends Error {
  constructor(public code: FolderErrorCode, public detail?: string) {
    super(code);
  }
}

export type FolderResult = {
  url: string;
  /** created = criada do zero; completed = já existia e faltavam subpastas; existing = nada a fazer. */
  status: 'created' | 'completed' | 'existing';
  subfoldersCreated: number;
};

export const foldersConfigured = () =>
  Boolean(process.env.FOLDERS_SCRIPT_URL?.trim() && process.env.FOLDERS_SCRIPT_TOKEN?.trim());

/** Espaços colapsados e sem caracteres de controle; vazio se não sobrar nada. */
export function normalizeClientName(raw: unknown): string {
  return String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isFolderRegion(value: unknown): value is FolderRegion {
  return (FOLDER_REGIONS as readonly string[]).includes(String(value));
}

/** Chama o Web App. O script é idempotente: repetir o pedido só completa o que falta. */
export async function createClientFolders(
  cliente: string,
  regiao: FolderRegion,
  solicitante: string,
): Promise<FolderResult> {
  if (!foldersConfigured()) throw new FolderError('not_configured');

  let res: Response;
  try {
    // O Web App responde com 302 para script.googleusercontent.com; o fetch segue
    // o redirect como GET, que é como o Apps Script entrega a resposta.
    res = await fetch(process.env.FOLDERS_SCRIPT_URL!.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: process.env.FOLDERS_SCRIPT_TOKEN!.trim(), cliente, regiao, solicitante }),
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(25_000),
    });
  } catch (e: any) {
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') throw new FolderError('timeout');
    throw new FolderError('script_error', e?.message);
  }

  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    // Página HTML de erro/login do Google: implantação sem doPost (versão antiga),
    // Web App não publicado para "Qualquer pessoa" ou URL errada. O título diz qual.
    const title = text.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();
    const hint = /function not found|função.*não encontrada/i.test(text)
      ? 'doPost não encontrado: publique uma nova versão do script'
      : /accounts\.google\.com|ServiceLogin|Sign in|Fazer login/i.test(text)
        ? 'o Google pediu login: publique com acesso "Qualquer pessoa"'
        : title;
    throw new FolderError('script_error', `HTTP ${res.status}${hint ? ` · ${hint.slice(0, 160)}` : ''}`);
  }
  if (!data?.ok) throw new FolderError('script_error', String(data?.erro || `HTTP ${res.status}`));

  const status = data.status === 'created' || data.status === 'completed' ? data.status : 'existing';
  return { url: String(data.url || ''), status, subfoldersCreated: Number(data.subpastasCriadas) || 0 };
}
