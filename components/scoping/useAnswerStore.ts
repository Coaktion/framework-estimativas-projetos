'use client';

/**
 * Autosave das respostas (RNF-01 e 4.5).
 *
 *  - Cada alteração atualiza a tela na hora e agenda a gravação da pergunta
 *    (texto: 2,5 s depois de parar de digitar; status: na hora). A resposta
 *    da gravação só atualiza a versão; o que está na tela não é trocado.
 *  - A gravação manda a versão que a tela conhece; se outra pessoa gravou
 *    antes, a pergunta entra em conflito e a tela pede a escolha.
 *  - Falha de rede ou do servidor: estado "error" (faixa vermelha), as
 *    alterações ficam numa fila local (também no localStorage) e são
 *    reenviadas a cada 5 s até voltar.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { saveAnswerAction, type AnswerInput } from '@/app/scoping/actions';
import type { AnswerStatus, AnswerValue, SessionAnswer } from '@/lib/scoping/types';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface AnswerPatch {
  value?: AnswerValue | null;
  status?: AnswerStatus;
  pendingOwner?: string | null;
  pendingDue?: string | null;
  naReason?: string | null;
}

export interface Conflict {
  questionKey: string;
  mine: SessionAnswer;
  theirs: SessionAnswer;
}

const blank = (questionKey: string): SessionAnswer => ({
  questionKey, value: null, status: 'nao_perguntada', pendingOwner: null, pendingDue: null, naReason: null,
  source: 'manual', sourceRef: null, version: 0,
});

const storageKey = (sessionId: string) => `scoping-queue:${sessionId}`;

/** Espera depois da última tecla antes de gravar. */
const TYPING_DELAY_MS = 2500;

