/**
 * Manutenção da fila, rodada junto com cada coleta:
 *
 *   1. reclassificar — quando as regras mudam (VERSAO_REGRAS), os sinais que
 *      ainda estão na fila são reprocessados a partir da camada crua. Sinal já
 *      triado ou descartado nunca é tocado: decisão humana não se reescreve.
 *
 *   2. traduzir — busca a versão pt-br que o próprio Zendesk publica no Help
 *      Center e preenche título e trecho em português. A tradução costuma sair
 *      dias depois do original, então cada artigo recente é conferido de novo a
 *      cada coleta até ela aparecer. Só aplica quando a estrutura bate bullet a
 *      bullet; na dúvida, o sinal fica em inglês (melhor do que traduzido errado).
 */
import type { PrismaClient } from '@prisma/client';
import type { ClienteHc } from '../zendesk/client';
import type { Classificador } from './classify';
import { avaliarEscopo, avaliarRuido, decidirArquivamento } from './noise';
import { brutosDoArtigo, brutosDoArtigoVivo, tituloDoBruto } from './artigo';
import type { SinalBruto } from './parser';

type Payload = { title?: string; body?: string | null; section_id?: number | null };

interface RawLinha {
  id: string;
  sourceId: string;
  externalId: string;
  titulo: string;
  secaoId: string | null;
  labels: string[];
  payload: unknown;
  criadoEm: Date;
}

interface FonteLinha {
  id: string;
  nome: string;
  isLiveArticle: boolean;
}

async function fontesPorId(prisma: PrismaClient, ids: string[]) {
  const fontes = (await prisma.psOpsSource.findMany({
    where: { id: { in: ids } },
  })) as unknown as FonteLinha[];
  return new Map(fontes.map((f) => [f.id, f]));
}

// ─────────────────────────────── Reclassificação ────────────────────────────

export interface ResultadoReclassificacao {
  reclassificados: number;
  /** quantos saíram da fila (foram para AUTO_ARQUIVADO) nesta passada */
  arquivados: number;
}

export async function reclassificarFila(
  prisma: PrismaClient,
  classificador: Classificador,
): Promise<ResultadoReclassificacao> {
  const pendentes = (await prisma.psOpsSignal.findMany({
    where: {
      status: { in: ['NOVO', 'NAO_CLASSIFICADO'] },
      classificadoPor: { not: classificador.nome },
    },
    select: { id: true, ancora: true, rawItemId: true },
  })) as Array<{ id: string; ancora: string; rawItemId: string }>;
  if (pendentes.length === 0) return { reclassificados: 0, arquivados: 0 };

  const porRaw = new Map<string, typeof pendentes>();
  for (const s of pendentes) {
    const lista = porRaw.get(s.rawItemId) ?? [];
    lista.push(s);
    porRaw.set(s.rawItemId, lista);
  }

  const raws = (await prisma.psOpsRawItem.findMany({
    where: { id: { in: Array.from(porRaw.keys()) } },
  })) as unknown as RawLinha[];
  const fontes = await fontesPorId(prisma, Array.from(new Set(raws.map((r) => r.sourceId))));

  let reclassificados = 0;
  let arquivados = 0;

  for (const raw of raws) {
    const fonte = fontes.get(raw.sourceId);
    const p = (raw.payload ?? {}) as Payload;
    let brutos: SinalBruto[];
    let ctx: { fonte: string; tituloArtigo: string; labels: string[] };

    if (fonte?.isLiveArticle) {
      brutos = brutosDoArtigoVivo(p.body ?? '');
      ctx = { fonte: 'EAPs e Betas', tituloArtigo: raw.titulo, labels: raw.labels ?? [] };
    } else {
      const r = brutosDoArtigo(
        { title: p.title ?? raw.titulo, body: p.body ?? '', section_id: p.section_id ?? raw.secaoId },
        fonte?.nome ?? '',
      );
      brutos = r.brutos;
      ctx = { fonte: r.nomeFonte, tituloArtigo: raw.titulo, labels: raw.labels ?? [] };
    }

    const porAncora = new Map(brutos.map((b) => [b.ancora, b]));
    for (const sinal of porRaw.get(raw.id) ?? []) {
      const b = porAncora.get(sinal.ancora);
      if (!b) continue; // o parser mudou e a âncora sumiu: deixa como está

      const c = await classificador.classificar(b, ctx);
      const decisao = decidirArquivamento(
        avaliarEscopo({
          texto: b.texto,
          fonte: ctx.fonte,
          tituloArtigo: ctx.tituloArtigo,
          grupoProduto: b.grupoProduto,
          grupoComponente: b.grupoComponente,
          produto: c.produto,
          tipo: c.tipo,
        }),
        avaliarRuido(b),
      );

      await prisma.psOpsSignal.update({
        where: { id: sinal.id },
        data: {
          titulo: c.titulo,
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
          status: decisao.arquivar ? 'AUTO_ARQUIVADO' : 'NOVO',
          motivoRuido: decisao.motivo,
        },
      });
      reclassificados += 1;
      if (decisao.arquivar) arquivados += 1;
    }
  }

  return { reclassificados, arquivados };
}

