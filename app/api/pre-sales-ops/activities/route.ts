/** GET /api/pre-sales-ops/activities — o board, com filtro por responsável. */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/psops/lib/db';
import { exigirUsuario } from '@/lib/psops/lib/auth';
import { handler, lerQuery, ok } from '@/lib/psops/lib/http';
import { queryAtividades } from '@/lib/psops/schemas';
import { contarPorResponsavel, listarAtividades } from '@/lib/psops/services/activities';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handler(async () => {
    await exigirUsuario();
    const q = lerQuery(req, queryAtividades);
    const [itens, contagens] = await Promise.all([
      listarAtividades(prisma, q),
      contarPorResponsavel(prisma),
    ]);
    return ok({ itens, contagens });
  });
}
