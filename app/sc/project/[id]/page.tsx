import prisma from "@/lib/prisma";
import ProjectEditorClient from "./ProjectEditorClient";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPreferencesAction } from "@/lib/preferences";
import { loadFrameworkCatalog } from "@/lib/framework-catalog";
import { canAccessScopes } from "@/lib/segments";
import { cookies } from "next/headers";
import { EDITOR_VIEW_COOKIE, parseEditorView } from "@/lib/editor-view";

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

  // Árvore de categorias, itens e variáveis: a mesma que a API do Tool Center usa.
  const {
    categories, categoryLabels, categoryRecords, subcategoriesByCategory,
    packagesByCategory, orphanPackages, variables,
  } = await loadFrameworkCatalog();

  const allVersions = await prisma.projectVersion.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });

  const currentVersion = versionId
    ? allVersions.find(v => v.id === versionId)
    : allVersions[0];

  return (
    <ProjectEditorClient
      key={`sc-project-${project.id}-v-${currentVersion?.id ?? 'new'}`}
      project={project}
      categories={categories}
      categoryLabels={categoryLabels}
      categoryRecords={categoryRecords}
      packagesByCategory={packagesByCategory}
      subcategoriesByCategory={subcategoriesByCategory}
      orphanPackages={orphanPackages}
      currentVersion={currentVersion}
      allVersions={allVersions}
      variables={variables}
      preferences={preferences}
      initialView={parseEditorView(cookies().get(EDITOR_VIEW_COOKIE)?.value)}
    />
  );
}
