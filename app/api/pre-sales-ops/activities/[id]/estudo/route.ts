/**
 * POST /api/pre-sales-ops/activities/:id/estudo
 * Registro do estudo no Acompanhamento semanal (área Estudos), completado na
 * janela quando a conclusão não conseguiu registrar sozinha.
 * Body: { userId, data (AAAA-MM-DD), categoria, atividade, tipo, observacoes }
 */
import { z } from 'zod';
import { prisma } from '@/lib/psops/lib/db';
import { exigirUsuario } from '@/lib/psops/lib/auth';
import { handler, lerBody, NaoEncontrado, ok } from '@/lib/psops/lib/http';
import { registrarEstudoManual } from '@/lib/estudos/radar';

export const dynamic = 'force-dynamic';

const corpo = z.object({
  userId: z.coerce.number().int().positive(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  categoria: z.string().trim().max(200).nullable().optional(),
  atividade: z.string().trim().min(2).max(500),
  tipo: z.string().trim().max(60).nullable().optional(),
  observacoes: z.string().trim().max(2000).nullable().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return handler(async () => {
    const u = await exigirUsuario();
    const b = await lerBody(req, corpo);
    const a = await prisma.psOpsActivity.findUnique({ where: { id: params.id }, select: { id: true, tipo: true } });
    if (!a || a.tipo !== 'ESTUDO') throw new NaoEncontrado('Atividade de estudo');
    return ok(
      await registrarEstudoManual(prisma, {
        activityId: a.id,
        userId: b.userId,
        data: b.data,
        categoria: b.categoria ?? null,
        atividade: b.atividade,
        tipo: b.tipo ?? null,
        observacoes: b.observacoes ?? null,
        criadoPor: /^\d+$/.test(String(u.id)) ? Number(u.id) : null,
      }),
    );
  });
}
