/**
 * Consultas de sinais: a fila de triagem e a linha do tempo do Pre-Sales Ops.
 */

import type { PrismaClient, Prisma } from '@prisma/client';
import { IMPACTOS_ORDEM, type Impacto } from '../config/taxonomy';
import { NaoEncontrado } from '../lib/http';
import { resolverResponsaveis } from '../config/responsaveis';
import { NOME_GRUPO, estimativaSugerida } from '../config/artefatos';
import { frentesDe, pendentesDe, type LinhaDecisao } from './decisoes';

export interface FiltroSinais {
  status?: Array<'NOVO' | 'TRIADO' | 'DESCARTADO' | 'AUTO_ARQUIVADO' | 'NAO_CLASSIFICADO'>;
  produto?: string[];
  tipo?: string[];
  /** busca full-text simples em título e trecho original */
  q?: string;
  scoreMin?: number;
  limite?: number;
  cursor?: string;
  /**
   * Fila de quem? Com `usuarioId`, cada item diz o que falta a pessoa decidir
   * e as sugestões que deixaram para ela; `modo: 'minhas'` mostra só o que
   * ainda espera decisão dela (quem não é dono de frente nenhuma vê tudo).
   */
  usuarioId?: string;
  modo?: 'minhas' | 'todas';
}

const selecaoLista = {
  id: true,
  titulo: true,
  resumoPtBr: true,
  trechoOriginal: true,
  tituloPt: true,
  trechoPt: true,
  tituloEs: true,
  trechoEs: true,
  produto: true,
  modulo: true,
  tipo: true,
  planoMinimo: true,
  requerConfiguracao: true,
  requerDev: true,
  afetaPreco: true,
  dataLimite: true,
  score: true,
  impactosSugeridos: true,
  classificadoPor: true,
  motivoRuido: true,
  status: true,
  criadoEm: true,
  decisoes: { select: { impacto: true, donoId: true, decisao: true, sugeridoPor: true } },
  rawItem: {
    select: {
      htmlUrl: true,
      titulo: true,
      criadoEm: true,
      atualizadoEm: true,
      secaoId: true,
      source: { select: { nome: true, isLiveArticle: true } },
    },
  },
} satisfies Prisma.PsOpsSignalSelect;

