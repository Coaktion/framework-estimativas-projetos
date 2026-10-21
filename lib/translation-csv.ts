/**
 * Planilha de traduções da biblioteca (itens, categorias e skills).
 *
 * Exportada pelo painel Admin para que os nomes sejam traduzidos fora do site
 * e importada de volta. A chave de cada linha é `tipo + id`; o nome em
 * português vai junto só como referência (é a chave canônica no banco e nunca
 * é alterado pela importação).
 */

export type TranslationRowType = 'item' | 'categoria' | 'skill';

export interface TranslationRow {
  type: TranslationRowType;
  id: number;
  /** Categoria do item (referência para quem traduz). */
  category: string;
  namePt: string;
  nameEn: string;
  nameEs: string;
  tooltipPt: string;
  tooltipEn: string;
  tooltipEs: string;
}

export const TRANSLATION_COLUMNS = [
  'tipo', 'id', 'categoria', 'nome_pt', 'nome_en', 'nome_es', 'tooltip_pt', 'tooltip_en', 'tooltip_es',
] as const;

const SEP = ';';

function cell(value: unknown): string {
  const text = String(value ?? '');
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV com ";" e BOM (abre direto no Excel em português). */
export function buildTranslationCsv(rows: TranslationRow[]): string {
  const lines = [TRANSLATION_COLUMNS.join(SEP)];
  rows.forEach((r) => {
    lines.push([r.type, r.id, r.category, r.namePt, r.nameEn, r.nameEs, r.tooltipPt, r.tooltipEn, r.tooltipEs].map(cell).join(SEP));
  });
  return '﻿' + lines.join('\r\n');
}

/** Lê CSV com ";" ou "," (detectado pelo cabeçalho), aspas e quebras de linha em campos. */
export function parseCsv(text: string): string[][] {
  const source = String(text || '').replace(/^﻿/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] || '';
  const sep = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inQuotes) {
      if (ch === '"') {
        if (source[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === sep) { row.push(field); field = ''; continue; }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }
  row.push(field);
  if (row.some((v) => v !== '')) rows.push(row);
  return rows;
}

/** Linhas da planilha importada, já mapeadas pelos nomes das colunas. */
export function parseTranslationCsv(text: string): { rows: TranslationRow[]; error?: string } {
  const table = parseCsv(text);
  if (!table.length) return { rows: [], error: 'empty' };
  const header = table[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  if (col('tipo') < 0 || col('id') < 0) return { rows: [], error: 'header' };
  const get = (r: string[], name: string) => (col(name) >= 0 ? String(r[col(name)] ?? '').trim() : '');
  const rows: TranslationRow[] = [];
  table.slice(1).forEach((r) => {
    const type = get(r, 'tipo').toLowerCase() as TranslationRowType;
    const id = parseInt(get(r, 'id'), 10);
    if (!['item', 'categoria', 'skill'].includes(type) || !Number.isInteger(id)) return;
    rows.push({
      type,
      id,
      category: get(r, 'categoria'),
      namePt: get(r, 'nome_pt'),
      nameEn: get(r, 'nome_en'),
      nameEs: get(r, 'nome_es'),
      tooltipPt: get(r, 'tooltip_pt'),
      tooltipEn: get(r, 'tooltip_en'),
      tooltipEs: get(r, 'tooltip_es'),
    });
  });
  return { rows };
}
