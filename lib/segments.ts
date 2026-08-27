/**
 * Segmentos de usuário / User segments.
 *
 * Cada usuário pertence a EXATAMENTE UM segmento. O segmento fica gravado na
 * coluna `User.role` — o nome da coluna foi mantido para não quebrar o código
 * de autorização que já existia.
 *
 * O segmento ADMIN é o que concede privilégio administrativo: `isAdmin` é
 * mantido em sincronia com ele (ver `syncIsAdmin` abaixo), de modo que todas as
 * verificações `session.user.isAdmin` espalhadas pelo app continuam válidas.
 */

export const SEGMENTS = ['ADMIN', 'SC', 'AE', 'PM', 'IMPL'] as const;

export type Segment = (typeof SEGMENTS)[number];

/** Segmento atribuído a quem ainda não tem um definido. */
export const DEFAULT_SEGMENT: Segment = 'IMPL';

/** Chave de tradução do rótulo de cada segmento. */
export const SEGMENT_LABEL_KEYS: Record<Segment, string> = {
  ADMIN: 'segment.admin',
  SC: 'segment.salesEngineer',
  AE: 'segment.accountExecutive',
  PM: 'segment.projectManager',
  IMPL: 'segment.implementation',
};

/** Sigla curta, usada em crachás e tabelas compactas. */
export const SEGMENT_SHORT: Record<Segment, string> = {
  ADMIN: 'ADMIN',
  SC: 'SC',
  AE: 'AE',
  PM: 'PM',
  IMPL: 'IMPL',
};

/**
 * Valores antigos da coluna `role` que ainda podem existir no banco.
 * Ajuste este mapa se a sua base usar outros códigos.
 */
const LEGACY_SEGMENT_MAP: Record<string, Segment> = {
  ADMIN: 'ADMIN',
  SC: 'SC',
  AE: 'AE',
  PM: 'PM',
  IMPL: 'IMPL',
  // ---- valores legados
  CONSULTING: 'AE',          // "AE (Consulting)" na UI antiga
  DEV: 'IMPL',               // "Desenvolvimento"
  DESENVOLVIMENTO: 'IMPL',
  IMPLANTACAO: 'IMPL',
  'IMPLANTAÇÃO': 'IMPL',
  GP: 'PM',                  // "Gerente de Projeto"
  USER: DEFAULT_SEGMENT,     // papel genérico antigo
  MEMBER: DEFAULT_SEGMENT,
};

/** Converte qualquer valor vindo do banco/sessão num segmento válido. */
export function normalizeSegment(value?: string | null): Segment {
  if (!value) return DEFAULT_SEGMENT;
  const upper = String(value).trim().toUpperCase();
  return LEGACY_SEGMENT_MAP[upper] ?? DEFAULT_SEGMENT;
}

export function isSegment(value?: string | null): value is Segment {
  return (SEGMENTS as readonly string[]).includes(String(value).toUpperCase());
}

/**
 * `isAdmin` é derivado do segmento — um único lugar decide quem é administrador.
 * Usuários já existentes com isAdmin=true são preservados na migração
 * (ver o script em prisma/migrate-segments.ts).
 */
export function syncIsAdmin(segment: Segment): boolean {
  return segment === 'ADMIN';
}

/** Somente administradores podem alterar o segmento de um usuário. */
export function canManageSegments(user?: { isAdmin?: boolean; role?: string | null } | null): boolean {
  if (!user) return false;
  return Boolean(user.isAdmin) || normalizeSegment(user.role) === 'ADMIN';
}

/* -------------------------------------------------------------------------- */
/*                      MATRIZ DE ACESSO POR SEGMENTO                         */
/*                                                                            */
/* Edite as duas listas abaixo para mudar quem vê o quê. É o único lugar que   */
/* decide isso — Navbar, home e os guards de página/action leem daqui.         */
/*                                                                            */
/*   Segmento | Projetos/Escopo | Calculadora AE | Admin                       */
/*   ---------|-----------------|----------------|-------                      */
/*   ADMIN    |       sim       |      sim       |  sim                        */
/*   SC       |       sim       |      sim       |  não                        */
/*   AE       |       não       |      sim       |  não                        */
/*   PM       |       sim       |      sim       |  não                        */
/*   IMPL     |       sim       |      não       |  não                        */
/*                                                                            */
/* Antes desta mudança o acesso era: Escopo = SC ou admin; AE = AE, SC ou      */
/* admin. PM e IMPL são novos, então a linha deles é uma proposta — ajuste se  */
/* não corresponder ao fluxo do time.                                         */
/* -------------------------------------------------------------------------- */

const SCOPE_SEGMENTS: readonly Segment[] = ['ADMIN', 'SC', 'PM', 'IMPL'];
const AE_SEGMENTS: readonly Segment[] = ['ADMIN', 'SC', 'AE', 'PM'];

/** Quem enxerga a área de Projetos / Escopo. */
export function canAccessScopes(user?: { isAdmin?: boolean; role?: string | null } | null): boolean {
  if (!user) return false;
  return Boolean(user.isAdmin) || SCOPE_SEGMENTS.includes(normalizeSegment(user.role));
}

/** Quem enxerga a Calculadora AE e o histórico. */
export function canAccessAE(user?: { isAdmin?: boolean; role?: string | null } | null): boolean {
  if (!user) return false;
  return Boolean(user.isAdmin) || AE_SEGMENTS.includes(normalizeSegment(user.role));
}
