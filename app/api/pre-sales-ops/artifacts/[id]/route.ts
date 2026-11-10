/**
 * GET   /api/pre-sales-ops/artifacts/:id — a linha do tempo de commits do artefato.
 * PATCH /api/pre-sales-ops/artifacts/:id — dono e fonte de verificação (só gestor do Radar).
 */
import { prisma } from '@/lib/psops/lib/db';
import { exigirGestor, exigirUsuario } from '@/lib/psops/lib/auth';
import { handler, lerBody, ok } from '@/lib/psops/lib/http';
import { bodyArtefato } from '@/lib/psops/schemas';
import { atualizarArtefato, historicoArtefato } from '@/lib/psops/services/artifacts';
import { pessoasPorId } from '@/lib/psops/services/usuarios';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handler(async () => {
    await exigirUsuario();
    const h = await historicoArtefato(prisma, params.id);
    const pessoas = await pessoasPorId(prisma, [h.artefato.donoId, ...h.atualizacoes.map((u) => u.autorId)]);
    return ok({
      ...h,
      donoNome: h.artefato.donoId ? (pessoas[h.artefato.donoId]?.nome ?? null) : null,
      atualizacoes: h.atualizacoes.map((u) => ({
        ...u,
        autorNome: pessoas[u.autorId]?.nome ?? null,
        autorIniciais: pessoas[u.autorId]?.iniciais ?? '?',
      })),
    });
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return handler(async () => {
    await exigirGestor('alterar dono ou fonte de verificação de artefato');
    const body = await lerBody(req, bodyArtefato);
    return ok(await atualizarArtefato(prisma, { artifactId: params.id, ...body }));
  });
}
