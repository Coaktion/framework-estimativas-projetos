/**
 * Ferramentas MCP do Scoping (Fase 1b, RF-50). Registradas em
 * app/api/mcp/route.ts ao lado das ferramentas de estimativa, sem mudá-las.
 *
 * Princípio: o portal não interpreta gravações. O Claude lê a transcrição com
 * as ferramentas que já tem e grava PROPOSTAS aqui; um humano aceita na aba
 * "Para revisar". Só existem onde o Scoping está ligado (flag scopingLigado) e
 * para quem acessa o Scoping (SC e ADMIN), agindo como o dono da chave.
 */

import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { canAccessScoping } from '@/lib/segments';
import { scopingLigado } from '@/lib/feature-flags';
import { ToolCenterError, type ToolCenterContext } from '@/lib/toolcenter';
import { latestBankVersionId, loadBank } from '@/lib/scoping/bank';
import { normalizeScopingLang, tr } from '@/lib/scoping/i18n';
import { formatValue } from '@/lib/scoping/format';
import { answerMap, visibleQuestions } from '@/lib/scoping/rules';
import { inTier, normalizeTier, stageOf, tierOf, STAGES, TIERS } from '@/lib/scoping/themes';
import { estimateFor, loadSessionView, toSessionAnswer } from '@/lib/scoping/server';
import { exportMarkdown } from '@/lib/scoping/export';
import { createProposals, pendingProposals, proposalInputSchema } from '@/lib/scoping/proposals';
import { DEPLOYMENT_TYPES, PLANS, SCOPING_LANGS, SKUS, type BankQuestion, type CatalogMapping } from '@/lib/scoping/types';

const json = (v: unknown) => v as Prisma.InputJsonValue;
const uid = (ctx: ToolCenterContext) => parseInt(ctx.user.id);
const sessionUrl = (ctx: ToolCenterContext, id: string) => `${ctx.origin}/scoping/${id}`;

/** As ferramentas de scoping só aparecem onde o módulo está ligado. */
export const scopingToolsEnabled = scopingLigado;

function assertScoping(ctx: ToolCenterContext) {
  if (!scopingLigado) throw new ToolCenterError('O Scoping está desligado neste ambiente.', 'forbidden');
  if (!canAccessScoping(ctx.user as any)) throw new ToolCenterError('Seu usuário não tem acesso ao Scoping.', 'forbidden');
}

async function openSession(sessionId: string, opts: { write?: boolean } = {}) {
  const s = await prisma.scopingSession.findUnique({ where: { id: String(sessionId) } });
  if (!s || s.deletedAt) throw new ToolCenterError(`Sessão ${sessionId} não encontrada.`, 'not_found');
  if (opts.write && s.status === 'concluida') throw new ToolCenterError('A sessão está concluída. Peça para reabrir no Tool Center antes de gravar.', 'invalid');
  return s;
}

function itemsOf(m: CatalogMapping): string[] {
  if (m.rule === 'table_item_qty' || m.rule === 'ai_usecase_complexity') return Object.values(m.items).map((i) => i.itemName);
  return [m.itemName];
}

// ---------------------------------------------------------------------------
// scoping_list_tracks
// ---------------------------------------------------------------------------

export const listTracksInput = z.object({ language: z.enum(SCOPING_LANGS).optional() });

export async function scopingListTracks(ctx: ToolCenterContext, input: z.infer<typeof listTracksInput>) {
  assertScoping(ctx);
  const lang = normalizeScopingLang(input.language || 'pt');
  const bank = await loadBank(await latestBankVersionId(uid(ctx)));
  return {
    bankVersion: bank.version,
    tracks: bank.tracks.map((t) => ({
      key: t.key, type: t.type, name: tr(t.name, lang), description: tr(t.description, lang),
      questions: bank.questions.filter((q) => q.trackKeys.includes(t.key)).length,
    })),
    tiers: TIERS.map((k) => ({ key: k, meaning: { P: 'Pequena', M: 'Média', G: 'Grande' }[k] })),
    stages: STAGES.map((s) => ({ key: s.key, title: tr(s.title, lang), afterMeeting: !!s.afterMeeting })),
  };
}

// ---------------------------------------------------------------------------
// scoping_search_sessions
// ---------------------------------------------------------------------------

export const searchSessionsInput = z.object({ query: z.string().trim().max(120).optional() });

