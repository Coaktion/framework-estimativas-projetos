'use server';

/**
 * Escritas da área Estudos. Toda action exige um SC (ou ADMIN) logado e
 * devolve { ok } — os erros viram códigos que a tela traduz.
 */
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { PRIORIDADES, TIPOS_ATIVIDADE } from '@/lib/estudos/calculo';
import { requireEstudosUser } from '@/lib/estudos/server';

type Resultado = { ok: boolean; id?: string; error?: string };

const falha = (e: unknown): Resultado => {
  const msg = e instanceof Error ? e.message : String(e);
  if (['forbidden', 'invalid', 'not_found'].includes(msg)) return { ok: false, error: msg };
  console.error('[estudos]', e);
  return { ok: false, error: 'server_error' };
};

const DATA_RX = /^\d{4}-\d{2}-\d{2}$/;

export interface RegistroInput {
  id?: string;
  userId: number;
  data: string;
  categoria: string | null;
  atividade: string;
  tipo: string | null;
  observacoes: string | null;
}

function validarRegistro(r: RegistroInput) {
  const atividade = String(r.atividade ?? '').trim();
  if (!Number.isInteger(r.userId) || !DATA_RX.test(r.data) || atividade.length < 2 || atividade.length > 500) {
    throw new Error('invalid');
  }
  if (r.tipo && !(TIPOS_ATIVIDADE as readonly string[]).includes(r.tipo)) throw new Error('invalid');
  return {
    userId: r.userId,
    data: new Date(`${r.data}T00:00:00Z`),
    categoria: r.categoria?.trim() || null,
    atividade,
    tipo: r.tipo || null,
    observacoes: r.observacoes?.trim().slice(0, 2000) || null,
  };
}

export async function salvarRegistroAction(r: RegistroInput): Promise<Resultado> {
  try {
    const u = await requireEstudosUser();
    const data = validarRegistro(r);
    if (r.id) {
      const existe = await prisma.estudoRegistro.findUnique({ where: { id: r.id } });
      if (!existe) throw new Error('not_found');
      await prisma.estudoRegistro.update({ where: { id: r.id }, data });
      revalidatePath('/estudos');
      return { ok: true, id: r.id };
    }
    const criado = await prisma.estudoRegistro.create({ data: { ...data, criadoPor: u.id } });
    revalidatePath('/estudos');
    return { ok: true, id: criado.id };
  } catch (e) {
    return falha(e);
  }
}

export async function apagarRegistroAction(id: string): Promise<Resultado> {
  try {
    await requireEstudosUser();
    await prisma.estudoRegistro.delete({ where: { id } });
    revalidatePath('/estudos');
    return { ok: true };
  } catch (e) {
    return falha(e);
  }
}

/** Nível 0–4 de uma pessoa num tópico; null apaga (célula vazia). */
export async function definirNivelAction(topicoId: string, userId: number, nivel: number | null): Promise<Resultado> {
  try {
    const u = await requireEstudosUser();
    if (!Number.isInteger(userId)) throw new Error('invalid');
    if (nivel === null) {
      await prisma.estudoNivel.deleteMany({ where: { topicoId, userId } });
    } else {
      if (!Number.isInteger(nivel) || nivel < 0 || nivel > 4) throw new Error('invalid');
      await prisma.estudoNivel.upsert({
        where: { topicoId_userId: { topicoId, userId } },
        create: { topicoId, userId, nivel, atualizadoPor: u.id },
        update: { nivel, atualizadoPor: u.id },
      });
    }
    return { ok: true };
  } catch (e) {
    return falha(e);
  }
}

/** Nível-alvo (0–4 ou vazio) e prioridade (Alta, Média, Baixa ou vazio) do tópico. */
export async function definirMetaAction(
  topicoId: string,
  meta: { nivelAlvo?: number | null; prioridade?: string | null },
): Promise<Resultado> {
  try {
    await requireEstudosUser();
    const data: { nivelAlvo?: number | null; prioridade?: string | null } = {};
    if (meta.nivelAlvo !== undefined) {
      if (meta.nivelAlvo !== null && (!Number.isInteger(meta.nivelAlvo) || meta.nivelAlvo < 0 || meta.nivelAlvo > 4)) {
        throw new Error('invalid');
      }
      data.nivelAlvo = meta.nivelAlvo;
    }
    if (meta.prioridade !== undefined) {
      if (meta.prioridade !== null && !(PRIORIDADES as readonly string[]).includes(meta.prioridade)) throw new Error('invalid');
      data.prioridade = meta.prioridade;
    }
    await prisma.estudoTopico.update({ where: { id: topicoId }, data });
    return { ok: true };
  } catch (e) {
    return falha(e);
  }
}
