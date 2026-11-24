/**
 * Propostas de resposta vindas de gravações (Fase 1b, RF-50 a RF-53).
 *
 * O Claude lê a transcrição (tl;dv, Claude Meetings) e grava PROPOSTAS pelo
 * MCP. Nada vira resposta sem um humano aceitar na aba "Para revisar".
 *  - Proposta sem citação literal é recusada.
 *  - Uma proposta nunca sobrescreve a resposta: aceitar é que grava, com a
 *    origem da gravação e o histórico.
 */

import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { loadBank } from './bank';
import { answerValueSchema, type AnswerSource, type AnswerValue, type BankQuestion } from './types';
import { mergeAnswerValues } from './merge';

export const PROPOSAL_PROVIDERS = ['tldv', 'claude_meetings', 'notes', 'other'] as const;
export const CONFIDENCES = ['alta', 'media', 'baixa'] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export const proposalSourceSchema = z.object({
  provider: z.enum(PROPOSAL_PROVIDERS),
  meetingTitle: z.string().trim().max(300).optional(),
  meetingDate: z.string().trim().max(40).optional(),
  url: z.string().trim().max(1000).optional(),
  /** minuto do trecho na gravação, ex.: "00:23:41" */
  timestamp: z.string().trim().max(20).optional(),
  /** citação literal da transcrição: obrigatória */
  quote: z.string().trim().min(3).max(2000),
});
export type ProposalSource = z.infer<typeof proposalSourceSchema>;

export const proposalInputSchema = z.object({
  questionKey: z.string().trim().min(1).max(200),
  /** valor no formato do tipo da pergunta (texto, número ou {min,max}, opção, lista de opções, Sim/Não, data, linhas de tabela) */
  value: z.unknown(),
  /** comentário livre que acompanha a resposta */
  note: z.string().max(5000).optional(),
  confidence: z.enum(CONFIDENCES),
  rationale: z.string().trim().max(1000).default(''),
  source: proposalSourceSchema,
  /**
   * complement: junta com a resposta atual (texto acrescentado, opções e linhas
   * somadas, comentário acrescentado); replace: substitui. Padrão: complement
   * quando a pergunta já tem resposta, replace quando não tem.
   */
  mode: z.enum(['complement', 'replace']).optional(),
});
export type ProposalInput = z.infer<typeof proposalInputSchema>;
export type ProposalMode = 'complement' | 'replace';

const json = (v: unknown) => v as Prisma.InputJsonValue;

export function answerSourceOf(provider: string): AnswerSource {
  if (provider === 'tldv' || provider === 'claude_meetings' || provider === 'notes') return provider;
  return 'import';
}

/** Valida o valor proposto contra o tipo da pergunta. Devolve o AnswerValue ou o motivo da recusa. */
export function validateProposalValue(q: BankQuestion, value: unknown, note?: string): { ok: true; value: AnswerValue } | { ok: false; reason: string } {
  // Sim/Não aceita também true/false e "Sim"/"Não" escritos por extenso.
  let v = value;
  if (q.type === 'yes_no') {
    const s = String(value).trim().toLowerCase();
    v = value === true || ['sim', 'yes', 'sí', 'si', 'true'].includes(s) ? 'sim'
      : value === false || ['nao', 'não', 'no', 'false'].includes(s) ? 'nao'
      : ['nao_sei', 'não sei', 'nao sei', 'unknown'].includes(s) ? 'nao_sei' : value;
  }
  if (q.type === 'single' || q.type === 'multi') {
    const allowed = new Set(q.options.map((o) => o.value));
    const list = Array.isArray(v) ? v : [v];
    const bad = list.filter((x) => !allowed.has(String(x)));
    if (bad.length) return { ok: false, reason: `opção inexistente (${bad.join(', ')}); use uma de: ${Array.from(allowed).join(', ')}` };
    if (q.type === 'single' && Array.isArray(v)) v = v[0];
  }
  const parsed = answerValueSchema(q.type).safeParse({ v, ...(note ? { note } : {}) });
  if (!parsed.success) return { ok: false, reason: `valor não confere com o tipo ${q.type}` };
  return { ok: true, value: parsed.data as AnswerValue };
}

