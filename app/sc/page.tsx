import prisma from "@/lib/prisma";
import ProjectDashboardClient from "./ProjectDashboardClient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { canAccessScopes } from "@/lib/segments";

export default async function ProjectDashboard() {
  const session = await getServerSession(authOptions);
  
  if (!canAccessScopes(session?.user as any)) {
    redirect('/');
  }

  const userId = parseInt(session.user.id);

  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { ownerId: userId },
        { isPrivate: false }
      ]
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      owner: true,
      // As versões vêm junto para que o card mostre os atalhos "V1 · 108h".
      // Ordem CRESCENTE por criação: é ela que define o número ordinal da
      // versão (V1, V2...), já que `versionName` é texto livre e pode ser
      // qualquer coisa ("Proposta Final", "Rev. cliente").
      //
      // NOTA: NÃO usamos `select` aqui para não quebrar em ambientes onde o
      // Prisma Client ainda não foi regenerado após a adição da coluna
      // `totalHours`. Sem `select`, todos os campos conhecidos pelo Client
      // são retornados. Se `totalHours` não vier (Client desatualizado), o
      // código abaixo cai em `0` e o chip mostra só "V1" sem horas — o que
      // já é previsto no comentário imediatamente abaixo.
      versions: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  /**
   * Achata as versões no formato que o card consome, já numeradas.
   *
   * `totalHours` pode vir 0 em versões salvas antes da coluna existir; nesse
   * caso o chip mostra só "V2", sem horas — melhor do que anunciar "0h" como
   * se fosse um escopo vazio.
   */
  const projectsWithVersions = projects.map((project: any) => ({
    ...project,
    versions: (project.versions || []).map((v: any, index: number) => ({
      id: v.id,
      ordinal: index + 1,
      versionName: v.versionName || '',
      totalHours: Number(v.totalHours) || 0,
      createdAt: v.createdAt,
    })),
  }));

  return (
    <ProjectDashboardClient projects={projectsWithVersions} currentUserId={userId} />
  );
}
