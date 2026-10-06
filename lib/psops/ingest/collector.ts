/**
 * Camada 1 — coletor.
 *
 * Roda uma vez por dia (07:00 BRT). Para cada fonte ativa:
 *   1. busca o que é mais novo que a marca d'água
 *   2. grava o payload cru, sem transformação, em PsOpsRawItem
 *   3. quebra em sinais atômicos, filtra ruído e classifica
 *   4. avança a marca d'água e registra o run
 *
 * Propriedades garantidas:
 *   · idempotente — rodar duas vezes no mesmo dia não duplica nada
 *   · falha isolada — uma fonte quebrada não impede as outras
 *   · a camada crua é imutável, então mudar a taxonomia permite reprocessar
 *     o histórico sem rebuscar na Zendesk
 */

import type { PrismaClient } from '@prisma/client';
import { hashConteudo } from '../lib/hash';
import type { ClienteHc } from '../zendesk/client';
import type { HcArticle } from '../zendesk/types';
import { parseArtigoEap, blocosNovos, type SinalBruto } from './parser';
import { brutosDoArtigo } from './artigo';
import { avaliarEscopo, avaliarRuido, decidirArquivamento } from './noise';
import { classificadorPadrao, type Classificador } from './classify';
import {
  reclassificarFila,
  traduzirPendentes,
  type ResultadoReclassificacao,
  type ResultadoTraducao,
} from './manutencao';

export interface ResultadoColeta {
  runId: string;
  porFonte: Array<{
    fonte: string;
    ok: boolean;
    itensNovos: number;
    sinaisCriados: number;
    sinaisArquivados: number;
    erro?: string;
  }>;
  totalSinaisCriados: number;
  totalSinaisArquivados: number;
  /** sinais da fila reprocessados porque as regras mudaram */
  reclassificacao: ResultadoReclassificacao;
  /** títulos e trechos em português vindos da tradução do Zendesk */
  traducao: ResultadoTraducao;
}

export interface DepsColeta {
  prisma: PrismaClient;
  hc: ClienteHc;
  classificador?: Classificador;
  /** injetável em teste para tornar o resultado determinístico */
  agora?: () => Date;
  /**
   * Janela da PRIMEIRA coleta de uma fonte (sem marca d'água): só entram
   * artigos dos últimos N dias. Sem isso, a primeira coleta varreria meses de
   * release notes — centenas de sinais velhos na fila e risco de estourar o
   * limite de 60 s da função no Netlify. Padrão: 14 dias.
   */
  primeiraColetaDias?: number;
  /**
   * Orçamento de tempo, em ms, para a etapa de tradução (a última). A rota no
   * Netlify tem 60 s; a tradução para antes de estourar e continua na próxima.
   */
  orcamentoMs?: number;
}

export const PRIMEIRA_COLETA_DIAS_PADRAO = 14;

