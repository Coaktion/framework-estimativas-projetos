/**
 * Quem responde por cada destino da triagem.
 *
 *   Estudo     → todos os SEs (uma atividade para cada um)
 *   Demo       → Renato
 *   Estimativa → Arthur
 *   Escopo     → Elisa
 *
 * Por e-mail, e não por id, para ler e manter: o e-mail do login Google é o
 * que identifica a pessoa no portal. Quem não for encontrado no cadastro de
 * usuários é ignorado (a atividade nasce sem responsável e aparece em "Sem
 * responsável" no Backlog), então trocar alguém do time é só editar a lista.
 */
import type { PrismaClient } from '@prisma/client';
import { Impacto } from './taxonomy';

export const RESPONSAVEIS_POR_IMPACTO: Record<Impacto, readonly string[]> = {
  [Impacto.ESTUDO]: [
    'rzanetti@aktienow.com',
    'aoliveira@aktienow.com',
    'msouza@aktienow.com',
    'esimicevic@aktienow.com',
    'fcastro@aktienow.com',
  ],
  [Impacto.DEMO]: ['rzanetti@aktienow.com'],
  [Impacto.ESTIM]: ['aoliveira@aktienow.com'],
  [Impacto.ESCOPO]: ['esimicevic@aktienow.com'],
};

/** Ids (como texto, no padrão do módulo) dos responsáveis de cada destino. */
export type ResponsaveisResolvidos = Record<Impacto, string[]>;

export async function resolverResponsaveis(
  prisma: Pick<PrismaClient, 'user'>,
): Promise<ResponsaveisResolvidos> {
  const emails = Array.from(new Set(Object.values(RESPONSAVEIS_POR_IMPACTO).flat()));
  const usuarios = (await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true },
  })) as Array<{ id: number | string; email: string }>;
  const idPorEmail = new Map(usuarios.map((u) => [u.email.toLowerCase(), String(u.id)]));

  const saida = {} as ResponsaveisResolvidos;
  (Object.keys(RESPONSAVEIS_POR_IMPACTO) as Impacto[]).forEach((impacto) => {
    saida[impacto] = RESPONSAVEIS_POR_IMPACTO[impacto]
      .map((e) => idPorEmail.get(e.toLowerCase()))
      .filter((id): id is string => Boolean(id));
  });
  return saida;
}
