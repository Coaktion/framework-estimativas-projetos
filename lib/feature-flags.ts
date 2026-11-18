/**
 * Funcionalidades ligadas fora da produção e ainda desligadas no main.
 *
 * Relatos (bugs e sugestões, /reports) e Changelog (/changelog) ficam no
 * design para teste, mas não aparecem em produção até a liberação. O valor é
 * fixado no BUILD (next.config.js lê o CONTEXT do Netlify): produção = desligado;
 * design, previews e local = ligado.
 *
 * Para liberar em produção, troque LIBERAR_EM_PRODUCAO para true.
 */
const LIBERAR_EM_PRODUCAO = false;

export const relatosEChangelogLigados: boolean =
  LIBERAR_EM_PRODUCAO || process.env.RELATOS_CHANGELOG === '1';

/**
 * Scoping (/scoping): mesmo esquema. Ligado no design, nos previews e no
 * local; desligado em produção até a liberação. Para liberar, troque
 * LIBERAR_SCOPING_EM_PRODUCAO para true.
 */
const LIBERAR_SCOPING_EM_PRODUCAO = false;

export const scopingLigado: boolean =
  LIBERAR_SCOPING_EM_PRODUCAO || process.env.SCOPING === '1';
