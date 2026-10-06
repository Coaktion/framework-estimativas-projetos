/**
 * POST /api/pre-sales-ops/activities/:id/complete
 * Fecha o ciclo: registra a aplicação, incrementa a versão do artefato e
 * grava revisaoDeclaradaEm. A data VERIFICADA é do reconciliador.
 */
import { prisma } from '@/lib/psops/lib/db';
import { exigirUsuario } from '@/lib/psops/lib/auth';
import { handler, ok } from '@/lib/psops/lib/http';
import { concluir } from '@/lib/psops/services/activities';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return handler(async () => {
    const u = await exigirUsuario();
    return ok(await concluir(prisma, { activityId: params.id, usuarioId: u.id }));
  });
}