export async function scopingSearchSessions(ctx: ToolCenterContext, input: z.infer<typeof searchSessionsInput>) {
  assertScoping(ctx);
  const q = (input.query || '').trim();
  const rows = await prisma.scopingSession.findMany({
    where: { deletedAt: null, ...(q ? { OR: [{ clientName: { contains: q, mode: 'insensitive' as const } }, { title: { contains: q, mode: 'insensitive' as const } }] } : {}) },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  });
  return rows.map((s) => ({
    sessionId: s.id, clientName: s.clientName, title: s.title, status: s.status, language: s.language,
    tier: normalizeTier((s.settings as any)?.tier), trackKeys: s.trackKeys, updatedAt: s.updatedAt.toISOString(), url: sessionUrl(ctx, s.id),
  }));
}

// ---------------------------------------------------------------------------
// scoping_create_session
// ---------------------------------------------------------------------------

export const createSessionInput = z.object({
  clientName: z.string().trim().min(2).max(120),
  title: z.string().trim().max(120).optional(),
  language: z.enum(SCOPING_LANGS).default('pt'),
  deploymentType: z.enum(DEPLOYMENT_TYPES).default('new'),
  sku: z.enum(SKUS).default('CS'),
  plan: z.enum(PLANS).default('professional'),
  tier: z.enum(TIERS).default('M'),
  trackKeys: z.array(z.string()).default([]),
});

export async function scopingCreateSession(ctx: ToolCenterContext, input: z.infer<typeof createSessionInput>) {
  assertScoping(ctx);
  const bankVersionId = await latestBankVersionId(uid(ctx));
  const bank = await loadBank(bankVersionId);
  const valid = new Set(bank.tracks.map((t) => t.key));
  const unknown = input.trackKeys.filter((k) => !valid.has(k));
  if (unknown.length) throw new ToolCenterError(`Trilhas inexistentes: ${unknown.join(', ')}. Veja scoping_list_tracks.`);
  const s = await prisma.scopingSession.create({
    data: {
      clientName: input.clientName, title: input.title || '', bankVersionId, language: input.language,
      deploymentType: input.deploymentType, sku: input.sku, plan: input.plan,
      trackKeys: Array.from(new Set(input.trackKeys.filter((k) => k !== 'core'))),
      settings: json({ tier: input.tier }), createdBy: uid(ctx),
    },
  });
  return { sessionId: s.id, url: sessionUrl(ctx, s.id), bankVersion: bank.version };
}

// ---------------------------------------------------------------------------
// scoping_get_session
// ---------------------------------------------------------------------------

export const getSessionInput = z.object({
  sessionId: z.string().min(1),
  language: z.enum(SCOPING_LANGS).optional(),
  /** só as perguntas que ainda não estão respondidas */
  onlyOpen: z.boolean().optional(),
});

