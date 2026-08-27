'use server';

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerT } from "@/app/i18n/server";
import { canAccessScopes } from "@/lib/segments";

export async function createProjectAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error(getServerT()('errors.notAuthorized'));

  const name = formData.get("name") as string;
  const isPrivate = formData.get("isPrivate") === "on";
  const userId = parseInt(session.user.id);

  const project = await prisma.project.create({
    data: {
      name,
      isPrivate,
      ownerId: userId,
      status: "DRAFT"
    }
  });

  revalidatePath("/sc");
  redirect(`/sc/project/${project.id}`);
}

export async function deleteProjectAction(projectId: number) {
  const session = await getServerSession(authOptions);
  if (!canAccessScopes(session?.user as any)) {
    throw new Error(getServerT()('errors.notAuthorized'));
  }

  await prisma.projectVersion.deleteMany({
    where: { projectId }
  });
  
  await prisma.spreadsheet.deleteMany({
    where: { projectId }
  });

  await prisma.project.delete({
    where: { id: projectId }
  });

  revalidatePath("/sc");
}
