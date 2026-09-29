import prisma from "@/lib/prisma";
import AdminClient from "./AdminClient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { buildCategoryOrderBy, sortCategories } from "@/lib/category-utils";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user || !session.user.isAdmin) {
    redirect('/');
  }

  // ===========================================================================
  // 🎛️  UPSERT AUTOMÁTICO das variáveis de regras SD / DRN.
  //     Garante que as variáveis abaixo EXISTAM e fiquem 100% funcionais SEM o primeiro acesso
  //     ao painel de Admin (não precisa criar variável manualmente).
  //     Se já existirem, mantém o valor atual do banco (não sobrescreve customizações).
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

    await prisma.variable.upsert({
      where: { key: 'SD_DISCOVERY_DEVOPS_PERCENT' },
      update: { isActive: true },
      create: {
        key:   'SD_DISCOVERY_DEVOPS_PERCENT',
        label: 'SD c/ Dev - % Discovery sobre Desenvolvimento',
        labelEn: 'SD with Dev - % Discovery over Development',
        value: '15',
        type:  'PERCENT',
        category: 'Solution Design',
        isActive: true
      }
    });

    await prisma.variable.upsert({
      where: { key: 'SD_LIQUID_TO_DISCOVERY_PCT' },
      update: { isActive: true },
      create: {
        key:   'SD_LIQUID_TO_DISCOVERY_PCT',
        label: 'SD - % do bruto para Discovery',
        labelEn: 'SD - % gross value to Discovery',
        value: '100',
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

  return (
    <AdminClient 
      packages={packages} 
      categories={categories}
      skills={skills}
      variables={variables} 
      versions={versions} 
      users={users} 
    />
  );
}