/** "2026-W33" — usado como ciclo semanal na iniciativa. */
export function semanaIso(d: Date): string {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dia = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dia);
  const inicioAno = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((dt.getTime() - inicioAno.getTime()) / 86_400_000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(semana).padStart(2, '0')}`;
}

export async function coletar(deps: DepsColeta): Promise<ResultadoColeta> {
  const { prisma, hc } = deps;
  const classificador = deps.classificador ?? classificadorPadrao;
  const agora = deps.agora ?? (() => new Date());
  const primeiraColetaDias = deps.primeiraColetaDias ?? PRIMEIRA_COLETA_DIAS_PADRAO;
  const inicio = Date.now();

  // 1. Regras mudaram? Reprocessa o que ainda está na fila antes de coletar.
  let reclassificacao: ResultadoReclassificacao = { reclassificados: 0, arquivados: 0 };
  try {
    reclassificacao = await reclassificarFila(prisma, classificador);
  } catch (e) {
    console.error('[psops] reclassificação falhou:', e instanceof Error ? e.message : e);
  }

  const run = await prisma.psOpsIngestRun.create({ data: { iniciadoEm: agora() } });
  const fontes = await prisma.psOpsSource.findMany({ where: { ativo: true } });

  const porFonte: ResultadoColeta['porFonte'] = [];
  let totalCriados = 0;
  let totalArquivados = 0;

  // 2. Coleta, fonte a fonte: falha numa não impede as outras.
  for (const fonte of fontes) {
    try {
      const r = fonte.isLiveArticle
        ? await processarArtigoVivo({ prisma, hc, classificador, fonte, agora, primeiraColetaDias })
        : await processarLista({ prisma, hc, classificador, fonte, agora, primeiraColetaDias });

      totalCriados += r.sinaisCriados;
      totalArquivados += r.sinaisArquivados;
      porFonte.push({ fonte: fonte.key, ok: true, ...r });

      await prisma.psOpsSource.update({
        where: { id: fonte.id },
        data: {
          ultimoRunEm: agora(),
          ultimoRunOk: true,
          ultimoRunErro: null,
          ...(r.novaWatermark ? { watermark: r.novaWatermark } : {}),
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[psops] fonte ${fonte.key} falhou:`, msg);
      porFonte.push({
        fonte: fonte.key,
        ok: false,
        itensNovos: 0,
        sinaisCriados: 0,
        sinaisArquivados: 0,
        erro: msg,
      });
      await prisma.psOpsSource.update({
        where: { id: fonte.id },
        data: { ultimoRunEm: agora(), ultimoRunOk: false, ultimoRunErro: msg.slice(0, 500) },
      });
    }
  }

  // 3. Tradução pt-br do Zendesk para o que já está no banco (inclusive o que
  // acabou de chegar). Falha aqui nunca derruba a coleta.
  let traducao: ResultadoTraducao = { conferidos: 0, artigosTraduzidos: 0, sinaisTraduzidos: 0, estruturaDiferente: 0 };
  try {
    traducao = await traduzirPendentes(prisma, hc, {
      agora,
      ate: inicio + (deps.orcamentoMs ?? 40_000),
    });
  } catch (e) {
    console.error('[psops] tradução falhou:', e instanceof Error ? e.message : e);
  }

  await prisma.psOpsIngestRun.update({
    where: { id: run.id },
    data: {
      finalizadoEm: agora(),
      ok: porFonte.every((f) => f.ok),
      itensNovos: porFonte.reduce((s, f) => s + f.itensNovos, 0),
      sinaisCriados: totalCriados,
      sinaisArquivados: totalArquivados,
      erro: porFonte.filter((f) => !f.ok).map((f) => `${f.fonte}: ${f.erro}`).join(' | ') || null,
    },
  });

  return {
    runId: run.id,
    porFonte,
    totalSinaisCriados: totalCriados,
    totalSinaisArquivados: totalArquivados,
    reclassificacao,
    traducao,
  };
}

// ──────────────────────── Fontes de lista (categoria / seção) ───────────────

type Ctx = {
  prisma: PrismaClient;
  hc: ClienteHc;
  classificador: Classificador;
  fonte: {
    id: string;
    key: string;
    nome: string;
    kind: string;
    zendeskId: string;
    locale: string;
    watermark: Date | null;
  };
  agora: () => Date;
  primeiraColetaDias: number;
};

async function processarLista(ctx: Ctx) {
  const { prisma, hc, fonte } = ctx;

  // Com marca d'água, ela é o corte. Sem (primeira coleta), a janela de dias.
  const corte =
    fonte.watermark ?? new Date(ctx.agora().getTime() - ctx.primeiraColetaDias * 86_400_000);

  const artigos = await hc.listarArtigos({
    kind: fonte.kind === 'CATEGORY' ? 'CATEGORY' : 'SECTION',
    zendeskId: fonte.zendeskId,
    locale: fonte.locale,
    pararEm: corte,
  });

  // ordem crescente: a marca d'água avança de forma consistente mesmo se o
  // processamento parar no meio
  const novos = artigos
    .filter((a) => new Date(a.created_at) > corte)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  let sinaisCriados = 0;
  let sinaisArquivados = 0;
  let novaWatermark: Date | null = fonte.watermark;

  for (const artigo of novos) {
    const r = await processarArtigo(ctx, artigo);
    sinaisCriados += r.criados;
    sinaisArquivados += r.arquivados;
    const criadoEm = new Date(artigo.created_at);
    if (!novaWatermark || criadoEm > novaWatermark) novaWatermark = criadoEm;
  }

  return { itensNovos: novos.length, sinaisCriados, sinaisArquivados, novaWatermark };
}

