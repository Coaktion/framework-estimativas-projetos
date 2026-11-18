'use server';

/**
 * Escritas do Scoping. Toda action exige acesso ao Scoping e devolve
 * { ok, error? } com códigos que a tela traduz: forbidden, invalid,
 * not_found, conflict, completed, incomplete, server_error.
 *
 * Só grava nas tabelas scoping_*.
 */

import { revalidatePath } from 'next/cache';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { latestBankVersionId, loadBank } from '@/lib/scoping/bank';
import { completeness } from '@/lib/scoping/rules';
import {
  estimateFor, requireScopingUser, toSessionAnswer, userNames, type SessionEstimate,
} from '@/lib/scoping/server';
import {
  ANSWER_STATUSES, DEPLOYMENT_TYPES, PLANS, SCOPING_LANGS, SKUS, answerValueSchema,
  type AnswerStatus, type SessionAnswer,
} from '@/lib/scoping/types';

type Fail = { ok: false; error: string };

const fail = (e: unknown): Fail => {
  const msg = e instanceof Error ? e.message : String(e);
  if (['forbidden', 'invalid', 'not_found', 'completed', 'incomplete'].includes(msg)) return { ok: false, error: msg };
  // Sem dado de cliente no log (RNF-04): só o tipo do erro.
  console.error('[scoping] erro', e instanceof Error ? e.name : typeof e);
  return { ok: false, error: 'server_error' };
};

const json = (v: unknown) => v as Prisma.InputJsonValue;
const DATE_RX = /^\d{4}-\d{2}-\d{2}$/;

async function openSession(id: string, opts: { allowCompleted?: boolean } = {}) {
  const s = await prisma.scopingSession.findUnique({ where: { id: String(id) } });
  if (!s || s.deletedAt) throw new Error('not_found');
  if (!opts.allowCompleted && s.status === 'concluida') throw new Error('completed');
  return s;
}

function cleanTracks(trackKeys: unknown, valid: Set<string>): string[] {
  if (!Array.isArray(trackKeys)) throw new Error('invalid');
  return Array.from(new Set(trackKeys.map(String).filter((k) => valid.has(k) && k !== 'core')));
}

// ---------------------------------------------------------------------------
// Sessão
// ---------------------------------------------------------------------------

export interface SessionInput {
  clientName: string;
  title?: string;
  language: string;
  deploymentType: string;
  sku: string;
  plan: string;
  trackKeys: string[];
}

function validateContext(input: Partial<SessionInput>) {
  if (input.language !== undefined && !(SCOPING_LANGS as readonly string[]).includes(input.language)) throw new Error('invalid');
  if (input.deploymentType !== undefined && !(DEPLOYMENT_TYPES as readonly string[]).includes(input.deploymentType)) throw new Error('invalid');
  if (input.sku !== undefined && !(SKUS as readonly string[]).includes(input.sku)) throw new Error('invalid');
  if (input.plan !== undefined && !(PLANS as readonly string[]).includes(input.plan)) throw new Error('invalid');
}

export async function createSessionAction(input: SessionInput): Promise<{ ok: true; id: string; error?: undefined } | Fail> {
  try {
    const u = await requireScopingUser();
    const clientName = String(input.clientName || '').trim();
    if (clientName.length < 2 || clientName.length > 120) throw new Error('invalid');
    validateContext(input);
    const bankVersionId = await latestBankVersionId(u.id);
    const bank = await loadBank(bankVersionId);
    const created = await prisma.scopingSession.create({
      data: {
        clientName,
        title: String(input.title || '').trim().slice(0, 120),
        bankVersionId,
        language: input.language,
        deploymentType: input.deploymentType,
        sku: input.sku,
        plan: input.plan,
        trackKeys: cleanTracks(input.trackKeys, new Set(bank.tracks.map((t) => t.key))),
        createdBy: u.id,
      },
    });
    revalidatePath('/scoping');
    return { ok: true, id: created.id };
  } catch (e) {
    return fail(e);
  }
}

