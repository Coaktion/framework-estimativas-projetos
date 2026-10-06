/** PATCH /api/pre-sales-ops/activities/:id — marcar item do DoD ou reatribuir. */
import { prisma } from '@/lib/psops/lib/db';
import { exigirUsuario } from '@/lib/psops/lib/auth';
import { handler, lerBody, ok } from '@/lib/psops/lib/http';
import { bodyAtividade } from '@/lib/psops/schemas';
import { atribuir, marcarDod } from '@/lib/psops/services/activities';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return handler(async () => {
    await exigirUsuario();
    const body = await lerBody(req, bodyAtividade);

    if (body.responsavelId !== undefined) {
      return ok(await atribuir(prisma, { activityId: params.id, responsavelId: body.responsavelId }));
    }
    return ok(
      await marcarDod(prisma, {
        activityId: params.id,
        indice: body.dod!.indice,
        feito: body.dod!.feito,
        evidencia: body.dod!.evidencia ?? null,
      }),
    );
  });
}
