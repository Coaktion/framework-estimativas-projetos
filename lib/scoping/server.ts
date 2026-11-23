/**
 * Scoping no servidor: quem acessa, leitura da sessão e prévia de horas.
 *
 * Acesso: SC e ADMIN (lib/segments.ts), com a flag scopingLigado. As sessões
 * são do time: qualquer pessoa com acesso abre e preenche; excluir é só de
 * quem criou ou de um admin.
 */

import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canAccessScoping } from '@/lib/segments';
import { scopingLigado } from '@/lib/feature-flags';
import { loadFrameworkCatalog, type FrameworkCatalog } from '@/lib/framework-catalog';
import { loadBank } from './bank';
import { normalizeScopingLang } from './i18n';
import { mapAnswersToItems, type MappingResult } from './mapping';
import { simulateScopingEstimate, type ScopingEstimate } from './estimate';
import type { AnswerSource, AnswerStatus, AnswerValue, Bank, SessionAnswer } from './types';

export type ScopingUser = { id: number; name: string; isAdmin: boolean };

export async function getScopingUser(): Promise<ScopingUser | null> {
  if (!scopingLigado) return null;
  const session: any = await getServerSession(authOptions);
  const u = session?.user;
  if (!u?.id || !canAccessScoping(u)) return null;
  return { id: Number(u.id), name: String(u.name || u.email || ''), isAdmin: Boolean(u.isAdmin) };
}

export async function requireScopingUser(): Promise<ScopingUser> {
  const u = await getScopingUser();
  if (!u) throw new Error('forbidden');
  return u;
}

/** Nomes das pessoas (só leitura), para "quem alterou" e "criado por". */
export async function userNames(ids: (number | null | undefined)[]): Promise<Map<number, string>> {
  const unique = Array.from(new Set(ids.filter((i): i is number => Number.isInteger(i))));
  if (!unique.length) return new Map();
  const rows = await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true, email: true } });
  return new Map(rows.map((r) => [r.id, r.name || r.email]));
}

export interface SessionRecord {
  id: string;
  clientName: string;
  title: string;
  bankVersionId: number;
  language: 'pt' | 'en' | 'es';
  deploymentType: string;
  sku: string;
  plan: string;
  trackKeys: string[];
  status: string;
  settings: { minutesEssential?: number; minutesRecommended?: number; tier?: 'P' | 'M' | 'G' };
  createdBy: number;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export function toSessionAnswer(a: any, names?: Map<number, string>): SessionAnswer {
  return {
    questionKey: a.questionKey,
    value: (a.value as AnswerValue) ?? null,
    status: a.status as AnswerStatus,
    pendingOwner: a.pendingOwner,
    pendingDue: a.pendingDue ? new Date(a.pendingDue).toISOString().slice(0, 10) : null,
    naReason: a.naReason,
    source: a.source as AnswerSource,
    sourceRef: (a.sourceRef as any) ?? null,
    version: a.version,
    updatedAt: a.updatedAt ? new Date(a.updatedAt).toISOString() : undefined,
    updatedByName: a.updatedBy && names ? names.get(a.updatedBy) ?? null : null,
  };
}

/** Sessão completa (não excluída), com banco, respostas e notas. */
export async function loadSessionView(id: string) {
  const s = await prisma.scopingSession.findUnique({
    where: { id },
    include: { answers: true, note: true },
  });
  if (!s || s.deletedAt) return null;
  const bank = await loadBank(s.bankVersionId);
  const names = await userNames([s.createdBy, ...s.answers.map((a) => a.updatedBy)]);
  const session: SessionRecord = {
    id: s.id,
    clientName: s.clientName,
    title: s.title,
    bankVersionId: s.bankVersionId,
    language: normalizeScopingLang(s.language),
    deploymentType: s.deploymentType,
    sku: s.sku,
    plan: s.plan,
    trackKeys: s.trackKeys,
    status: s.status,
    settings: (s.settings as any) || {},
    createdBy: s.createdBy,
    createdByName: names.get(s.createdBy) ?? null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    completedAt: s.completedAt?.toISOString() ?? null,
  };
  return {
    session,
    bank,
    answers: s.answers.map((a) => toSessionAnswer(a, names)),
    note: { content: s.note?.content ?? '', version: s.note?.version ?? 0 },
  };
}

// O catálogo muda pouco: guarda por 60 s por instância para o medidor não reler a cada tecla.
let catalogCache: { at: number; catalog: FrameworkCatalog } | null = null;
async function catalogCached(): Promise<FrameworkCatalog> {
  if (catalogCache && Date.now() - catalogCache.at < 60_000) return catalogCache.catalog;
  const catalog = await loadFrameworkCatalog();
  catalogCache = { at: Date.now(), catalog };
  return catalog;
}

export interface SessionEstimate {
  mapping: MappingResult;
  estimate: ScopingEstimate;
}

/** RF-32: mapeia as respostas e simula no motor atual, sem gravar nada. */
export async function estimateFor(
  bank: Bank, ctx: { plan: string; sku: string; deploymentType: string; trackKeys: string[] }, answers: SessionAnswer[],
): Promise<SessionEstimate> {
  const mapping = mapAnswersToItems(bank, ctx.trackKeys, answers);
  const estimate = simulateScopingEstimate(await catalogCached(), ctx, mapping.items);
  return { mapping, estimate };
}
