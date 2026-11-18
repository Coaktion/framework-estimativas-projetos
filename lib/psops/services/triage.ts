/**
 * Camadas 3 e 4 — triagem e geração.
 *
 * O triador não escreve tarefa: ele marca ONDE impacta. Este serviço traduz
 * essa decisão em uma Iniciativa e N Atividades, cada uma com Definition of
 * Done do template e o responsável do destino (config/responsaveis.ts).
 *
 * Regras que este arquivo garante:
 *   · ESTUDO não toca artefato — gera uma atividade para cada SE e UMA ficha
 *     da feature (PsOpsStudyNote), compartilhada por eles
 *   · DEMO / ESCOPO apontam para o grupo de artefatos (3 ambientes, os
 *     documentos de escopo); quais foram atualizados se escolhe ao concluir.
 *     ESTIM já aponta para a estimativa do módulo do produto (sugestão)
 *   · o responsável vem da configuração do time; sem ninguém configurado,
 *     do dono do artefato — nunca de sorteio nem de quem triou
 *   · triar duas vezes o mesmo sinal é erro de negócio, não duplicação
 */

import type { PrismaClient, Prisma } from '@prisma/client';
import { Impacto, IMPACTOS_ORDEM, type Modulo } from '../config/taxonomy';
import { NOME_GRUPO, estimativaSugerida } from '../config/artefatos';
import { DOD_TEMPLATES, criterioSugerido, tituloAtividade } from '../config/dod';
import { resolverResponsaveis, type ResponsaveisResolvidos } from '../config/responsaveis';
import { semanaIso } from '../ingest/collector';
import { NaoEncontrado, RegraDeNegocio } from '../lib/http';
import { notificarAtividadesNovas } from '../../notificacoes';

export interface TriarInput {
  signalId: string;
  impactos: Impacto[];
  usuarioId: string;
  nota?: string | null;
  /** quem responde por destino; sem isto, vem de config/responsaveis.ts */
  responsaveis?: ResponsaveisResolvidos;
}

export interface TriarResultado {
  initiativeId: string;
  atividades: Array<{
    id: string;
    tipo: Impacto;
    titulo: string;
    artefato: string | null;
    responsavelId: string | null;
  }>;
  artefatosCriados: string[];
}


export async function triar(prisma: PrismaClient, input: TriarInput): Promise<TriarResultado> {
  const sinal = await prisma.psOpsSignal.findUnique({
    where: { id: input.signalId },
    include: { initiative: { select: { id: true } } },
  });
  if (!sinal) throw new NaoEncontrado('Sinal');
  if (sinal.initiative) {
    throw new RegraDeNegocio('Este sinal já foi triado e gerou atividades.');
  }
  if (input.impactos.length === 0) {
    throw new RegraDeNegocio('Marque ao menos um impacto, ou use descartar.');
  }

  // ordem canônica: ESTUDO primeiro, para o card de estudo aparecer no topo
  const impactos = IMPACTOS_ORDEM.filter((i) => input.impactos.includes(i));
  const modulo = sinal.modulo as Modulo;
  const artefatosCriados: string[] = [];
  const responsaveis = input.responsaveis ?? (await resolverResponsaveis(prisma));

  const resultado = await prisma.$transaction(async (tx) => {
    const initiative = await garantirIniciativa(tx, sinal);

    await tx.psOpsTriage.create({
      data: {
        signalId: sinal.id,
        usuarioId: input.usuarioId,
        impactos,
        nota: input.nota ?? null,
      },
    });

    const atividades: TriarResultado['atividades'] = [];

    for (const impacto of impactos) {
      // Quem responde vem da configuração do time (config/responsaveis.ts):
      // Estudo é de todos os SEs — uma atividade para cada um —, os outros
      // destinos têm um dono só. Sem ninguém configurado, fica o dono do
      // artefato (ou ninguém, e o card cai em "Sem responsável").
      const configurados = responsaveis[impacto] ?? [];
      const pessoas: Array<string | null | undefined> =
        impacto === Impacto.ESTUDO ? (configurados.length ? configurados : [null]) : [configurados[0]];
      atividades.push(
        ...(await criarAtividadesDaFrente(tx, { sinal, initiativeId: initiative.id, impacto, pessoas, modulo })),
      );
    }

    await tx.psOpsSignal.update({
      where: { id: sinal.id },
      data: { status: 'TRIADO' },
    });

    // o sininho de cada responsável: uma notificação por atividade nova
    await notificarAtividadesNovas(tx, atividades, sinal.tituloPt || sinal.titulo);

    return { initiativeId: initiative.id, atividades };
  });

  return { ...resultado, artefatosCriados };
}

type Tx = Prisma.TransactionClient;
type SinalBase = { id: string; titulo: string; criadoEm: Date; produto: string; tipo: string };

