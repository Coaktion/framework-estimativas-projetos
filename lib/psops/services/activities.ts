/**
 * Atividades do backlog: marcar DoD, atribuir responsável, concluir.
 *
 * A conclusão é o ponto onde o mecanismo fecha o ciclo:
 *   1. valida o DoD (inclusive as evidências obrigatórias)
 *   2. registra um commit (PsOpsArtifactUpdate) em cada artefato atualizado,
 *      com a descrição de quem concluiu, ligado à atividade e à feature
 *   3. a versão do artefato sobe e a última atualização vira agora
 */

import type { PrismaClient, Prisma } from '@prisma/client';
import { dodPendencias, type DodItem } from '../config/dod';
import { NaoEncontrado, RegraDeNegocio } from '../lib/http';
import { TIPO_POR_IMPACTO } from '../config/artefatos';
import type { Impacto } from '../config/taxonomy';
import { incrementarVersao, registrarAtualizacao } from './artifacts';
import { notificarAtividadesNovas } from '../../notificacoes';
import { registrarEstudoDoRadar, type ResultadoRegistroEstudo } from '../../estudos/radar';

function lerDod(json: Prisma.JsonValue): DodItem[] {
  if (!Array.isArray(json)) return [];
  return json as unknown as DodItem[];
}

export interface FiltroAtividades {
  responsavelId?: string | undefined;
  /** true = só atividades sem responsável */
  semResponsavel?: boolean | undefined;
  status?: Array<'TODO' | 'DOING' | 'DONE' | 'CANCELADA'> | undefined;
  tipo?: Array<'ESTUDO' | 'DEMO' | 'ESTIM' | 'ESCOPO'> | undefined;
  artifactId?: string | undefined;
}

export async function listarAtividades(prisma: PrismaClient, f: FiltroAtividades) {
  const where: Prisma.PsOpsActivityWhereInput = {
    ...(f.semResponsavel ? { responsavelId: null } : {}),
    ...(f.responsavelId && !f.semResponsavel ? { responsavelId: f.responsavelId } : {}),
    ...(f.status?.length ? { status: { in: f.status } } : {}),
    ...(f.tipo?.length ? { tipo: { in: f.tipo } } : {}),
    ...(f.artifactId ? { artifactId: f.artifactId } : {}),
  };

  const atividades = await prisma.psOpsActivity.findMany({
    where,
    orderBy: [{ status: 'asc' }, { titulo: 'asc' }],
    include: {
      artifact: { select: { id: true, nome: true, chave: true, tipo: true } },
      initiative: {
        select: {
          id: true,
          titulo: true,
          ciclo: true,
          signal: {
            select: {
              id: true,
              titulo: true,
              tituloPt: true,
              trechoOriginal: true,
              trechoPt: true,
              tituloEs: true,
              trechoEs: true,
              tipo: true,
              produto: true,
              score: true,
              rawItem: { select: { htmlUrl: true, titulo: true } },
              // a ficha é da FEATURE: os estudos de todos os SEs abrem a mesma
              studyNote: { select: { id: true, publicadoEm: true } },
            },
          },
        },
      },
    },
  });

  // Tarefa sem novidade de origem (SKILL de um commit feito direto no Mapa):
  // o card mostra o próprio título no lugar da novidade.
  const comNovidade = atividades.map((a) =>
    a.initiative
      ? a
      : {
          ...a,
          initiative: {
            id: '',
            titulo: a.titulo,
            ciclo: '',
            signal: {
              id: '',
              titulo: a.titulo,
              tituloPt: a.titulo,
              tituloEs: a.titulo,
              trechoOriginal: '',
              trechoPt: '',
              trechoEs: '',
              tipo: 'GA' as const,
              produto: 'OUTRO' as const,
              score: 0,
              rawItem: { htmlUrl: '', titulo: '' },
              studyNote: null,
            },
          },
        },
  );

  // dentro de cada coluna, o mais relevante primeiro (score da novidade)
  comNovidade.sort((x, y) => (y.initiative.signal.score ?? 0) - (x.initiative.signal.score ?? 0));

  return comNovidade.map((a) => {
    const dod = lerDod(a.dod);
    return {
      ...a,
      studyNote: a.tipo === 'ESTUDO' ? (a.initiative.signal.studyNote ?? null) : null,
      dod,
      progresso: { feitos: dod.filter((i) => i.d).length, total: dod.length },
      pendencias: dodPendencias(dod),
      /** link direto para a nota completa no Help Center */
      fonteUrl: a.initiative.signal.rawItem.htmlUrl,
    };
  });
}

