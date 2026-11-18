/**
 * Exportação da sessão (RF-35): Markdown (para colar no Claude) e .xlsx no
 * formato do template original da Zendesk, com respostas, status e pendências.
 * O idioma é escolhido na hora e não precisa ser o da sessão.
 *
 * A exportação não traz horas: é o registro do que o cliente respondeu.
 */

import ExcelJS from 'exceljs';
import { tr } from './i18n';
import { COMPLEXITY_LABEL, PRIORITY_LABEL, STATUS_LABEL, formatDate, formatValue } from './format';
import { answerMap, pendingItems, valueOf, visibleQuestions } from './rules';
import type { Bank, BankQuestion, ScopingLang, SessionAnswer } from './types';

export interface ExportSession {
  clientName: string;
  title: string;
  language: ScopingLang;
  deploymentType: string;
  sku: string;
  plan: string;
  trackKeys: string[];
  status: string;
  createdAt: string;
}

const T = {
  title: { pt: 'Scoping', en: 'Scoping', es: 'Scoping' },
  client: { pt: 'Cliente', en: 'Client', es: 'Cliente' },
  date: { pt: 'Data', en: 'Date', es: 'Fecha' },
  deployment: { pt: 'Tipo de implantação', en: 'Deployment type', es: 'Tipo de implementación' },
  new: { pt: 'Nova', en: 'New', es: 'Nueva' },
  optimization: { pt: 'Otimização', en: 'Optimization', es: 'Optimización' },
  plan: { pt: 'Plano previsto', en: 'Expected plan', es: 'Plan previsto' },
  tracks: { pt: 'Trilhas', en: 'Tracks', es: 'Rutas' },
  sessionStatus: { pt: 'Status da sessão', en: 'Session status', es: 'Estado de la sesión' },
  inProgress: { pt: 'Em andamento', en: 'In progress', es: 'En curso' },
  completed: { pt: 'Concluída', en: 'Completed', es: 'Concluida' },
  pending: { pt: 'Pendências', en: 'Open items', es: 'Pendientes' },
  noPending: { pt: 'Nenhuma pendência.', en: 'No open items.', es: 'Ningún pendiente.' },
  owner: { pt: 'Dono', en: 'Owner', es: 'Responsable' },
  due: { pt: 'Prazo', en: 'Due date', es: 'Plazo' },
  section: { pt: 'Seção', en: 'Section', es: 'Sección' },
  question: { pt: 'Pergunta', en: 'Discovery Question', es: 'Pregunta' },
  answer: { pt: 'Resposta / notas', en: 'Client Answer / Notes', es: 'Respuesta / notas' },
  impact: { pt: 'Impacto na configuração Zendesk', en: 'Zendesk Configuration Impact', es: 'Impacto en la configuración de Zendesk' },
  complexity: { pt: 'Complexidade', en: 'Complexity', es: 'Complejidad' },
  status: { pt: 'Status', en: 'Status', es: 'Estado' },
  priority: { pt: 'Prioridade', en: 'Priority', es: 'Prioridad' },
  followUp: { pt: 'Precisa de retorno?', en: 'Follow-up Needed?', es: '¿Requiere seguimiento?' },
  deliverables: { pt: 'Entregáveis', en: 'Deliverables', es: 'Entregables' },
  na: { pt: 'Motivo', en: 'Reason', es: 'Motivo' },
  note: { pt: 'Nota', en: 'Note', es: 'Nota' },
  notes: { pt: 'Notas da reunião', en: 'Meeting notes', es: 'Notas de la reunión' },
  actionItems: { pt: 'Pendências', en: 'Action Items', es: 'Pendientes' },
  cover: { pt: 'Capa', en: 'Cover', es: 'Portada' },
  yes: { pt: 'Sim', en: 'Yes', es: 'Sí' },
  no: { pt: 'Não', en: 'No', es: 'No' },
} as const;

const L = (key: keyof typeof T, lang: ScopingLang) => T[key][lang];

interface Prepared {
  questions: BankQuestion[];
  answers: Map<string, SessionAnswer>;
  sections: { key: string; title: string; deliverable: string; questions: BankQuestion[] }[];
  trackNames: string;
}

