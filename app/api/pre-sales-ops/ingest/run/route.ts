import { secretMatches } from '@/lib/secure-compare';
/**
 * POST /api/pre-sales-ops/ingest/run — dispara a coleta.
 *
 * Dois chamadores possíveis:
 *   · o agendador (Netlify Scheduled Function) com o header
 *     `x-psops-secret: $PSOPS_INGEST_SECRET` — só roda sozinho no deploy de
 *     produção; em branch deploy, o Netlify não dispara funções agendadas
 *   · um gestor do Radar logado, pelo botão "Coletar agora"
 *
 * Esta rota fica fora do middleware de login (ver middleware.ts) para o
 * agendador alcançá-la; a proteção é o segredo OU a sessão de gestor do Radar, abaixo.
 */
import { prisma } from '@/lib/psops/lib/db';
import { exigirGestor } from '@/lib/psops/lib/auth';
import { erro, handler, ok } from '@/lib/psops/lib/http';
import { env } from '@/lib/psops/lib/env';
import { criarClienteHc } from '@/lib/psops/zendesk/client';
import { coletar } from '@/lib/psops/ingest/collector';
import { garantirBase } from '@/lib/psops/services/seed';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  return handler(async () => {
    const segredo = env().PSOPS_INGEST_SECRET;
    const header = req.headers.get('x-psops-secret');

    if (!secretMatches(header, segredo)) {
      // sem segredo válido, exige sessão de gestor do Radar
      await exigirGestor('disparar a coleta manualmente');
    }

    // banco recém-criado pelo build: garante fontes e artefatos antes de coletar
    const base = await garantirBase(prisma);
    const r = await coletar({
      prisma,
      hc: criarClienteHc(),
      primeiraColetaDias: env().PSOPS_PRIMEIRA_COLETA_DIAS,
    });
    const corpo = { ...r, base };
    return r.porFonte.every((f) => f.ok)
      ? ok(corpo)
      : erro(207, 'Coleta parcial: alguma fonte falhou.', corpo);
  });
}
