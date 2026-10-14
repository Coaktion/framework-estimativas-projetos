/**
 * Quem pode usar as rotas do ZD Auto Config: a sessão do NextAuth (o login do
 * site) + o segmento ADMIN/SC, relido do banco a cada pedido pelo callback de
 * sessão. SÓ SERVIDOR.
 */
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { canAccessZdAutoConfig } from '@/lib/segments';

export type Quem = { id: number; email: string; isAdmin: boolean };

export async function exigirAcesso(): Promise<Quem | NextResponse> {
  const session: any = await getServerSession(authOptions);
  const u = session?.user;
  if (!u?.email || !u?.id) return NextResponse.json({ ok: false, erro: 'nao autenticado' }, { status: 401 });
  if (!canAccessZdAutoConfig(u)) return NextResponse.json({ ok: false, erro: 'sem permissao para o ZD Auto Config' }, { status: 403 });
  return { id: parseInt(String(u.id), 10), email: String(u.email).toLowerCase(), isAdmin: Boolean(u.isAdmin) };
}

export const semCache = { 'Cache-Control': 'no-store' };
