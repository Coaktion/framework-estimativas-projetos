'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canAccessFolders } from '@/lib/segments';
import {
  CLIENT_NAME_MAX, FolderError, createClientFolders, isFolderRegion, normalizeClientName,
  type FolderErrorCode, type FolderResult,
} from '@/lib/folders';

type Fail = { ok: false; error: FolderErrorCode; detail?: string };

export async function createClientFoldersAction(
  cliente: string,
  regiao: string,
): Promise<({ ok: true } & FolderResult) | Fail> {
  try {
    const session: any = await getServerSession(authOptions);
    const user = session?.user;
    if (!user || !canAccessFolders(user)) throw new FolderError('not_authorized');

    const nome = normalizeClientName(cliente);
    if (!nome || nome.length > CLIENT_NAME_MAX) throw new FolderError('invalid_name');
    if (!isFolderRegion(regiao)) throw new FolderError('invalid_region');

    const result = await createClientFolders(nome, regiao, String(user.email || ''));
    return { ok: true, ...result };
  } catch (e) {
    if (e instanceof FolderError) return { ok: false, error: e.code, detail: e.detail };
    console.error('[folders] falha inesperada', e);
    return { ok: false, error: 'script_error' };
  }
}
