/** GET /api/pre-sales-ops/signals/:id — detalhe + prévia do que a triagem vai gerar. */
import { prisma } from '@/lib/psops/lib/db';
import { exigirUsuario } from '@/lib/psops/lib/auth';
import { handler, ok } from '@/lib/psops/lib/http';
import { detalharSinal } from '@/lib/psops/services/signals';
import { pessoasPorId } from '@/lib/psops/services/usuarios';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handler(async () => {
    await exigirUsuario();
    const d = await detalharSinal(prisma, params.id);
    // quem responde por cada artefato, com nome — a tela não conhece o User
    const pessoas = await pessoasPorId(prisma, d.previa.map((p) => p.responsavelId));
    return ok({
      ...d,
      previa: d.previa.map((p) => ({
        ...p,
        responsavelNome: p.responsavelId ? (pessoas[p.responsavelId]?.nome ?? null) : null,
        responsavelIniciais: p.responsavelId ? (pessoas[p.responsavelId]?.iniciais ?? '?') : null,
      })),
    });
  });
}
