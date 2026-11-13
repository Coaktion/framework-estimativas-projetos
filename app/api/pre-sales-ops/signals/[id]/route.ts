/** GET /api/pre-sales-ops/signals/:id — detalhe, donos de cada frente e prévia do que a decisão vai gerar. */
import { prisma } from '@/lib/psops/lib/db';
import { exigirUsuario } from '@/lib/psops/lib/auth';
import { handler, ok } from '@/lib/psops/lib/http';
import { detalharSinal } from '@/lib/psops/services/signals';
import { pessoasPorId } from '@/lib/psops/services/usuarios';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return handler(async () => {
    const u = await exigirUsuario();
    const d = await detalharSinal(prisma, params.id, u.id);
    // nomes: a tela não conhece o User
    const pessoas = await pessoasPorId(prisma, [
      ...d.previa.flatMap((p) => [p.responsavelId, ...p.responsaveisIds]),
      ...d.frentes.flatMap((f) => f.donos.flatMap((x) => [x.id, ...x.sugeridosPor])),
      ...(d.sugestoesParaMim ?? []).flatMap((x) => x.sugeridosPor),
    ]);
    const nome = (id: string | null | undefined) => (id ? (pessoas[id]?.nome ?? null) : null);
    return ok({
      ...d,
      decisoes: undefined,
      frentes: d.frentes.map((f) => ({
        ...f,
        donos: f.donos.map((x) => ({
          ...x,
          nome: nome(x.id) ?? x.id,
          iniciais: pessoas[x.id]?.iniciais ?? '?',
          sugeridoPorNome: nome(x.sugeridoPor),
          sugeridosPorNomes: x.sugeridosPor.map((id) => nome(id) ?? id),
        })),
      })),
      sugestoesParaMim: (d.sugestoesParaMim ?? []).map((x) => ({
        ...x,
        sugeridoPorNome: nome(x.sugeridoPor),
        sugeridosPorNomes: x.sugeridosPor.map((id) => nome(id) ?? id),
      })),
      previa: d.previa.map((p) => ({
        ...p,
        responsavelNome: nome(p.responsavelId),
        responsavelIniciais: p.responsavelId ? (pessoas[p.responsavelId]?.iniciais ?? '?') : null,
        responsaveis: p.responsaveisIds
          .filter((id) => pessoas[id])
          .map((id) => ({ id, nome: pessoas[id]!.nome, iniciais: pessoas[id]!.iniciais })),
      })),
    });
  });
}