export interface CreateResult {
  created: { id: string; questionKey: string }[];
  rejected: { questionKey: string; reason: string }[];
}

/** RF-50: grava as propostas que passam na validação; devolve as recusadas com o motivo. */
export async function createProposals(sessionId: string, userId: number, proposals: ProposalInput[]): Promise<CreateResult> {
  const session = await prisma.scopingSession.findUnique({ where: { id: sessionId } });
  if (!session || session.deletedAt) throw new Error('not_found');
  if (session.status === 'concluida') throw new Error('completed');
  const bank = await loadBank(session.bankVersionId);
  const byKey = new Map(bank.questions.map((q) => [q.key, q]));
  const pending = await prisma.scopingProposal.findMany({ where: { sessionId, state: 'proposta' }, select: { questionKey: true, value: true } });
  const answered = new Set((await prisma.scopingAnswer.findMany({ where: { sessionId, status: 'respondida' }, select: { questionKey: true } })).map((a) => a.questionKey));
  const pendingSig = new Set(pending.map((p) => `${p.questionKey}|${JSON.stringify(p.value)}`));

  const result: CreateResult = { created: [], rejected: [] };
  for (const p of proposals) {
    const q = byKey.get(p.questionKey);
    if (!q) { result.rejected.push({ questionKey: p.questionKey, reason: 'pergunta inexistente neste banco' }); continue; }
    const checked = validateProposalValue(q, p.value, p.note);
    if ('reason' in checked) { result.rejected.push({ questionKey: p.questionKey, reason: checked.reason }); continue; }
    const value = (checked as { value: AnswerValue }).value;
    const sig = `${p.questionKey}|${JSON.stringify(value)}`;
    if (pendingSig.has(sig)) { result.rejected.push({ questionKey: p.questionKey, reason: 'proposta igual já está aguardando revisão' }); continue; }
    const created = await prisma.scopingProposal.create({
      data: {
        sessionId, questionKey: p.questionKey, value: json(value), confidence: p.confidence,
        rationale: p.rationale || '', createdBy: userId,
        // O modo viaja junto da origem (a tabela não tem coluna própria para ele).
        sourceRef: json({ ...p.source, mode: p.mode ?? (answered.has(p.questionKey) ? 'complement' : 'replace') }),
      },
    });
    pendingSig.add(sig);
    result.created.push({ id: created.id, questionKey: p.questionKey });
  }
  return result;
}

/**
 * RF-52: aceitar grava a resposta como "respondida", com a origem da gravação
 * e o histórico. `editedValue` = "editar e aceitar".
 */
