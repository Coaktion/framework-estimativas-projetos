/** GET /api/pre-sales-ops/artifacts — o mapa, com semáforo baseado na data VERIFICADA. */
import { prisma } from '@/lib/psops/lib/db';
import { exigirUsuario } from '@/lib/psops/lib/auth';
import { handler, ok } from '@/lib/psops/lib/http';
import { listarArtefatos } from '@/lib/psops/services/artifacts';
import { pessoasPorId } from '@/lib/psops/services/usuarios';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handler(async () => {
    await exigirUsuario();
    const itens = await listarArtefatos(prisma);
    const pessoas = await pessoasPorId(prisma, itens.map((a) => a.donoId));
    return ok({
      itens: itens.map((a) => ({
        ...a,
        donoNome: a.donoId ? (pessoas[a.donoId]?.nome ?? null) : null,
        donoIniciais: a.donoId ? (pessoas[a.donoId]?.iniciais ?? '?') : null,
      })),
    });
  });
}
