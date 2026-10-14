/**
 * Camadas 3 e 4 — triagem e geração.
 *
 * O triador não escreve tarefa: ele marca ONDE impacta. Este serviço traduz
 * essa decisão em uma Iniciativa e N Atividades, cada uma com Definition of
 * Done do template e responsável herdado do dono do artefato.
 *
 * Regras que este arquivo garante:
 *   · ESTUDO não toca artefato — cria a ficha da feature (PsOpsStudyNote)
 *   · DEMO / ESTIM / ESCOPO tocam o artefato correspondente, criando-o se
 *     ainda não existir (sem dono, e isso fica visível no mapa)
 *   · o responsável vem do dono do artefato, não de sorteio
 *   · triar duas vezes o mesmo sinal é erro de negócio, não duplicação
 */

import type { PrismaClient, Prisma } from '@prisma/client';
import {
  Impacto,
  IMPACTOS_ORDEM,
  MODULO_LABEL,
  chaveArtefato,
  type Modulo,
} from '../config/taxonomy';
import { DOD_TEMPLATES, criterioSugerido, tituloAtividade } from '../config/dod';
import { semanaIso } from '../ingest/collector';
import { NaoEncontrado, RegraDeNegocio } from '../lib/http';

export interface TriarInput {
  signalId: string;
  impactos: Impacto[];
  usuarioId: string;
  nota?: string | null;
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

/** Nome legível do artefato a partir da chave. */
function nomeArtefato(chave: string, modulo: Modulo): string {
  if (chave === 'DEMO_TEMPLATE') return 'Template de demo · zd_auto_template';
  const [tipo] = chave.split(':');
  return `${tipo === 'FRAMEWORK' ? 'Framework' : 'Bloco escopo'} · ${MODULO_LABEL[modulo]}`;
}

function tipoArtefatoDaChave(chave: string): 'DEMO_TEMPLATE' | 'FRAMEWORK' | 'ESCOPO' {
  if (chave === 'DEMO_TEMPLATE') return 'DEMO_TEMPLATE';
  return chave.startsWith('FRAMEWORK') ? 'FRAMEWORK' : 'ESCOPO';
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

  const resultado = await prisma.$transaction(async (tx) => {
    const initiative = await tx.psOpsInitiative.create({
      data: {
        signalId: sinal.id,
        titulo: `Ciclo ${semanaIso(sinal.criadoEm)} · ${sinal.titulo.slice(0, 90)}`,
        ciclo: semanaIso(sinal.criadoEm),
      },
    });

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
      const chave = chaveArtefato(impacto, modulo);

      let artifactId: string | null = null;
      let responsavelId: string | null = null;
      let nomeArt: string | null = null;

      if (chave) {
        let art = await tx.psOpsArtifact.findUnique({ where: { chave } });
        if (!art) {
          // Artefato ainda não existe no mapa. Criar sem dono é deliberado: o
          // card cai no filtro "sem responsável" e alguém precisa assumir.
          art = await tx.psOpsArtifact.create({
            data: {
              chave,
              tipo: tipoArtefatoDaChave(chave),
              modulo: chave === 'DEMO_TEMPLATE' ? null : modulo,
              nome: nomeArtefato(chave, modulo),
            },
          });
          artefatosCriados.push(art.nome);
        }
        artifactId = art.id;
        responsavelId = art.donoId;
        nomeArt = art.nome;
      }

      const atividade = await tx.psOpsActivity.create({
        data: {
          initiativeId: initiative.id,
          tipo: impacto,
          titulo: tituloAtividade(impacto, sinal.titulo),
          artifactId,
          responsavelId,
          dod: DOD_TEMPLATES[impacto]() as unknown as Prisma.InputJsonValue,
          criterioVerificavel: criterioSugerido(
            impacto,
            modulo,
            sinal.tipo,
            sinal.titulo,
          ) as unknown as Prisma.InputJsonValue,
        },
      });

      // ESTUDO gera a ficha da feature, já vinculada ao sinal e à atividade.
      if (impacto === Impacto.ESTUDO) {
        await tx.psOpsStudyNote.create({
          data: {
            signalId: sinal.id,
            activityId: atividade.id,
            autorId: null,
            linksConsultados: [],
          },
        });
      }

      atividades.push({
        id: atividade.id,
        tipo: impacto,
        titulo: atividade.titulo,
        artefato: nomeArt,
        responsavelId,
      });
    }

    await tx.psOpsSignal.update({
      where: { id: sinal.id },
      data: { status: 'TRIADO' },
    });

    return { initiativeId: initiative.id, atividades };
  });

  return { ...resultado, artefatosCriados };
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
