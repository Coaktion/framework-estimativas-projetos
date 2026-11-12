/**
 * Ponte Radar → Estudos: estudo concluído no Backlog do Radar vira um
 * registro no Acompanhamento semanal (EstudoRegistro), na categoria da
 * matriz de conhecimento que corresponde ao módulo da novidade.
 *
 *   · categoria pelo módulo do Zendesk (CATEGORIA_POR_PRODUTO), casada pela
 *     LETRA da categoria ("E. Zendesk IA & Automação…") — renomear a
 *     categoria na planilha não quebra a ponte
 *   · sem categoria correspondente (produto "Outro", categoria apagada), não
 *     registra: devolve a sugestão e a tela abre a janela para completar
 *   · um registro por atividade (EstudoRegistro.atividadeRadarId): concluir,
 *     reabrir e concluir de novo não duplica
 */
import type { PrismaClient } from '@prisma/client';
import { TIPOS_ATIVIDADE } from './calculo';
import { RegraDeNegocio } from '../psops/lib/http';

type Db = Pick<PrismaClient, 'estudoRegistro' | 'estudoTopico'>;

/** Módulo do Zendesk → letra da categoria na matriz de conhecimento. */
export const CATEGORIA_POR_PRODUTO: Record<string, string | null> = {
  ADMIN_SEGURANCA: 'A',
  SUPPORT: 'B',
  MESSAGING: 'C',
  CONTACT_CENTER: 'C',
  KNOWLEDGE: 'D',
  AI_AGENTS: 'E',
  COPILOT: 'E',
  ANALYTICS: 'F',
  WFM: 'F',
  QA: 'F',
  DEVELOPER_API: 'H',
  MARKETPLACE: 'H',
  OUTRO: null,
};

/** Tipo de atividade do registro: estudar uma novidade é ler a documentação. */
export const TIPO_ESTUDO_RADAR = 'Documentação';

export function categoriaDoProduto(produto: string, categorias: string[]): string | null {
  const letra = CATEGORIA_POR_PRODUTO[produto];
  if (!letra) return null;
  return categorias.find((c) => c.trim().toUpperCase().startsWith(`${letra}.`)) ?? null;
}

export async function categoriasDaMatriz(db: Db): Promise<string[]> {
  const topicos = (await db.estudoTopico.findMany({
    select: { categoria: true },
    orderBy: { ordem: 'asc' },
  })) as Array<{ categoria: string }>;
  return Array.from(new Set(topicos.map((t) => t.categoria))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** O que a janela de complemento mostra já preenchido. */
export interface SugestaoRegistroEstudo {
  activityId: string;
  userId: number;
  data: string;
  categoria: string | null;
  atividade: string;
  tipo: string;
  observacoes: string | null;
  categorias: string[];
}

export type ResultadoRegistroEstudo =
  | { registrado: true; id: string; categoria: string }
  | { registrado: false; motivo: 'sem_categoria' | 'sem_pessoa'; sugestao: SugestaoRegistroEstudo };

const hojeIso = (d: Date) => d.toISOString().slice(0, 10);

export async function registrarEstudoDoRadar(
  db: Db,
  args: {
    activityId: string;
    /** User.id do Radar (texto) de quem estudou */
    pessoaId: string | null;
    produto: string;
    feature: string;
    observacoes?: string | null;
    agora: Date;
  },
): Promise<ResultadoRegistroEstudo> {
  const categorias = await categoriasDaMatriz(db);
  const categoria = categoriaDoProduto(args.produto, categorias);
  const userId = args.pessoaId && /^\d+$/.test(args.pessoaId) ? Number(args.pessoaId) : null;
  const atividade = `Radar: ${args.feature}`.replace(/\s+/g, ' ').trim().slice(0, 500);
  const observacoes = args.observacoes?.trim().slice(0, 2000) || null;

  const sugestao: SugestaoRegistroEstudo = {
    activityId: args.activityId,
    userId: userId ?? 0,
    data: hojeIso(args.agora),
    categoria,
    atividade,
    tipo: TIPO_ESTUDO_RADAR,
    observacoes,
    categorias,
  };
  if (!userId) return { registrado: false, motivo: 'sem_pessoa', sugestao };
  if (!categoria) return { registrado: false, motivo: 'sem_categoria', sugestao };

  const reg = (await db.estudoRegistro.upsert({
    where: { atividadeRadarId: args.activityId },
    create: {
      userId,
      data: new Date(`${sugestao.data}T00:00:00Z`),
      categoria,
      atividade,
      tipo: TIPO_ESTUDO_RADAR,
      observacoes,
      criadoPor: userId,
      atividadeRadarId: args.activityId,
    },
    update: {},
  })) as { id: string };
  return { registrado: true, id: reg.id, categoria };
}

/**
 * Registro completado na janela (quando o automático não deu): mesmos campos
 * do Acompanhamento semanal, ligado à atividade do Radar.
 */
export async function registrarEstudoManual(
  db: Pick<PrismaClient, 'estudoRegistro'>,
  args: {
    activityId: string;
    userId: number;
    data: string;
    categoria: string | null;
    atividade: string;
    tipo: string | null;
    observacoes: string | null;
    criadoPor: number | null;
  },
): Promise<{ id: string }> {
  const atividade = String(args.atividade ?? '').trim();
  if (!Number.isInteger(args.userId) || args.userId <= 0) throw new RegraDeNegocio('Pessoa inválida.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.data)) throw new RegraDeNegocio('Data inválida.');
  if (atividade.length < 2 || atividade.length > 500) throw new RegraDeNegocio('Descreva o estudo (até 500 caracteres).');
  if (args.tipo && !(TIPOS_ATIVIDADE as readonly string[]).includes(args.tipo)) throw new RegraDeNegocio('Tipo inválido.');
  const dados = {
    userId: args.userId,
    data: new Date(`${args.data}T00:00:00Z`),
    categoria: args.categoria?.trim() || null,
    atividade,
    tipo: args.tipo || null,
    observacoes: args.observacoes?.trim().slice(0, 2000) || null,
  };
  return (await db.estudoRegistro.upsert({
    where: { atividadeRadarId: args.activityId },
    create: { ...dados, criadoPor: args.criadoPor, atividadeRadarId: args.activityId },
    update: dados,
  })) as { id: string };
}
