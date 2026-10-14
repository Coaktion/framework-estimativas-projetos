/** GET /api/pre-sales-ops/signals — a fila de triagem. */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/psops/lib/db';
import { exigirUsuario } from '@/lib/psops/lib/auth';
import { handler, lerQuery, ok } from '@/lib/psops/lib/http';
import { querySinais } from '@/lib/psops/schemas';
import { listarSinais, resumoFila } from '@/lib/psops/services/signals';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handler(async () => {
    await exigirUsuario();
    const q = lerQuery(req, querySinais);
    const [lista, resumo] = await Promise.all([
      listarSinais(prisma, { ...q, status: q.status ?? ['NOVO'] }),
      resumoFila(prisma),
    ]);
    return ok({ ...lista, resumo });
  });
}
