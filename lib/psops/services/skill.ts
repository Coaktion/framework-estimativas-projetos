/**
 * Tarefa de atualização da skill de escopo.
 *
 * Quando um documento de estimativa (artefato ESTIM:*) recebe um commit — no
 * Mapa ou na conclusão de uma atividade de Estimativa —, a skill que gera os
 * escopos a partir do Framework precisa acompanhar. Isso vira uma atividade
 * SKILL no Backlog para o responsável (config/responsaveis.ts), com aviso no
 * sininho.
 *
 *   · uma tarefa aberta por artefato: commits seguidos no mesmo documento não
 *     duplicam o card; o responsável é avisado de novo e o histórico de
 *     commits do Mapa mostra tudo o que mudou
 *   · a tarefa herda a novidade (initiative) quando o commit veio da conclusão
 *     de uma atividade; commit direto no Mapa gera tarefa sem novidade
 */
import type { PrismaClient } from '@prisma/client';
import { RESPONSAVEL_SKILL } from '../config/responsaveis';
import { notificarAtividadesNovas } from '../../notificacoes';

type Db = Pick<PrismaClient, 'psOpsActivity' | 'user' | 'notificacao'>;

export const ehDocumentoDeEstimativa = (chave: string) => chave.startsWith('ESTIM:');

/** "Estimativa · Zendesk Voice" → "Zendesk Voice" */
const nomeDoModulo = (nome: string) => nome.replace(/^Estimativa\s*·\s*/i, '');

export async function gerarTarefaDeSkill(
  db: Db,
  args: {
    artefato: { id: string; chave: string; nome: string };
    descricao: string;
    activityId?: string | null;
  },
): Promise<{ id: string; nova: boolean } | null> {
  if (!ehDocumentoDeEstimativa(args.artefato.chave)) return null;

  const [usuario] = (await db.user.findMany({
    where: { email: { in: [RESPONSAVEL_SKILL] } },
    select: { id: true },
  })) as Array<{ id: number | string }>;
  const responsavelId = usuario ? String(usuario.id) : null;

  const modulo = nomeDoModulo(args.artefato.nome);
  const resumo = args.descricao.replace(/\s+/g, ' ').trim().slice(0, 300);

  const aberta = (await db.psOpsActivity.findFirst({
    where: { tipo: 'SKILL', artifactId: args.artefato.id, status: { in: ['TODO', 'DOING'] } },
    select: { id: true, responsavelId: true },
  })) as { id: string; responsavelId: string | null } | null;
  if (aberta) {
    await notificarAtividadesNovas(
      db,
      [{ id: aberta.id, tipo: 'SKILL', responsavelId: aberta.responsavelId ?? responsavelId }],
      `${modulo}: ${resumo}`,
    );
    return { id: aberta.id, nova: false };
  }

  // a novidade de origem, quando o commit veio de uma atividade
  let initiativeId: string | null = null;
  if (args.activityId) {
    const origem = (await db.psOpsActivity.findUnique({
      where: { id: args.activityId },
      select: { initiativeId: true },
    })) as { initiativeId: string | null } | null;
    initiativeId = origem?.initiativeId ?? null;
  }

  const tarefa = (await db.psOpsActivity.create({
    data: {
      tipo: 'SKILL',
      titulo: `Atualizar skill · ${modulo}: ${resumo}`.slice(0, 300),
      artifactId: args.artefato.id,
      initiativeId,
      responsavelId,
      dod: [],
    },
  })) as { id: string };
  await notificarAtividadesNovas(db, [{ id: tarefa.id, tipo: 'SKILL', responsavelId }], `${modulo}: ${resumo}`);
  return { id: tarefa.id, nova: true };
}
