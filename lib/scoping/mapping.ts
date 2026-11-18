/**
 * Respostas da sessão → itens do catálogo (RF-30 e RF-33).
 *
 * Função pura: recebe o banco, as trilhas e as respostas e devolve as
 * quantidades por item, as perguntas mapeadas ainda sem resposta e as
 * perguntas sem item no catálogo (horas manuais).
 *
 * Só respostas com status "respondida" contam. Faixa usa o máximo (RF-11).
 * Várias perguntas no mesmo item: as de `combine: 'sum'` (padrão) somam; as de
 * `combine: 'max'` (e os itens fixos das trilhas) disputam com essa soma e
 * vale o maior valor.
 */

import { activeTracks, answerMap, isRange, numberMax, valueOf, visibleQuestions } from './rules';
import type { Bank, BankQuestion, CatalogMapping, SessionAnswer, TableRow } from './types';

export interface MappedItem {
  itemId: number;
  itemName: string;
  quantity: number;
  /** alguma resposta que alimenta o item é faixa */
  isRange: boolean;
  /** keys das perguntas (ou `track:<key>`) que somaram no item */
  sources: string[];
}

export interface MappingResult {
  items: MappedItem[];
  /** perguntas visíveis com mapeamento e sem resposta (status diferente de respondida) */
  missing: string[];
  /** perguntas visíveis marcadas "sem item no catálogo" */
  manual: { questionKey: string; quantity: number | null }[];
}

interface Entry { source: string; qty: number; combine: 'sum' | 'max'; range: boolean }

function rowHasContent(row: TableRow): boolean {
  return Object.values(row || {}).some((v) => v !== null && v !== undefined && String(v).trim() !== '');
}

function rowsOf(v: unknown): TableRow[] {
  return Array.isArray(v) ? (v as TableRow[]).filter((r) => r && typeof r === 'object' && rowHasContent(r)) : [];
}

function includesOption(v: unknown, option: string): boolean {
  return Array.isArray(v) ? (v as string[]).includes(option) : v === option;
}

export function mapAnswersToItems(bank: Bank, trackKeys: string[], answers: SessionAnswer[]): MappingResult {
  const tracks = activeTracks(trackKeys);
  const map = answerMap(answers);
  const visible = visibleQuestions(bank, trackKeys, answers);
  const entries = new Map<number, { name: string; list: Entry[] }>();
  const missing: string[] = [];
  const manual: MappingResult['manual'] = [];

  const add = (itemId: number, itemName: string, e: Entry) => {
    if (!(e.qty > 0)) return;
    const cur = entries.get(itemId) || { name: itemName, list: [] };
    cur.list.push(e);
    entries.set(itemId, cur);
  };

  const answeredValue = (key: string) => {
    const a = map.get(key);
    return a?.status === 'respondida' ? valueOf(a) : undefined;
  };

  const apply = (q: BankQuestion, m: CatalogMapping, v: unknown) => {
    const combine = m.combine ?? 'sum';
    const range = isRange(v);
    const base = { source: q.key, combine, range } as const;
    switch (m.rule) {
      case 'quantity': {
        const n = numberMax(v);
        if (n !== undefined) add(m.itemId, m.itemName, { ...base, qty: n * (m.factor ?? 1) });
        break;
      }
      case 'fixed_if_yes':
        if (v === 'sim') add(m.itemId, m.itemName, { ...base, range: false, qty: m.quantity });
        break;
      case 'fixed_if_positive': {
        const n = numberMax(v);
        if (n !== undefined && n > 0) add(m.itemId, m.itemName, { ...base, range: false, qty: m.quantity });
        break;
      }
      case 'per_option': {
        if (!includesOption(v, m.option)) break;
        let qty = m.quantity ?? 1;
        let fromRange = false;
        if (m.quantityFrom) {
          const from = answeredValue(m.quantityFrom);
          const n = numberMax(from);
          if (n !== undefined) { qty = n; fromRange = isRange(from); }
        }
        add(m.itemId, m.itemName, { ...base, range: fromRange, qty });
        break;
      }
      case 'table_count':
        add(m.itemId, m.itemName, { ...base, range: false, qty: rowsOf(v).length * (m.factor ?? 1) });
        break;
      case 'table_item_qty':
        rowsOf(v).forEach((row) => {
          const ref = m.items[String(row[m.itemColumn] ?? '')];
          if (!ref) return;
          const n = Number(row[m.qtyColumn]);
          add(ref.itemId, ref.itemName, { ...base, range: false, qty: Number.isFinite(n) && n > 0 ? n : 1 });
        });
        break;
      case 'ai_usecase_complexity':
        rowsOf(v).forEach((row) => {
          const ref = m.items[String(row.complexity ?? '') as keyof typeof m.items];
          if (ref) add(ref.itemId, ref.itemName, { ...base, range: false, qty: 1 });
        });
        break;
    }
  };

  visible.forEach((q) => {
    const v = answeredValue(q.key);
    if (q.noCatalogItem) {
      const n = numberMax(v);
      manual.push({ questionKey: q.key, quantity: n ?? null });
    }
    const mappings = q.catalogMappings.filter((m) => !m.requiresTrack || tracks.has(m.requiresTrack));
    if (!mappings.length) return;
    if (v === undefined) {
      missing.push(q.key);
      return;
    }
    mappings.forEach((m) => apply(q, m, v));
  });

  // Itens fixos das trilhas ativas (configurações gerais, workshops).
  bank.tracks
    .filter((t) => tracks.has(t.key))
    .forEach((t) => t.fixedItems.forEach((f) =>
      add(f.itemId, f.itemName, { source: `track:${t.key}`, qty: f.quantity, combine: 'max', range: false })));

  const items: MappedItem[] = [];
  entries.forEach(({ name, list }, itemId) => {
    const sum = list.filter((e) => e.combine === 'sum').reduce((acc, e) => acc + e.qty, 0);
    const max = Math.max(0, ...list.filter((e) => e.combine === 'max').map((e) => e.qty));
    const quantity = Math.round(Math.max(sum, max) * 100) / 100;
    if (quantity <= 0) return;
    items.push({
      itemId,
      itemName: name,
      quantity,
      isRange: list.some((e) => e.range),
      sources: Array.from(new Set(list.map((e) => e.source))),
    });
  });
  items.sort((a, b) => a.itemId - b.itemId);
  return { items, missing, manual };
}
