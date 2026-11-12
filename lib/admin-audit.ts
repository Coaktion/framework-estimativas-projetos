/**
 * Registro de alterações feitas pelo painel Admin. SÓ SERVIDOR.
 *
 * Cada ação do Admin (biblioteca, categorias, skills, variáveis, usuários,
 * Calculadora AE, Zoho, atalhos, restaurações...) grava uma linha aqui. A aba
 * "Alterações do Admin" do changelog (só admin e SE) lista tudo, para o time
 * marcar o que já foi comunicado ("publicado") — o que vai para o arquivo e
 * pode ser desmarcado.
 *
 * Gravar o registro NUNCA derruba a ação do Admin: erro aqui só vai para o log.
 */
import prisma from '@/lib/prisma';

export type AdminArea =
  | 'library' | 'categories' | 'skills' | 'variables' | 'users' | 'snapshots'
  | 'aeCalculator' | 'zoho' | 'shortcuts' | 'deletedEstimates';

export async function recordAdminChange(entry: {
  userId: number | null;
  area: AdminArea;
  action: string;
  summary: string;
  details?: unknown;
}): Promise<void> {
  try {
    await prisma.adminChange.create({
      data: {
        userId: entry.userId,
        area: entry.area,
        action: entry.action,
        summary: String(entry.summary || '').slice(0, 2000),
        details: entry.details === undefined ? undefined : (JSON.parse(JSON.stringify(entry.details)) as any),
      },
    });
  } catch (error) {
    console.error('[admin-audit] não foi possível registrar a alteração:', error);
  }
}
