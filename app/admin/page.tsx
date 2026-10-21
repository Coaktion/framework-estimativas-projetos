import prisma from "@/lib/prisma";
import AdminClient from "./AdminClient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { buildCategoryOrderBy, sortCategories } from "@/lib/category-utils";
import { getActiveAeConfig, listAeConfigs } from "@/lib/ae-config-server";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user || !session.user.isAdmin) {
    redirect('/');
  }

  // ===========================================================================
  // 🎛️  UPSERT AUTOMÁTICO da variável de DRN (% sobre Desenvolvimento).
  //     O cálculo do framework depende dela; se já existir, mantém o valor atual.
  //     As antigas SD_DISCOVERY_DEVOPS_PERCENT e SD_LIQUID_TO_DISCOVERY_PCT não
  //     são mais lidas por nada e deixaram de ser recriadas aqui.
  // ===========================================================================
  try {
    await prisma.variable.upsert({
      where: { key: 'SD_DRN_DEVOPS_PERCENT' },
      update: { isActive: true },
      create: {
        key:   'SD_DRN_DEVOPS_PERCENT',
        label: 'DRN - % sobre Desenvolvimento',
        labelEn: 'DRN - % over Development',
        value: '15',
        type:  'PERCENT',
        category: 'Solution Design',
        isActive: true
      }
    });
  } catch {
    /* se não der certo, seguimos de qualquer forma — o editor usa fallback hardcoded. */
  }

  const packages = await prisma.package.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    include: { category: true, skill: true }
  });

  let categories: any[];
  try {
    categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: buildCategoryOrderBy() as any,
    });
  } catch {
    const rows = await prisma.category.findMany({ where: { isActive: true } });
    categories = sortCategories(rows as any);
  }

  const skills = await prisma.skill.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' }
  });

  const variables = await prisma.variable.findMany({
    where: { isActive: true },
    orderBy: { key: 'asc' },
  });

  const versions = await prisma.frameworkVersion.findMany({
    orderBy: { createdAt: 'desc' },
    include: { creator: true },
  });

  const users = await prisma.user.findMany({
    orderBy: { email: 'asc' },
  });

  // Calculadora AE: configuração ativa (números e fórmulas) e histórico.
  const [activeAeConfig, aeConfigHistory] = await Promise.all([getActiveAeConfig(), listAeConfigs()]);

  return (
    <AdminClient 
      packages={packages} 
      categories={categories}
      skills={skills}
      variables={variables} 
      versions={versions} 
      users={users} 
      activeAeConfig={activeAeConfig}
      aeConfigHistory={aeConfigHistory}
    />
  );
}