/** A iniciativa da novidade: criada na primeira atividade, reaproveitada nas outras. */
export async function garantirIniciativa(tx: Tx, sinal: SinalBase) {
  const existente = await tx.psOpsInitiative.findUnique({ where: { signalId: sinal.id } });
  if (existente) return existente;
  return tx.psOpsInitiative.create({
    data: {
      signalId: sinal.id,
      titulo: `Ciclo ${semanaIso(sinal.criadoEm)} · ${sinal.titulo.slice(0, 90)}`,
      ciclo: semanaIso(sinal.criadoEm),
    },
  });
}

/**
 * As atividades de UMA frente para as pessoas indicadas (Estudo: uma por SE).
 * `undefined` numa posição de `pessoas` = usar o dono do artefato sugerido.
 *
 *   · Estimativa já aponta para a estimativa do módulo do produto; Demo e
 *     Escopo apontam para o grupo — quais artefatos foram atualizados quem
 *     conclui é que diz
 *   · Estudo: UMA ficha da feature, compartilhada (criada na primeira vez)
 */
export async function criarAtividadesDaFrente(
  tx: Tx,
  args: {
    sinal: SinalBase;
    initiativeId: string;
    impacto: Impacto;
    pessoas: Array<string | null | undefined>;
    modulo: Modulo;
  },
): Promise<TriarResultado['atividades']> {
  const { sinal, impacto } = args;
  let artifactId: string | null = null;
  let donoArtefato: string | null = null;
  let nomeArt: string | null = null;
  if (impacto === Impacto.ESTIM) {
    const estimativas = await tx.psOpsArtifact.findMany({
      where: { chave: { startsWith: 'ESTIM:' } },
      select: { id: true, chave: true, nome: true, donoId: true },
    });
    const art = estimativaSugerida(sinal.produto, estimativas);
    if (art) {
      artifactId = art.id;
      donoArtefato = art.donoId;
      nomeArt = art.nome;
    }
  } else if (impacto !== Impacto.ESTUDO) {
    nomeArt = NOME_GRUPO[impacto] ?? null;
  }

  const saida: TriarResultado['atividades'] = [];
  let primeiraId: string | null = null;
  for (const p of args.pessoas) {
    const pessoa = p === undefined ? donoArtefato : p;
    const atividade = await tx.psOpsActivity.create({
      data: {
        initiativeId: args.initiativeId,
        tipo: impacto,
        titulo: tituloAtividade(impacto, sinal.titulo),
        artifactId,
        responsavelId: pessoa,
        dod: DOD_TEMPLATES[impacto]() as unknown as Prisma.InputJsonValue,
        criterioVerificavel: criterioSugerido(
          impacto,
          args.modulo,
          sinal.tipo as never,
          sinal.titulo,
        ) as unknown as Prisma.InputJsonValue,
      },
    });
    primeiraId ??= atividade.id;
    saida.push({ id: atividade.id, tipo: impacto, titulo: atividade.titulo, artefato: nomeArt, responsavelId: pessoa });
  }

  // ESTUDO: UMA ficha da feature, compartilhada pelos SEs (busca pelo sinal)
  if (impacto === Impacto.ESTUDO) {
    const ficha = await tx.psOpsStudyNote.findUnique({ where: { signalId: sinal.id } });
    if (!ficha) {
      await tx.psOpsStudyNote.create({
        data: { signalId: sinal.id, activityId: primeiraId, autorId: null, linksConsultados: [] },
      });
    }
  }
  return saida;
}

export async function descartar(
  prisma: PrismaClient,
  args: { signalId: string; usuarioId: string; motivo: string },
) {
  const sinal = await prisma.psOpsSignal.findUnique({ where: { id: args.signalId } });
  if (!sinal) throw new NaoEncontrado('Sinal');
  if (sinal.status === 'TRIADO') {
    throw new RegraDeNegocio('Sinal já triado não pode ser descartado.');
  }

  return prisma.$transaction(async (tx) => {
    await tx.psOpsTriage.upsert({
      where: { signalId: sinal.id },
      create: {
        signalId: sinal.id,
        usuarioId: args.usuarioId,
        impactos: [],
        motivoDescarte: args.motivo,
      },
      update: { motivoDescarte: args.motivo, usuarioId: args.usuarioId, impactos: [] },
    });
    return tx.psOpsSignal.update({
      where: { id: sinal.id },
      data: { status: 'DESCARTADO' },
    });
  });
}

/**
 * Triagem em lote — o que faz o ritual de 20 minutos caber.
 * Falha por item não interrompe o lote: devolve o que passou e o que não.
 */
export async function triarEmLote(
  prisma: PrismaClient,
  args: { itens: Array<{ signalId: string; impactos: Impacto[] }>; usuarioId: string },
) {
  const ok: TriarResultado[] = [];
  const falhas: Array<{ signalId: string; erro: string }> = [];

  for (const item of args.itens) {
    try {
      ok.push(await triar(prisma, { ...item, usuarioId: args.usuarioId }));
    } catch (e) {
      falhas.push({ signalId: item.signalId, erro: e instanceof Error ? e.message : String(e) });
    }
  }
  return { ok, falhas };
}
