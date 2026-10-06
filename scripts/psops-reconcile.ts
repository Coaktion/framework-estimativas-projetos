/**
 * Reconciliação manual.
 *
 *   npm run psops:reconcile
 */
import { PrismaClient } from '@prisma/client';
import { reconciliar } from '../lib/psops/services/reconcile';

async function main() {
  const prisma = new PrismaClient();
  try {
    const r = await reconciliar(prisma);
    console.log(
      `conferidos=${r.conferidos} confirmados=${r.confirmados} ` +
        `divergentes=${r.divergentes} inconclusivos=${r.inconclusivos}`,
    );
    for (const d of r.detalhes) console.log(`  [${d.estado}] ${d.artefato}: ${d.detalhe}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