async function processarArtigo(ctx: Ctx, artigo: HcArticle) {
  const { prisma, fonte, classificador } = ctx;
  const bodyHash = hashConteudo(artigo.body ?? '');

  // (sourceId, externalId, bodyHash) único: reexecução não duplica, e edição
  // do artigo cria um novo RawItem preservando o anterior.
  const existente = await prisma.psOpsRawItem.findUnique({
    where: {
      sourceId_externalId_bodyHash: {
        sourceId: fonte.id,
        externalId: String(artigo.id),
        bodyHash,
      },
    },
  });
  if (existente) return { criados: 0, arquivados: 0 };

  const rawItem = await prisma.psOpsRawItem.create({
    data: {
      sourceId: fonte.id,
      externalId: String(artigo.id),
      titulo: artigo.title,
      htmlUrl: artigo.html_url,
      secaoId: artigo.section_id ? String(artigo.section_id) : null,
      criadoEm: new Date(artigo.created_at),
      atualizadoEm: new Date(artigo.updated_at),
      editadoEm: artigo.edited_at ? new Date(artigo.edited_at) : null,
      labels: artigo.label_names ?? [],
      bodyHash,
      payload: artigo as unknown as object,
    },
  });

  const { nomeFonte, brutos } = brutosDoArtigo(artigo, fonte.nome);

  return gravarSinais(ctx, {
    rawItemId: rawItem.id,
    externalId: String(artigo.id),
    brutos,
    ctxClassificacao: {
      fonte: nomeFonte,
      tituloArtigo: artigo.title,
      labels: artigo.label_names ?? [],
    },
  });
}

// ──────────────────── Artigo-vivo: a lista de EAPs e betas ──────────────────

/**
 * O artigo de EAPs é editado no lugar e nunca ganha created_at novo. Aqui a
 * marca d'água não serve: o controle é hash de body e diff de blocos contra as
 * assinaturas já conhecidas deste artigo.
 */
async function processarArtigoVivo(ctx: Ctx) {
  const { prisma, hc, fonte } = ctx;

  const artigo = await hc.pegarArtigo({ zendeskId: fonte.zendeskId, locale: fonte.locale });
  const bodyHash = hashConteudo(artigo.body ?? '');

  const jaVisto = await prisma.psOpsRawItem.findUnique({
    where: {
      sourceId_externalId_bodyHash: {
        sourceId: fonte.id,
        externalId: String(artigo.id),
        bodyHash,
      },
    },
  });
  if (jaVisto) {
    return { itensNovos: 0, sinaisCriados: 0, sinaisArquivados: 0, novaWatermark: null };
  }

  // assinaturas de blocos já emitidos para este artigo, em qualquer versão
  const anteriores: Array<{ assinatura: string }> = await prisma.psOpsSignal.findMany({
    where: { rawItem: { sourceId: fonte.id, externalId: String(artigo.id) } },
    select: { assinatura: true },
  });
  const vistas = new Set<string>(anteriores.map((s) => s.assinatura));

  const rawItem = await prisma.psOpsRawItem.create({
    data: {
      sourceId: fonte.id,
      externalId: String(artigo.id),
      titulo: artigo.title,
      htmlUrl: artigo.html_url,
      secaoId: artigo.section_id ? String(artigo.section_id) : null,
      criadoEm: new Date(artigo.created_at),
      atualizadoEm: new Date(artigo.updated_at),
      editadoEm: artigo.edited_at ? new Date(artigo.edited_at) : null,
      labels: artigo.label_names ?? [],
      bodyHash,
      payload: artigo as unknown as object,
    },
  });

  const novos = blocosNovos(parseArtigoEap(artigo.body ?? ''), vistas);
  const brutos: SinalBruto[] = novos.map((b) => ({
    ancora: b.ancora,
    assinatura: b.assinatura,
    grupoProduto: b.categoria,
    grupoComponente: b.nome,
    texto: `${b.nome}. ${b.descricao}`,
    links: b.links,
  }));

  const r = await gravarSinais(ctx, {
    rawItemId: rawItem.id,
    externalId: String(artigo.id),
    brutos,
    ctxClassificacao: {
      fonte: 'EAPs e Betas',
      tituloArtigo: artigo.title,
      labels: artigo.label_names ?? [],
    },
  });

  return { itensNovos: 1, sinaisCriados: r.criados, sinaisArquivados: r.arquivados, novaWatermark: null };
}

