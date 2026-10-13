/**
 * Camada 5 — o mapa de artefatos.
 *
 * A regra que sustenta o controle: o semáforo de saúde usa
 * `revisaoVerificadaEm`, NUNCA `revisaoDeclaradaEm`. Se usasse a declarada, o
 * mecanismo seria burlável com um clique.
 *
 * Enquanto um artefato tem `fonteVerificacao = NENHUMA` ele fica com saúde
 * `NAO_VERIFICADO` — honesto: ninguém sabe se aquilo mudou. É o estado que
 * empurra a decisão de configurar a fonte de verificação.
 */

import type { PrismaClient } from '@prisma/client';
import { env } from '../lib/env';
import { NaoEncontrado } from '../lib/http';

export type EstadoSaude = 'SAUDAVEL' | 'ATENCAO' | 'CRITICO' | 'DIVERGENTE' | 'NAO_VERIFICADO';

export interface Saude {
  estado: EstadoSaude;
  /** dias desde a revisão verificada; null quando nunca foi verificada */
  idadeDias: number | null;
  /** dias desde a revisão declarada — mostrado só como contraste */
  idadeDeclaradaDias: number | null;
  detalhe: string;
}

const DIA = 86_400_000;
const dias = (de: Date | null, ate: Date): number | null =>
  de ? Math.floor((ate.getTime() - de.getTime()) / DIA) : null;

export function calcularSaude(
  a: {
    revisaoDeclaradaEm: Date | null;
    revisaoVerificadaEm: Date | null;
    fonteVerificacao: string;
    divergente: boolean;
    pendentes: number;
  },
  agora = new Date(),
): Saude {
  const e = env();
  const idade = dias(a.revisaoVerificadaEm, agora);
  const idadeDeclarada = dias(a.revisaoDeclaradaEm, agora);

  const base = { idadeDias: idade, idadeDeclaradaDias: idadeDeclarada };

  if (a.divergente) {
    return {
      ...base,
      estado: 'DIVERGENTE',
      detalhe:
        'Alguém declarou a atualização e a fonte não confirma. Conferir antes de confiar no painel.',
    };
  }

  if (a.fonteVerificacao === 'NENHUMA') {
    return {
      ...base,
      estado: 'NAO_VERIFICADO',
      detalhe:
        'Sem fonte de verificação configurada — a idade abaixo é declarada, não confirmada.',
    };
  }

  if (idade === null) {
    return {
      ...base,
      estado: 'NAO_VERIFICADO',
      detalhe: 'A fonte nunca confirmou uma atualização deste artefato.',
    };
  }

  if (idade > e.PSOPS_SAUDE_CRITICO_DIAS || a.pendentes > e.PSOPS_SAUDE_CRITICO_PENDENTES) {
    return {
      ...base,
      estado: 'CRITICO',
      detalhe:
        idade > e.PSOPS_SAUDE_CRITICO_DIAS
          ? `${idade} dias sem revisão confirmada.`
          : `${a.pendentes} sinais pendentes acumulados.`,
    };
  }
  if (idade >= e.PSOPS_SAUDE_ATENCAO_DIAS) {
    return { ...base, estado: 'ATENCAO', detalhe: `${idade} dias sem revisão confirmada.` };
  }
  return { ...base, estado: 'SAUDAVEL', detalhe: `Revisado há ${idade} dias.` };
}

export async function listarArtefatos(prisma: PrismaClient, agora = new Date()) {
  const artefatos = await prisma.psOpsArtifact.findMany({
    orderBy: [{ tipo: 'asc' }, { nome: 'asc' }],
    include: {
      _count: { select: { aplicacoes: true } },
      atividades: {
        where: { status: { in: ['TODO', 'DOING'] } },
        select: { id: true },
      },
    },
  });

  return artefatos.map((a) => {
    const pendentes = a.atividades.length;
    return {
      id: a.id,
      chave: a.chave,
      tipo: a.tipo,
      modulo: a.modulo,
      nome: a.nome,
      donoId: a.donoId,
      versao: a.versao,
      revisaoDeclaradaEm: a.revisaoDeclaradaEm,
      revisaoVerificadaEm: a.revisaoVerificadaEm,
      conferidoEm: a.conferidoEm,
      fonteVerificacao: a.fonteVerificacao,
      fonteRef: a.fonteRef,
      pendentes,
      aplicacoesTotal: a._count.aplicacoes,
      saude: calcularSaude({ ...a, pendentes }, agora),
    };
  });
}

/**
 * Leitura reversa: por que este artefato está do jeito que está.
 * Devolve as aplicações em ordem cronológica, cada uma com o sinal e o link
 * para o announcement original.
 */
export async function historicoArtefato(prisma: PrismaClient, artifactId: string) {
  const artefato = await prisma.psOpsArtifact.findUnique({ where: { id: artifactId } });
  if (!artefato) throw new NaoEncontrado('Artefato');

  const aplicacoes = await prisma.psOpsArtifactSignal.findMany({
    where: { artifactId },
    orderBy: { aplicadoEm: 'desc' },
    include: {
      signal: {
        select: {
          id: true,
          titulo: true,
          tipo: true,
          produto: true,
          criadoEm: true,
          rawItem: { select: { htmlUrl: true, titulo: true } },
        },
      },
      activity: { select: { id: true, tipo: true, concluidoEm: true, concluidoPor: true } },
    },
  });

  return {
    artefato,
    aplicacoes: aplicacoes.map((ap) => ({
      aplicadoEm: ap.aplicadoEm,
      versaoResultante: ap.versaoResultante,
      atividade: ap.activity,
      sinal: {
        id: ap.signal.id,
        titulo: ap.signal.titulo,
        tipo: ap.signal.tipo,
        produto: ap.signal.produto,
        publicadoEm: ap.signal.criadoEm,
        /** o link que fecha a rastreabilidade até a fonte externa */
        fonteUrl: ap.signal.rawItem.htmlUrl,
        fonteTitulo: ap.signal.rawItem.titulo,
      },
    })),
  };
}

export async function atualizarArtefato(
  prisma: PrismaClient,
  args: {
    artifactId: string;
    donoId?: string | null;
    fonteVerificacao?: 'PORTAL' | 'GDRIVE' | 'ZENDESK_ADMIN' | 'NENHUMA';
    fonteRef?: string | null;
    nome?: string;
  },
) {
  const existe = await prisma.psOpsArtifact.findUnique({ where: { id: args.artifactId } });
  if (!existe) throw new NaoEncontrado('Artefato');

  const artefato = await prisma.psOpsArtifact.update({
    where: { id: args.artifactId },
    data: {
      ...(args.donoId !== undefined ? { donoId: args.donoId } : {}),
      ...(args.fonteVerificacao ? { fonteVerificacao: args.fonteVerificacao } : {}),
      ...(args.fonteRef !== undefined ? { fonteRef: args.fonteRef } : {}),
      ...(args.nome ? { nome: args.nome } : {}),
    },
  });

  // Dono novo herda as atividades abertas que nasceram órfãs (geradas antes de
  // o artefato ter dono). Nunca sobrescreve quem já foi atribuído à mão.
  let atividadesAtribuidas = 0;
  if (args.donoId) {
    const r = await prisma.psOpsActivity.updateMany({
      where: { artifactId: args.artifactId, responsavelId: null, status: { in: ['TODO', 'DOING'] } },
      data: { responsavelId: args.donoId },
    });
    atividadesAtribuidas = r.count;
  }

  return { artefato, atividadesAtribuidas };
}