export async function scopingGetSession(ctx: ToolCenterContext, input: z.infer<typeof getSessionInput>) {
  assertScoping(ctx);
  const s = await openSession(input.sessionId);
  const view = await loadSessionView(s.id);
  if (!view) throw new ToolCenterError('Sessão não encontrada.', 'not_found');
  const lang = normalizeScopingLang(input.language || view.session.language);
  const tier = normalizeTier(view.session.settings.tier);
  const pending = await pendingProposals(s.id);
  const proposed = new Set(pending.map((p) => p.questionKey));
  const map = answerMap(view.answers);
  const visible = visibleQuestions(view.bank, view.session.trackKeys, view.answers);
  const list = visible.filter((q) => !input.onlyOpen || map.get(q.key)?.status !== 'respondida');

  const describe = (q: BankQuestion) => {
    const a = map.get(q.key);
    return {
      key: q.key,
      stage: stageOf(q),
      tier: tierOf(q),
      inSessionTier: inTier(q, tier),
      priority: q.priority,
      type: q.type,
      text: tr(q.text, lang),
      ...(tr(q.help, lang) ? { help: tr(q.help, lang) } : {}),
      ...(q.options.length ? { options: q.options.map((o) => ({ value: o.value, label: tr(o.label, lang) })) } : {}),
      ...(q.unit ? { unit: tr(q.unit, lang) } : {}),
      ...(q.min !== null ? { min: q.min } : {}),
      ...(q.max !== null ? { max: q.max } : {}),
      ...(q.tableColumns.length ? {
        tableColumns: q.tableColumns.map((c) => ({
          key: c.key, type: c.type, label: tr(c.label, lang),
          ...(c.options ? { options: c.options.map((o) => o.value) } : {}),
          ...(c.maxLength ? { maxLength: c.maxLength } : {}),
        })),
      } : {}),
      ...(q.catalogMappings.length ? { catalogItems: Array.from(new Set(q.catalogMappings.flatMap(itemsOf))) } : {}),
      ...(q.noCatalogItem ? { noCatalogItem: true } : {}),
      answer: a ? {
        status: a.status,
        value: a.value?.v ?? null,
        text: formatValue(q, a.value?.v, lang) || null,
        ...(a.value?.note ? { note: a.value.note } : {}),
        source: a.source,
        ...(a.status === 'pendente' ? { pendingOwner: a.pendingOwner, pendingDue: a.pendingDue } : {}),
        ...(a.status === 'nao_se_aplica' ? { naReason: a.naReason } : {}),
      } : { status: 'nao_perguntada' },
      ...(proposed.has(q.key) ? { hasPendingProposal: true } : {}),
    };
  };

  return {
    session: {
      sessionId: s.id, clientName: view.session.clientName, title: view.session.title, status: view.session.status,
      language: view.session.language, tier, plan: view.session.plan, sku: view.session.sku,
      deploymentType: view.session.deploymentType, trackKeys: view.session.trackKeys, bankVersion: view.bank.version,
      url: sessionUrl(ctx, s.id),
    },
    valueFormats: {
      short_text: 'texto', long_text: 'texto', number: 'número, ou {"min":n,"max":n} para faixa', single: 'value de uma das options',
      multi: 'lista de values das options', yes_no: '"sim", "nao" ou "nao_sei"', date: '"AAAA-MM-DD"',
      table: 'lista de linhas: [{ <key da coluna>: valor }]', ai_usecases: 'lista de linhas com name, reason, complexity (simples|intermediario|complexo), systems, volume',
    },
    pendingProposals: pending.length,
    questions: list.map(describe),
  };
}

// ---------------------------------------------------------------------------
// scoping_propose_answers
// ---------------------------------------------------------------------------

export const proposeInput = z.object({
  sessionId: z.string().min(1),
  proposals: z.array(proposalInputSchema).min(1).max(200),
});

export async function scopingProposeAnswers(ctx: ToolCenterContext, input: z.infer<typeof proposeInput>) {
  assertScoping(ctx);
  const s = await openSession(input.sessionId, { write: true });
  const result = await createProposals(s.id, uid(ctx), input.proposals);
  return {
    created: result.created.length,
    rejected: result.rejected,
    reviewUrl: `${sessionUrl(ctx, s.id)}#revisar`,
    note: 'Nada foi gravado como resposta: as propostas aguardam revisão na aba "Para revisar".',
  };
}

// ---------------------------------------------------------------------------
// scoping_set_pending
// ---------------------------------------------------------------------------

export const setPendingInput = z.object({
  sessionId: z.string().min(1),
  questionKey: z.string().min(1),
  owner: z.string().trim().min(1).max(120),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(2000).optional(),
});

export async function scopingSetPending(ctx: ToolCenterContext, input: z.infer<typeof setPendingInput>) {
  assertScoping(ctx);
  const s = await openSession(input.sessionId, { write: true });
  const bank = await loadBank(s.bankVersionId);
  if (!bank.questions.some((q) => q.key === input.questionKey)) throw new ToolCenterError(`Pergunta ${input.questionKey} não existe neste banco.`);
  const current = await prisma.scopingAnswer.findUnique({ where: { sessionId_questionKey: { sessionId: s.id, questionKey: input.questionKey } } });
  if (current?.status === 'respondida') {
    throw new ToolCenterError('A pergunta já está respondida: não marco como pendente por cima de uma resposta. Se a gravação traz algo diferente, use scoping_propose_answers.');
  }
  const value = { ...((current?.value as any) || {}), ...(input.note ? { note: input.note } : {}) };
  const due = new Date(`${input.dueDate}T12:00:00Z`);
  const saved = await prisma.$transaction(async (tx) => {
    const data = { status: 'pendente', pendingOwner: input.owner, pendingDue: due, naReason: null, value: json(value), source: 'import', updatedBy: uid(ctx) };
    const a = current
      ? await tx.scopingAnswer.update({ where: { id: current.id }, data: { ...data, version: { increment: 1 } } })
      : await tx.scopingAnswer.create({ data: { ...data, sessionId: s.id, questionKey: input.questionKey } });
    await tx.scopingAnswerHistory.create({
      data: { answerId: a.id, previousValue: current?.value ? json(current.value) : undefined, newValue: json(value), previousStatus: current?.status ?? null, newStatus: 'pendente', source: 'import', changedBy: uid(ctx) },
    });
    return a;
  });
  return { questionKey: input.questionKey, status: saved.status, owner: saved.pendingOwner, dueDate: input.dueDate };
}

