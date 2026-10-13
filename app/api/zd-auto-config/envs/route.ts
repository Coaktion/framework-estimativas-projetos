import { NextResponse } from 'next/server';
import { exigirAcesso, semCache } from '@/lib/zdcfg/acesso';
import { ErroCofre, cofreConfigurado, criar, listar } from '@/lib/zdcfg/cofre';

export const dynamic = 'force-dynamic';

/** Ambientes que o usuário pode usar (os dele + os compartilhados). */
export async function GET() {
  const quem = await exigirAcesso();
  if (quem instanceof NextResponse) return quem;
  if (!cofreConfigurado()) return NextResponse.json({ ok: true, configurado: false, envs: [] }, { headers: semCache });
  return NextResponse.json({ ok: true, configurado: true, envs: await listar(quem) }, { headers: semCache });
}

export async function POST(req: Request) {
  const quem = await exigirAcesso();
  if (quem instanceof NextResponse) return quem;
  try {
    const id = await criar(quem, await req.json());
    return NextResponse.json({ ok: true, id }, { headers: semCache });
  } catch (e) {
    if (e instanceof ErroCofre) return NextResponse.json({ ok: false, erro: e.message }, { status: e.status });
    throw e;
  }
}
