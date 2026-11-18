/** GET /api/pre-sales-ops/signals — a fila de triagem (por padrão, a de quem está vendo). */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/psops/lib/db';
import { exigirUsuario } from '@/lib/psops/lib/auth';
import { handler, lerQuery, ok } from '@/lib/psops/lib/http';
import { querySinais } from '@/lib/psops/schemas';
import { listarSinais, resumoFila } from '@/lib/psops/services/signals';
import { pessoasPorId } from '@/lib/psops/services/usuarios';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handler(async () => {
    const u = await exigirUsuario();
    const q = lerQuery(req, querySinais);
    const [lista, resumo] = await Promise.all([
      listarSinais(prisma, { ...q, status: q.status ?? ['NOVO'], usuarioId: u.id, modo: q.modo ?? 'minhas' }),
      resumoFila(prisma),
    ]);
    // quem deixou cada sugestão, com nome
    type Sug = { impacto: string; sugeridoPor: string; sugeridosPor: string[] };
    const itens = lista.itens as Array<Record<string, unknown> & { sugestoesParaMim?: Sug[] }>;
    const pessoas = await pessoasPorId(prisma, itens.flatMap((s) => (s.sugestoesParaMim ?? []).flatMap((x) => x.sugeridosPor)));
    return ok({
      ...lista,
      itens: itens.map((s) => ({
        ...s,
        decisoes: undefined,
        sugestoesParaMim: (s.sugestoesParaMim ?? []).map((x) => ({
          ...x,
          sugeridoPorNome: pessoas[x.sugeridoPor]?.nome ?? null,
          sugeridosPorNomes: x.sugeridosPor.map((id) => pessoas[id]?.nome ?? id),
        })),
      })),
      resumo,
    });
  });
}
