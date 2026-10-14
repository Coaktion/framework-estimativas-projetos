import { NextResponse } from 'next/server';
import { exigirAcesso, semCache } from '@/lib/zdcfg/acesso';
import { ErroCofre, credenciais } from '@/lib/zdcfg/cofre';
import { FaltaRef, executarPasso } from '@/lib/zdcfg/passos';
import type { Base, Ctx, Passo } from '@/lib/zdcfg/plano';
import { TenteDepois, ZendeskClient, ZendeskError } from '@/lib/zdcfg/zendesk';

export const dynamic = 'force-dynamic';
export const maxDuration = 26;

/**
 * Executa UM passo do provisionamento e devolve logs, recursos criados e o
 * contexto atualizado. A tela chama em sequência (ver lib/zdcfg/executor.ts).
 */
export async function POST(req: Request) {
  const quem = await exigirAcesso();
  if (quem instanceof NextResponse) return quem;
  const b = (await req.json()) as { envId: string; aplicar: boolean; base: Base; passo: Passo; ctx: Ctx };
  try {
    const creds = await credenciais(quem, String(b.envId || ''));
    const c = new ZendeskClient(creds, !b.aplicar, b.ctx?.fakeId ?? 1000, b.ctx?.guideSub || undefined);
    const r = await executarPasso(b.passo, b.base, b.ctx, c, new URL(req.url).origin);
    return NextResponse.json({ ok: true, ...r }, { headers: semCache });
  } catch (e) {
    if (e instanceof TenteDepois) return NextResponse.json({ ok: false, tenteEm: e.segundos }, { headers: semCache });
    if (e instanceof ZendeskError || e instanceof FaltaRef) return NextResponse.json({ ok: false, erro: e.message }, { headers: semCache });
    if (e instanceof ErroCofre) return NextResponse.json({ ok: false, erro: e.message }, { status: e.status });
    console.error('[zd-auto-config] passo', b?.passo?.tipo, e);
    return NextResponse.json({ ok: false, erro: `erro interno: ${(e as Error).message}` }, { status: 500 });
  }
}
