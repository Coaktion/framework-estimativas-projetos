/** GET /api/pre-sales-ops/artifacts — o mapa, com semáforo baseado na data VERIFICADA. */
import { prisma } from '@/lib/psops/lib/db';
import { exigirUsuario } from '@/lib/psops/lib/auth';
import { handler, ok } from '@/lib/psops/lib/http';
import { listarArtefatos } from '@/lib/psops/services/artifacts';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handler(async () => {
    await exigirUsuario();
    return ok({ itens: await listarArtefatos(prisma) });
  });
}
