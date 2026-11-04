/**
 * GET   /api/pre-sales-ops/artifacts/:id — histórico: por que este artefato está assim.
 * PATCH /api/pre-sales-ops/artifacts/:id — dono e fonte de verificação (só gestor do Radar).
 */
import { prisma } from '@/lib/psops/lib/db';
import { exigirGestor, exigirUsuario } from '@/lib/psops/lib/auth';
import { handler, lerBody, ok } from '@/lib/psops/lib/http';
import { bodyArtefato } from '@/lib/psops/schemas';
import { atualizarArtefato, historicoArtefato } from '@/lib/psops/services/artifacts';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handler(async () => {
    await exigirUsuario();
    return ok(await historicoArtefato(prisma, params.id));
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return handler(async () => {
    await exigirGestor('alterar dono ou fonte de verificação de artefato');
    const body = await lerBody(req, bodyArtefato);
    return ok(await atualizarArtefato(prisma, { artifactId: params.id, ...body }));
  });
}
