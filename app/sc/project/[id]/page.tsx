import prisma from "@/lib/prisma";
import ProjectEditorClient from "./ProjectEditorClient";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPreferencesAction } from "@/lib/preferences";
import { buildCategoryOrderBy, sortCategories } from "@/lib/category-utils";
import { canAccessScopes } from "@/lib/segments";

export default async function ProjectEditorPage({ 
  params,
  searchParams 
}: { 
  params: { id: string },
  searchParams: { version_id?: string }
}) {
  const session = await getServerSession(authOptions);
  
  if (!canAccessScopes(session?.user as any)) {
    redirect('/');
  }

  const projectId = parseInt(params.id);
  const versionId = searchParams.version_id ? parseInt(searchParams.version_id) : null;
  
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { owner: true },
  });

  if (!project) {
    notFound();
  }

  const preferences = await getUserPreferencesAction();

  let categoriesData: any[];
  try {
    categoriesData = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: buildCategoryOrderBy() as any,
    });
  } catch {
    const rows = await prisma.category.findMany({ where: { isActive: true } });
    categoriesData = sortCategories(rows as any);
  }

  const packages = await prisma.package.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  const variables = await prisma.variable.findMany({
    where: { isActive: true },
  });

  // Rótulos PT (compatibilidade) e o registro completo por categoria, para que
  // o cliente possa exibir no idioma ativo e buscar nos dois idiomas.
  const categoryLabels = categoriesData.reduce((acc: Record<string, string>, c) => {
    acc[c.name] = c.displayName || c.name;
    return acc;
  }, {});

  const categoryRecords = categoriesData.reduce((acc: Record<string, any>, c: any) => {
    acc[c.name] = {
      name: c.name,
      displayName: c.displayName || '',
      displayNameEn: c.displayNameEn || '',
      // Porteira de plano da categoria — o cliente usa para esconder a
      // categoria inteira abaixo do tier mínimo.
      minPlanCS: c.minPlanCS || '',
      minPlanES: c.minPlanES || '',
    };
    return acc;
  }, {});

  const rootCategories = categoriesData.filter(c => !c.parentName);
  const categories = rootCategories.map(c => c.name);

  const childCategoriesByParent = categoriesData.reduce((acc: Record<string, any[]>, c: any) => {
    if (!c.parentName) return acc;
    acc[c.parentName] = acc[c.parentName] || [];
    acc[c.parentName].push(c);
    return acc;
  }, {});

  const packagesByCategory = categories.reduce((acc: any, parentCat) => {
    const children = ([...(childCategoriesByParent[parentCat] || [])] as any[]).sort((a: any, b: any) => {
      const orderA = a.displayOrder ?? 0;
      const orderB = b.displayOrder ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return String(a.name).localeCompare(String(b.name));
    });
    const allowedNames = [parentCat, ...children.map(c => c.name)];

    acc[parentCat] = packages
      .filter(p => p.categoryName && allowedNames.includes(p.categoryName))
      .map((p: any) => {
        const sourceCat = p.categoryName;
        const isChild = sourceCat !== parentCat;
        return isChild
          ? { ...p, __defaultSubcategory: categoryLabels[sourceCat] || sourceCat }
          : p;
      });

    return acc;
  }, {});

  const allVersions = await prisma.projectVersion.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });

  const currentVersion = versionId 
    ? allVersions.find(v => v.id === versionId)
    : allVersions[0];

  return (
    <ProjectEditorClient 
      project={project}
      categories={categories}
      categoryLabels={categoryLabels}
      categoryRecords={categoryRecords}
      packagesByCategory={packagesByCategory}
      currentVersion={currentVersion}
      allVersions={allVersions}
      variables={variables}
      preferences={preferences}
    />
  );
}
