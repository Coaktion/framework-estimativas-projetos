/** POST /api/pre-sales-ops/signals/:id/discard — descarte com motivo obrigatório. */
import { prisma } from '@/lib/psops/lib/db';
import { exigirUsuario } from '@/lib/psops/lib/auth';
import { handler, lerBody, ok } from '@/lib/psops/lib/http';
import { bodyDescarte } from '@/lib/psops/schemas';
import { descartar } from '@/lib/psops/services/triage';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handler(async () => {
    const u = await exigirUsuario();
    const { motivo } = await lerBody(req, bodyDescarte);
    return ok(await descartar(prisma, { signalId: params.id, usuarioId: u.id, motivo }));
  });
}
