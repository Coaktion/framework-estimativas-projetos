import prisma from "@/lib/prisma";
import AdminClient from "./AdminClient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user || !session.user.isAdmin) {
    redirect('/');
  }

  const packages = await prisma.package.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    include: { category: true, skill: true }
  });

  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }]
  });

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
