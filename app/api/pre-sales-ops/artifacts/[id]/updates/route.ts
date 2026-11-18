/**
 * POST /api/pre-sales-ops/artifacts/:id/updates — registra uma atualização
 * ("commit") no artefato, com a descrição do que mudou. Pode o dono do
 * artefato e o gestor do Radar; artefato sem dono, qualquer um (e assume).
 */
import { prisma } from '@/lib/psops/lib/db';
import { exigirUsuario, SemPermissao } from '@/lib/psops/lib/auth';
import { handler, lerBody, NaoEncontrado, ok } from '@/lib/psops/lib/http';
import { bodyAtualizacaoArtefato } from '@/lib/psops/schemas';
import { registrarAtualizacao } from '@/lib/psops/services/artifacts';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handler(async () => {
    const u = await exigirUsuario();
    const art = await prisma.psOpsArtifact.findUnique({ where: { id: params.id }, select: { donoId: true } });
    if (!art) throw new NaoEncontrado('Artefato');
    if (art.donoId && art.donoId !== u.id && !u.gestor) {
      throw new SemPermissao('registrar atualização em artefato de outra pessoa');
    }
    const body = await lerBody(req, bodyAtualizacaoArtefato);
    return ok(await registrarAtualizacao(prisma, { artifactId: params.id, autorId: u.id, descricao: body.descricao }));
  });
}
