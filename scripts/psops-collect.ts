/**
 * Coleta manual. Mesmo caminho que o agendador e o botão "Coletar agora".
 *
 *   npm run psops:collect
 */
import { PrismaClient } from '@prisma/client';
import { criarClienteHc } from '../lib/psops/zendesk/client';
import { coletar } from '../lib/psops/ingest/collector';
import { garantirBase } from '../lib/psops/services/seed';

async function main() {
  const prisma = new PrismaClient();
  try {
    await garantirBase(prisma);
    const r = await coletar({ prisma, hc: criarClienteHc() });

    console.log(`run ${r.runId}`);
    for (const f of r.porFonte) {
      const status = f.ok ? 'ok  ' : 'FALHA';
      console.log(
        `  ${status} ${f.fonte.padEnd(20)} itens=${f.itensNovos} sinais=${f.sinaisCriados} ruído=${f.sinaisArquivados}` +
          (f.erro ? `  ← ${f.erro}` : ''),
      );
    }
    console.log(`total: ${r.totalSinaisCriados} sinais na fila, ${r.totalSinaisArquivados} arquivados`);
    if (r.porFonte.some((f) => !f.ok)) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
