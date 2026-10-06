import { NextResponse } from 'next/server';
import { exigirAcesso, semCache } from '@/lib/zdcfg/acesso';
import { ErroCofre, credenciais } from '@/lib/zdcfg/cofre';
import type { Criado } from '@/lib/zdcfg/passos';
import { removerUm } from '@/lib/zdcfg/passos';
import { ZendeskClient } from '@/lib/zdcfg/zendesk';

export const dynamic = 'force-dynamic';
export const maxDuration = 26;

/** Remove um lote pequeno de recursos (a tela manda de 5 em 5, do mais novo ao mais antigo). */
export async function POST(req: Request) {
  const quem = await exigirAcesso();
  if (quem instanceof NextResponse) return quem;
  const b = (await req.json()) as { envId: string; itens: Criado[] };
  try {
    const c = new ZendeskClient(await credenciais(quem, String(b.envId || '')), false);
    const logs: string[] = [];
    const resultados = [];
    for (const [kind, id] of (b.itens || []).slice(0, 10)) {
      resultados.push({ kind, id, ok: await removerUm(c, kind, id, (m) => logs.push(m)) });
    }
    return NextResponse.json({ logs, resultados }, { headers: semCache });
  } catch (e) {
    if (e instanceof ErroCofre) return NextResponse.json({ ok: false, erro: e.message }, { status: e.status });
    throw e;
  }
}
