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
  /** tradução em espanhol publicada pelo Zendesk */
  tituloEs?: string | null;
  trechoEs?: string | null;
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
  /** EAP ou beta (lista de EAPs do Zendesk ou classificado como EAP/beta) */
  eap: boolean;
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
  /** todos que vão receber a atividade (Estudo: os SEs; os outros: um só) */
  responsaveis?: Array<{ id: string; nome: string; iniciais: string }>;
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
  reconstrucao?: { artigos: number; sinaisRemovidos: number; sinaisCriados: number; sinaisArquivados: number };
  reclassificacao?: { reclassificados: number; arquivados: number };
  traducao?: { conferidos: number; artigosTraduzidos: number; sinaisTraduzidos: number };
}

/**
 * Título e trecho no idioma do portal. Em português, usa a tradução do
 * Zendesk quando ela existe; senão cai no original e marca como pendente.
 */
export function textoDoSinal(
  s: Pick<Sinal, 'titulo' | 'trechoOriginal' | 'tituloPt' | 'trechoPt' | 'tituloEs' | 'trechoEs'>,
  idioma: string,
): { titulo: string; trecho: string; traduzido: boolean; pendente: boolean } {
  if (idioma === 'pt' && s.tituloPt) {
    return { titulo: s.tituloPt, trecho: s.trechoPt ?? s.trechoOriginal, traduzido: true, pendente: false };
  }
  if (idioma === 'es' && s.tituloEs) {
    return { titulo: s.tituloEs, trecho: s.trechoEs ?? s.trechoOriginal, traduzido: true, pendente: false };
  }
  return { titulo: s.titulo, trecho: s.trechoOriginal, traduzido: false, pendente: idioma === 'pt' || idioma === 'es' };
}

/**
 * Abas por módulo do Zendesk, na ordem do nosso negócio (AI Agents e Copilot
 * primeiro). "Outros" junta o que não é módulo nosso (Marketplace, sem
 * produto). A aba só aparece quando tem sinal.
 */
export const ABAS_MODULO: ReadonlyArray<{ id: string; produtos: Produto[] }> = [
  { id: 'AI_AGENTS', produtos: ['AI_AGENTS'] },
  { id: 'COPILOT', produtos: ['COPILOT'] },
  { id: 'SUPPORT', produtos: ['SUPPORT'] },
  { id: 'MESSAGING', produtos: ['MESSAGING'] },
  { id: 'KNOWLEDGE', produtos: ['KNOWLEDGE'] },
  { id: 'CONTACT_CENTER', produtos: ['CONTACT_CENTER'] },
  { id: 'WFM', produtos: ['WFM'] },
  { id: 'QA', produtos: ['QA'] },
  { id: 'ANALYTICS', produtos: ['ANALYTICS'] },
  { id: 'ADMIN_SEGURANCA', produtos: ['ADMIN_SEGURANCA'] },
  { id: 'OUTROS', produtos: ['MARKETPLACE', 'OUTRO', 'DEVELOPER_API'] },
];

export function abaDoProduto(produto: Produto): string {
  return ABAS_MODULO.find((a) => a.produtos.includes(produto))?.id ?? 'OUTROS';
}

/** Aba da fila de triagem: EAPs e betas têm a sua; o resto vai pelo módulo. */
export const ABA_EAP = 'EAP';
export function abaDoSinal(s: { produto: Produto; eap?: boolean }): string {
  return s.eap ? ABA_EAP : abaDoProduto(s.produto);
}

/** Ordem da fila de triagem. */
export type OrdemFila = 'relevancia' | 'data';
export function ordenarFila<T extends { score: number; publicadoEm: string; criadoEm: string }>(
  itens: T[],
  ordem: OrdemFila,
): T[] {
  if (ordem === 'relevancia') return itens;
  const t = (x: T) => new Date(x.publicadoEm || x.criadoEm).getTime() || 0;
  return [...itens].sort((a, b) => t(b) - t(a) || b.score - a.score);
}

/**
 * "Release notes through 2026-10-23" → "23/10". Os sinais de uma mesma nota
 * de versão carregam o mesmo título de artigo; a data é o que os distingue.
 */
export function dataDaNota(fonteTitulo: string | null | undefined): string | null {
  const m = String(fonteTitulo ?? '').match(/(\d{4})-(\d{2})-(\d{2})/);
  return m && /release notes|notas de vers/i.test(String(fonteTitulo)) ? `${m[3]}/${m[2]}` : null;
}

/**
 * Link da nota no idioma do portal (espanhol em es; nos demais, SEMPRE português): a versão pt-br do mesmo artigo
 * (/hc/pt-br/articles/:id). O slug em inglês sai — o Help Center redireciona
 * para o slug do idioma; sem tradução publicada, ele mostra o original.
 */
