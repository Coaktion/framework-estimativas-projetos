/**
 * Garante as fontes e os artefatos do Pre-Sales Ops. Idempotente.
 *
 *   npm run psops:seed
 *
 * Normalmente não é preciso: toda coleta (inclusive o botão "Coletar agora")
 * já chama a mesma função antes de coletar. Fica aqui para uso local.
 * As tabelas vêm do `prisma db push` do build — este script não altera schema.
 */
import { PrismaClient } from '@prisma/client';
import { garantirBase } from '../lib/psops/services/seed';

async function main() {
  const prisma = new PrismaClient();
  try {
    const r = await garantirBase(prisma);
    console.log(`fontes: ${r.fontes} garantidas · artefatos: ${r.artefatos} garantidos`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
