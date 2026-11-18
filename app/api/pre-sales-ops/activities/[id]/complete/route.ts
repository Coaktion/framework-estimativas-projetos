/**
 * POST /api/pre-sales-ops/activities/:id/complete
 * Fecha o ciclo. Body (Demo, Estimativa, Escopo): { artefatoIds, descricao } —
 * quais artefatos foram atualizados e o que mudou; vira um commit em cada um.
 * Estudo não precisa de body.
 */
import { prisma } from '@/lib/psops/lib/db';
import { exigirUsuario } from '@/lib/psops/lib/auth';
import { handler, ok } from '@/lib/psops/lib/http';
import { bodyConclusao } from '@/lib/psops/schemas';
import { concluir } from '@/lib/psops/services/activities';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handler(async () => {
    const u = await exigirUsuario();
    const texto = await req.text();
    const body = bodyConclusao.parse(texto.trim() ? JSON.parse(texto) : {});
    return ok(
      await concluir(prisma, {
        activityId: params.id,
        usuarioId: u.id,
        artefatoIds: body.artefatoIds,
        descricao: body.descricao ?? null,
      }),
    );
  });
}
