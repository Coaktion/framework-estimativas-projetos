/**
 * Decisão de elegibilidade POR DONO de frente.
 *
 * Em vez de uma pessoa decidir por todo o time, cada frente tem dono
 * (config/responsaveis.ts): Demo → Renato, Estimativa → Arthur, Escopo →
 * Elisa, e Estudo → cada SE, individualmente. Na tela de decisão:
 *
 *   · marcar uma frente SUA efetiva: a atividade nasce no seu Backlog
 *   · deixar uma frente sua desmarcada é "não vou fazer" — sai da sua fila
 *   · marcar a frente de OUTRA pessoa vira sugestão: ela vê "Sugerido por
 *     você" na própria tela de decisão (e recebe aviso no sininho), com a
 *     frente já marcada, e decide
 *   · a novidade sai da fila geral quando todos os donos decidiram: TRIADO se
 *     alguém vai fazer, DESCARTADO se ninguém vai
 *
 * Frente sem dono configurado é decidida por quem estiver triando (como antes).
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import { Impacto, IMPACTOS_ORDEM, type Modulo } from '../config/taxonomy';
import { resolverResponsaveis, type ResponsaveisResolvidos } from '../config/responsaveis';
import { NaoEncontrado, RegraDeNegocio } from '../lib/http';
import { criarAtividadesDaFrente, garantirIniciativa, type TriarResultado } from './triage';

export const FAZER = 'FAZER';
export const NAO_FAZER = 'NAO_FAZER';

export interface LinhaDecisao {
  impacto: Impacto;
  donoId: string;
  decisao: string | null;
  sugeridoPor: string | null;
}

/** Frentes de que a pessoa é dona. */
export function frentesDe(usuarioId: string, responsaveis: ResponsaveisResolvidos): Impacto[] {
  return IMPACTOS_ORDEM.filter((i) => (responsaveis[i] ?? []).includes(usuarioId));
}

/** Frentes da pessoa que ainda esperam a decisão dela nesta novidade. */
export function pendentesDe(usuarioId: string, responsaveis: ResponsaveisResolvidos, decisoes: LinhaDecisao[]): Impacto[] {
  return frentesDe(usuarioId, responsaveis).filter(
    (i) => !decisoes.some((d) => d.impacto === i && d.donoId === usuarioId && d.decisao),
  );
}

/** Todos os donos de todas as frentes decidiram? */
export function todosDecidiram(responsaveis: ResponsaveisResolvidos, decisoes: LinhaDecisao[]): boolean {
  return IMPACTOS_ORDEM.every((i) =>
    (responsaveis[i] ?? []).every((dono) => decisoes.some((d) => d.impacto === i && d.donoId === dono && d.decisao)),
  );
}

export interface ResultadoDecisao {
  /** atividades criadas no Backlog de quem decidiu */
  atividades: TriarResultado['atividades'];
  /** sugestões deixadas para outros donos */
  sugestoes: Array<{ impacto: Impacto; donoId: string }>;
  /** frentes que a pessoa disse que não vai fazer */
  naoFazer: Impacto[];
  /** status da novidade depois da decisão */
  status: 'NOVO' | 'TRIADO' | 'DESCARTADO';
}

