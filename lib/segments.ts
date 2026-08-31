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

export const SEGMENTS = [
  'ADMIN',
  'SC',
  'AE',
  'PM',
  'IMPL',
  'SALES_OPS',
  'CS',
  'DEV',
] as const;

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
  SALES_OPS: 'segment.salesOps',
  CS: 'segment.customerSuccess',
  DEV: 'segment.developer',
};

/** Sigla curta, usada em crachás e tabelas compactas. */
export const SEGMENT_SHORT: Record<Segment, string> = {
  ADMIN: 'ADMIN',
  SC: 'SC',
  AE: 'AE',
  PM: 'PM',
  IMPL: 'IMPL',
  SALES_OPS: 'S.OPS',
  CS: 'CS',
  DEV: 'DEV',
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
  SALES_OPS: 'SALES_OPS',
  CS: 'CS',
  DEV: 'DEV',
  // ---- valores legados
  CONSULTING: 'AE',          // "AE (Consulting)" na UI antiga
  // DEV/DESENVOLVIMENTO caíam em IMPL enquanto não existia um segmento próprio.
  // Agora existe: "Developer" é o destino correto para os dois.
  DESENVOLVIMENTO: 'DEV',
  IMPLANTACAO: 'IMPL',
  'IMPLANTAÇÃO': 'IMPL',
  GP: 'PM',                  // "Gerente de Projeto"
  // ---- grafias alternativas dos segmentos novos
  SALESOPS: 'SALES_OPS',
  'SALES OPS': 'SALES_OPS',
  OPS: 'SALES_OPS',
  CUSTOMER_SUCCESS: 'CS',
  CUSTOMERSUCCESS: 'CS',
  'CUSTOMER SUCCESS': 'CS',
  DEVELOPER: 'DEV',
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
/*   Segmento  | Projetos/Escopo | Calculadora AE | Admin | Relatório Exec.    */
/*   ----------|-----------------|----------------|-------|-----------------   */
/*   ADMIN     |       sim       |      sim       |  sim  |      sim           */
/*   SC        |       sim       |      sim       |  não  |      não           */
/*   AE        |       não       |      sim       |  não  |      não           */
/*   PM        |       sim       |      sim       |  não  |      não           */
/*   IMPL      |       sim       |      não       |  não  |      não           */
/*   SALES_OPS |       sim       |      sim       |  não  |      não           */
/*   CS        |       sim       |      sim       |  não  |      não           */
/*   DEV       |       sim       |      não       |  não  |      não           */
/*                                                                            */
/* Antes desta mudança o acesso era: Escopo = SC ou admin; AE = AE, SC ou      */
/* admin. PM e IMPL são novos, então a linha deles é uma proposta — ajuste se  */
/* não corresponder ao fluxo do time.                                         */
/*                                                                            */
/* SALES_OPS e CS entraram espelhando a linha do PM (apoiam o ciclo comercial  */
/* e precisam ver estimativas e escopos); DEV entrou espelhando IMPL (consome  */
/* o escopo técnico, mas não dimensiona pré-venda). Ambas são propostas.       */
/* -------------------------------------------------------------------------- */

const SCOPE_SEGMENTS: readonly Segment[] = [
  'ADMIN', 'SC', 'PM', 'IMPL', 'SALES_OPS', 'CS', 'DEV',
];
const AE_SEGMENTS: readonly Segment[] = [
  'ADMIN', 'SC', 'AE', 'PM', 'SALES_OPS', 'CS',
];

/**
 * Quem vê a tabela de resultado da Calculadora AE em versão REDUZIDA (só a
 * lista de itens, sem quantidade nem horas).
 *
 * Fica isolado aqui porque é uma decisão de produto, não uma consequência do
 * segmento: hoje só o Account Executive tem a visão simplificada. Se Sales Ops
 * ou Customer Success também devem tê-la, basta acrescentar aqui.
 */
const SIMPLIFIED_AE_TABLE_SEGMENTS: readonly Segment[] = ['AE'];

/** A tabela de resultado deve esconder quantidades e horas deste leitor? */
export function usesSimplifiedAETable(
  user?: { role?: string | null } | null,
): boolean {
  return SIMPLIFIED_AE_TABLE_SEGMENTS.includes(normalizeSegment(user?.role));
}

/**
 * Quem vê o "Relatório Executivo" completo (o markdown longo abaixo da tabela).
 *
 * Restrito a administradores: o relatório expõe a mecânica de cálculo item por
 * item, incluindo as bases percentuais, e isso não deve circular fora do time
 * que mantém o framework. Os demais segmentos ficam com a tabela de resultado.
 */
export function canViewExecutiveReport(
  user?: { isAdmin?: boolean; role?: string | null } | null,
): boolean {
  if (!user) return false;
  return Boolean(user.isAdmin) || normalizeSegment(user.role) === 'ADMIN';
}

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
