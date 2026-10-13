/**
 * Nomes de pessoas a partir do User do portal.
 *
 * O módulo guarda ids de pessoa como texto (o User do portal tem id inteiro).
 * Este é o único ponto que traduz id → nome; as telas recebem o nome pronto.
 */
import type { PrismaClient } from '@prisma/client';

export interface Pessoa {
  id: string;
  nome: string;
  iniciais: string;
}

export function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return (partes[0]![0]! + partes[partes.length - 1]![0]!).toUpperCase();
}

export async function pessoasPorId(
  prisma: PrismaClient,
  ids: Array<string | null | undefined>,
): Promise<Record<string, Pessoa>> {
  const numericos = Array.from(new Set(ids.filter((x): x is string => Boolean(x))))
    .map((x) => Number(x))
    .filter((n) => Number.isInteger(n));
  if (numericos.length === 0) return {};

  const usuarios = await prisma.user.findMany({
    where: { id: { in: numericos } },
    select: { id: true, name: true, email: true },
  });

  const saida: Record<string, Pessoa> = {};
  for (const u of usuarios) {
    const nome = u.name?.trim() || u.email.split('@')[0]!;
    saida[String(u.id)] = { id: String(u.id), nome, iniciais: iniciaisDe(nome) };
  }
  return saida;
}
