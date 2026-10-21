'use client';

/**
 * Exportação do projeto do Framework em CSV, XLSX, PDF e PNG.
 *
 * Tudo é gerado no navegador a partir do MESMO resultado que o editor mostra
 * (as linhas e o resumo vêm de `computeFrameworkTotals`), então o arquivo
 * sempre bate com a tela. As bibliotecas pesadas (exceljs, jspdf,
 * html-to-image) só são baixadas no clique do formato escolhido.
 */

export type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'png';

export interface ExportDocument {
  locale: 'pt' | 'en' | 'es';
  /** Nome-base do arquivo, sem extensão. */
  fileBase: string;
  title: string;
  /** Linhas de cabeçalho (versão, plano, data...). */
  meta: Array<{ label: string; value: string }>;
  columns: {
    category: string;
    subcategory: string;
    item: string;
    skill: string;
    quantity: string;
    unitHours: string;
    total: string;
  };
  rows: Array<{
    category: string;
    subcategory: string;
    item: string;
    skill: string;
    quantity: number;
    unitHours: number | null;
    total: number;
  }>;
  summaryTitle: string;
  summary: Array<{ label: string; hours: number | null; note?: string; level: 0 | 1 }>;
  grandTotalLabel: string;
  grandTotal: number;
  hoursUnit: string;
}

const SHEET_NAMES: Record<ExportDocument['locale'], { items: string; summary: string }> = {
  pt: { items: 'Itens', summary: 'Resumo' },
  en: { items: 'Items', summary: 'Summary' },
  es: { items: 'Ítems', summary: 'Resumen' },
};

function formatNumber(value: number | null | undefined, locale: ExportDocument['locale'], decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  const rounded = Math.round(value * 10 ** decimals) / 10 ** decimals;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '');
  return locale === 'en' ? text : text.replace('.', ',');
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
  const c = doc.columns;
  out.push(line([c.category, c.subcategory, c.item, c.skill, c.quantity, c.unitHours, c.total]));
  doc.rows.forEach((r) => {
    out.push(line([
      r.category, r.subcategory, r.item, r.skill,
      formatNumber(r.quantity, doc.locale), formatNumber(r.unitHours, doc.locale), formatNumber(r.total, doc.locale),
    ]));
  });
  out.push('');
  out.push(line([doc.summaryTitle]));
  doc.summary.forEach((s) => {
    out.push(line([
      s.level ? `  ${s.label}` : s.label,
      s.hours === null ? (s.note || '') : formatNumber(s.hours, doc.locale),
    ]));
  });
  out.push(line([doc.grandTotalLabel, formatNumber(doc.grandTotal, doc.locale)]));
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
  const c = doc.columns;
  const header = sheet.addRow([c.category, c.subcategory, c.item, c.skill, c.quantity, c.unitHours, c.total]);
  header.font = { bold: true };
  header.eachCell((cellRef: any) => {
    cellRef.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E3' } };
  });
  doc.rows.forEach((r) => {
    sheet.addRow([r.category, r.subcategory, r.item, r.skill, r.quantity, r.unitHours ?? null, r.total]);
  });
  [28, 26, 48, 18, 10, 12, 12].forEach((width, i) => { sheet.getColumn(i + 1).width = width; });
  [5, 6, 7].forEach((col) => { sheet.getColumn(col).numFmt = '0.##'; });

  const summary = workbook.addWorksheet(SHEET_NAMES[doc.locale].summary);
  summary.addRow([doc.summaryTitle]).font = { bold: true, size: 14 };
  doc.summary.forEach((s) => {
    const row = summary.addRow([s.level ? `   ${s.label}` : s.label, s.hours === null ? (s.note || '') : s.hours]);
    if (!s.level) row.font = { bold: true };
  });
  const total = summary.addRow([doc.grandTotalLabel, doc.grandTotal]);
  total.font = { bold: true };
  summary.getColumn(1).width = 44;
  summary.getColumn(2).width = 40;
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

  const c = doc.columns;
  autoTable(pdf, {
    startY: y + 6,
    head: [[c.category, c.subcategory, c.item, c.skill, c.quantity, c.unitHours, c.total]],
    body: doc.rows.map((r) => [
      r.category, r.subcategory, r.item, r.skill,
      formatNumber(r.quantity, doc.locale), formatNumber(r.unitHours, doc.locale), formatNumber(r.total, doc.locale),
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [47, 122, 42] },
    columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' } },
    margin: { left: marginX, right: marginX },
    didParseCell: (data: any) => {
      if (data.section === 'head' && data.column.index >= 4) data.cell.styles.halign = 'right';
    },
  });

  const afterItems = (pdf as any).lastAutoTable?.finalY ?? y + 20;
  autoTable(pdf, {
    startY: afterItems + 18,
    head: [[doc.summaryTitle, doc.hoursUnit]],
    body: [
      ...doc.summary.map((s) => [
        s.level ? `    ${s.label}` : s.label,
        s.hours === null ? (s.note || '') : formatNumber(s.hours, doc.locale),
      ]),
      [doc.grandTotalLabel, formatNumber(doc.grandTotal, doc.locale)],
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