function prepare(bank: Bank, s: ExportSession, answers: SessionAnswer[], lang: ScopingLang): Prepared {
  const questions = visibleQuestions(bank, s.trackKeys, answers);
  const bySection = new Map<string, BankQuestion[]>();
  questions.forEach((q) => bySection.set(q.sectionKey, [...(bySection.get(q.sectionKey) || []), q]));
  return {
    questions,
    answers: answerMap(answers),
    sections: bank.sections
      .filter((sec) => bySection.has(sec.key))
      .map((sec) => ({ key: sec.key, title: tr(sec.title, lang), deliverable: tr(sec.deliverable, lang), questions: bySection.get(sec.key)! })),
    trackNames: bank.tracks.filter((t) => t.key === 'core' || s.trackKeys.includes(t.key)).map((t) => tr(t.name, lang)).join(', '),
  };
}

function answerText(q: BankQuestion, a: SessionAnswer | undefined, lang: ScopingLang): string {
  if (!a) return '';
  const parts: string[] = [];
  const v = formatValue(q, valueOf(a), lang);
  if (v) parts.push(v);
  if (a.value?.note?.trim()) parts.push(a.value.note.trim());
  return parts.join('\n');
}

function statusText(a: SessionAnswer | undefined, lang: ScopingLang): string {
  const status = a?.status || 'nao_perguntada';
  let out = STATUS_LABEL[status][lang];
  if (status === 'pendente') out += ` · ${L('owner', lang)}: ${a?.pendingOwner || '—'}${a?.pendingDue ? ` · ${L('due', lang)}: ${formatDate(a.pendingDue, lang)}` : ''}`;
  if (status === 'nao_se_aplica' && a?.naReason) out += ` · ${L('na', lang)}: ${a.naReason}`;
  return out;
}

const header = (s: ExportSession, lang: ScopingLang, trackNames: string): [string, string][] => [
  [L('client', lang), s.clientName + (s.title ? ` · ${s.title}` : '')],
  [L('date', lang), formatDate(s.createdAt, lang)],
  [L('deployment', lang), s.deploymentType === 'optimization' ? L('optimization', lang) : L('new', lang)],
  [L('plan', lang), `${s.sku} · ${s.plan}`],
  [L('tracks', lang), trackNames],
  [L('sessionStatus', lang), s.status === 'concluida' ? L('completed', lang) : L('inProgress', lang)],
];

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

export function exportMarkdown(
  bank: Bank, s: ExportSession, answers: SessionAnswer[], lang: ScopingLang, notes = '',
): string {
  const p = prepare(bank, s, answers, lang);
  const out: string[] = [`# ${L('title', lang)} · ${s.clientName}`, ''];
  header(s, lang, p.trackNames).forEach(([k, v]) => out.push(`- **${k}:** ${v}`));
  out.push('');

  const pend = pendingItems(bank, s.trackKeys, answers);
  out.push(`## ${L('pending', lang)}`, '');
  if (!pend.length) out.push(L('noPending', lang), '');
  pend.forEach((item) => {
    const q = p.questions.find((x) => x.key === item.questionKey);
    out.push(`- ${tr(q?.text, lang)} (${L('owner', lang)}: ${item.owner}${item.due ? ` · ${L('due', lang)}: ${formatDate(item.due, lang)}` : ''})`);
  });
  if (pend.length) out.push('');

  p.sections.forEach((sec) => {
    out.push(`## ${sec.title}`, '');
    sec.questions.forEach((q) => {
      const a = p.answers.get(q.key);
      out.push(`### ${tr(q.text, lang)}`);
      out.push(`*${PRIORITY_LABEL[q.priority][lang]} · ${statusText(a, lang)}*`);
      const text = answerText(q, a, lang);
      if (text) out.push('', ...text.split('\n').map((l) => (q.type === 'table' || q.type === 'ai_usecases' ? `- ${l}` : l)));
      out.push('');
    });
  });

  if (notes.trim()) out.push(`## ${L('notes', lang)}`, '', notes.trim(), '');
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// .xlsx (layout do "Zendesk Scoping Call Template")
// ---------------------------------------------------------------------------

const GREEN = 'FF7FD171';
const BLACK = 'FF111111';

function sheetName(index: number, title: string, used: Set<string>): string {
  // Excel: até 31 caracteres, sem : \ / ? * [ ]
  let name = `${index}. ${title}`.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31).trim();
  let n = 2;
  while (used.has(name.toLowerCase())) name = `${name.slice(0, 28)} ${n++}`;
  used.add(name.toLowerCase());
  return name;
}