export async function decidir(
  prisma: PrismaClient,
  args: {
    signalId: string;
    usuarioId: string;
    /** as frentes marcadas na tela */
    marcados: Impacto[];
    nota?: string | null;
    responsaveis?: ResponsaveisResolvidos;
    agora?: Date;
  },
): Promise<ResultadoDecisao> {
  const agora = args.agora ?? new Date();
  const sinal = await prisma.psOpsSignal.findUnique({ where: { id: args.signalId } });
  if (!sinal) throw new NaoEncontrado('Sinal');
  if (sinal.status !== 'NOVO') throw new RegraDeNegocio('Esta novidade já saiu da fila de triagem.');

  const responsaveis = args.responsaveis ?? (await resolverResponsaveis(prisma));
  const eu = args.usuarioId;
  const marcados = IMPACTOS_ORDEM.filter((i) => args.marcados.includes(i));
  const minhas = frentesDe(eu, responsaveis);
  const semDono = IMPACTOS_ORDEM.filter((i) => (responsaveis[i] ?? []).length === 0);

  const anteriores = (await prisma.psOpsDecisao.findMany({ where: { signalId: sinal.id } })) as LinhaDecisao[];
  const jaDecidi = (i: Impacto) => anteriores.some((d) => d.impacto === i && d.donoId === eu && d.decisao);

  // Nada a decidir: não é dono de nada pendente e não marcou nada
  const pendentesMinhas = minhas.filter((i) => !jaDecidi(i));
  const sugerir = marcados.filter((i) => !minhas.includes(i) && !semDono.includes(i));
  const semDonoMarcadas = marcados.filter((i) => semDono.includes(i));
  if (!pendentesMinhas.length && !sugerir.length && !semDonoMarcadas.length) {
    throw new RegraDeNegocio(
      minhas.length ? 'Você já decidiu as suas frentes nesta novidade.' : 'Marque ao menos uma frente para sugerir.',
    );
  }

  return prisma.$transaction(async (tx) => {
    const r: ResultadoDecisao = { atividades: [], sugestoes: [], naoFazer: [], status: 'NOVO' };
    let initiativeId: string | null = null;
    const iniciativa = async () => (initiativeId ??= (await garantirIniciativa(tx, sinal)).id);

    // 1. as minhas frentes: marcar efetiva, desmarcar é "não vou fazer"
    for (const impacto of pendentesMinhas) {
      const faz = marcados.includes(impacto);
      let activityId: string | null = null;
      if (faz) {
        const criadas = await criarAtividadesDaFrente(tx, {
          sinal,
          initiativeId: await iniciativa(),
          impacto,
          pessoas: [eu],
          modulo: sinal.modulo as Modulo,
        });
        activityId = criadas[0]?.id ?? null;
        r.atividades.push(...criadas);
      } else {
        r.naoFazer.push(impacto);
      }
      await tx.psOpsDecisao.upsert({
        where: { signalId_impacto_donoId: { signalId: sinal.id, impacto, donoId: eu } },
        create: { signalId: sinal.id, impacto, donoId: eu, decisao: faz ? FAZER : NAO_FAZER, decididoEm: agora, activityId },
        update: { decisao: faz ? FAZER : NAO_FAZER, decididoEm: agora, activityId },
      });
    }

    // 2. frente sem dono configurado: quem tria decide (como antes)
    for (const impacto of semDonoMarcadas) {
      r.atividades.push(
        ...(await criarAtividadesDaFrente(tx, {
          sinal,
          initiativeId: await iniciativa(),
          impacto,
          pessoas: [undefined],
          modulo: sinal.modulo as Modulo,
        })),
      );
    }

    // 3. frentes dos outros: sugestão para cada dono que ainda não decidiu
    for (const impacto of sugerir) {
      for (const dono of responsaveis[impacto] ?? []) {
        if (dono === eu) continue;
        const ant = anteriores.find((d) => d.impacto === impacto && d.donoId === dono);
        if (ant?.decisao || ant?.sugeridoPor) continue; // já decidiu, ou já tem sugestão
        await tx.psOpsDecisao.upsert({
          where: { signalId_impacto_donoId: { signalId: sinal.id, impacto, donoId: dono } },
          create: { signalId: sinal.id, impacto, donoId: dono, sugeridoPor: eu, sugeridoEm: agora },
          update: { sugeridoPor: eu, sugeridoEm: agora },
        });
        r.sugestoes.push({ impacto, donoId: dono });
      }
    }

    // 4. todos os donos decidiram? a novidade sai da fila geral
    const depois = (await tx.psOpsDecisao.findMany({ where: { signalId: sinal.id } })) as LinhaDecisao[];
    const fazendo = depois.filter((d) => d.decisao === FAZER).map((d) => d.impacto);
    const algumaAtividade = fazendo.length > 0 || semDonoMarcadas.length > 0 || Boolean(initiativeId);
    if (todosDecidiram(responsaveis, depois)) {
      r.status = algumaAtividade ? 'TRIADO' : 'DESCARTADO';
      await tx.psOpsSignal.update({ where: { id: sinal.id }, data: { status: r.status } });
    }

    // histórico da triagem (uma linha por novidade): quem decidiu por último,
    // o que já vai ser feito e as notas
    const impactosFeitos = IMPACTOS_ORDEM.filter((i) => fazendo.includes(i) || semDonoMarcadas.includes(i));
    await tx.psOpsTriage.upsert({
      where: { signalId: sinal.id },
      create: {
        signalId: sinal.id,
        usuarioId: eu,
        impactos: impactosFeitos,
        nota: args.nota ?? null,
        motivoDescarte: r.status === 'DESCARTADO' ? 'Nenhum dono vai fazer.' : null,
      },
      update: {
        usuarioId: eu,
        decididoEm: agora,
        impactos: impactosFeitos,
        ...(args.nota ? { nota: args.nota } : {}),
        ...(r.status === 'DESCARTADO' ? { motivoDescarte: 'Nenhum dono vai fazer.' } : {}),
      },
    });

    // o sininho de quem recebeu sugestão
    if (r.sugestoes.length) {
      const porDono = new Map<string, Impacto[]>();
      r.sugestoes.forEach((s) => porDono.set(s.donoId, [...(porDono.get(s.donoId) ?? []), s.impacto]));
      const data: Prisma.NotificacaoCreateManyInput[] = [];
      porDono.forEach((impactos, dono) => {
        if (!/^\d+$/.test(dono)) return;
        data.push({
          userId: Number(dono),
          tipo: 'SUGESTAO_TRIAGEM',
          titulo: `Sugestão na triagem: ${impactos.map((i) => NOME_FRENTE[i]).join(', ')}`,
          corpo: (sinal.tituloPt || sinal.titulo).slice(0, 300),
          link: linkDaTriagem(sinal.id),
        });
      });
      if (data.length) await tx.notificacao.createMany({ data });
    }

    return r;
  });
}

const NOME_FRENTE: Record<Impacto, string> = {
  ESTUDO: 'Estudo',
  DEMO: 'Demo',
  ESTIM: 'Estimativa',
  ESCOPO: 'Escopo',
};

export const linkDaTriagem = (signalId: string) => `/pre-sales-ops/triagem?sinal=${encodeURIComponent(signalId)}`;

/** Sugestões e decisões da novidade, para a tela. */
export async function decisoesDoSinal(prisma: Pick<PrismaClient, 'psOpsDecisao'>, signalId: string) {
  return (await prisma.psOpsDecisao.findMany({ where: { signalId } })) as LinhaDecisao[];
}

