/**
 * Cliente Prisma do módulo = o singleton do portal.
 *
 * Um PrismaClient só por processo: dois clientes dobrariam o pool de conexões
 * com o Neon. Os serviços recebem o client por parâmetro (é o que permite os
 * testes rodarem sem banco); as rotas passam este aqui.
 */
import prisma from '@/lib/prisma';

export { prisma };