// ─────────────────────────── Gravação dos sinais ────────────────────────────

async function gravarSinais(
  ctx: Ctx,
  args: {
    rawItemId: string;
    externalId: string;
    brutos: SinalBruto[];
    ctxClassificacao: { fonte: string; tituloArtigo: string; labels: string[] };
  },
) {
  const { prisma, fonte, classificador } = ctx;
  let criados = 0;
  let arquivados = 0;

  for (const bruto of args.brutos) {
    // Dedupe por conteúdo dentro do mesmo artigo: se este texto já virou sinal
    // numa versão anterior do artigo, não recria.
    const duplicado = await prisma.psOpsSignal.findFirst({
      where: {
        assinatura: bruto.assinatura,
        rawItem: { sourceId: fonte.id, externalId: args.externalId },
      },
      select: { id: true },
    });
    if (duplicado) continue;

    let ruido = avaliarRuido(bruto);

    let dados;
    try {
      const c = await classificador.classificar(bruto, args.ctxClassificacao);
      ruido = decidirArquivamento(
        avaliarEscopo({
          texto: bruto.texto,
          fonte: args.ctxClassificacao.fonte,
          tituloArtigo: args.ctxClassificacao.tituloArtigo,
          grupoProduto: bruto.grupoProduto,
          grupoComponente: bruto.grupoComponente,
          produto: c.produto,
          tipo: c.tipo,
        }),
        ruido,
      );
      dados = {
        titulo: c.titulo,
        resumoPtBr: c.resumoPtBr,
        produto: c.produto,
        modulo: c.modulo,
        tipo: c.tipo,
        planoMinimo: c.planoMinimo,
        requerConfiguracao: c.requerConfiguracao,
        requerDev: c.requerDev,
        afetaPreco: c.afetaPreco,
        dataLimite: c.dataLimite,
        score: c.score,
        impactosSugeridos: c.impactosSugeridos,
        classificadoPor: c.classificadoPor,
        status: ruido.arquivar ? ('AUTO_ARQUIVADO' as const) : ('NOVO' as const),
      };
    } catch (e) {
      // Classificação nunca bloqueia a ingestão: o sinal entra sem metadados e
      // aparece na fila marcado como NAO_CLASSIFICADO, para triagem manual.
      console.warn(`[psops] classificação falhou em ${bruto.ancora}:`, e);
      dados = {
        titulo: bruto.texto.slice(0, 120),
        resumoPtBr: null,
        produto: 'OUTRO' as const,
        modulo: 'OUTRO' as const,
        tipo: 'GA' as const,
        planoMinimo: null,
        requerConfiguracao: false,
        requerDev: false,
        afetaPreco: false,
        dataLimite: null,
        score: 0,
        impactosSugeridos: [],
        classificadoPor: 'falhou',
        status: 'NAO_CLASSIFICADO' as const,
      };
    }

    await prisma.psOpsSignal.create({
      data: {
        rawItemId: args.rawItemId,
        ancora: bruto.ancora,
        assinatura: bruto.assinatura,
        trechoOriginal: bruto.texto,
        motivoRuido: ruido.motivo,
        ...dados,
      },
    });

    if (ruido.arquivar) arquivados += 1;
    else criados += 1;
  }

  return { criados, arquivados };
}
