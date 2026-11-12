/**
 * Notificações do sininho do cabeçalho.
 *
 * Hoje há um tipo só: ATIVIDADE_NOVA — uma atividade do Backlog do Radar
 * caiu para a pessoa (na triagem ou ao ser reatribuída). O link abre a
 * atividade direto no Backlog.
 */
import type { PrismaClient } from '@prisma/client';

type Db = Pick<PrismaClient, 'notificacao'>;

const NOME_DESTINO: Record<string, string> = {
  ESTUDO: 'Estudo',
  DEMO: 'Demo',
  ESTIM: 'Estimativa',
  ESCOPO: 'Escopo',
  SKILL: 'Skill',
};

export const linkDaAtividade = (activityId: string) => `/pre-sales-ops/backlog?atividade=${encodeURIComponent(activityId)}`;

/** User.id guardado como texto no Radar → número; ids que não são de usuário do portal ficam de fora. */
const paraUserId = (id: string | null | undefined): number | null => {
  if (!id || !/^\d+$/.test(id)) return null;
  return Number(id);
};

/** Uma notificação por atividade com responsável. */
export async function notificarAtividadesNovas(
  db: Db,
  atividades: Array<{ id: string; tipo: string; responsavelId: string | null }>,
  feature: string,
): Promise<number> {
  const data = atividades
    .map((a) => ({ a, userId: paraUserId(a.responsavelId) }))
    .filter((x): x is { a: (typeof atividades)[number]; userId: number } => x.userId !== null)
    .map(({ a, userId }) => ({
      userId,
      tipo: 'ATIVIDADE_NOVA',
      titulo: `Nova atividade de ${NOME_DESTINO[a.tipo] ?? a.tipo}`,
      corpo: feature.slice(0, 300),
      link: linkDaAtividade(a.id),
    }));
  if (!data.length) return 0;
  return (await db.notificacao.createMany({ data })).count;
}

/**
 * Relato (bug ou sugestão) marcado como resolvido em /reports: avisa quem
 * enviou, com o que foi feito (quando quem resolveu escreveu) e um trecho do
 * relato. Não avisa a própria pessoa que resolveu.
 */
export async function notificarRelatoResolvido(
  db: Db,
  relato: { id: number; userId: number | null; kind: string; body: string; pageUrl?: string | null },
  resolvidoPor: number | null,
  nota?: string | null,
): Promise<boolean> {
  if (!relato.userId || relato.userId === resolvidoPor) return false;
  const tipo = relato.kind === 'bug' ? 'Seu bug' : 'Sua sugestão';
  const trecho = relato.body.replace(/\s+/g, ' ').trim().slice(0, 140);
  const corpo = [nota?.trim() ? `Atualização: ${nota.trim()}` : null, `Relato #${relato.id}: ${trecho}`]
    .filter(Boolean)
    .join(' — ')
    .slice(0, 600);
  await db.notificacao.create({
    data: {
      userId: relato.userId,
      tipo: 'RELATO_RESOLVIDO',
      titulo: `${tipo} foi ${relato.kind === 'bug' ? 'resolvido' : 'resolvida'}`,
      corpo,
      link: relato.pageUrl && relato.pageUrl.startsWith('/') ? relato.pageUrl : null,
    },
  });
  return true;
}

export async function listarNotificacoes(db: Db, userId: number, limite = 30) {
  const [itens, naoLidas] = await Promise.all([
    db.notificacao.findMany({ where: { userId }, orderBy: { criadoEm: 'desc' }, take: limite }),
    db.notificacao.count({ where: { userId, lidaEm: null } }),
  ]);
  return { itens, naoLidas };
}

/** Marca como lidas as indicadas, ou todas as da pessoa. Só mexe nas da própria pessoa. */
export async function marcarLidas(db: Db, userId: number, ids?: string[]): Promise<number> {
  const r = await db.notificacao.updateMany({
    where: { userId, lidaEm: null, ...(ids?.length ? { id: { in: ids } } : {}) },
    data: { lidaEm: new Date() },
  });
  return r.count;
}