// ---------------------------------------------------------------------------
// scoping_preview_estimate, scoping_get_notes, scoping_export
// ---------------------------------------------------------------------------

export const sessionIdInput = z.object({ sessionId: z.string().min(1) });

export async function scopingPreviewEstimate(ctx: ToolCenterContext, input: z.infer<typeof sessionIdInput>) {
  assertScoping(ctx);
  const s = await openSession(input.sessionId);
  const bank = await loadBank(s.bankVersionId);
  const answers = (await prisma.scopingAnswer.findMany({ where: { sessionId: s.id } })).map((a) => toSessionAnswer(a));
  const { mapping, estimate } = await estimateFor(bank, s, answers);
  return {
    saved: false,
    note: 'Simulação com as respostas aceitas (propostas pendentes não contam).',
    grandTotal: estimate.grandTotal,
    subtotal: estimate.subtotal,
    shares: estimate.shares,
    items: mapping.items.map((i) => ({ itemId: i.itemId, name: i.itemName, quantity: i.quantity, hours: estimate.itemHours[i.itemId] ?? 0, ...(i.isRange ? { range: true } : {}) })),
    mappedWithoutAnswer: mapping.missing,
    manualHours: mapping.manual,
    warnings: estimate.warnings,
  };
}

export async function scopingGetNotes(ctx: ToolCenterContext, input: z.infer<typeof sessionIdInput>) {
  assertScoping(ctx);
  const s = await openSession(input.sessionId);
  const note = await prisma.scopingNote.findUnique({ where: { sessionId: s.id } });
  return { sessionId: s.id, notes: note?.content || '', updatedAt: note?.updatedAt?.toISOString() ?? null };
}

export const exportInput = z.object({ sessionId: z.string().min(1), language: z.enum(SCOPING_LANGS).optional() });

// ---------------------------------------------------------------------------
// scoping_append_notes
// ---------------------------------------------------------------------------

export const appendNotesInput = z.object({
  sessionId: z.string().min(1),
  text: z.string().trim().min(3).max(20000),
  /** de onde veio (ex.: "tl;dv · Discovery 24/11") */
  sourceLabel: z.string().trim().max(200).optional(),
});

/**
 * Acrescenta um bloco ao fim das notas da sessão, sem apagar nada: o que a
 * gravação traz e não cabe em nenhuma pergunta (participantes, contexto,
 * próximos passos). O bloco vem marcado como complemento do Claude.
 */
export async function scopingAppendNotes(ctx: ToolCenterContext, input: z.infer<typeof appendNotesInput>) {
  assertScoping(ctx);
  const s = await openSession(input.sessionId);
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const header = `--- Complemento do Claude${input.sourceLabel ? ` (${input.sourceLabel})` : ''} · ${stamp} UTC ---`;
  const current = await prisma.scopingNote.findUnique({ where: { sessionId: s.id } });
  const content = `${current?.content?.trimEnd() || ''}${current?.content?.trim() ? '\n\n' : ''}${header}\n${input.text.trim()}\n`;
  if (content.length > 100_000) throw new ToolCenterError('As notas passariam do limite de 100 mil caracteres.');
  const saved = current
    ? await prisma.scopingNote.update({ where: { id: current.id }, data: { content, updatedBy: uid(ctx), version: { increment: 1 } } })
    : await prisma.scopingNote.create({ data: { sessionId: s.id, content, updatedBy: uid(ctx) } });
  return { sessionId: s.id, appended: input.text.length, notesLength: saved.content.length, url: sessionUrl(ctx, s.id) };
}

export async function scopingExport(ctx: ToolCenterContext, input: z.infer<typeof exportInput>) {
  assertScoping(ctx);
  const s = await openSession(input.sessionId);
  const view = await loadSessionView(s.id);
  if (!view) throw new ToolCenterError('Sessão não encontrada.', 'not_found');
  const lang = normalizeScopingLang(input.language || view.session.language);
  return {
    markdown: exportMarkdown(view.bank, view.session, view.answers, lang, view.note.content),
    xlsxUrl: `${ctx.origin}/api/scoping/${s.id}/export?format=xlsx&lang=${lang}`,
  };
}
