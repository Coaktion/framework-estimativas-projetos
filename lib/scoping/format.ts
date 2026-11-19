/**
 * Textos fixos do conteúdo do scoping (status, prioridade, Sim/Não) e
 * formatação de respostas. Ficam aqui, e não no common.json, porque a
 * exportação sai no idioma escolhido na hora, que pode não ser o da tela.
 */

import { tr } from './i18n';
import type { AnswerStatus, BankQuestion, Priority, ScopingLang, TableRow } from './types';

type L<T extends string> = Record<T, Record<ScopingLang, string>>;

export const STATUS_LABEL: L<AnswerStatus> = {
  nao_perguntada: { pt: 'Não perguntada', en: 'Not asked', es: 'No preguntada' },
  respondida: { pt: 'Respondida', en: 'Answered', es: 'Respondida' },
  pendente: { pt: 'Pendente', en: 'Pending', es: 'Pendiente' },
  nao_se_aplica: { pt: 'Não se aplica', en: 'Not applicable', es: 'No aplica' },
};

export const PRIORITY_LABEL: L<Priority> = {
  essencial: { pt: 'Obrigatória', en: 'Required', es: 'Obligatoria' },
  recomendada: { pt: 'Recomendada', en: 'Recommended', es: 'Recomendada' },
  opcional: { pt: 'Aprofundamento', en: 'Deep-dive', es: 'Profundización' },
};

export const YES_NO_LABEL: L<'sim' | 'nao' | 'nao_sei'> = {
  sim: { pt: 'Sim', en: 'Yes', es: 'Sí' },
  nao: { pt: 'Não', en: 'No', es: 'No' },
  nao_sei: { pt: 'Não sei', en: "Don't know", es: 'No sé' },
};

export const COMPLEXITY_LABEL: L<'baixa' | 'media' | 'alta'> = {
  baixa: { pt: 'Baixa', en: 'Low', es: 'Baja' },
  media: { pt: 'Média', en: 'Medium', es: 'Media' },
  alta: { pt: 'Alta', en: 'High', es: 'Alta' },
};

const NUMBER_LOCALE: Record<ScopingLang, string> = { pt: 'pt-BR', en: 'en-US', es: 'es-419' };

export function formatNumber(n: number, lang: ScopingLang): string {
  return n.toLocaleString(NUMBER_LOCALE[lang], { maximumFractionDigits: 2 });
}

function optionLabel(q: BankQuestion, value: string, lang: ScopingLang): string {
  const o = q.options.find((x) => x.value === value);
  return o ? tr(o.label, lang) : value;
}

/** Uma linha de tabela em texto ("col: valor · col: valor"). */
export function formatRow(q: BankQuestion, row: TableRow, lang: ScopingLang): string {
  return q.tableColumns
    .map((c) => {
      const raw = row[c.key];
      if (raw === null || raw === undefined || String(raw).trim() === '') return null;
      let v = String(raw);
      if (c.type === 'single') v = tr(c.options?.find((o) => o.value === raw)?.label, lang) || v;
      if (c.type === 'yes_no') v = YES_NO_LABEL[raw as 'sim']?.[lang] || v;
      if (c.type === 'number' && typeof raw === 'number') v = formatNumber(raw, lang);
      return `${tr(c.label, lang)}: ${v}`;
    })
    .filter(Boolean)
    .join(' · ');
}

/** Resposta em texto curto (cards fechados, Markdown e .xlsx). Tabelas: uma linha por registro. */
export function formatValue(q: BankQuestion, v: unknown, lang: ScopingLang): string {
  if (v === null || v === undefined || v === '') return '';
  switch (q.type) {
    case 'number': {
      const unit = tr(q.unit, lang);
      if (typeof v === 'number') return `${formatNumber(v, lang)}${unit ? ` ${unit}` : ''}`;
      if (typeof v === 'object' && v && 'max' in (v as any)) {
        const r = v as { min: number; max: number };
        return `${formatNumber(r.min, lang)}–${formatNumber(r.max, lang)}${unit ? ` ${unit}` : ''}`;
      }
      return String(v);
    }
    case 'yes_no':
      return YES_NO_LABEL[v as 'sim']?.[lang] || String(v);
    case 'single':
      return optionLabel(q, String(v), lang);
    case 'multi':
      return Array.isArray(v) ? v.map((x) => optionLabel(q, String(x), lang)).join(', ') : String(v);
    case 'date': {
      const [y, m, d] = String(v).split('-');
      return lang === 'en' ? `${m}/${d}/${y}` : `${d}/${m}/${y}`;
    }
    case 'table':
    case 'ai_usecases':
      return Array.isArray(v) ? (v as TableRow[]).map((r) => formatRow(q, r, lang)).filter(Boolean).join('\n') : '';
    default:
      return String(v);
  }
}

export function formatDate(iso: string | null | undefined, lang: ScopingLang): string {
  if (!iso) return '';
  return formatValue({ type: 'date' } as BankQuestion, iso.slice(0, 10), lang);
}
