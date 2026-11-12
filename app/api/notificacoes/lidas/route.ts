/** POST /api/notificacoes/lidas — { ids?: string[] }: marca essas (ou todas) como lidas. */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { marcarLidas } from '@/lib/notificacoes';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session: any = await getServerSession(authOptions);
  const u = session?.user;
  if (!u?.id) return NextResponse.json({ erro: 'Não autenticado.' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === 'string').slice(0, 200) : undefined;
  return NextResponse.json({ marcadas: await marcarLidas(prisma, Number(u.id), ids) });
}
