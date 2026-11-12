import prisma from "@/lib/prisma";
import { getServerT } from "@/app/i18n/server";

/**
 * Regras de acesso a projetos de Escopo (SC).
 *
 *  - Ler e salvar versões: dono, admin ou qualquer usuário de Escopo se o
 *    projeto for público (projetos públicos são colaborativos).
 *  - Renomear e excluir: só o dono ou um admin.
 *  - Projeto privado: só o dono ou um admin, para qualquer operação.
 *
 * Toda Server Action que recebe um `projectId` tem que passar por aqui: as
 * actions podem ser chamadas direto por POST, sem passar pela tela.
 */
export type ProjectUser = { id: string | number; isAdmin?: boolean | null };

/** Só os campos públicos do dono — NUNCA o hash da senha. */
export const OWNER_PUBLIC_SELECT = { id: true, name: true, email: true } as const;

export function canReadProject(p: { ownerId: number; isPrivate: boolean }, user: ProjectUser) {
  return !!user.isAdmin || p.ownerId === Number(user.id) || !p.isPrivate;
}

export function canManageProject(p: { ownerId: number }, user: ProjectUser) {
  return !!user.isAdmin || p.ownerId === Number(user.id);
}

/** Lança "não autorizado" se o usuário não pode usar o projeto. */
export async function assertProjectAccess(projectId: number, user: ProjectUser, mode: 'read' | 'manage' = 'read') {
  const id = Number(projectId);
  const project = Number.isInteger(id)
    ? await prisma.project.findUnique({ where: { id }, select: { id: true, ownerId: true, isPrivate: true, deletedAt: true } })
    : null;
  // Projeto excluído (só na tela): ninguém além do admin mexe nele.
  const visible = !!project && (!project.deletedAt || !!user.isAdmin);
  const ok = visible && (mode === 'manage' ? canManageProject(project!, user) : canReadProject(project!, user));
  if (!ok) throw new Error(getServerT()('errors.notAuthorized'));
  return project!;
}