/** Contagem por responsável — alimenta os chips de filtro do board. */
export async function contarPorResponsavel(prisma: PrismaClient) {
  const grupos = await prisma.psOpsActivity.groupBy({
    by: ['responsavelId'],
    _count: { _all: true },
    where: { status: { not: 'CANCELADA' } },
  });
  return grupos.map((g) => ({
    responsavelId: g.responsavelId,
    total: g._count._all,
  }));
}

export async function atribuir(
  prisma: PrismaClient,
  args: { activityId: string; responsavelId: string | null },
) {
  const a = await prisma.psOpsActivity.findUnique({ where: { id: args.activityId } });
  if (!a) throw new NaoEncontrado('Atividade');
  if (a.status === 'DONE') throw new RegraDeNegocio('Atividade concluída não muda de responsável.');

  const anterior = a.responsavelId;
  const atualizada = await prisma.psOpsActivity.update({
    where: { id: args.activityId },
    data: { responsavelId: args.responsavelId },
  });
  // passou para outra pessoa: ela recebe no sininho
  if (args.responsavelId && args.responsavelId !== anterior) {
    const ini = a.initiativeId
      ? await prisma.psOpsInitiative.findUnique({
          where: { id: a.initiativeId },
          select: { signal: { select: { titulo: true, tituloPt: true } } },
        })
      : null;
    const feature = ini?.signal ? ini.signal.tituloPt || ini.signal.titulo : a.titulo;
    await notificarAtividadesNovas(prisma, [{ id: a.id, tipo: a.tipo, responsavelId: args.responsavelId }], feature);
  }
  return atualizada;
}

export async function marcarDod(
  prisma: PrismaClient,
  args: { activityId: string; indice: number; feito: boolean; evidencia?: string | null },
) {
  const a = await prisma.psOpsActivity.findUnique({ where: { id: args.activityId } });
  if (!a) throw new NaoEncontrado('Atividade');
  if (a.status === 'DONE') throw new RegraDeNegocio('Atividade já concluída.');

  const dod = lerDod(a.dod);
  const item = dod[args.indice];
  if (!item) throw new RegraDeNegocio(`Item ${args.indice} não existe neste DoD.`);

  item.d = args.feito;
  if (args.evidencia !== undefined) item.evidencia = args.evidencia;
  if (!args.feito) item.evidencia = null;

  // TODO → DOING na primeira marcação: o status acompanha o trabalho real,
  // ninguém precisa mover card.
  const status = a.status === 'TODO' && dod.some((i) => i.d) ? 'DOING' : a.status;

  return prisma.psOpsActivity.update({
    where: { id: a.id },
    data: { dod: dod as unknown as Prisma.InputJsonValue, status },
  });
}

export interface ResultadoConclusao {
  activityId: string;
  /** os artefatos que receberam um commit nesta conclusão */
  artefatos: Array<{ id: string; nome: string; versao: string }>;
  fichaPublicada: boolean;
  /**
   * Estudo: o registro no Acompanhamento semanal dos Estudos. Quando não deu
   * para registrar sozinho, traz a sugestão para a tela completar.
   */
  estudo?: ResultadoRegistroEstudo | null;
}

/**
 * Conclui a atividade. Disse que está feito, está feito: não há checklist.
 *
 * Demo, Estimativa e Escopo PODEM dizer quais artefatos foram atualizados
 * (os 3 ambientes de demo, o documento em PT, EN e ES) e o que mudou — aí
 * vira um commit em cada artefato, ligado à atividade e à feature. Sem
 * descrição, conclui sem commit (ex.: arrastar o card para Concluídas).
 */