export async function updateSessionAction(
  id: string,
  patch: Partial<SessionInput> & { settings?: { minutesEssential?: number; minutesRecommended?: number } },
): Promise<{ ok: true; error?: undefined } | Fail> {
  try {
    await requireScopingUser();
    const s = await openSession(id);
    validateContext(patch);
    const data: Prisma.ScopingSessionUpdateInput = {};
    if (patch.clientName !== undefined) {
      const name = String(patch.clientName).trim();
      if (name.length < 2 || name.length > 120) throw new Error('invalid');
      data.clientName = name;
    }
    if (patch.title !== undefined) data.title = String(patch.title).trim().slice(0, 120);
    if (patch.language !== undefined) data.language = patch.language;
    if (patch.deploymentType !== undefined) data.deploymentType = patch.deploymentType;
    if (patch.sku !== undefined) data.sku = patch.sku;
    if (patch.plan !== undefined) data.plan = patch.plan;
    if (patch.trackKeys !== undefined) {
      // RF-09: remover trilha só esconde as perguntas; as respostas ficam.
      const bank = await loadBank(s.bankVersionId);
      data.trackKeys = cleanTracks(patch.trackKeys, new Set(bank.tracks.map((t) => t.key)));
    }
    if (patch.settings !== undefined) {
      const m = (n: unknown) => Math.max(0, Math.min(30, Number(n) || 0));
      data.settings = json({ minutesEssential: m(patch.settings.minutesEssential), minutesRecommended: m(patch.settings.minutesRecommended) });
    }
    await prisma.scopingSession.update({ where: { id: s.id }, data });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteSessionAction(id: string): Promise<{ ok: true; error?: undefined } | Fail> {
  try {
    const u = await requireScopingUser();
    const s = await openSession(id, { allowCompleted: true });
    if (!u.isAdmin && s.createdBy !== u.id) throw new Error('forbidden');
    // Exclusão só na tela, como os projetos: a sessão continua no banco.
    await prisma.scopingSession.update({ where: { id: s.id }, data: { deletedAt: new Date(), deletedBy: u.id } });
    revalidatePath('/scoping');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** RF-13: concluir exige todas as essenciais tratadas. */
export async function completeSessionAction(id: string): Promise<{ ok: true; error?: undefined } | { ok: false; error: string; open?: string[] }> {
  try {
    const u = await requireScopingUser();
    const s = await openSession(id);
    const bank = await loadBank(s.bankVersionId);
    const answers = (await prisma.scopingAnswer.findMany({ where: { sessionId: s.id } })).map((a) => toSessionAnswer(a));
    const c = completeness(bank, s.trackKeys, answers);
    if (!c.canComplete) return { ok: false, error: 'incomplete', open: c.essentialOpen.map((q) => q.key) };
    await prisma.scopingSession.update({ where: { id: s.id }, data: { status: 'concluida', completedAt: new Date(), completedBy: u.id } });
    revalidatePath('/scoping');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function reopenSessionAction(id: string): Promise<{ ok: true; error?: undefined } | Fail> {
  try {
    await requireScopingUser();
    const s = await openSession(id, { allowCompleted: true });
    await prisma.scopingSession.update({ where: { id: s.id }, data: { status: 'em_andamento', completedAt: null, completedBy: null } });
    revalidatePath('/scoping');
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Respostas
// ---------------------------------------------------------------------------

export interface AnswerInput {
  value?: unknown;
  status: AnswerStatus;
  pendingOwner?: string | null;
  pendingDue?: string | null;
  naReason?: string | null;
}

export type SaveAnswerResult =
  | { ok: true; answer: SessionAnswer; error?: undefined }
  | { ok: false; error: 'conflict'; current: SessionAnswer }
  | Fail;

/**
 * Grava uma resposta (autosave). `expectedVersion` é a versão que a tela viu:
 * se outra pessoa gravou antes, devolve `conflict` com a versão atual (4.5).
 */
export async function saveAnswerAction(
  sessionId: string, questionKey: string, input: AnswerInput, expectedVersion: number,
): Promise<SaveAnswerResult> {
  try {
    const u = await requireScopingUser();
    const s = await openSession(sessionId);
    const bank = await loadBank(s.bankVersionId);
    const q = bank.questions.find((x) => x.key === questionKey);
    if (!q) throw new Error('invalid');
    if (!(ANSWER_STATUSES as readonly string[]).includes(input.status)) throw new Error('invalid');

    const parsed = answerValueSchema(q.type).safeParse(input.value ?? {});
    if (!parsed.success) throw new Error('invalid');
    const value = parsed.data;
    const owner = input.status === 'pendente' ? String(input.pendingOwner || '').trim().slice(0, 120) || null : null;
    const due = input.status === 'pendente' && input.pendingDue && DATE_RX.test(input.pendingDue) ? new Date(`${input.pendingDue}T12:00:00Z`) : null;
    const naReason = input.status === 'nao_se_aplica' ? String(input.naReason || '').trim().slice(0, 300) || null : null;

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.scopingAnswer.findUnique({ where: { sessionId_questionKey: { sessionId: s.id, questionKey } } });
      const currentVersion = current?.version ?? 0;
      if (currentVersion !== Number(expectedVersion)) return { conflict: current };

      const data = {
        value: json(value), status: input.status, pendingOwner: owner, pendingDue: due, naReason,
        source: 'manual', sourceRef: undefined as any, updatedBy: u.id,
      };
      const saved = current
        ? await tx.scopingAnswer.update({ where: { id: current.id }, data: { ...data, version: { increment: 1 } } })
        : await tx.scopingAnswer.create({ data: { ...data, sessionId: s.id, questionKey } });

      const changed = !current
        || JSON.stringify(current.value) !== JSON.stringify(value)
        || current.status !== input.status
        || current.pendingOwner !== owner
        || String(current.pendingDue?.toISOString() ?? '') !== String(due?.toISOString() ?? '')
        || current.naReason !== naReason;
      if (changed) {
        await tx.scopingAnswerHistory.create({
          data: {
            answerId: saved.id,
            previousValue: current?.value === null || current?.value === undefined ? undefined : json(current.value),
            newValue: json(value),
            previousStatus: current?.status ?? null,
            newStatus: input.status,
            source: 'manual',
            changedBy: u.id,
          },
        });
      }
      return { saved };
    });

    if ('conflict' in result) {
      const names = await userNames([result.conflict?.updatedBy]);
      return { ok: false, error: 'conflict', current: toSessionAnswer(result.conflict, names) };
    }
    await prisma.scopingSession.update({ where: { id: s.id }, data: { updatedAt: new Date() } });
    return { ok: true, answer: toSessionAnswer(result.saved, new Map([[u.id, u.name]])) };
  } catch (e) {
    return fail(e);
  }
}

export interface HistoryEntry {
  previousValue: unknown;
  newValue: unknown;
  previousStatus: string | null;
  newStatus: string;
  source: string;
  changedBy: string | null;
  changedAt: string;
}

/** RF-16: histórico da resposta, do mais recente para o mais antigo. */
export async function answerHistoryAction(sessionId: string, questionKey: string): Promise<{ ok: true; history: HistoryEntry[]; error?: undefined } | Fail> {
  try {
    await requireScopingUser();
    const s = await openSession(sessionId, { allowCompleted: true });
    const answer = await prisma.scopingAnswer.findUnique({
      where: { sessionId_questionKey: { sessionId: s.id, questionKey } },
      include: { history: { orderBy: { changedAt: 'desc' }, take: 50 } },
    });
    const names = await userNames(answer?.history.map((h) => h.changedBy) || []);
    return {
      ok: true,
      history: (answer?.history || []).map((h) => ({
        previousValue: h.previousValue, newValue: h.newValue, previousStatus: h.previousStatus, newStatus: h.newStatus,
        source: h.source, changedBy: h.changedBy ? names.get(h.changedBy) ?? null : null, changedAt: h.changedAt.toISOString(),
      })),
    };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Notas e prévia de horas
// ---------------------------------------------------------------------------

export async function saveNoteAction(
  sessionId: string, content: string, expectedVersion: number,
): Promise<{ ok: true; version: number; error?: undefined } | { ok: false; error: 'conflict'; content: string; version: number } | Fail> {
  try {
    const u = await requireScopingUser();
    const s = await openSession(sessionId, { allowCompleted: true });
    const text = String(content ?? '').slice(0, 100_000);
    const current = await prisma.scopingNote.findUnique({ where: { sessionId: s.id } });
    if ((current?.version ?? 0) !== Number(expectedVersion)) {
      return { ok: false, error: 'conflict', content: current?.content ?? '', version: current?.version ?? 0 };
    }
    const saved = current
      ? await prisma.scopingNote.update({ where: { id: current.id }, data: { content: text, updatedBy: u.id, version: { increment: 1 } } })
      : await prisma.scopingNote.create({ data: { sessionId: s.id, content: text, updatedBy: u.id } });
    return { ok: true, version: saved.version };
  } catch (e) {
    return fail(e);
  }
}

/** Medidor de horas (RF-32): lê as respostas gravadas e simula, sem gravar. */
export async function previewEstimateAction(sessionId: string): Promise<({ ok: true } & SessionEstimate) | Fail> {
  try {
    await requireScopingUser();
    const s = await openSession(sessionId, { allowCompleted: true });
    const bank = await loadBank(s.bankVersionId);
    const answers = (await prisma.scopingAnswer.findMany({ where: { sessionId: s.id } })).map((a) => toSessionAnswer(a));
    const result = await estimateFor(bank, s, answers);
    return { ok: true, ...result };
  } catch (e) {
    return fail(e);
  }
}
