/**
 * Adaptador de sessão do Pre-Sales Ops.
 *
 * É a ÚNICA porta do módulo para a sessão do portal: nada mais em lib/psops
 * importa `next-auth`. Quem pode entrar é decidido em `lib/segments.ts`
 * (canAccessPreSalesOps), no mesmo lugar que decide o acesso a todo o resto do
 * Tool Center. Admin é o `isAdmin` do portal, relido do banco a cada request
 * pelo callback de sessão em `lib/auth.ts`.
 *
 * SÓ SERVIDOR.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canAccessPreSalesOps } from '@/lib/segments';
import { NaoAutenticado, SemPermissao } from './erros';

export { NaoAutenticado, SemPermissao };

export interface PsOpsUser {
  /** id do User do portal, como string (o módulo guarda ids de pessoa como texto) */
  id: string;
  nome: string | null;
  email: string | null;
  /** segmento do portal (ADMIN, SC, SD…) */
  papel: string | null;
  admin: boolean;
}

/** Usuário da sessão do portal, ou null. Nunca inventa usuário. */
export async function usuarioAtual(): Promise<PsOpsUser | null> {
  let session: any = null;
  try {
    session = await getServerSession(authOptions);
  } catch {
    // fora de contexto de request (script de linha de comando)
    return null;
  }
  const u = session?.user;
  if (!u?.id) return null;
  return {
    id: String(u.id),
    nome: u.name ?? null,
    email: u.email ?? null,
    papel: u.role ?? null,
    admin: Boolean(u.isAdmin),
  };
}

/** Exige sessão E acesso ao módulo. */
export async function exigirUsuario(): Promise<PsOpsUser> {
  const u = await usuarioAtual();
  if (!u) throw new NaoAutenticado();
  if (!canAccessPreSalesOps({ isAdmin: u.admin, role: u.papel })) {
    throw new SemPermissao('usar o Pre-Sales Ops');
  }
  return u;
}

/** Ações que mexem na operação: coletar, reconciliar, definir dono de artefato. */
export async function exigirAdmin(acao: string): Promise<PsOpsUser> {
  const u = await exigirUsuario();
  if (!u.admin) throw new SemPermissao(acao);
  return u;
}

export function ehAdmin(u: PsOpsUser): boolean {
  return u.admin;
}
