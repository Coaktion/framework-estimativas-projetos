/**
 * POST /api/pre-sales-ops/signals/:id/triage — a decisão de quem está triando.
 * Frentes da pessoa: marcada vira atividade no Backlog dela; desmarcada é
 * "não vou fazer". Frentes de outros donos marcadas viram sugestão para eles.
 */
import { prisma } from '@/lib/psops/lib/db';
import { exigirUsuario } from '@/lib/psops/lib/auth';
import { criado, handler, lerBody } from '@/lib/psops/lib/http';
import { bodyTriagem } from '@/lib/psops/schemas';
import { decidir } from '@/lib/psops/services/decisoes';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handler(async () => {
    const u = await exigirUsuario();
    const body = await lerBody(req, bodyTriagem);
    return criado(
      await decidir(prisma, {
        signalId: params.id,
        marcados: body.impactos,
        usuarioId: u.id,
        nota: body.nota ?? null,
      }),
    );
  });
}
