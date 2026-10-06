/** GET /api/pre-sales-ops/ingest/runs — histórico de execuções e saúde das fontes. */
import { prisma } from '@/lib/psops/lib/db';
import { exigirUsuario } from '@/lib/psops/lib/auth';
import { handler, ok } from '@/lib/psops/lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handler(async () => {
    await exigirUsuario();
    const [runs, fontes] = await Promise.all([
      prisma.psOpsIngestRun.findMany({ orderBy: { iniciadoEm: 'desc' }, take: 20 }),
      prisma.psOpsSource.findMany({
        orderBy: { key: 'asc' },
        select: {
          key: true, nome: true, kind: true, zendeskId: true, ativo: true,
          isLiveArticle: true, watermark: true, ultimoRunEm: true,
          ultimoRunOk: true, ultimoRunErro: true,
        },
      }),
    ]);
    return ok({ runs, fontes });
  });
}
