'use server';

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerT } from "@/app/i18n/server";

export async function changePasswordAction(data: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false, error: getServerT()('errors.notAuthorized') };
  }

  const userId = parseInt(session.user.id);
  if (!Number.isFinite(userId)) {
    return { success: false, error: getServerT()('errors.notAuthorized') };
  }

  const currentPassword = String(data.currentPassword || '');
  const newPassword = String(data.newPassword || '');
  const confirmPassword = String(data.confirmPassword || '');

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { success: false, error: getServerT()('errors.allFieldsRequired') };
  }

  if (newPassword.length < 6) {
    return { success: false, error: getServerT()('errors.passwordTooShort') };
  }

  if (newPassword !== confirmPassword) {
    return { success: false, error: getServerT()('errors.passwordMismatch') };
  }

  if (newPassword === currentPassword) {
    return { success: false, error: getServerT()('errors.passwordSameAsCurrent') };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, password: true }
  });

  if (!user || !user.password) {
    return { success: false, error: getServerT()('errors.userNotFound') };
  }

  const bcrypt = (await import('bcryptjs')).default;
  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) {
    return { success: false, error: getServerT()('errors.wrongPassword') };
  }

  let hashedNewPassword: string;
  try {
    hashedNewPassword = await bcrypt.hash(newPassword, 10);
  } catch {
    return { success: false, error: getServerT()('errors.hashFailed') };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword }
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || getServerT()('errors.generic') };
  }
}
