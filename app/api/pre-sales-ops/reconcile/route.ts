/**
 * POST /api/pre-sales-ops/reconcile — reconciliação.
 *
 * Recalcula revisaoVerificadaEm a partir da FONTE de cada artefato, sem olhar
 * para o board. É daqui que vem o controle: sem isso, o semáforo reflete
 * cliques, não fatos.
 */
import { prisma } from '@/lib/psops/lib/db';
import { exigirAdmin } from '@/lib/psops/lib/auth';
import { handler, ok } from '@/lib/psops/lib/http';
import { env } from '@/lib/psops/lib/env';
import { reconciliar } from '@/lib/psops/services/reconcile';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  return handler(async () => {
    const segredo = env().PSOPS_INGEST_SECRET;
    const header = req.headers.get('x-psops-secret');
    if (!(segredo && header && header === segredo)) {
      await exigirAdmin('disparar a reconciliação manualmente');
    }
    return ok(await reconciliar(prisma));
  });
}
