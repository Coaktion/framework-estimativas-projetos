/**
 * Paridade entre o editor de projetos e o cálculo do servidor. SÓ LEITURA.
 *
 *   npm run framework:parity
 *
 * Recalcula cada versão salva com lib/framework-estimate (o mesmo cálculo que a
 * API do Tool Center usa) e compara com `totalHours`, o total que o editor
 * gravou ao salvar. Versões com retrato de preços são recalculadas com os
 * valores originais, como o editor abre; as antigas, sem retrato, com a
 * biblioteca atual — por isso divergências nelas podem ser só mudança de preço.
 */
import prisma from '../lib/prisma';
import { loadFrameworkCatalog } from '../lib/framework-catalog';
import { estimateVersion, parsePriceSnapshot, safeJsonParse } from '../lib/framework-estimate';

async function main() {
  const catalog = await loadFrameworkCatalog();
  const versions = await prisma.projectVersion.findMany({
    include: { project: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  // Com retrato de preços a paridade tem de ser exata; sem retrato, é indicativa.
  const bySnapshot = { com: { comparadas: 0, iguais: 0 }, sem: { comparadas: 0, iguais: 0 } };
  const mismatches: string[] = [];
  let skipped = 0;

  for (const v of versions) {
    const saved = Number((v as any).totalHours) || 0;
    if (saved <= 0) { skipped++; continue; }
    const data = safeJsonParse<Record<string, any>>(v.data, {});
    const hasSnapshot = Boolean(parsePriceSnapshot(data.__priceSnapshot));
    const result = estimateVersion(catalog, v);
    const bucket = hasSnapshot ? bySnapshot.com : bySnapshot.sem;
    bucket.comparadas++;
    if (Math.abs(result.grandTotal - saved) < 0.5) {
      bucket.iguais++;
    } else {
      mismatches.push(
        `  #${v.id} ${v.project.name} ${v.versionName} (${v.createdAt.toISOString().slice(0, 10)}, ${hasSnapshot ? 'com retrato' : 'sem retrato'}): gravado ${saved}h, calculado ${result.grandTotal}h`,
      );
    }
  }

  console.log(`versões: ${versions.length} · sem total gravado: ${skipped}`);
  console.log(`com retrato de preços: ${bySnapshot.com.iguais}/${bySnapshot.com.comparadas} iguais`);
  console.log(`sem retrato (preços da biblioteca atual): ${bySnapshot.sem.iguais}/${bySnapshot.sem.comparadas} iguais`);
  if (mismatches.length) console.log(mismatches.join('\n'));
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
