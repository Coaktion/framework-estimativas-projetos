/**
 * Gestores do Radar: quem comanda a operação do módulo — coletar, reconciliar
 * e definir o dono de cada artefato.
 *
 * Gestor = admin do portal OU e-mail listado em `PSOPS_GESTORES` (separados por
 * vírgula, ponto e vírgula ou espaço; sem diferença de caixa). A lista existe
 * para o responsável pelo Radar não precisar ser admin do Tool Center inteiro.
 *
 * Funções puras, sem sessão nem banco: testadas em services/__tests__.
 */

export function parseGestores(raw: string | null | undefined): Set<string> {
  return new Set(
    String(raw ?? '')
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes('@')),
  );
}

export function ehGestorPor(
  u: { admin: boolean; email: string | null },
  gestores: Set<string>,
): boolean {
  if (u.admin) return true;
  const email = String(u.email ?? '').trim().toLowerCase();
  return Boolean(email) && gestores.has(email);
}
