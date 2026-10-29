'use client';

/**
 * Exportação em CSV, XLSX, PDF e PNG (Framework e estimativas da Calculadora AE).
 *
 * Tudo é gerado no navegador a partir do MESMO resultado que a tela mostra,
 * então o arquivo sempre bate com ela. As colunas são definidas por quem
 * exporta (o Framework tem categoria/skill; a Calculadora tem seção e, para o
 * Account Executive, só o nome do item). As bibliotecas pesadas (exceljs,
 * jspdf, html-to-image) só são baixadas no clique do formato escolhido.
 */

export type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'png';

export interface ExportColumn {
  key: string;
  label: string;
  /** Números: alinhados à direita e com vírgula decimal em PT/ES. */
  numeric?: boolean;
  /** Largura no Excel (caracteres). */
  width?: number;
}

export interface ExportDocument {
  locale: 'pt' | 'en' | 'es';
  /** Nome-base do arquivo, sem extensão. */
  fileBase: string;
  title: string;
  /** Linhas de cabeçalho (versão, plano, data...). */
  meta: Array<{ label: string; value: string }>;
  columns: ExportColumn[];
  rows: Array<Record<string, string | number | null>>;
  /** Bloco opcional de pares rótulo/valor (ex.: dados informados na Calculadora). */
  details?: { title: string; items: Array<{ label: string; value: string }> };
  summaryTitle: string;
  summary: Array<{ label: string; hours: number | null; note?: string; level: 0 | 1 }>;
  grandTotalLabel: string;
  /** null = não exibir horas (ex.: estimativa que exige SC); mostra `grandTotalNote`. */
  grandTotal: number | null;
  grandTotalNote?: string;
  hoursUnit: string;
}

const SHEET_NAMES: Record<ExportDocument['locale'], { items: string; summary: string }> = {
  pt: { items: 'Itens', summary: 'Resumo' },
  en: { items: 'Items', summary: 'Summary' },
  es: { items: 'Ítems', summary: 'Resumen' },
};

export function formatNumber(value: number | null | undefined, locale: ExportDocument['locale'], decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  const rounded = Math.round(value * 10 ** decimals) / 10 ** decimals;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '');
  return locale === 'en' ? text : text.replace('.', ',');
}

/** Valor de uma célula como texto (números formatados no idioma). */
export function cellText(doc: ExportDocument, column: ExportColumn, row: Record<string, string | number | null>): string {
  const value = row[column.key];
  if (column.numeric) return formatNumber(typeof value === 'number' ? value : value == null ? null : Number(value), doc.locale);
  return value == null ? '' : String(value);
}

