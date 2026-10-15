'use server';

import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerT } from "@/app/i18n/server";

// Arquivos 'use server' só podem exportar funções async — o tipo fica local.
type ChangePasswordResult = { success: boolean; error?: string };

/**
 * Troca de senha do próprio usuário autenticado.
 * Confere a senha atual antes de gravar a nova (bcrypt) e devolve um resultado
 * padronizado para a UI, sem lançar exceção.
 */
export async function changePasswordAction(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): Promise<ChangePasswordResult> {
  const t = getServerT();

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: t('errors.notAuthenticated') };

  const current = String(currentPassword || '');
  const next = String(newPassword || '');
  const confirm = String(confirmPassword || '');

  if (!current || !next || !confirm) return { success: false, error: t('errors.allFieldsRequired') };
  if (next.length < 6) return { success: false, error: t('errors.passwordTooShort') };
  if (next !== confirm) return { success: false, error: t('errors.passwordMismatch') };
  if (next === current) return { success: false, error: t('errors.passwordSameAsCurrent') };

  try {
    const user = await prisma.user.findUnique({ where: { id: parseInt(session.user.id) } });
    if (!user || !user.password) return { success: false, error: t('errors.notAuthenticated') };

    const isValid = await bcrypt.compare(current, user.password);
    if (!isValid) return { success: false, error: t('errors.wrongPassword') };

    const hashed = await bcrypt.hash(next, 10);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });

    return { success: true };
  } catch (e) {
    console.error('changePasswordAction error:', e);
    return { success: false, error: t('errors.generic') };
  }
}