export function urlDaNota(url: string, idioma?: string): string {
  // portal em espanhol: a nota em espanhol; nos demais idiomas, pt-br
  const locale = idioma === 'es' ? 'es' : 'pt-br';
  return url.replace(/\/hc\/[a-z]{2}(-[a-z]{2})?\/articles\/(\d+)[^?#]*/i, `/hc/${locale}/articles/$2`);
}

// ─────────────────────────────── Backlog ────────────────────────────────────

export type AtividadeStatus = 'TODO' | 'DOING' | 'DONE' | 'CANCELADA';

export interface DodItem {
  t: string;
  d: boolean;
  exigeEvidencia?: boolean;
  evidencia?: string | null;
}

/** SKILL: atualizar a skill de escopo depois de um commit num documento de estimativa (não vem da triagem). */
export type TipoAtividade = Impacto | 'SKILL';

export interface Atividade {
  id: string;
  tipo: TipoAtividade;
  titulo: string;
  status: AtividadeStatus;
  responsavelId: string | null;
  responsavelNome: string | null;
  responsavelIniciais: string | null;
  dod: DodItem[];
  progresso: { feitos: number; total: number };
  pendencias: { faltamCheck: number; faltamEvidencia: number };
  concluidoEm: string | null;
  artifact: { id: string; nome: string; chave: string; tipo: string } | null;
  initiative: {
    id: string;
    titulo: string;
    ciclo: string;
    signal: {
      id: string;
      titulo: string;
      tituloPt: string | null;
      trechoOriginal: string;
      trechoPt: string | null;
      tituloEs?: string | null;
      trechoEs?: string | null;
      tipo: SignalTipo;
      produto: Produto;
      score: number;
    };
  };
  studyNote: { id: string; publicadoEm: string | null } | null;
  fonteUrl: string;
}

export interface RespostaBacklog {
  itens: Atividade[];
  contagens: Array<{ responsavelId: string | null; total: number; nome: string | null }>;
}

export interface Pessoa {
  id: string;
  nome: string;
  iniciais: string;
}

export interface RespostaPessoas {
  itens: Pessoa[];
  euId: string;
}

export interface FichaEstudo {
  id: string;
  oQueE: string | null;
  comoFunciona: string | null;
  preRequisitos: string | null;
  limitacoes: string | null;
  planoNecessario: string | null;
  linksConsultados: string[];
  testadoEmSandbox: boolean;
  motivoNaoTestado: string | null;
  publicadoEm: string | null;
  versao: number;
}

// ─────────────────────────── Mapa de Artefatos ──────────────────────────────

export type EstadoSaude = 'SAUDAVEL' | 'ATENCAO' | 'CRITICO' | 'DIVERGENTE' | 'NAO_VERIFICADO';
export type ArtefatoTipo = 'DEMO_TEMPLATE' | 'FRAMEWORK' | 'ESCOPO';

export interface Artefato {
  id: string;
  chave: string;
  tipo: ArtefatoTipo;
  modulo: Modulo | null;
  nome: string;
  donoId: string | null;
  donoNome: string | null;
  donoIniciais: string | null;
  versao: string;
  revisaoDeclaradaEm: string | null;
  revisaoVerificadaEm: string | null;
  fonteVerificacao: 'PORTAL' | 'GDRIVE' | 'ZENDESK_ADMIN' | 'NENHUMA';
  pendentes: number;
  aplicacoesTotal: number;
  /** data do commit mais recente */
  ultimaAtualizacao: string | null;
  atualizacoesTotal: number;
  ultimoCommit: { autorId: string; autorNome: string | null; descricao: string; criadoEm: string } | null;
  saude: { estado: EstadoSaude; detalhe: string; idadeDias: number | null };
}

/** Um commit no artefato. */
export interface AtualizacaoArtefato {
  id: string;
  criadoEm: string;
  autorId: string;
  autorNome: string | null;
  autorIniciais: string;
  descricao: string;
  activityId: string | null;
  sinal: { id: string; titulo: string; fonteUrl: string } | null;
}

export interface HistoricoArtefato {
  artefato: { id: string; nome: string; donoId: string | null; versao: string };
  donoNome: string | null;
  atualizacoes: AtualizacaoArtefato[];
}

export const ARTEFATO_TIPOS_ORDEM: ArtefatoTipo[] = ['DEMO_TEMPLATE', 'FRAMEWORK', 'ESCOPO'];

/** Que tipo de artefato cada destino atualiza (Estudo não atualiza artefato). */
export const TIPO_ARTEFATO_DO_IMPACTO: Record<Impacto, ArtefatoTipo | null> = {
  ESTUDO: null,
  DEMO: 'DEMO_TEMPLATE',
  ESTIM: 'FRAMEWORK',
  ESCOPO: 'ESCOPO',
};

// ───────────────────────────── Linha do tempo ───────────────────────────────

export interface RespostaTimeline {
  semanas: Array<{ semana: string; inicio: string; itens: Sinal[] }>;
  porProduto: Array<{ produto: Produto; total: number }>;
  total: number;
}
