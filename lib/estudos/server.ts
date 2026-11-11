/**
 * Estudos do time — acesso, carga inicial e leitura/escrita no banco.
 *
 * Quem vê: SCs (e ADMIN). Como na planilha, qualquer SC pode registrar e
 * ajustar; o padrão de cada formulário é a própria pessoa.
 */
import { getServerSession } from 'next-auth';
import type { PrismaClient } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { canAccessEstudos, normalizeSegment } from '@/lib/segments';
import { PESSOA_POR_NOME, REGISTROS_INICIAIS, TOPICOS_INICIAIS } from './dados-iniciais';

export type EstudosUser = { id: number; nome: string; isAdmin: boolean };

export async function getEstudosUser(): Promise<EstudosUser | null> {
  const session: any = await getServerSession(authOptions);
  const u = session?.user;
  if (!u?.id || !canAccessEstudos(u)) return null;
  return { id: Number(u.id), nome: String(u.name || u.email || ''), isAdmin: Boolean(u.isAdmin) };
}

export async function requireEstudosUser(): Promise<EstudosUser> {
  const u = await getEstudosUser();
  if (!u) throw new Error('forbidden');
  return u;
}

type Db = Pick<PrismaClient, 'user' | 'estudoTopico' | 'estudoNivel' | 'estudoRegistro' | '$transaction'>;

/**
 * Quem não aparece em Estudos, mesmo sendo SC: a conta genérica de admin e
 * quem não faz parte do time de estudos.
 */
export const OCULTOS_EM_ESTUDOS = ['admin@aktienow.com', 'tmunari@aktienow.com'];

/** Ordem da planilha primeiro (Renato, Matheus, Arthur, Elisa), depois por nome. */
const ORDEM_PLANILHA = Object.values(PESSOA_POR_NOME);

/**
 * Importa a planilha uma única vez: tópicos e níveis quando não há tópico
 * nenhum; registros semanais quando não há registro nenhum. Idempotente.
 */
export async function garantirCargaInicial(db: Db): Promise<{ topicos: number; registros: number }> {
  const emails = Object.values(PESSOA_POR_NOME);
  const usuarios = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } });
  const idPorEmail = new Map(usuarios.map((u) => [u.email.toLowerCase(), u.id]));
  const idPorNome = (nome: string) => idPorEmail.get((PESSOA_POR_NOME[nome] ?? '').toLowerCase());

  let topicos = 0;
  if ((await db.estudoTopico.count()) === 0) {
    for (let ordem = 0; ordem < TOPICOS_INICIAIS.length; ordem++) {
      const t = TOPICOS_INICIAIS[ordem]!;
      const criado = await db.estudoTopico.upsert({
        where: { categoria_topico: { categoria: t.categoria, topico: t.topico } },
        create: { categoria: t.categoria, topico: t.topico, descricao: t.descricao, ordem },
        update: {},
      });
      const niveis = Object.entries(t.niveis)
        .map(([nome, nivel]) => ({ userId: idPorNome(nome), nivel }))
        .filter((n): n is { userId: number; nivel: number } => typeof n.userId === 'number');
      if (niveis.length) {
        await db.estudoNivel.createMany({
          data: niveis.map((n) => ({ topicoId: criado.id, userId: n.userId, nivel: n.nivel })),
          skipDuplicates: true,
        });
      }
      topicos += 1;
    }
  }

  let registros = 0;
  if ((await db.estudoRegistro.count()) === 0) {
    const data = REGISTROS_INICIAIS.map((r) => ({ ...r, userId: idPorNome(r.pessoa) }))
      .filter((r): r is typeof r & { userId: number } => typeof r.userId === 'number')
      .map((r) => ({
        userId: r.userId,
        data: new Date(`${r.data}T00:00:00Z`),
        categoria: r.categoria,
        atividade: r.atividade || '—',
        tipo: r.tipo,
        observacoes: r.observacoes,
      }));
    if (data.length) registros = (await db.estudoRegistro.createMany({ data })).count;
  }
  return { topicos, registros };
}

export interface PessoaEstudo { id: number; nome: string; iniciais: string }

export interface DadosEstudos {
  pessoas: PessoaEstudo[];
  topicos: Array<{ id: string; categoria: string; topico: string; descricao: string | null; nivelAlvo: number | null; prioridade: string | null }>;
  niveis: Array<{ topicoId: string; userId: number; nivel: number }>;
  registros: Array<{ id: string; userId: number; data: string; categoria: string | null; atividade: string; tipo: string | null; observacoes: string | null }>;
}

const iniciais = (nome: string) =>
  nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?';

/** Tudo o que as quatro abas usam, numa leitura só. */
export async function carregarEstudos(db: Db): Promise<DadosEstudos> {
  const [topicos, niveis, registros, scs] = await Promise.all([
    db.estudoTopico.findMany({ orderBy: [{ ordem: 'asc' }, { categoria: 'asc' }, { topico: 'asc' }] }),
    db.estudoNivel.findMany({ select: { topicoId: true, userId: true, nivel: true } }),
    db.estudoRegistro.findMany({ orderBy: [{ data: 'desc' }, { criadoEm: 'desc' }] }),
    db.user.findMany({ select: { id: true, name: true, email: true, role: true } }),
  ]);

  // Pessoas: todo SC, mais quem já tem nível ou registro (ex.: alguém que mudou de segmento)
  const comDados = new Set<number>([...niveis.map((n) => n.userId), ...registros.map((r) => r.userId)]);
  const pessoas = scs
    .filter((u) => !OCULTOS_EM_ESTUDOS.includes(u.email.toLowerCase()))
    .filter((u) => normalizeSegment(u.role) === 'SC' || comDados.has(u.id))
    .map((u) => ({ id: u.id, nome: u.name || u.email.split('@')[0]!, email: u.email.toLowerCase() }))
    .sort((a, b) => {
      const ia = ORDEM_PLANILHA.indexOf(a.email), ib = ORDEM_PLANILHA.indexOf(b.email);
      if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      return a.nome.localeCompare(b.nome, 'pt-BR');
    })
    .map(({ id, nome }) => ({ id, nome, iniciais: iniciais(nome) }));

  return {
    pessoas,
    topicos: topicos.map((t) => ({
      id: t.id, categoria: t.categoria, topico: t.topico, descricao: t.descricao,
      nivelAlvo: t.nivelAlvo, prioridade: t.prioridade,
    })),
    niveis,
    registros: registros.map((r) => ({
      id: r.id, userId: r.userId, data: r.data.toISOString().slice(0, 10),
      categoria: r.categoria, atividade: r.atividade, tipo: r.tipo, observacoes: r.observacoes,
    })),
  };
}