// ──────────────────────────────── Tradução pt-br ────────────────────────────

export interface ResultadoTraducao {
  /** artigos consultados no Zendesk nesta passada */
  conferidos: number;
  /** artigos cuja tradução foi aplicada */
  artigosTraduzidos: number;
  sinaisTraduzidos: number;
  /** tradução existe, mas a estrutura não bate com a original */
  estruturaDiferente: number;
}

export const TRADUCAO_LOCALE = 'pt-br';
/** Por quantos dias um artigo continua sendo conferido à espera da tradução. */
export const TRADUCAO_JANELA_DIAS = 30;
/** Teto de consultas por coleta — cada uma é uma chamada ao Zendesk. */
export const TRADUCAO_MAX_POR_COLETA = 12;

/** Mesma quebra, mesma ordem, mesmas âncoras. Senão, não aplica. */
export function estruturaBate(en: SinalBruto[], pt: SinalBruto[]): boolean {
  return en.length > 0 && en.length === pt.length && en.every((b, i) => b.ancora === pt[i]!.ancora);
}

export async function traduzirPendentes(
  prisma: PrismaClient,
  hc: ClienteHc,
  opts: { agora: () => Date; ate?: number },
): Promise<ResultadoTraducao> {
  const r: ResultadoTraducao = { conferidos: 0, artigosTraduzidos: 0, sinaisTraduzidos: 0, estruturaDiferente: 0 };
  if (!hc.pegarTraducao) return r;

  const desde = new Date(opts.agora().getTime() - TRADUCAO_JANELA_DIAS * 86_400_000);
  const candidatos = ((await prisma.psOpsRawItem.findMany({
    where: { traducaoPtEm: null, criadoEm: { gte: desde } },
  })) as unknown as RawLinha[]).sort((a, b) => +b.criadoEm - +a.criadoEm); // mais novos primeiro

  const fontes = await fontesPorId(prisma, Array.from(new Set(candidatos.map((c) => c.sourceId))));

  for (const raw of candidatos) {
    if (r.conferidos >= TRADUCAO_MAX_POR_COLETA) break;
    if (opts.ate && Date.now() > opts.ate) break; // respeita o limite de tempo da função
    const fonte = fontes.get(raw.sourceId);
    if (!fonte || fonte.isLiveArticle) continue; // a lista de EAPs muda no lugar; fica em inglês

    r.conferidos += 1;
    let traducao;
    try {
      traducao = await hc.pegarTraducao({ zendeskId: raw.externalId, locale: TRADUCAO_LOCALE });
    } catch (e) {
      console.warn(`[psops] tradução de ${raw.externalId} falhou:`, e instanceof Error ? e.message : e);
      continue;
    }
    if (!traducao) continue; // ainda não traduzido: confere de novo na próxima coleta

    const p = (raw.payload ?? {}) as Payload;
    const en = brutosDoArtigo(
      { title: p.title ?? raw.titulo, body: p.body ?? '', section_id: p.section_id ?? raw.secaoId },
      fonte.nome,
    );
    const pt = brutosDoArtigo(
      { title: traducao.title, body: traducao.body, section_id: p.section_id ?? raw.secaoId },
      fonte.nome,
      en.modo,
    );

    if (!estruturaBate(en.brutos, pt.brutos)) {
      r.estruturaDiferente += 1;
      console.warn(
        `[psops] tradução de ${raw.externalId} com estrutura diferente (${en.brutos.length} × ${pt.brutos.length} itens) — mantido em inglês`,
      );
      continue;
    }

    const ptPorAncora = new Map(pt.brutos.map((b) => [b.ancora, b]));
    const sinais = (await prisma.psOpsSignal.findMany({
      where: { rawItemId: raw.id },
      select: { id: true, ancora: true },
    })) as Array<{ id: string; ancora: string }>;

    for (const s of sinais) {
      const b = ptPorAncora.get(s.ancora);
      if (!b) continue;
      await prisma.psOpsSignal.update({
        where: { id: s.id },
        data: { tituloPt: tituloDoBruto(b), trechoPt: b.texto },
      });
      r.sinaisTraduzidos += 1;
    }
    await prisma.psOpsRawItem.update({ where: { id: raw.id }, data: { traducaoPtEm: opts.agora() } });
    r.artigosTraduzidos += 1;
  }

  return r;
}