/** Total geral como texto (ou a observação, quando as horas não são exibidas). */
export function grandTotalText(doc: ExportDocument): string {
  return doc.grandTotal == null ? (doc.grandTotalNote || '') : formatNumber(doc.grandTotal, doc.locale);
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFileBase(value: string): string {
  return String(value || 'projeto')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'projeto';
}

/* ------------------------------------------------------------------ CSV -- */

export function exportCsv(doc: ExportDocument) {
  // Excel em pt-BR espera ";" como separador e vírgula decimal.
  const sep = doc.locale === 'en' ? ',' : ';';
  const cell = (value: unknown) => {
    const text = String(value ?? '');
    const needsQuotes = text.includes(sep) || text.includes('"') || /[\r\n]/.test(text);
    return needsQuotes ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const line = (values: unknown[]) => values.map(cell).join(sep);
  const out: string[] = [];
  out.push(line([doc.title]));
  doc.meta.forEach((m) => out.push(line([m.label, m.value])));
  out.push('');
  out.push(line(doc.columns.map((c) => c.label)));
  doc.rows.forEach((r) => out.push(line(doc.columns.map((c) => cellText(doc, c, r)))));
  if (doc.details?.items.length) {
    out.push('');
    out.push(line([doc.details.title]));
    doc.details.items.forEach((d) => out.push(line([d.label, d.value])));
  }
  out.push('');
  out.push(line([doc.summaryTitle]));
  doc.summary.forEach((s) => {
    out.push(line([
      s.level ? `  ${s.label}` : s.label,
      s.hours === null ? (s.note || '') : formatNumber(s.hours, doc.locale),
    ]));
  });
  out.push(line([doc.grandTotalLabel, grandTotalText(doc)]));
  const blob = new Blob(['﻿' + out.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  download(blob, `${doc.fileBase}.csv`);
}

/* ----------------------------------------------------------------- XLSX -- */

export async function exportXlsx(doc: ExportDocument) {
  const ExcelJS: any = (await import('exceljs')).default ?? (await import('exceljs'));
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(SHEET_NAMES[doc.locale].items);
  sheet.addRow([doc.title]).font = { bold: true, size: 14 };
  doc.meta.forEach((m) => sheet.addRow([m.label, m.value]));
  sheet.addRow([]);
  const header = sheet.addRow(doc.columns.map((c) => c.label));
  header.font = { bold: true };
  header.eachCell((cellRef: any) => {
    cellRef.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E3' } };
  });
  doc.rows.forEach((r) => {
    sheet.addRow(doc.columns.map((c) => {
      const value = r[c.key];
      if (!c.numeric) return value ?? '';
      const n = typeof value === 'number' ? value : value == null ? null : Number(value);
      return n == null || !Number.isFinite(n) ? null : n;
    }));
  });
  doc.columns.forEach((c, i) => {
    const column = sheet.getColumn(i + 1);
    column.width = c.width ?? (c.numeric ? 12 : 30);
    if (c.numeric) column.numFmt = '0.##';
  });

  const summary = workbook.addWorksheet(SHEET_NAMES[doc.locale].summary);
  if (doc.details?.items.length) {
    summary.addRow([doc.details.title]).font = { bold: true, size: 14 };
    doc.details.items.forEach((d) => {
      const row = summary.addRow([d.label, d.value]);
      row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
    });
    summary.addRow([]);
  }
  summary.addRow([doc.summaryTitle]).font = { bold: true, size: 14 };
  doc.summary.forEach((s) => {
    const row = summary.addRow([s.level ? `   ${s.label}` : s.label, s.hours === null ? (s.note || '') : s.hours]);
    if (!s.level) row.font = { bold: true };
  });
  const total = summary.addRow([doc.grandTotalLabel, doc.grandTotal ?? (doc.grandTotalNote || '')]);
  total.font = { bold: true };
  summary.getColumn(1).width = 44;
  summary.getColumn(2).width = 60;
  summary.getColumn(2).numFmt = '0.##';

  const buffer = await workbook.xlsx.writeBuffer();
  download(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${doc.fileBase}.xlsx`,
  );
}

/* ------------------------------------------------------------------ PDF -- */

export async function exportPdf(doc: ExportDocument) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const marginX = 36;

  pdf.setFontSize(16);
  pdf.text(doc.title, marginX, 40);
  pdf.setFontSize(9);
  let y = 58;
  doc.meta.forEach((m) => {
    pdf.text(`${m.label}: ${m.value}`, marginX, y);
    y += 12;
  });

  const numericIndexes = new Set(doc.columns.map((c, i) => (c.numeric ? i : -1)).filter((i) => i >= 0));
  autoTable(pdf, {
    startY: y + 6,
    head: [doc.columns.map((c) => c.label)],
    body: doc.rows.map((r) => doc.columns.map((c) => cellText(doc, c, r))),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [47, 122, 42] },
    columnStyles: Object.fromEntries(Array.from(numericIndexes).map((i) => [i, { halign: 'right' }])),
    margin: { left: marginX, right: marginX },
    didParseCell: (data: any) => {
      if (data.section === 'head' && numericIndexes.has(data.column.index)) data.cell.styles.halign = 'right';
    },
  });
  let after = (pdf as any).lastAutoTable?.finalY ?? y + 20;

  if (doc.details?.items.length) {
    autoTable(pdf, {
      startY: after + 18,
      head: [[doc.details.title, '']],
      body: doc.details.items.map((d) => [d.label, d.value]),
      styles: { fontSize: 9, cellPadding: 3, valign: 'top' },
      headStyles: { fillColor: [47, 122, 42] },
      columnStyles: { 0: { cellWidth: 180, fontStyle: 'bold' } },
      margin: { left: marginX, right: marginX },
    });
    after = (pdf as any).lastAutoTable?.finalY ?? after + 20;
  }

  autoTable(pdf, {
    startY: after + 18,
    head: [[doc.summaryTitle, doc.hoursUnit]],
    body: [
      ...doc.summary.map((s) => [
        s.level ? `    ${s.label}` : s.label,
        s.hours === null ? (s.note || '') : formatNumber(s.hours, doc.locale),
      ]),
      [doc.grandTotalLabel, grandTotalText(doc)],
    ],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [47, 122, 42] },
    columnStyles: { 1: { halign: 'right' } },
    tableWidth: 420,
    margin: { left: marginX },
    didParseCell: (data: any) => {
      if (data.section === 'head' && data.column.index === 1) data.cell.styles.halign = 'right';
      const isTotal = data.section === 'body' && data.row.index === doc.summary.length;
      const isHeading = data.section === 'body' && doc.summary[data.row.index]?.level === 0;
      if (isTotal || isHeading) data.cell.styles.fontStyle = 'bold';
    },
  });

  download(pdf.output('blob'), `${doc.fileBase}.pdf`);
}

/* ------------------------------------------------------------------ PNG -- */

export async function exportPng(node: HTMLElement, fileBase: string) {
  const { toPng } = await import('html-to-image');
  const dataUrl = await toPng(node, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true });
  const blob = await (await fetch(dataUrl)).blob();
  download(blob, `${fileBase}.png`);
}
