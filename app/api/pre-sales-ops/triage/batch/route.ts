/**
 * POST /api/pre-sales-ops/triage/batch — triagem em lote.
 * É o que faz o ritual de 20 minutos caber: selecionar N sinais do mesmo
 * produto e aplicar a mesma decisão. Falha por item não derruba o lote.
 */
import { prisma } from '@/lib/psops/lib/db';
import { exigirUsuario } from '@/lib/psops/lib/auth';
import { handler, lerBody, ok } from '@/lib/psops/lib/http';
import { bodyTriagemLote } from '@/lib/psops/schemas';
import { triarEmLote } from '@/lib/psops/services/triage';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handler(async () => {
    const u = await exigirUsuario();
    const { itens } = await lerBody(req, bodyTriagemLote);
    // o zod já validou; o cast só existe porque, sem strictNullChecks (tsconfig
    // do portal), o tipo inferido pelo zod marca todo campo como opcional
    type Itens = Parameters<typeof triarEmLote>[1]['itens'];
    return ok(await triarEmLote(prisma, { itens: itens as Itens, usuarioId: u.id }));
  });
}
