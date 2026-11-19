/**
 * Regras puras da sessão de scoping: quais perguntas aparecem, completude
 * (RF-13), pendências (RF-14) e sugestão de trilhas (RF-08).
 */

import type {
  AnswerValue, Bank, BankQuestion, BankTrack, NumberValue, SessionAnswer, SessionContext, ShowIf, SuggestRule,
} from './types';

export const CORE_TRACK = 'core';

/** Trilhas ativas da sessão: o núcleo está sempre presente. */
export function activeTracks(trackKeys: string[]): Set<string> {
  return new Set([CORE_TRACK, ...trackKeys]);
}

export function answerMap(answers: SessionAnswer[]): Map<string, SessionAnswer> {
  return new Map(answers.map((a) => [a.questionKey, a]));
}

/** Valor tipado de uma resposta (ou undefined se vazio). */
export function valueOf(answer: SessionAnswer | undefined): AnswerValue['v'] | undefined {
  const v = answer?.value?.v;
  if (v === null || v === undefined || v === '') return undefined;
  if (Array.isArray(v) && v.length === 0) return undefined;
  return v;
}

/** Máximo de um número ou de uma faixa (a estimativa usa o máximo, RF-11). */
export function numberMax(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v && typeof v === 'object' && !Array.isArray(v) && 'max' in (v as any)) {
    const max = Number((v as any).max);
    return Number.isFinite(max) ? max : undefined;
  }
  return undefined;
}

export function isRange(v: unknown): v is { min: number; max: number } {
  return !!v && typeof v === 'object' && !Array.isArray(v) && 'max' in (v as any) && 'min' in (v as any);
}

export function showIfMatches(cond: ShowIf, answers: Map<string, SessionAnswer>): boolean {
  const v = valueOf(answers.get(cond.questionKey));
  if (v === undefined) return false;
  if (cond.answered) return true;
  if (cond.in !== undefined) return Array.isArray(v) ? (v as string[]).some((x) => cond.in!.includes(x)) : cond.in.includes(String(v));
  if (cond.equals !== undefined) return v === cond.equals;
  if (cond.includes !== undefined) return Array.isArray(v) && (v as string[]).includes(cond.includes);
  if (cond.gt !== undefined) {
    const n = numberMax(v as NumberValue);
    return n !== undefined && n > cond.gt;
  }
  return true;
}

/** A pergunta pertence a alguma trilha ativa (sem olhar a condição de exibição). */
export function inActiveTracks(q: BankQuestion, tracks: Set<string>): boolean {
  const keys = q.trackKeys.length ? q.trackKeys : [CORE_TRACK];
  return keys.some((k) => tracks.has(k));
}

/** Perguntas visíveis da sessão: trilha ativa e condição de exibição satisfeita (encadeada). */
export function visibleQuestions(bank: Bank, trackKeys: string[], answers: SessionAnswer[]): BankQuestion[] {
  const tracks = activeTracks(trackKeys);
  const map = answerMap(answers);
  const byKey = new Map(bank.questions.map((q) => [q.key, q]));
  const memo = new Map<string, boolean>();
  const visible = (q: BankQuestion, depth = 0): boolean => {
    if (memo.has(q.key)) return memo.get(q.key)!;
    let ok = inActiveTracks(q, tracks);
    if (ok && q.showIf) {
      const parent = byKey.get(q.showIf.questionKey);
      ok = (!parent || depth > 10 || visible(parent, depth + 1)) && showIfMatches(q.showIf, map);
    }
    memo.set(q.key, ok);
    return ok;
  };
  return bank.questions.filter((q) => visible(q));
}

/** A resposta deixa a pergunta "tratada" para a regra de completude (RF-12/13). */
export function isAddressed(answer: SessionAnswer | undefined): boolean {
  if (!answer) return false;
  switch (answer.status) {
    case 'respondida': return valueOf(answer) !== undefined || !!answer.value?.note?.trim();
    case 'pendente': return !!answer.pendingOwner?.trim() && !!answer.pendingDue;
    case 'nao_se_aplica': return !!answer.naReason?.trim();
    default: return false;
  }
}

export interface Completeness {
  essentialTotal: number;
  essentialOpen: BankQuestion[];
  canComplete: boolean;
  counts: { respondida: number; pendente: number; nao_se_aplica: number; nao_perguntada: number };
}

