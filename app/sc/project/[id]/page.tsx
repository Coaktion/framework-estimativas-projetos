import prisma from "@/lib/prisma";
import { loadEditorShortcuts } from "@/lib/editor-shortcuts-server";
import ProjectEditorClient from "./ProjectEditorClient";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserPreferencesAction } from "@/lib/preferences";
import { loadFrameworkCatalog } from "@/lib/framework-catalog";
import { canAccessScopes } from "@/lib/segments";
import { canReadProject, OWNER_PUBLIC_SELECT } from "@/lib/project-access";
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
    include: { owner: { select: OWNER_PUBLIC_SELECT } },
  });

  // Projeto privado de outra pessoa: responde como se não existisse. Projeto
  // excluído só abre para admin (vindo de Admin › Estimativas excluídas).
  const isAdmin = Boolean((session!.user as any).isAdmin);
  if (!project || !canReadProject(project, session!.user as any) || (project.deletedAt && !isAdmin)) {
    notFound();
  }

  const preferences = await getUserPreferencesAction();
  // Atalhos do editor (Admin › Biblioteca › Atalhos).
  const shortcuts = await loadEditorShortcuts();

  // Árvore de categorias, itens e variáveis: a mesma que a API do Tool Center usa.
  const {
    categories, categoryLabels, categoryRecords, subcategoriesByCategory,
    packagesByCategory, orphanPackages, variables,
  } = await loadFrameworkCatalog();

  // Versões excluídas (só na tela) saem do seletor; o admin ainda abre uma
  // pelo link direto (Admin › Estimativas excluídas), com aviso na tela.
  const versionRows = await prisma.projectVersion.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });
  const allVersions = versionRows.filter((v) => !v.deletedAt);
  const requested = versionId ? versionRows.find(v => v.id === versionId) : null;
  const currentVersion = requested && (!requested.deletedAt || isAdmin)
    ? requested
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
      shortcuts={shortcuts}
    />
  );
}
