/**
 * "Complementar" uma resposta: junta o que veio da gravação ao que o
 * pré-vendas já anotou, em vez de substituir. Função pura (tela e servidor).
 *
 *  - texto: acrescenta o trecho novo em outra linha (se ainda não estiver lá);
 *  - escolha múltipla: une as opções;
 *  - tabela e casos de uso: acrescenta as linhas novas (sem repetir linha igual);
 *  - número, escolha única, Sim/Não e data: não há o que somar, vale o novo;
 *  - comentário: acrescenta o novo ao que existia.
 */

import type { AnswerValue, BankQuestion, TableRow } from './types';

const hasText = (s: unknown): s is string => typeof s === 'string' && s.trim() !== '';

function appendText(cur: unknown, add: unknown): string | undefined {
  const a = hasText(cur) ? cur.trim() : '';
  const b = hasText(add) ? add.trim() : '';
  if (!b) return a || undefined;
  if (!a) return b;
  return a.toLowerCase().includes(b.toLowerCase()) ? a : `${a}\n${b}`;
}

export function mergeAnswerValues(q: BankQuestion, current: AnswerValue | null | undefined, proposed: AnswerValue): AnswerValue {
  const cur = current || {};
  let v: AnswerValue['v'] = proposed.v;
  switch (q.type) {
    case 'short_text':
    case 'long_text':
      v = appendText(cur.v, proposed.v) ?? null;
      break;
    case 'multi': {
      const a = Array.isArray(cur.v) ? (cur.v as string[]) : [];
      const b = Array.isArray(proposed.v) ? (proposed.v as string[]) : [];
      v = Array.from(new Set([...a, ...b]));
      break;
    }
    case 'table':
    case 'ai_usecases': {
      const a = Array.isArray(cur.v) ? (cur.v as TableRow[]) : [];
      const b = Array.isArray(proposed.v) ? (proposed.v as TableRow[]) : [];
      const seen = new Set(a.map((r) => JSON.stringify(r)));
      v = [...a, ...b.filter((r) => !seen.has(JSON.stringify(r)))];
      break;
    }
    default:
      v = proposed.v ?? cur.v ?? null;
  }
  const note = appendText(cur.note, proposed.note);
  return { v, ...(note ? { note } : {}) };
}
