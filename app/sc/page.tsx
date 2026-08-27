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
    include: { owner: true },
  });

  return (
    <ProjectDashboardClient projects={projects} currentUserId={userId} />
  );
}
