/**
 * Domínios de e-mail que podem entrar no Tool Center (login com Google).
 * Para liberar outro domínio, acrescente aqui — vale para o login, para a
 * criação de usuários no Admin e para o seed. Sem dependências: é usado também
 * em componentes de cliente (textos da tela de login e do perfil).
 */
export const SSO_DOMAINS = ['aktienow.com', 'coaktion.com'] as const;

/** Domínio do e-mail, em minúsculas ('' se não houver). */
export function emailDomain(email: string): string {
  const at = String(email || '').trim().toLowerCase().lastIndexOf('@');
  return at >= 0 ? String(email).trim().toLowerCase().slice(at + 1) : '';
}

/** O e-mail é de um domínio liberado? */
export function isAllowedEmail(email: string): boolean {
  return (SSO_DOMAINS as readonly string[]).includes(emailDomain(email));
}

/** "@aktienow.com ou @coaktion.com" — para mensagens. */
export function ssoDomainsLabel(joiner = ' / '): string {
  return SSO_DOMAINS.map((d) => `@${d}`).join(joiner);
}