export async function concluir(
  prisma: PrismaClient,
  args: {
    activityId: string;
    usuarioId: string;
    artefatoIds?: string[];
    descricao?: string | null;
    agora?: Date;
  },
): Promise<ResultadoConclusao> {
  const agora = args.agora ?? new Date();

  const a = await prisma.psOpsActivity.findUnique({
    where: { id: args.activityId },
    include: { initiative: { select: { signalId: true } } },
  });
  if (!a) throw new NaoEncontrado('Atividade');
  if (a.status === 'DONE') throw new RegraDeNegocio('Atividade já concluída.');

  // Commit opcional: só quando há descrição. Artefatos: os marcados; sem
  // marcação, o sugerido na triagem.
  const tipoArt = TIPO_POR_IMPACTO[a.tipo as Impacto];
  const descricao = String(args.descricao ?? '').trim();
  let alvos: Array<{ id: string; tipo: string }> = [];
  if (tipoArt && (descricao || args.artefatoIds?.length)) {
    const ids = Array.from(new Set(args.artefatoIds?.length ? args.artefatoIds : a.artifactId ? [a.artifactId] : []));
    if (!ids.length) throw new RegraDeNegocio('Marque qual artefato você atualizou.');
    alvos = await prisma.psOpsArtifact.findMany({ where: { id: { in: ids } }, select: { id: true, tipo: true } });
    if (alvos.length !== ids.length) throw new NaoEncontrado('Artefato');
    if (alvos.some((x) => x.tipo !== tipoArt)) {
      throw new RegraDeNegocio('Os artefatos marcados não são deste destino.');
    }
    if (descricao.length < 5) {
      throw new RegraDeNegocio('Descreva o que mudou no artefato (pelo menos 5 caracteres).');
    }
  }

  return prisma.$transaction(async (tx) => {
    await tx.psOpsActivity.update({
      where: { id: a.id },
      data: { status: 'DONE', concluidoEm: agora, concluidoPor: args.usuarioId },
    });

    let fichaPublicada = false;
    if (a.tipo === 'ESTUDO') {
      // ficha compartilhada pelos estudos da feature: busca pelo sinal
      const ficha = a.initiative
        ? await tx.psOpsStudyNote.findUnique({ where: { signalId: a.initiative.signalId } })
        : null;
      if (ficha) {
        await tx.psOpsStudyNote.update({
          where: { id: ficha.id },
          data: {
            publicadoEm: ficha.publicadoEm ?? agora,
            autorId: ficha.autorId ?? args.usuarioId,
            versao: ficha.publicadoEm ? ficha.versao + 1 : ficha.versao,
          },
        });
        fichaPublicada = true;
      }
    }

    // Estudo concluído vira registro na área Estudos (matriz de conhecimento)
    let estudo: ResultadoRegistroEstudo | null = null;
    if (a.tipo === 'ESTUDO' && a.initiative) {
      const sinal = (await tx.psOpsSignal.findUnique({
        where: { id: a.initiative.signalId },
        select: { produto: true, titulo: true, tituloPt: true },
      })) as { produto: string; titulo: string; tituloPt: string | null } | null;
      const ficha = (await tx.psOpsStudyNote.findUnique({
        where: { signalId: a.initiative.signalId },
        select: { comoFunciona: true },
      })) as { comoFunciona: string | null } | null;
      estudo = await registrarEstudoDoRadar(tx, {
        activityId: a.id,
        pessoaId: a.responsavelId ?? args.usuarioId,
        produto: sinal?.produto ?? 'OUTRO',
        feature: sinal ? sinal.tituloPt || sinal.titulo : a.titulo,
        observacoes: ficha?.comoFunciona ?? null,
        agora,
      });
    }

    const artefatos: ResultadoConclusao['artefatos'] = [];
    for (const alvo of alvos) {
      const { artefato } = await registrarAtualizacao(tx, {
        artifactId: alvo.id,
        autorId: args.usuarioId,
        descricao,
        activityId: a.id,
        signalId: a.initiative?.signalId ?? null,
        agora,
      });
      artefatos.push({ id: artefato.id, nome: artefato.nome, versao: artefato.versao });
    }

    return { activityId: a.id, artefatos, fichaPublicada, estudo };
  });
}

export { incrementarVersao };

/**
 * Mover o card no quadro (arrastar entre colunas, arquivar, desarquivar):
 *   · Concluídas → conclui (sem commit; o commit se registra pelo detalhe)
 *   · A fazer / Em andamento → muda o status; se estava concluída ou
 *     arquivada, reabre. Commits já registrados ficam no histórico.
 *   · CANCELADA = arquivada: item que se percebeu que não precisa fazer nada
 */
export async function moverAtividade(
  prisma: PrismaClient,
  args: { activityId: string; status: 'TODO' | 'DOING' | 'DONE' | 'CANCELADA'; usuarioId: string; agora?: Date },
) {
  const a = await prisma.psOpsActivity.findUnique({ where: { id: args.activityId } });
  if (!a) throw new NaoEncontrado('Atividade');
  if (a.status === args.status) return a;
  if (args.status === 'DONE') {
    const conclusao = await concluir(prisma, { activityId: a.id, usuarioId: args.usuarioId, agora: args.agora });
    const atividade = await prisma.psOpsActivity.findUnique({ where: { id: a.id } });
    // a tela usa "estudo" para abrir a janela de registro quando preciso
    return { ...atividade, estudo: conclusao.estudo ?? null };
  }
  return prisma.psOpsActivity.update({
    where: { id: a.id },
    data: {
      status: args.status,
      // sair de Concluídas apaga a data de conclusão; arquivar não conclui
      concluidoEm: null,
      concluidoPor: null,
    },
  });
}
