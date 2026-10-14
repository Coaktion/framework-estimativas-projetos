/** POST /api/pre-sales-ops/signals/:id/triage — a decisão humana vira atividades. */
import { prisma } from '@/lib/psops/lib/db';
import { exigirUsuario } from '@/lib/psops/lib/auth';
import { criado, handler, lerBody } from '@/lib/psops/lib/http';
import { bodyTriagem } from '@/lib/psops/schemas';
import { triar } from '@/lib/psops/services/triage';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handler(async () => {
    const u = await exigirUsuario();
    const body = await lerBody(req, bodyTriagem);
    return criado(
      await triar(prisma, {
        signalId: params.id,
        impactos: body.impactos,
        usuarioId: u.id,
        nota: body.nota ?? null,
      }),
    );
  });
}
