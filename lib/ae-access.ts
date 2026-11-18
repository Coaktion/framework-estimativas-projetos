import { normalizeSegment, roleValuesOf } from '@/lib/segments';

/**
 * Quem vê quais estimativas da Calculadora AE.
 *
 *  - ADMIN: todas.
 *  - SC (Sales Engineer): as próprias + as criadas por usuários do segmento
 *    AE — é quem pega a estimativa do AE para desenhar o escopo.
 *  - Demais: só as próprias.
 *
 * Ver ≠ alterar: excluir continua só para o autor ou um admin.
 * Usado no histórico, na página da estimativa, no "Nova versão" (cloneFrom)
 * e em "Gerar estimativa a partir desta".
 */
export type AEViewer = { id: string | number; isAdmin?: boolean | null; role?: string | null };

/** Alcance do usuário: 'all' (admin), 'ae' (SC: próprias + dos AEs) ou 'own'. */
export function aeReach(user: AEViewer): 'all' | 'ae' | 'own' {
  if (user.isAdmin || normalizeSegment(user.role) === 'ADMIN') return 'all';
  if (normalizeSegment(user.role) === 'SC') return 'ae';
  return 'own';
}

/** O usuário enxerga estimativas de outras pessoas (mostra o filtro Meus/Todos e o autor). */
export function aeSeesOthers(user: AEViewer): boolean {
  return aeReach(user) !== 'own';
}

/** Filtro de autor (where do Prisma) para as estimativas visíveis. */
export function aeVisibleWhere(user: AEViewer, scope: 'mine' | 'all' = 'all'): Record<string, unknown> {
  const me = Number(user.id);
  const reach = aeReach(user);
  if (scope === 'mine' || reach === 'own') return { createdBy: me };
  if (reach === 'all') return {};
  // SC: as próprias ou as de quem é do segmento AE (inclui valores legados do role).
  return {
    OR: [
      { createdBy: me },
      { creator: { OR: roleValuesOf('AE').map((r) => ({ role: { equals: r, mode: 'insensitive' } })) } },
    ],
  };
}

/** Pode abrir esta estimativa? `creatorRole` = role de quem a criou. */
export function canViewAEEstimate(
  user: AEViewer,
  estimate: { createdBy: number; deletedAt?: Date | string | null },
  creatorRole?: string | null,
): boolean {
  const reach = aeReach(user);
  if (reach === 'all') return true; // admin vê até as excluídas (com aviso)
  if (estimate.deletedAt) return false;
  if (Number(estimate.createdBy) === Number(user.id)) return true;
  return reach === 'ae' && normalizeSegment(creatorRole) === 'AE';
}
