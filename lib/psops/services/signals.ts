/**
 * Consultas de sinais: a fila de triagem e a linha do tempo do Pre-Sales Ops.
 */

import type { PrismaClient, Prisma } from '@prisma/client';
import { chaveArtefato, IMPACTOS_ORDEM, MODULO_LABEL, type Impacto, type Modulo } from '../config/taxonomy';
import { NaoEncontrado } from '../lib/http';

export interface FiltroSinais {
  status?: Array<'NOVO' | 'TRIADO' | 'DESCARTADO' | 'AUTO_ARQUIVADO' | 'NAO_CLASSIFICADO'>;
  produto?: string[];
  tipo?: string[];
  /** busca full-text simples em título e trecho original */
  q?: string;
  scoreMin?: number;
  limite?: number;
  cursor?: string;
}

const selecaoLista = {
  id: true,
  titulo: true,
  resumoPtBr: true,
  trechoOriginal: true,
  tituloPt: true,
  trechoPt: true,
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
  rawItem: {
    select: { htmlUrl: true, titulo: true, criadoEm: true, secaoId: true, source: { select: { nome: true } } },
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

  return {
    itens: pagina.map(mapear),
    proximoCursor: temMais ? (pagina[pagina.length - 1]?.id ?? null) : null,
  };
}

function mapear(s: {
  rawItem: { htmlUrl: string; titulo: string; criadoEm: Date; source: { nome: string } };
} & Record<string, unknown>) {
  const { rawItem, ...resto } = s;
  return {
    ...resto,
    /** link direto para a nota completa no Help Center do Zendesk */
    fonteUrl: rawItem.htmlUrl,
    fonteTitulo: rawItem.titulo,
    fonteNome: rawItem.source.nome,
    publicadoEm: rawItem.criadoEm,
  };
}

/**
 * Detalhe do sinal, com a PRÉVIA do que a triagem vai gerar: quais artefatos
 * serão tocados e quem é o responsável de cada um. Mostrar a consequência
 * antes de clicar é o que substitui campos como prioridade e segmento.
 */
export async function detalharSinal(prisma: PrismaClient, id: string) {
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
  return { ...mapear(s as never), previa: await previaImpactos(prisma, s.modulo as Modulo, IMPACTOS_ORDEM) };
}

/** Para cada impacto, qual artefato será tocado e quem responde por ele. */
export async function previaImpactos(
  prisma: PrismaClient,
  modulo: Modulo,
  impactos: Impacto[],
) {
  const saida: Array<{
    impacto: Impacto;
    artefatoChave: string | null;
    artefatoNome: string;
    responsavelId: string | null;
    artefatoExiste: boolean;
  }> = [];

  for (const impacto of impactos) {
    const chave = chaveArtefato(impacto, modulo);
    if (!chave) {
      saida.push({
        impacto,
        artefatoChave: null,
        artefatoNome: `Ficha da feature (nova)`,
        responsavelId: null,
        artefatoExiste: false,
      });
      continue;
    }
    const art = await prisma.psOpsArtifact.findUnique({
      where: { chave },
      select: { nome: true, donoId: true },
    });
    saida.push({
      impacto,
      artefatoChave: chave,
      artefatoNome:
        art?.nome ??
        (chave === 'DEMO_TEMPLATE'
          ? 'Template de demo · zd_auto_template'
          : `${chave.startsWith('FRAMEWORK') ? 'Framework' : 'Bloco escopo'} · ${MODULO_LABEL[modulo]}`),
      responsavelId: art?.donoId ?? null,
      artefatoExiste: Boolean(art),
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
