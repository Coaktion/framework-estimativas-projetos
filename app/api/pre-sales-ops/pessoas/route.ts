/**
 * GET /api/pre-sales-ops/pessoas — quem pode ser dono de artefato ou
 * responsável por atividade: os usuários do portal com acesso ao módulo.
 */
import { prisma } from '@/lib/psops/lib/db';
import { exigirUsuario } from '@/lib/psops/lib/auth';
import { handler, ok } from '@/lib/psops/lib/http';
import { canAccessPreSalesOps } from '@/lib/segments';
import { iniciaisDe } from '@/lib/psops/services/usuarios';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handler(async () => {
    const eu = await exigirUsuario();
    // A tabela de usuários do portal é pequena; o filtro de acesso usa a
    // MESMA regra do menu (lib/segments.ts), inclusive os segmentos legados.
    const usuarios = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, isAdmin: true },
      orderBy: { name: 'asc' },
    });
    const itens = usuarios
      .filter((u) => canAccessPreSalesOps({ isAdmin: u.isAdmin, role: u.role }))
      .map((u) => {
        const nome = u.name?.trim() || u.email.split('@')[0]!;
        return { id: String(u.id), nome, iniciais: iniciaisDe(nome) };
      });
    return ok({ itens, euId: eu.id });
  });
}
