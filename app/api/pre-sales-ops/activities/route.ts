/** GET /api/pre-sales-ops/activities — o board, com filtro por responsável. */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/psops/lib/db';
import { exigirUsuario } from '@/lib/psops/lib/auth';
import { handler, lerQuery, ok } from '@/lib/psops/lib/http';
import { queryAtividades } from '@/lib/psops/schemas';
import { contarPorResponsavel, listarAtividades } from '@/lib/psops/services/activities';
import { pessoasPorId } from '@/lib/psops/services/usuarios';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handler(async () => {
    await exigirUsuario();
    const q = lerQuery(req, queryAtividades);
    const [itens, contagens] = await Promise.all([
      listarAtividades(prisma, q),
      contarPorResponsavel(prisma),
    ]);
    // nomes resolvidos aqui: a tela não conhece o User do portal
    const pessoas = await pessoasPorId(prisma, [
      ...itens.map((a) => a.responsavelId),
      ...contagens.map((c) => c.responsavelId),
    ]);
    const nome = (id: string | null) => (id ? (pessoas[id]?.nome ?? null) : null);
    const iniciais = (id: string | null) => (id ? (pessoas[id]?.iniciais ?? '?') : null);
    return ok({
      itens: itens.map((a) => ({
        ...a,
        responsavelNome: nome(a.responsavelId),
        responsavelIniciais: iniciais(a.responsavelId),
      })),
      contagens: contagens.map((c) => ({ ...c, nome: nome(c.responsavelId) })),
    });
  });
}