export async function listarSinais(prisma: PrismaClient, f: FiltroSinais) {
  const where: Prisma.PsOpsSignalWhereInput = {
    ...(f.status?.length ? { status: { in: f.status } } : {}),
    ...(f.produto?.length ? { produto: { in: f.produto as never[] } } : {}),
    ...(f.tipo?.length ? { tipo: { in: f.tipo as never[] } } : {}),
    ...(f.scoreMin !== undefined ? { score: { gte: f.scoreMin } } : {}),
    ...(f.q
      ? {
          OR: [
            { titulo: { contains: f.q, mode: 'insensitive' } },
            { trechoOriginal: { contains: f.q, mode: 'insensitive' } },
            { resumoPtBr: { contains: f.q, mode: 'insensitive' } },
            { tituloPt: { contains: f.q, mode: 'insensitive' } },
            { trechoPt: { contains: f.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const limite = Math.min(f.limite ?? 50, 200);
  const sinais = await prisma.psOpsSignal.findMany({
    where,
    select: selecaoLista,
    orderBy: [{ score: 'desc' }, { criadoEm: 'desc' }, { id: 'asc' }],
    take: limite + 1,
    ...(f.cursor ? { cursor: { id: f.cursor }, skip: 1 } : {}),
  });

  const temMais = sinais.length > limite;
  const pagina = temMais ? sinais.slice(0, limite) : sinais;

  let itens = pagina.map(mapear);
  if (f.usuarioId) {
    const responsaveis = await resolverResponsaveis(prisma);
    const eu = f.usuarioId;
    const souDono = frentesDe(eu, responsaveis).length > 0;
    itens = itens
      .map((s) => {
        const decisoes = (s.decisoes ?? []) as LinhaDecisao[];
        return {
          ...s,
          minhasPendentes: pendentesDe(eu, responsaveis, decisoes),
          sugestoesParaMim: decisoes
            .filter((d) => d.donoId === eu && !d.decisao && d.sugeridoPor)
            .map((d) => ({ impacto: d.impacto, sugeridoPor: d.sugeridoPor as string })),
        };
      })
      .filter((s) => f.modo !== 'minhas' || !souDono || s.minhasPendentes.length > 0);
  }

  return {
    itens,
    proximoCursor: temMais ? (pagina[pagina.length - 1]?.id ?? null) : null,
  };
}

function mapear(s: {
  decisoes?: unknown[];
  rawItem: {
    htmlUrl: string;
    titulo: string;
    criadoEm: Date;
    atualizadoEm?: Date;
    source: { nome: string; isLiveArticle?: boolean };
  };
} & Record<string, unknown>) {
  const { rawItem, ...resto } = s;
  const vivo = Boolean(rawItem.source.isLiveArticle);
  return {
    ...resto,
    /** link direto para a nota completa no Help Center do Zendesk */
    fonteUrl: rawItem.htmlUrl,
    fonteTitulo: rawItem.titulo,
    fonteNome: rawItem.source.nome,
    // Artigo-vivo (lista de EAPs) é o mesmo artigo editado: a novidade foi
    // publicada na edição em que o bloco apareceu, não quando o artigo nasceu.
    publicadoEm: vivo ? (rawItem.atualizadoEm ?? rawItem.criadoEm) : rawItem.criadoEm,
    /** EAP ou beta: vem da lista de EAPs ou foi classificado como EAP/beta */
    eap: vivo || resto.tipo === 'EAP_BETA',
  };
}

/**
 * Detalhe do sinal, com a PRÉVIA do que a triagem vai gerar: quais artefatos
 * serão tocados e quem é o responsável de cada um. Mostrar a consequência
 * antes de clicar é o que substitui campos como prioridade e segmento.
 */
export async function detalharSinal(prisma: PrismaClient, id: string, usuarioId?: string) {
  const s = await prisma.psOpsSignal.findUnique({
    where: { id },
    select: {
      ...selecaoLista,
      assinatura: true,
      ancora: true,
      triage: true,
      initiative: {
        select: {
          id: true,
          titulo: true,
          atividades: {
            select: {
              id: true,
              tipo: true,
              titulo: true,
              status: true,
              responsavelId: true,
              artifact: { select: { id: true, nome: true } },
            },
          },
        },
      },
      studyNote: true,
    },
  });
  if (!s) throw new NaoEncontrado('Sinal');

  // Prévia dos QUATRO destinos, não só dos sugeridos: a tela filtra pelo que
  // a pessoa marcou. Se aqui viessem só os sugeridos, marcar um destino fora
  // da sugestão geraria a atividade sem mostrar antes quem responde por ela.
  // Quem é dono de cada frente e o que cada um já decidiu (ou recebeu de
  // sugestão): a tela mostra "Sua decisão" nas frentes da pessoa e "Sugerir
  // para …" nas dos outros.
  const responsaveis = await resolverResponsaveis(prisma);
  const decisoes = ((s as { decisoes?: LinhaDecisao[] }).decisoes ?? []) as LinhaDecisao[];
  const frentes = IMPACTOS_ORDEM.map((impacto) => ({
    impacto,
    minha: Boolean(usuarioId && (responsaveis[impacto] ?? []).includes(usuarioId)),
    donos: (responsaveis[impacto] ?? []).map((donoId) => {
      const d = decisoes.find((x) => x.impacto === impacto && x.donoId === donoId);
      return { id: donoId, decisao: d?.decisao ?? null, sugeridoPor: d?.sugeridoPor ?? null };
    }),
  }));
  const base = mapear(s as never) as ReturnType<typeof mapear> & { decisoes?: LinhaDecisao[] };
  return {
    ...base,
    ...(usuarioId
      ? {
          minhasPendentes: pendentesDe(usuarioId, responsaveis, decisoes),
          sugestoesParaMim: decisoes
            .filter((d) => d.donoId === usuarioId && !d.decisao && d.sugeridoPor)
            .map((d) => ({ impacto: d.impacto, sugeridoPor: d.sugeridoPor as string })),
        }
      : {}),
    frentes,
    previa: await previaImpactos(prisma, String(s.produto), IMPACTOS_ORDEM),
  };
}

/** Para cada impacto, qual artefato será tocado e quem responde por ele. */
export async function previaImpactos(
  prisma: PrismaClient,
  produto: string,
  impactos: Impacto[],
) {
  const saida: Array<{
    impacto: Impacto;
    artefatoChave: string | null;
    artefatoNome: string;
    responsavelId: string | null;
    /** todos que recebem a atividade — o mesmo critério de triar() */
    responsaveisIds: string[];
    artefatoExiste: boolean;
  }> = [];
  const config = await resolverResponsaveis(prisma);

  for (const impacto of impactos) {
    const configurados = config[impacto] ?? [];
    if (impacto === 'ESTUDO') {
      saida.push({
        impacto,
        artefatoChave: null,
        artefatoNome: 'Ficha da feature (nova)',
        responsavelId: configurados[0] ?? null,
        responsaveisIds: configurados,
        artefatoExiste: false,
      });
      continue;
    }
    // Mesmo critério de triar(): Estimativa sugere o módulo do produto; Demo e
    // Escopo apontam para o grupo, e os artefatos se escolhem na conclusão.
    let art: { chave: string; nome: string; donoId: string | null } | null = null;
    if (impacto === 'ESTIM') {
      const estimativas = await prisma.psOpsArtifact.findMany({
        where: { chave: { startsWith: 'ESTIM:' } },
        select: { chave: true, nome: true, donoId: true },
      });
      art = estimativaSugerida(produto, estimativas);
    }
    const dono = configurados[0] ?? art?.donoId ?? null;
    saida.push({
      impacto,
      artefatoChave: art?.chave ?? null,
      artefatoNome: art?.nome ?? NOME_GRUPO[impacto] ?? 'Estimativa',
      responsavelId: dono,
      responsaveisIds: dono ? [dono] : [],
      artefatoExiste: true,
    });
  }
  return saida;
}

/**
 * Linha do tempo do Pre-Sales Ops: tudo o que a Zendesk publicou, triado ou não,
 * agrupado por semana, com link para a fonte original em cada item.
 */
export async function timeline(
  prisma: PrismaClient,
  args: { semanas?: number; produto?: string[]; q?: string; arquivados?: boolean },
) {
  const semanas = Math.min(args.semanas ?? 6, 26);
  const desde = new Date(Date.now() - semanas * 7 * 86_400_000);

  const sinais = await prisma.psOpsSignal.findMany({
    where: {
      // pela data de publicação no Zendesk, não pela data da coleta
      rawItem: { criadoEm: { gte: desde } },
      ...(args.arquivados ? {} : { status: { not: 'AUTO_ARQUIVADO' } }),
      ...(args.produto?.length ? { produto: { in: args.produto as never[] } } : {}),
      ...(args.q
        ? {
            OR: [
              { titulo: { contains: args.q, mode: 'insensitive' } },
              { trechoOriginal: { contains: args.q, mode: 'insensitive' } },
              { tituloPt: { contains: args.q, mode: 'insensitive' } },
              { trechoPt: { contains: args.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: selecaoLista,
    orderBy: [{ rawItem: { criadoEm: 'desc' } }, { score: 'desc' }],
  });

  const porSemana = new Map<string, { inicio: Date; itens: ReturnType<typeof mapear>[] }>();
  for (const s of sinais) {
    const chave = rotuloSemana(s.rawItem.criadoEm);
    const grupo = porSemana.get(chave) ?? { inicio: inicioSemana(s.rawItem.criadoEm), itens: [] };
    grupo.itens.push(mapear(s as never));
    porSemana.set(chave, grupo);
  }

  const porProduto = new Map<string, number>();
  for (const s of sinais) porProduto.set(s.produto, (porProduto.get(s.produto) ?? 0) + 1);

  return {
    // Array.from em vez de spread: o tsconfig do portal não tem target ES2015+
    semanas: Array.from(porSemana.entries()).map(([semana, g]) => ({ semana, inicio: g.inicio, itens: g.itens })),
    porProduto: Array.from(porProduto.entries())
      .map(([produto, total]) => ({ produto, total }))
      .sort((a, b) => b.total - a.total),
    total: sinais.length,
  };
}

/** Segunda-feira (UTC) da semana da data. */
function inicioSemana(d: Date): Date {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dia = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() - (dia - 1));
  return dt;
}

function rotuloSemana(d: Date): string {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dia = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dia);
  const inicioAno = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((dt.getTime() - inicioAno.getTime()) / 86_400_000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(semana).padStart(2, '0')}`;
}

/** Números do topo da fila de triagem. */
export async function resumoFila(prisma: PrismaClient) {
  const [naFila, alto, arquivados, triadosSemana, ultimoRun] = await Promise.all([
    prisma.psOpsSignal.count({ where: { status: 'NOVO' } }),
    prisma.psOpsSignal.count({ where: { status: 'NOVO', score: { gte: 80 } } }),
    prisma.psOpsSignal.count({ where: { status: 'AUTO_ARQUIVADO' } }),
    prisma.psOpsTriage.count({
      where: { decididoEm: { gte: new Date(Date.now() - 7 * 86_400_000) } },
    }),
    prisma.psOpsIngestRun.findFirst({ orderBy: { iniciadoEm: 'desc' } }),
  ]);

  return { naFila, alto, arquivados, triadosSemana, ultimoRun };
}
