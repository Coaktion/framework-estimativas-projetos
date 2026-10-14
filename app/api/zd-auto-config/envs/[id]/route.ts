import { NextResponse } from 'next/server';
import { exigirAcesso, semCache } from '@/lib/zdcfg/acesso';
import { ErroCofre, editar, excluir } from '@/lib/zdcfg/cofre';

export const dynamic = 'force-dynamic';

type P = { params: { id: string } };

export async function PUT(req: Request, { params }: P) {
  const quem = await exigirAcesso();
  if (quem instanceof NextResponse) return quem;
  try {
    await editar(quem, params.id, await req.json());
    return NextResponse.json({ ok: true, id: params.id }, { headers: semCache });
  } catch (e) {
    if (e instanceof ErroCofre) return NextResponse.json({ ok: false, erro: e.message }, { status: e.status });
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: P) {
  const quem = await exigirAcesso();
  if (quem instanceof NextResponse) return quem;
  try {
    await excluir(quem, params.id);
    return NextResponse.json({ ok: true }, { headers: semCache });
  } catch (e) {
    if (e instanceof ErroCofre) return NextResponse.json({ ok: false, erro: e.message }, { status: e.status });
    throw e;
  }
}
