/**
 * Atividades do backlog: marcar DoD, atribuir responsável, concluir.
 *
 * A conclusão é o ponto onde o mecanismo fecha o ciclo:
 *   1. valida o DoD (inclusive as evidências obrigatórias)
 *   2. grava a APLICAÇÃO em PsOpsArtifactSignal — a rastreabilidade reversa
 *   3. incrementa a versão do artefato e marca revisaoDeclaradaEm
 *
 * Note o nome do campo: DECLARADA. Concluir uma atividade é uma declaração,
 * não uma prova. A data que o semáforo de saúde usa é revisaoVerificadaEm,
 * preenchida pelo reconciliador. Ver services/reconcile.ts.
 */

import type { PrismaClient, Prisma } from '@prisma/client';
import { dodCompleto, dodPendencias, type DodItem } from '../config/dod';
import { NaoEncontrado, RegraDeNegocio } from '../lib/http';

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
              tipo: true,
              produto: true,
              rawItem: { select: { htmlUrl: true, titulo: true } },
            },
          },
        },
      },
      studyNote: { select: { id: true, publicadoEm: true } },
    },
  });

  return atividades.map((a) => {
    const dod = lerDod(a.dod);
    return {
      ...a,
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

  return prisma.psOpsActivity.update({
    where: { id: args.activityId },
    data: { responsavelId: args.responsavelId },
  });
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
  artefato: { id: string; nome: string; versao: string } | null;
  fichaPublicada: boolean;
}

/**
 * Conclui a atividade. Só passa com o DoD completo — inclusive as evidências
 * dos itens que exigem anexo.
 */
export async function concluir(
  prisma: PrismaClient,
  args: { activityId: string; usuarioId: string; agora?: Date },
): Promise<ResultadoConclusao> {
  const agora = args.agora ?? new Date();

  const a = await prisma.psOpsActivity.findUnique({
    where: { id: args.activityId },
    include: { initiative: { select: { signalId: true } }, artifact: true },
  });
  if (!a) throw new NaoEncontrado('Atividade');
  if (a.status === 'DONE') throw new RegraDeNegocio('Atividade já concluída.');

  const dod = lerDod(a.dod);
  if (!dodCompleto(dod)) {
    const p = dodPendencias(dod);
    throw new RegraDeNegocio(
      `Definition of Done incompleto: ${p.faltamCheck} item(ns) sem marcar, ` +
        `${p.faltamEvidencia} sem evidência anexada.`,
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.psOpsActivity.update({
      where: { id: a.id },
      data: { status: 'DONE', concluidoEm: agora, concluidoPor: args.usuarioId },
    });

    let fichaPublicada = false;
    if (a.tipo === 'ESTUDO') {
      const ficha = await tx.psOpsStudyNote.findUnique({ where: { activityId: a.id } });
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

    if (!a.artifact) return { activityId: a.id, artefato: null, fichaPublicada };

    const novaVersao = incrementarVersao(a.artifact.versao);

    // A aplicação é o registro auditável: este sinal alterou este artefato
    // através desta atividade, nesta versão.
    await tx.psOpsArtifactSignal.upsert({
      where: {
        artifactId_signalId_activityId: {
          artifactId: a.artifact.id,
          signalId: a.initiative.signalId,
          activityId: a.id,
        },
      },
      create: {
        artifactId: a.artifact.id,
        signalId: a.initiative.signalId,
        activityId: a.id,
        aplicadoEm: agora,
        versaoResultante: novaVersao,
      },
      update: { versaoResultante: novaVersao },
    });

    const pendentes = await tx.psOpsActivity.count({
      where: { artifactId: a.artifact.id, status: { in: ['TODO', 'DOING'] } },
    });

    // Artefato que mora no portal tem a verificação por construção: o write É
    // a prova. Para os outros, só a data declarada avança aqui — a verificada
    // fica para o reconciliador.
    const moraNoPortal = a.artifact.fonteVerificacao === 'PORTAL';

    const artefato = await tx.psOpsArtifact.update({
      where: { id: a.artifact.id },
      data: {
        versao: novaVersao,
        revisaoDeclaradaEm: agora,
        ...(moraNoPortal
          ? { revisaoVerificadaEm: agora, conferidoEm: agora, divergente: false }
          : {}),
        // quem fez o trabalho assume o artefato órfão
        ...(a.artifact.donoId ? {} : { donoId: a.responsavelId ?? args.usuarioId }),
      },
    });

    void pendentes;

    return {
      activityId: a.id,
      artefato: { id: artefato.id, nome: artefato.nome, versao: artefato.versao },
      fichaPublicada,
    };
  });
}

/** "11" → "12"; "2026.Q2" → "2026.Q3"; "1" → "2". */
export function incrementarVersao(v: string): string {
  const m = v.match(/^(.*?)(\d+)$/);
  if (!m?.[2]) return `${v}.1`;
  return `${m[1]}${Number(m[2]) + 1}`;
}
