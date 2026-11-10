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
import { NaoEncontrado, RegraDeNegocio } from '../lib/http';

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

/**
 * Saúde pela ÚLTIMA ATUALIZAÇÃO registrada (o commit mais recente): é o que o
 * time controla. Sem nenhuma, "sem atualização registrada".
 */
export function saudePorAtualizacao(ultima: Date | null, pendentes: number, agora = new Date()): Saude {
  const e = env();
  if (!ultima) {
    return { estado: 'NAO_VERIFICADO', idadeDias: null, idadeDeclaradaDias: null, detalhe: 'Nenhuma atualização registrada.' };
  }
  const idade = dias(ultima, agora) ?? 0;
  const base = { idadeDias: idade, idadeDeclaradaDias: idade };
  if (idade > e.PSOPS_SAUDE_CRITICO_DIAS || pendentes > e.PSOPS_SAUDE_CRITICO_PENDENTES) {
    return { ...base, estado: 'CRITICO', detalhe: `Atualizado há ${idade} dias · ${pendentes} atividade(s) abertas.` };
  }
  if (idade >= e.PSOPS_SAUDE_ATENCAO_DIAS) {
    return { ...base, estado: 'ATENCAO', detalhe: `Atualizado há ${idade} dias.` };
  }
  return { ...base, estado: 'SAUDAVEL', detalhe: `Atualizado há ${idade} dias.` };
}

export async function listarArtefatos(prisma: PrismaClient, agora = new Date()) {
  const artefatos = await prisma.psOpsArtifact.findMany({
    orderBy: [{ tipo: 'asc' }, { nome: 'asc' }],
    include: {
      _count: { select: { aplicacoes: true, atualizacoes: true } },
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
      /** data do commit mais recente */
      ultimaAtualizacao: a.revisaoDeclaradaEm,
      revisaoDeclaradaEm: a.revisaoDeclaradaEm,
      revisaoVerificadaEm: a.revisaoVerificadaEm,
      conferidoEm: a.conferidoEm,
      fonteVerificacao: a.fonteVerificacao,
      fonteRef: a.fonteRef,
      pendentes,
      aplicacoesTotal: a._count.aplicacoes,
      atualizacoesTotal: a._count.atualizacoes,
      saude: saudePorAtualizacao(a.revisaoDeclaradaEm, pendentes, agora),
    };
  });
}

/**
 * A linha do tempo do artefato: os commits, do mais novo ao mais velho, cada
 * um com autor, descrição e — quando veio de uma atividade — a feature.
 */
export async function historicoArtefato(prisma: PrismaClient, artifactId: string) {
  const artefato = await prisma.psOpsArtifact.findUnique({ where: { id: artifactId } });
  if (!artefato) throw new NaoEncontrado('Artefato');

  const atualizacoes = await prisma.psOpsArtifactUpdate.findMany({
    where: { artifactId },
    orderBy: { criadoEm: 'desc' },
  });
  const signalIds = Array.from(new Set(atualizacoes.map((u) => u.signalId).filter((x): x is string => Boolean(x))));
  const sinais = signalIds.length
    ? await prisma.psOpsSignal.findMany({
        where: { id: { in: signalIds } },
        select: { id: true, titulo: true, tituloPt: true, rawItem: { select: { htmlUrl: true } } },
      })
    : [];
  const sinalPorId = new Map(sinais.map((s) => [s.id, s]));

  return {
    artefato,
    atualizacoes: atualizacoes.map((u) => {
      const s = u.signalId ? sinalPorId.get(u.signalId) : null;
      return {
        id: u.id,
        criadoEm: u.criadoEm,
        autorId: u.autorId,
        descricao: u.descricao,
        activityId: u.activityId,
        sinal: s ? { id: s.id, titulo: s.tituloPt || s.titulo, fonteUrl: s.rawItem.htmlUrl } : null,
      };
    }),
  };
}

/** "11" → "12", "2026.Q2" → "2026.Q3", sem número no fim → acrescenta ".1". */
export function incrementarVersao(v: string): string {
  const m = v.match(/^(.*?)(\d+)$/);
  if (!m?.[2]) return `${v}.1`;
  return `${m[1]}${Number(m[2]) + 1}`;
}

/**
 * Registra uma atualização ("commit") no artefato: descrição obrigatória,
 * versão +1, última atualização = agora. O autor assume o artefato sem dono.
 * Aceita um client de transação, para a conclusão gravar tudo junto.
 */
export async function registrarAtualizacao(
  prisma: Pick<PrismaClient, 'psOpsArtifact' | 'psOpsArtifactUpdate'>,
  args: {
    artifactId: string;
    autorId: string;
    descricao: string;
    activityId?: string | null;
    signalId?: string | null;
    agora?: Date;
  },
) {
  const descricao = String(args.descricao ?? '').trim();
  if (descricao.length < 5) {
    throw new RegraDeNegocio('Descreva o que mudou no artefato (pelo menos 5 caracteres).');
  }
  const agora = args.agora ?? new Date();
  const art = await prisma.psOpsArtifact.findUnique({ where: { id: args.artifactId } });
  if (!art) throw new NaoEncontrado('Artefato');

  const atualizacao = await prisma.psOpsArtifactUpdate.create({
    data: {
      artifactId: art.id,
      autorId: args.autorId,
      descricao,
      criadoEm: agora,
      activityId: args.activityId ?? null,
      signalId: args.signalId ?? null,
    },
  });
  const artefato = await prisma.psOpsArtifact.update({
    where: { id: art.id },
    data: {
      versao: incrementarVersao(art.versao),
      revisaoDeclaradaEm: agora,
      ...(art.donoId ? {} : { donoId: args.autorId }),
    },
  });
  return { atualizacao, artefato };
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
