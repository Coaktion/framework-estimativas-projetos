/**
 * GET   /api/pre-sales-ops/study-notes/:id — a ficha da feature.
 * PATCH /api/pre-sales-ops/study-notes/:id — preencher o estudo.
 *
 * A ficha é o artefato que a atividade de ESTUDO produz. Publicar acontece na
 * conclusão da atividade, não aqui.
 */
import { prisma } from '@/lib/psops/lib/db';
import { exigirUsuario } from '@/lib/psops/lib/auth';
import { handler, lerBody, NaoEncontrado, ok } from '@/lib/psops/lib/http';
import { bodyFicha } from '@/lib/psops/schemas';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handler(async () => {
    await exigirUsuario();
    const ficha = await prisma.psOpsStudyNote.findUnique({
      where: { id: params.id },
      include: {
        signal: {
          select: {
            id: true, titulo: true, tipo: true, produto: true, planoMinimo: true,
            rawItem: { select: { htmlUrl: true, titulo: true } },
          },
        },
        activity: { select: { id: true, status: true, responsavelId: true } },
      },
    });
    if (!ficha) throw new NaoEncontrado('Ficha de estudo');
    return ok({ ...ficha, fonteUrl: ficha.signal.rawItem.htmlUrl });
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return handler(async () => {
    const u = await exigirUsuario();
    const body = await lerBody(req, bodyFicha);
    const existe = await prisma.psOpsStudyNote.findUnique({ where: { id: params.id } });
    if (!existe) throw new NaoEncontrado('Ficha de estudo');

    return ok(
      await prisma.psOpsStudyNote.update({
        where: { id: params.id },
        data: { ...body, autorId: existe.autorId ?? u.id },
      }),
    );
  });
}