/** RF-13: só conclui se toda essencial visível estiver respondida, pendente com dono/prazo ou NA com motivo. */
export function completeness(bank: Bank, trackKeys: string[], answers: SessionAnswer[]): Completeness {
  const visible = visibleQuestions(bank, trackKeys, answers);
  const map = answerMap(answers);
  const counts = { respondida: 0, pendente: 0, nao_se_aplica: 0, nao_perguntada: 0 };
  visible.forEach((q) => {
    const a = map.get(q.key);
    const status = a && isAddressed(a) ? a.status : 'nao_perguntada';
    counts[status as keyof typeof counts] += 1;
  });
  const essentials = visible.filter((q) => q.priority === 'essencial');
  const essentialOpen = essentials.filter((q) => !isAddressed(map.get(q.key)));
  return { essentialTotal: essentials.length, essentialOpen, canComplete: essentialOpen.length === 0, counts };
}

export interface PendingItem {
  questionKey: string;
  owner: string;
  due: string | null;
  note: string;
}

/** RF-14: pendências das perguntas visíveis, agrupáveis por dono. */
export function pendingItems(bank: Bank, trackKeys: string[], answers: SessionAnswer[]): PendingItem[] {
  const visibleKeys = new Set(visibleQuestions(bank, trackKeys, answers).map((q) => q.key));
  return answers
    .filter((a) => a.status === 'pendente' && visibleKeys.has(a.questionKey))
    .map((a) => ({
      questionKey: a.questionKey,
      owner: (a.pendingOwner || '').trim() || '—',
      due: a.pendingDue,
      note: a.value?.note || '',
    }))
    .sort((a, b) => a.owner.localeCompare(b.owner) || String(a.due).localeCompare(String(b.due)));
}

export function groupByOwner(items: PendingItem[]): Map<string, PendingItem[]> {
  const out = new Map<string, PendingItem[]>();
  items.forEach((i) => out.set(i.owner, [...(out.get(i.owner) || []), i]));
  return out;
}

const isContextRule = (r: SuggestRule) => !r.answer && (r.sku !== undefined || r.plan !== undefined || r.deploymentType !== undefined);

/** RF-08: trilhas sugeridas pelo contexto (SKU, plano, tipo de implantação). */
export function suggestedTracks(tracks: BankTrack[], ctx: Pick<SessionContext, 'sku' | 'plan' | 'deploymentType'>): string[] {
  return tracks
    .filter((t) => t.type !== 'core')
    .filter((t) => t.suggestRules.filter(isContextRule).some((r) =>
      (r.sku === undefined || r.sku === ctx.sku) &&
      (r.plan === undefined || r.plan === ctx.plan) &&
      (r.deploymentType === undefined || r.deploymentType === ctx.deploymentType)))
    .map((t) => t.key);
}

/** Trilhas que a própria conversa indica e que ainda não estão ativas. */
export function suggestedByAnswers(tracks: BankTrack[], trackKeys: string[], answers: SessionAnswer[]): string[] {
  const active = activeTracks(trackKeys);
  const map = answerMap(answers);
  return tracks
    .filter((t) => t.type !== 'core' && !active.has(t.key))
    .filter((t) => t.suggestRules.some((r) => r.answer && showIfMatches(r.answer, map)))
    .map((t) => t.key);
}

export interface TrackCost {
  questions: number;
  essential: number;
  recommended: number;
  minutes: number;
}

export const DEFAULT_MINUTES = { essential: 2, recommended: 1 };

/** Quantas perguntas a trilha soma e o tempo estimado de reunião (RF-08). */
export function trackCost(bank: Bank, trackKey: string, minutes = DEFAULT_MINUTES): TrackCost {
  const qs = bank.questions.filter((q) => (q.trackKeys.length ? q.trackKeys : [CORE_TRACK]).includes(trackKey));
  const essential = qs.filter((q) => q.priority === 'essencial').length;
  const recommended = qs.filter((q) => q.priority === 'recomendada').length;
  return { questions: qs.length, essential, recommended, minutes: essential * minutes.essential + recommended * minutes.recommended };
}

const PRIORITY_RANK = { essencial: 0, recomendada: 1, opcional: 2 } as const;

/** Ordem do Modo reunião: essenciais primeiro, depois recomendadas, depois opcionais (cada grupo na ordem do banco). */
export function meetingOrder(questions: BankQuestion[], bank: Bank): BankQuestion[] {
  const sectionOrder = new Map(bank.sections.map((s) => [s.key, s.order]));
  return [...questions].sort((a, b) =>
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    (sectionOrder.get(a.sectionKey) ?? 0) - (sectionOrder.get(b.sectionKey) ?? 0) ||
    a.order - b.order);
}
