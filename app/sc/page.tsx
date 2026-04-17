import prisma from "@/lib/prisma";
import ProjectDashboardClient from "./ProjectDashboardClient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ProjectDashboard() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user || (session.user.role !== 'SC' && !session.user.isAdmin)) {
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
    include: { owner: true },
  });

  return (
    <ProjectDashboardClient projects={projects} />
  );
}