export async function exportXlsx(
  bank: Bank, s: ExportSession, answers: SessionAnswer[], lang: ScopingLang, notes = '',
): Promise<Buffer> {
  const p = prepare(bank, s, answers, lang);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Aktie Now Tool Center';
  const used = new Set<string>();

  const cover = wb.addWorksheet(sheetName(0, L('cover', lang), used).replace(/^0\. /, ''));
  cover.columns = [{ width: 28 }, { width: 80 }];
  cover.addRow([`${L('title', lang).toUpperCase()} · ${s.clientName}`]).font = { bold: true, size: 16 };
  cover.addRow([]);
  header(s, lang, p.trackNames).forEach(([k, v]) => {
    const row = cover.addRow([k, v]);
    row.getCell(1).font = { bold: true };
  });
  if (notes.trim()) {
    cover.addRow([]);
    cover.addRow([L('notes', lang)]).font = { bold: true };
    const r = cover.addRow([notes.trim()]);
    cover.mergeCells(`A${r.number}:B${r.number}`);
    r.getCell(1).alignment = { wrapText: true, vertical: 'top' };
  }

  p.sections.forEach((sec, i) => {
    const ws = wb.addWorksheet(sheetName(i + 1, sec.title, used));
    ws.columns = [
      { width: 6 }, { width: 55 }, { width: 55 }, { width: 45 }, { width: 13 }, { width: 14 }, { width: 34 }, { width: 18 },
    ];
    ws.addRow([sec.title]).font = { bold: true, size: 14 };
    if (sec.deliverable) ws.addRow([`${L('deliverables', lang)}: ${sec.deliverable}`]).font = { italic: true };
    ws.addRow([]);
    const head = ws.addRow(['#', L('question', lang), L('answer', lang), L('impact', lang), L('complexity', lang), L('priority', lang), L('status', lang), L('followUp', lang)]);
    head.eachCell((c) => {
      c.font = { bold: true, color: { argb: BLACK } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
      c.alignment = { vertical: 'middle', wrapText: true };
    });
    sec.questions.forEach((q, qi) => {
      const a = p.answers.get(q.key);
      const row = ws.addRow([
        qi + 1,
        tr(q.text, lang),
        answerText(q, a, lang),
        tr(q.configImpact, lang),
        q.defaultComplexity ? COMPLEXITY_LABEL[q.defaultComplexity][lang] : '',
        PRIORITY_LABEL[q.priority][lang],
        statusText(a, lang),
        a?.status === 'pendente' ? L('yes', lang) : L('no', lang),
      ]);
      row.alignment = { wrapText: true, vertical: 'top' };
    });
    ws.views = [{ state: 'frozen', ySplit: head.number }];
  });

  const ai = wb.addWorksheet(L('actionItems', lang));
  ai.columns = [{ width: 6 }, { width: 70 }, { width: 30 }, { width: 24 }, { width: 14 }, { width: 40 }];
  const aiHead = ai.addRow(['#', L('question', lang), L('section', lang), L('owner', lang), L('due', lang), L('note', lang)]);
  aiHead.eachCell((c) => {
    c.font = { bold: true, color: { argb: BLACK } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
  });
  const sectionTitle = new Map(p.sections.map((x) => [x.key, x.title]));
  pendingItems(bank, s.trackKeys, answers).forEach((item, i) => {
    const q = p.questions.find((x) => x.key === item.questionKey);
    const row = ai.addRow([i + 1, tr(q?.text, lang), sectionTitle.get(q?.sectionKey || '') || '', item.owner, formatDate(item.due, lang), item.note]);
    row.alignment = { wrapText: true, vertical: 'top' };
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

export function exportFileName(clientName: string, ext: 'md' | 'xlsx', lang: ScopingLang): string {
  const slug = clientName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'cliente';
  return `Scoping-${slug}-${lang}.${ext}`;
}