export function useAnswerStore(sessionId: string, initial: SessionAnswer[], opts: { readOnly: boolean; onSaved?: () => void }) {
  const [answers, setAnswers] = useState<Record<string, SessionAnswer>>(() => Object.fromEntries(initial.map((a) => [a.questionKey, a])));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [readOnlyError, setReadOnlyError] = useState<string | null>(null);

  const answersRef = useRef(answers);
  answersRef.current = answers;
  /** versão do servidor que a tela conhece, por pergunta */
  const baseVersion = useRef<Record<string, number>>(Object.fromEntries(initial.map((a) => [a.questionKey, a.version])));
  const dirty = useRef<Set<string>>(new Set());
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const inflight = useRef<Set<string>>(new Set());
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSavedRef = useRef(opts.onSaved);
  onSavedRef.current = opts.onSaved;

  const persistQueue = useCallback(() => {
    try {
      const pending = Array.from(dirty.current).map((k) => ({ answer: answersRef.current[k], base: baseVersion.current[k] ?? 0 }));
      if (pending.length) localStorage.setItem(storageKey(sessionId), JSON.stringify(pending));
      else localStorage.removeItem(storageKey(sessionId));
    } catch { /* armazenamento indisponível: segue só em memória */ }
  }, [sessionId]);

  const flush = useCallback(async (key: string) => {
    if (inflight.current.has(key)) return;
    const a = answersRef.current[key];
    if (!a || !dirty.current.has(key)) return;
    inflight.current.add(key);
    dirty.current.delete(key);
    setSaveState('saving');
    const input: AnswerInput = { value: a.value ?? {}, status: a.status, pendingOwner: a.pendingOwner, pendingDue: a.pendingDue, naReason: a.naReason };
    let res: Awaited<ReturnType<typeof saveAnswerAction>> | null = null;
    try {
      res = await saveAnswerAction(sessionId, key, input, baseVersion.current[key] ?? 0);
    } catch {
      res = null;
    }
    inflight.current.delete(key);
    if (res && res.ok) {
      baseVersion.current[key] = res.answer.version;
      // Se a pessoa alterou de novo durante a gravação, a versão local continua valendo.
      // Só a versão e a origem vêm do servidor: o texto continua o da tela,
      // senão o campo é redesenhado e o cursor pula enquanto a pessoa digita.
      setAnswers((cur) => ({ ...cur, [key]: cur[key] ? { ...cur[key], version: res!.answer.version, source: res!.answer.source, sourceRef: res!.answer.sourceRef } : res!.answer }));
      onSavedRef.current?.();
    } else if (res && !res.ok && res.error === 'conflict' && 'current' in res) {
      const theirs = res.current;
      setConflicts((cur) => [...cur.filter((c) => c.questionKey !== key), { questionKey: key, mine: a, theirs }]);
    } else if (res && !res.ok && (res.error === 'completed' || res.error === 'forbidden' || res.error === 'not_found')) {
      setReadOnlyError(res.error);
    } else {
      dirty.current.add(key);
      setSaveState('error');
      persistQueue();
      if (!retryTimer.current) {
        retryTimer.current = setTimeout(() => {
          retryTimer.current = null;
          Array.from(dirty.current).forEach((k) => void flush(k));
        }, 5000);
      }
      return;
    }
    if (dirty.current.has(key)) void flush(key);
    persistQueue();
    if (!dirty.current.size && !inflight.current.size) setSaveState((s) => (s === 'error' ? s : 'saved'));
  }, [sessionId, persistQueue]);

  const schedule = useCallback((key: string, delay: number) => {
    dirty.current.add(key);
    persistQueue();
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => void flush(key), delay);
  }, [flush, persistQueue]);

  const update = useCallback((key: string, patch: AnswerPatch, opts2: { immediate?: boolean } = {}) => {
    if (opts.readOnly) return;
    setAnswers((cur) => {
      const prev = cur[key] || blank(key);
      const next: SessionAnswer = { ...prev, ...patch } as SessionAnswer;
      answersRef.current = { ...cur, [key]: next };
      return answersRef.current;
    });
    schedule(key, opts2.immediate ? 50 : TYPING_DELAY_MS);
  }, [opts.readOnly, schedule]);

  /** Resolve um conflito: 'mine' regrava a minha versão por cima; 'theirs' aceita a outra. */
  const resolveConflict = useCallback((key: string, choice: 'mine' | 'theirs') => {
    const c = conflicts.find((x) => x.questionKey === key);
    if (!c) return;
    baseVersion.current[key] = c.theirs.version;
    setConflicts((cur) => cur.filter((x) => x.questionKey !== key));
    if (choice === 'theirs') {
      dirty.current.delete(key);
      setAnswers((cur) => ({ ...cur, [key]: c.theirs }));
    } else {
      setAnswers((cur) => ({ ...cur, [key]: { ...c.mine, version: c.theirs.version } }));
      answersRef.current = { ...answersRef.current, [key]: { ...c.mine, version: c.theirs.version } };
      schedule(key, 50);
    }
  }, [conflicts, schedule]);

  // Fila local de uma visita anterior que não chegou ao servidor: reenvia.
  useEffect(() => {
    if (opts.readOnly) return;
    try {
      const raw = localStorage.getItem(storageKey(sessionId));
      if (!raw) return;
      const pending = JSON.parse(raw) as { answer: SessionAnswer; base: number }[];
      pending.forEach(({ answer, base }) => {
        if (!answer?.questionKey) return;
        baseVersion.current[answer.questionKey] = base;
        setAnswers((cur) => ({ ...cur, [answer.questionKey]: answer }));
        answersRef.current = { ...answersRef.current, [answer.questionKey]: answer };
        schedule(answer.questionKey, 300);
      });
    } catch { /* fila corrompida: ignora */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Trocou de aba ou de janela: grava na hora o que estava esperando a pausa.
  useEffect(() => {
    const now = () => {
      if (document.visibilityState !== 'hidden') return;
      Array.from(dirty.current).forEach((k) => { clearTimeout(timers.current[k]); void flush(k); });
    };
    document.addEventListener('visibilitychange', now);
    return () => document.removeEventListener('visibilitychange', now);
  }, [flush]);

  // Avisa antes de fechar a aba com alteração não gravada.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty.current.size || inflight.current.size) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  /** Resposta gravada por outro caminho (ex.: proposta aceita): entra na tela com a versão nova. */
  const applyServer = useCallback((a: SessionAnswer) => {
    baseVersion.current[a.questionKey] = a.version;
    dirty.current.delete(a.questionKey);
    setAnswers((cur) => ({ ...cur, [a.questionKey]: a }));
    answersRef.current = { ...answersRef.current, [a.questionKey]: a };
    persistQueue();
  }, [persistQueue]);

  return { answers, update, saveState, conflicts, resolveConflict, readOnlyError, applyServer };
}