export async function acceptProposal(proposalId: string, userId: number, editedValue?: unknown) {
  const p = await prisma.scopingProposal.findUnique({ where: { id: proposalId }, include: { session: true } });
  if (!p || p.session.deletedAt) throw new Error('not_found');
  if (p.session.status === 'concluida') throw new Error('completed');
  if (p.state !== 'proposta') throw new Error('invalid');
  let value = p.value as AnswerValue;
  const mode: ProposalMode = (p.sourceRef as any)?.mode === 'complement' ? 'complement' : 'replace';
  if (editedValue !== undefined) {
    const bank = await loadBank(p.session.bankVersionId);
    const q = bank.questions.find((x) => x.key === p.questionKey);
    if (!q) throw new Error('invalid');
    const parsed = answerValueSchema(q.type).safeParse(editedValue);
    if (!parsed.success) throw new Error('invalid');
    value = parsed.data as AnswerValue;
  }
  const src = p.sourceRef as ProposalSource;
  const source = answerSourceOf(src?.provider);
  const bankForMerge = mode === 'complement' && editedValue === undefined ? await loadBank(p.session.bankVersionId) : null;
  return prisma.$transaction(async (tx) => {
    const current = await tx.scopingAnswer.findUnique({ where: { sessionId_questionKey: { sessionId: p.sessionId, questionKey: p.questionKey } } });
    // Complementar: junta com o que o pré-vendas já tinha (editar e aceitar grava exatamente o editado).
    if (bankForMerge && current) {
      const q = bankForMerge.questions.find((x) => x.key === p.questionKey);
      if (q) value = mergeAnswerValues(q, current.value as AnswerValue, value);
    }
    const data = {
      value: json(value), status: 'respondida', pendingOwner: null, pendingDue: null, naReason: null,
      source, sourceRef: json(src), confidence: p.confidence, updatedBy: userId,
    };
    const saved = current
      ? await tx.scopingAnswer.update({ where: { id: current.id }, data: { ...data, version: { increment: 1 } } })
      : await tx.scopingAnswer.create({ data: { ...data, sessionId: p.sessionId, questionKey: p.questionKey } });
    await tx.scopingAnswerHistory.create({
      data: {
        answerId: saved.id,
        previousValue: current?.value === null || current?.value === undefined ? undefined : json(current.value),
        newValue: json(value), previousStatus: current?.status ?? null, newStatus: 'respondida',
        source, sourceRef: json(src), changedBy: userId,
      },
    });
    await tx.scopingProposal.update({ where: { id: p.id }, data: { state: 'aceita', decidedBy: userId, decidedAt: new Date(), ...(editedValue !== undefined ? { value: json(value) } : {}) } });
    // Outras propostas pendentes para a mesma pergunta ficam superadas.
    await tx.scopingProposal.updateMany({
      where: { sessionId: p.sessionId, questionKey: p.questionKey, state: 'proposta', id: { not: p.id } },
      data: { state: 'rejeitada', decidedBy: userId, decidedAt: new Date(), rejectReason: 'superada por outra proposta aceita' },
    });
    await tx.scopingSession.update({ where: { id: p.sessionId }, data: { updatedAt: new Date() } });
    return saved;
  });
}

/** Rejeitar deixa a proposta no histórico, com o motivo (que ajuda a melhorar o roteiro). */
export async function rejectProposal(proposalId: string, userId: number, reason?: string) {
  const p = await prisma.scopingProposal.findUnique({ where: { id: proposalId }, include: { session: true } });
  if (!p || p.session.deletedAt) throw new Error('not_found');
  if (p.state !== 'proposta') throw new Error('invalid');
  await prisma.scopingProposal.update({
    where: { id: p.id },
    data: { state: 'rejeitada', decidedBy: userId, decidedAt: new Date(), rejectReason: String(reason || '').trim().slice(0, 300) || null },
  });
}

export interface ProposalView {
  id: string;
  questionKey: string;
  value: AnswerValue;
  confidence: Confidence;
  rationale: string;
  source: ProposalSource;
  mode: ProposalMode;
  createdAt: string;
}

export async function pendingProposals(sessionId: string): Promise<ProposalView[]> {
  const rows = await prisma.scopingProposal.findMany({ where: { sessionId, state: 'proposta' }, orderBy: { createdAt: 'asc' } });
  return rows.map((r) => ({
    id: r.id, questionKey: r.questionKey, value: r.value as AnswerValue, confidence: r.confidence as Confidence,
    rationale: r.rationale, source: r.sourceRef as ProposalSource,
    mode: (r.sourceRef as any)?.mode === 'complement' ? 'complement' : 'replace', createdAt: r.createdAt.toISOString(),
  }));
}

export interface MeetingUsed { title: string; date: string | null; url: string | null; provider: string; accepted: number }

/** RF-53: reuniões usadas como fonte, a partir das propostas aceitas. */
export async function meetingsUsed(sessionId: string): Promise<MeetingUsed[]> {
  const rows = await prisma.scopingProposal.findMany({ where: { sessionId, state: 'aceita' }, select: { sourceRef: true } });
  const map = new Map<string, MeetingUsed>();
  rows.forEach((r) => {
    const s = r.sourceRef as ProposalSource;
    const key = `${s?.meetingTitle || ''}|${s?.meetingDate || ''}|${s?.url || ''}`;
    const cur = map.get(key) || { title: s?.meetingTitle || '—', date: s?.meetingDate || null, url: s?.url || null, provider: s?.provider || 'other', accepted: 0 };
    cur.accepted += 1;
    map.set(key, cur);
  });
  return Array.from(map.values());
}
