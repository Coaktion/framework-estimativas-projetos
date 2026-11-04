/**
 * Adaptador de sessão do Pre-Sales Ops.
 *
 * É a ÚNICA porta do módulo para a sessão do portal: nada mais em lib/psops
 * importa `next-auth`. Quem pode entrar é decidido em `lib/segments.ts`
 * (canAccessPreSalesOps), no mesmo lugar que decide o acesso a todo o resto do
 * Tool Center. Admin é o `isAdmin` do portal, relido do banco a cada request
 * pelo callback de sessão em `lib/auth.ts`. Gestor (quem comanda a operação do
 * Radar) é admin ou e-mail listado em PSOPS_GESTORES — ver ./gestores.ts.
 *
 * SÓ SERVIDOR.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canAccessPreSalesOps } from '@/lib/segments';
import { NaoAutenticado, SemPermissao } from './erros';
import { ehGestorPor, parseGestores } from './gestores';

export { NaoAutenticado, SemPermissao };

export interface PsOpsUser {
  /** id do User do portal, como string (o módulo guarda ids de pessoa como texto) */
  id: string;
  nome: string | null;
  email: string | null;
  /** segmento do portal (ADMIN, SC, SD…) */
  papel: string | null;
  admin: boolean;
  /** Comanda a operação do Radar: admin ou e-mail em PSOPS_GESTORES. */
  gestor: boolean;
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
  const admin = Boolean(u.isAdmin);
  const email = u.email ?? null;
  return {
    id: String(u.id),
    nome: u.name ?? null,
    email,
    papel: u.role ?? null,
    admin,
    // Lido direto (e não por env()): a validação de TODAS as variáveis do módulo
    // não pode derrubar as telas só porque outra variável está mal configurada.
    gestor: ehGestorPor({ admin, email }, parseGestores(process.env.PSOPS_GESTORES)),
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
export async function exigirGestor(acao: string): Promise<PsOpsUser> {
  const u = await exigirUsuario();
  if (!u.gestor) throw new SemPermissao(acao);
  return u;
}
