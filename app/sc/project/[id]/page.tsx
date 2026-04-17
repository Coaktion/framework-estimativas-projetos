import prisma from "@/lib/prisma";
import ProjectEditorClient from "./ProjectEditorClient";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function ProjectEditorPage({ 
  params,
  searchParams 
}: { 
  params: { id: string },
  searchParams: { version_id?: string }
}) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user || (session.user.role !== 'SC' && !session.user.isAdmin)) {
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

  const packages = await prisma.package.findMany({
    where: { isActive: true },
    orderBy: { category: 'asc' },
  });

  const variables = await prisma.variable.findMany({
    where: { isActive: true },
  });

  const categories = Array.from(new Set(packages.map(p => p.category).filter(Boolean))) as string[];
  const packagesByCategory = categories.reduce((acc: any, cat) => {
    acc[cat] = packages.filter(p => p.category === cat);
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
      packagesByCategory={packagesByCategory}
      currentVersion={currentVersion}
      allVersions={allVersions}
      variables={variables}
    />
  );
}
