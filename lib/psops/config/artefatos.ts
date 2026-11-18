/**
 * Os artefatos que o time mantém — cada um com dono, data da última
 * atualização e histórico de atualizações ("commits").
 *
 *   Demo       → os 3 ambientes de demo padrão (Brasil, EUA, SSAC)
 *   Estimativa → um por módulo de estimativa do Tool Center (as categorias
 *                raiz do Framework; módulo novo no Admin entra sozinho)
 *   Escopo     → os 5 documentos de escopo, cada um em PT, EN e ES
 *
 * Chaves estáveis (`DEMO:BR`, `ESTIM:Zendesk Support`, `ESCOPO:PH_SE:PT`): é
 * por elas que o seed acha o que já existe e não duplica.
 */
import type { Impacto } from './taxonomy';

export const DEMOS = [
  { chave: 'DEMO:BR', nome: 'Ambiente de demo padrão Brasil' },
  { chave: 'DEMO:US', nome: 'Ambiente de demo padrão EUA' },
  { chave: 'DEMO:SSAC', nome: 'Ambiente de demo padrão SSAC' },
] as const;

export const DOCUMENTOS_ESCOPO = [
  { id: 'PH_SE', nome: 'Custom SE Pacote de Horas' },
  { id: 'PH_AE', nome: 'Custom AE Pacote de Horas' },
  { id: 'FECHADO', nome: 'Custom Escopo Fechado' },
  { id: 'IAAS', nome: 'IaaS - Hospedagem AWS' },
  { id: 'TM', nome: 'Time & Materials' },
] as const;

export const IDIOMAS_ESCOPO = [
  { id: 'PT', nome: 'Português' },
  { id: 'EN', nome: 'Inglês' },
  { id: 'ES', nome: 'Espanhol' },
] as const;

export const chaveEstimativa = (categoria: string) => `ESTIM:${categoria}`;
export const chaveEscopo = (doc: string, idioma: string) => `ESCOPO:${doc}:${idioma}`;

/** Tipo de artefato que cada destino da triagem atualiza (Estudo não atualiza artefato). */
export const TIPO_POR_IMPACTO: Partial<Record<Impacto, 'DEMO_TEMPLATE' | 'FRAMEWORK' | 'ESCOPO'>> = {
  DEMO: 'DEMO_TEMPLATE',
  ESTIM: 'FRAMEWORK',
  ESCOPO: 'ESCOPO',
};

/** Como a atividade descreve o grupo de artefatos que pode atualizar. */
export const NOME_GRUPO: Partial<Record<Impacto, string>> = {
  DEMO: 'Ambientes de demo (Brasil, EUA, SSAC)',
  ESCOPO: 'Documentos de escopo',
};

/** Artefato do formato atual? (os antigos: DEMO_TEMPLATE, FRAMEWORK:<modulo>, ESCOPO:<modulo>) */
export function ehArtefatoAtual(chave: string): boolean {
  return chave.startsWith('DEMO:') || chave.startsWith('ESTIM:') || /^ESCOPO:[^:]+:[^:]+$/.test(chave);
}

/**
 * Qual módulo de estimativa um produto do Zendesk toca — a SUGESTÃO marcada
 * quando o Arthur conclui uma atividade de Estimativa (ele pode marcar outros).
 * Casa pelo nome da categoria do Framework, para seguir o que existe no Admin.
 */
const CATEGORIA_POR_PRODUTO: Record<string, RegExp> = {
  AI_AGENTS: /ai agents?/i,
  COPILOT: /copilot/i,
  KNOWLEDGE: /knowledge/i,
  CONTACT_CENTER: /voz|voice/i,
  WFM: /wfm|workforce/i,
  QA: /\bqa\b|quality/i,
  ANALYTICS: /analytics|explore/i,
  ADMIN_SEGURANCA: /adpp|privacy|privacidade/i,
  SUPPORT: /zendesk support|^support/i,
  MESSAGING: /zendesk support|^support/i,
};

export function estimativaSugerida<T extends { chave: string; nome: string }>(
  produto: string,
  estimativas: T[],
): T | null {
  const rx = CATEGORIA_POR_PRODUTO[produto] ?? CATEGORIA_POR_PRODUTO.SUPPORT!;
  return estimativas.find((a) => rx.test(a.chave.replace(/^ESTIM:/, '')) || rx.test(a.nome)) ?? null;
}
