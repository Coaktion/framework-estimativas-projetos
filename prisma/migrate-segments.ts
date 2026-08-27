/**
 * Migração pontual: normaliza a coluna `User.role` para os cinco segmentos
 * e mantém `isAdmin` coerente com o segmento.
 *
 * Rode UMA VEZ depois de aplicar o schema:
 *   npx prisma db push
 *   npm run migrate:segments
 *
 * O script é idempotente — rodar de novo não causa dano.
 *
 * REGRA DE PRESERVAÇÃO: quem já era administrador (`isAdmin = true`) vai para o
 * segmento ADMIN, para que ninguém perca acesso na virada. Se você preferir que
 * um administrador continue, por exemplo, como Sales Engineer, ajuste o segmento
 * dele no painel Admin depois de rodar isto.
 */
import { PrismaClient } from '@prisma/client';
import { normalizeSegment, syncIsAdmin } from '../lib/segments';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, isAdmin: true },
  });

  console.log(`Verificando ${users.length} usuários...\n`);

  let changed = 0;

  for (const user of users) {
    // Administradores existentes são preservados como ADMIN.
    const segment = user.isAdmin ? 'ADMIN' : normalizeSegment(user.role);
    const isAdmin = syncIsAdmin(segment);

    if (user.role === segment && user.isAdmin === isAdmin) continue;

    await prisma.user.update({
      where: { id: user.id },
      data: { role: segment, isAdmin },
    });

    console.log(
      `  ${user.email}: role "${user.role}" (isAdmin=${user.isAdmin}) -> ` +
        `"${segment}" (isAdmin=${isAdmin})`,
    );
    changed += 1;
  }

  const adminCount = await prisma.user.count({ where: { isAdmin: true } });

  console.log(`\n${changed} usuário(s) atualizado(s).`);
  console.log(`Administradores no sistema: ${adminCount}`);

  if (adminCount === 0) {
    console.warn(
      '\n⚠️  ATENÇÃO: nenhum administrador restou. Promova alguém direto no banco:\n' +
        '   UPDATE "User" SET role = \'ADMIN\', "isAdmin" = true WHERE email = \'seu@email.com\';',
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
