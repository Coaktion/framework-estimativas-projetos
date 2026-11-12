/** GET /api/notificacoes — as últimas notificações da pessoa logada e quantas estão sem ler. */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { listarNotificacoes } from '@/lib/notificacoes';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session: any = await getServerSession(authOptions);
  const u = session?.user;
  if (!u?.id) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 });
  return NextResponse.json(await listarNotificacoes(prisma, Number(u.id)), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
