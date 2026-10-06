/**
 * Tipos da API, definidos no cliente (seguro para o browser).
 *
 * De propósito NÃO importam do @prisma/client: o contrato com a API é o que
 * importa aqui, não o shape do banco. `lib/psops/schemas.ts` é o espelho
 * destes tipos no lado do servidor. Rótulos de exibição ficam no i18n do
 * portal (app/i18n/locales/{pt,en}/common.json, bloco "psops").
 */

export type Impacto = 'ESTUDO' | 'DEMO' | 'ESTIM' | 'ESCOPO';

export type SignalTipo =
  | 'GA'
  | 'EAP_BETA'
  | 'DEPRECATION'
  | 'BREAKING_CHANGE'
  | 'PRICING_PACKAGING'
  | 'UX_INTERFACE'
  | 'FIX_MINOR';

export type SignalStatus = 'NOVO' | 'TRIADO' | 'DESCARTADO' | 'AUTO_ARQUIVADO' | 'NAO_CLASSIFICADO';

export type Produto =
  | 'SUPPORT' | 'MESSAGING' | 'CONTACT_CENTER' | 'KNOWLEDGE' | 'AI_AGENTS' | 'COPILOT'
  | 'ANALYTICS' | 'WFM' | 'QA' | 'ADMIN_SEGURANCA' | 'DEVELOPER_API' | 'MARKETPLACE' | 'OUTRO';

export type Modulo =
  | 'SUPPORT' | 'VOICE' | 'KNOWLEDGE' | 'COPILOT' | 'AI_AGENTS'
  | 'ANALYTICS' | 'WFM' | 'QA' | 'INTEGRACOES' | 'OUTRO';

export interface Sinal {
  id: string;
  titulo: string;
  resumoPtBr: string | null;
  trechoOriginal: string;
  /** tradução pt-br publicada pelo Zendesk; null enquanto não sai */
  tituloPt: string | null;
  trechoPt: string | null;
  produto: Produto;
  modulo: Modulo;
  tipo: SignalTipo;
  planoMinimo: string | null;
  requerConfiguracao: boolean;
  requerDev: boolean;
  afetaPreco: boolean;
  dataLimite: string | null;
  score: number;
  impactosSugeridos: Impacto[];
  classificadoPor: string;
  motivoRuido: string | null;
  status: SignalStatus;
  criadoEm: string;
  /** link para a nota completa no Help Center */
  fonteUrl: string;
  fonteTitulo: string;
  fonteNome: string;
  publicadoEm: string;
}

export interface PreviaImpacto {
  impacto: Impacto;
  artefatoChave: string | null;
  artefatoNome: string;
  responsavelId: string | null;
  /** nome e iniciais vindos do User do portal (null = sem dono) */
  responsavelNome: string | null;
  responsavelIniciais: string | null;
  artefatoExiste: boolean;
}

export interface SinalDetalhe extends Sinal {
  previa: PreviaImpacto[];
}

export interface ResumoFila {
  naFila: number;
  alto: number;
  arquivados: number;
  triadosSemana: number;
  ultimoRun: {
    id: string;
    iniciadoEm: string;
    finalizadoEm: string | null;
    ok: boolean;
    itensNovos: number;
    sinaisCriados: number;
    sinaisArquivados: number;
    erro: string | null;
  } | null;
}

export interface RespostaFila {
  itens: Sinal[];
  proximoCursor: string | null;
  resumo: ResumoFila;
}

export interface AtividadeGerada {
  id: string;
  tipo: Impacto;
  titulo: string;
  artefato: string | null;
  responsavelId: string | null;
}

export interface RespostaTriagem {
  initiativeId: string;
  atividades: AtividadeGerada[];
  artefatosCriados: string[];
}

export interface ErroApi {
  erro: string;
  detalhe?: unknown;
}

// ───────────────────────────── Ordem e atalhos ─────────────────────────────

export const IMPACTOS_ORDEM: Impacto[] = ['ESTUDO', 'DEMO', 'ESTIM', 'ESCOPO'];

/** Tecla que alterna cada destino na triagem. */
export const ATALHO_IMPACTO: Record<Impacto, string> = {
  ESTUDO: '1',
  DEMO: '2',
  ESTIM: '3',
  ESCOPO: '4',
};

/** Resposta de POST /ingest/run: 200 traz o resultado; 207 traz { erro, detalhe }. */
export interface ResultadoColeta {
  runId: string;
  porFonte: Array<{ fonte: string; ok: boolean; erro?: string }>;
  totalSinaisCriados: number;
  totalSinaisArquivados: number;
  reclassificacao?: { reclassificados: number; arquivados: number };
  traducao?: { conferidos: number; artigosTraduzidos: number; sinaisTraduzidos: number };
}

/**
 * Título e trecho no idioma do portal. Em português, usa a tradução do
 * Zendesk quando ela existe; senão cai no original e marca como pendente.
 */
export function textoDoSinal(
  s: Pick<Sinal, 'titulo' | 'trechoOriginal' | 'tituloPt' | 'trechoPt'>,
  idioma: string,
): { titulo: string; trecho: string; traduzido: boolean; pendente: boolean } {
  const querPt = idioma === 'pt';
  if (querPt && s.tituloPt) {
    return { titulo: s.tituloPt, trecho: s.trechoPt ?? s.trechoOriginal, traduzido: true, pendente: false };
  }
  return { titulo: s.titulo, trecho: s.trechoOriginal, traduzido: false, pendente: querPt };
}
