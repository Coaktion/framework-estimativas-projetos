/**
 * Zoho CRM — quais campos entram no prompt de escopo e como são escritos.
 * Roda no servidor e no navegador (Admin › Zoho CRM edita esta configuração).
 *
 * Três fontes, todas lidas a partir do negócio do link do Zoho:
 *  - o próprio negócio (Deals);
 *  - o contato vinculado a ele por um campo de lookup (Contacts);
 *  - um módulo personalizado, ligado ao negócio por um lookup no negócio
 *    (`deal_lookup`) ou por um lookup no módulo que aponta para o negócio
 *    (`search`).
 *
 * Campos vazios saem agrupados numa linha só ("A, B e C: ---"), para o prompt
 * não virar uma lista de vazios. "---" = o Zoho não tem a informação (e não
 * "o recurso não tem valor"). Textos com várias linhas mantêm as quebras, como
 * bloco recuado embaixo do rótulo.
 *
 * As notas do negócio e do registro do módulo personalizado também podem entrar
 * (só leitura, mais antigas primeiro): são contexto interno para a skill.
 */

export interface ZohoFieldRef {
  /** Nome de API do campo no Zoho (ex.: Deal_Name). */
  api: string;
  /** Rótulo escrito no prompt. */
  label: string;
}

export interface ZohoConfig {
  version: number;
  /** Versão da API do CRM (ex.: v7). */
  apiVersion: string;
  deal: { label: string; fields: ZohoFieldRef[]; includeNotes: boolean };
  contact: { enabled: boolean; label: string; lookupField: string; fields: ZohoFieldRef[] };
  custom: {
    enabled: boolean;
    label: string;
    module: string;
    linkMode: 'deal_lookup' | 'search';
    linkField: string;
    maxRecords: number;
    fields: ZohoFieldRef[];
    includeNotes: boolean;
  };
}

export const ZOHO_SETTINGS_KEY = 'zoho.config';

export function defaultZohoConfig(): ZohoConfig {
  return {
    version: 1,
    apiVersion: 'v7',
    deal: {
      label: 'Negócio',
      fields: [
        { api: 'Deal_Name', label: 'Nome do negócio' },
        { api: 'Account_Name', label: 'Conta' },
        { api: 'Stage', label: 'Etapa' },
        { api: 'Owner', label: 'Responsável' },
        { api: 'Closing_Date', label: 'Data prevista de fechamento' },
        { api: 'Description', label: 'Descrição' },
      ],
      includeNotes: true,
    },
    contact: {
      enabled: true,
      label: 'Contato',
      lookupField: 'Contact_Name',
      fields: [
        { api: 'Full_Name', label: 'Nome' },
        { api: 'Title', label: 'Cargo' },
        { api: 'Email', label: 'E-mail' },
      ],
    },
    custom: {
      enabled: false,
      label: '',
      module: '',
      linkMode: 'search',
      linkField: '',
      maxRecords: 3,
      fields: [],
      includeNotes: true,
    },
  };
}

const API_NAME = /^[A-Za-z][A-Za-z0-9_$]{0,99}$/;

function cleanFields(raw: unknown): ZohoFieldRef[] {
  const out: ZohoFieldRef[] = [];
  (Array.isArray(raw) ? raw : []).slice(0, 60).forEach((f: any) => {
    const api = String(f?.api ?? '').trim();
    if (!API_NAME.test(api) || out.some((x) => x.api === api)) return;
    out.push({ api, label: String(f?.label ?? '').trim().slice(0, 80) || api });
  });
  return out;
}

export function normalizeZohoConfig(raw: any): ZohoConfig {
  const base = defaultZohoConfig();
  if (!raw || typeof raw !== 'object') return base;
  const apiName = (v: unknown, fallback: string) => (API_NAME.test(String(v ?? '').trim()) ? String(v).trim() : fallback);
  const d = raw.deal || {};
  const c = raw.contact || {};
  const m = raw.custom || {};
  return {
    version: 1,
    apiVersion: /^v\d{1,2}(\.\d)?$/.test(String(raw.apiVersion || '')) ? String(raw.apiVersion) : base.apiVersion,
    deal: {
      label: String(d.label || base.deal.label).slice(0, 60),
      fields: Array.isArray(d.fields) ? cleanFields(d.fields) : base.deal.fields,
      includeNotes: d.includeNotes === undefined ? base.deal.includeNotes : Boolean(d.includeNotes),
    },
    contact: {
      enabled: c.enabled === undefined ? base.contact.enabled : Boolean(c.enabled),
      label: String(c.label || base.contact.label).slice(0, 60),
      lookupField: apiName(c.lookupField, base.contact.lookupField),
      fields: Array.isArray(c.fields) ? cleanFields(c.fields) : base.contact.fields,
    },
    custom: {
      enabled: Boolean(m.enabled),
      label: String(m.label || '').slice(0, 60),
      module: apiName(m.module, ''),
      linkMode: m.linkMode === 'deal_lookup' ? 'deal_lookup' : 'search',
      linkField: apiName(m.linkField, ''),
      maxRecords: Math.min(Math.max(parseInt(String(m.maxRecords ?? 3), 10) || 3, 1), 10),
      fields: cleanFields(m.fields),
      includeNotes: m.includeNotes === undefined ? base.custom.includeNotes : Boolean(m.includeNotes),
    },
  };
}

/** ID do negócio no link do Zoho CRM (…/tab/Potentials/<id> ou …/Deals/<id>). */
export function dealIdFromLink(link: unknown): string | null {
  const text = String(link ?? '');
  const direct = text.match(/(?:Potentials|Deals)\/(\d{6,})/i);
  if (direct) return direct[1];
  const longest = text.match(/\d{12,}/g);
  return longest ? longest[longest.length - 1] : null;
}

const pad = (n: number) => String(n).padStart(2, '0');

export type ZohoLocale = 'pt' | 'en' | 'es';

/** Textos fixos da seção [ZOHO CRM], no idioma do bloco. */
export const ZOHO_TEXT: Record<ZohoLocale, {
  yes: string; no: string; and: string; empty: string;
  noContact: string; noRecord: string; record: string; notes: string; noNotes: string;
  noDealId: (link: string) => string; dealNotFound: (id: string) => string; failed: (msg: string) => string;
  emptyLink: string; connection: string;
}> = {
  pt: {
    yes: 'sim', no: 'não', and: 'e', empty: '---',
    noContact: 'Nenhum contato vinculado ao negócio.', noRecord: 'Nenhum registro vinculado ao negócio.',
    record: 'Registro', notes: 'Notas', noNotes: '(nenhuma nota)',
    noDealId: (link) => `Não foi possível identificar o ID do negócio no link do Zoho (${link}).`,
    dealNotFound: (id) => `Negócio ${id} não encontrado no Zoho CRM (ou sem permissão de leitura).`,
    failed: (msg) => `Não foi possível consultar o Zoho CRM agora (${msg}).`,
    emptyLink: 'link vazio', connection: 'erro de conexão',
  },
  en: {
    yes: 'yes', no: 'no', and: 'and', empty: '---',
    noContact: 'No contact linked to the deal.', noRecord: 'No record linked to the deal.',
    record: 'Record', notes: 'Notes', noNotes: '(no notes)',
    noDealId: (link) => `Could not find the deal ID in the Zoho link (${link}).`,
    dealNotFound: (id) => `Deal ${id} not found in Zoho CRM (or no read permission).`,
    failed: (msg) => `Could not reach Zoho CRM right now (${msg}).`,
    emptyLink: 'empty link', connection: 'connection error',
  },
  es: {
    yes: 'sí', no: 'no', and: 'y', empty: '---',
    noContact: 'Ningún contacto vinculado al negocio.', noRecord: 'Ningún registro vinculado al negocio.',
    record: 'Registro', notes: 'Notas', noNotes: '(ninguna nota)',
    noDealId: (link) => `No se pudo identificar el ID del negocio en el enlace de Zoho (${link}).`,
    dealNotFound: (id) => `Negocio ${id} no encontrado en Zoho CRM (o sin permiso de lectura).`,
    failed: (msg) => `No se pudo consultar Zoho CRM en este momento (${msg}).`,
    emptyLink: 'enlace vacío', connection: 'error de conexión',
  },
};

export function zohoLocale(value: unknown): ZohoLocale {
  const v = String(value || '').toLowerCase();
  return v.startsWith('en') ? 'en' : v.startsWith('es') ? 'es' : 'pt';
}

function formatDate(d: Date, locale: ZohoLocale, withTime: boolean): string {
  const day = locale === 'en'
    ? `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`
    : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  return withTime ? `${day} ${pad(d.getHours())}:${pad(d.getMinutes())}` : day;
}

const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/**
 * HTML do Zoho (notas, campos de texto rico) em texto puro, mantendo quebras
 * de linha, itens de lista e o endereço dos links.
 */
export function htmlToText(value: unknown): string {
  let text = String(value ?? '').replace(/\r\n?/g, '\n');
  if (/[<&]/.test(text)) {
    text = text
      .replace(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, inner: string) => {
        const label = String(inner).replace(/<[^>]+>/g, '').trim();
        return label && label !== href ? `${label} (${href})` : href;
      })
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n- ')
      .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, code: string) => {
        if (code[0] === '#') {
          const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
          return Number.isFinite(n) ? String.fromCodePoint(n) : m;
        }
        return ENTITIES[code.toLowerCase()] ?? m;
      });
  }
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Valor de um campo do Zoho como texto (pode ter várias linhas), ou '' quando vazio. */
export function formatZohoValue(value: unknown, locale: ZohoLocale = 'pt'): string {
  const T = ZOHO_TEXT[locale];
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? T.yes : T.no;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    return locale === 'pt' ? String(value).replace('.', ',') : String(value);
  }
  if (Array.isArray(value)) return value.map((v) => formatZohoValue(v, locale)).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    return formatZohoValue(v.name ?? v.display_value ?? v.full_name ?? v.email ?? '', locale);
  }
  const text = htmlToText(value);
  const single = text.replace(/\s+/g, ' ').trim();
  const date = single.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (date) return formatDate(new Date(Number(date[1]), Number(date[2]) - 1, Number(date[3])), locale, false);
  if (/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.test(single)) {
    const d = new Date(single);
    if (!Number.isNaN(d.getTime())) return formatDate(d, locale, true);
  }
  return text;
}

/** "A", "A e B", "A, B e C" (com o "e" do idioma). */
export function joinList(list: string[], locale: ZohoLocale = 'pt'): string {
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} ${ZOHO_TEXT[locale].and} ${list[list.length - 1]}`;
}

/** Texto de várias linhas como bloco recuado (4 espaços) embaixo de um rótulo. */
export function indentBlock(text: string): string[] {
  return text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => `    ${line}`);
}

/**
 * Linhas de um registro: um campo preenchido por linha (texto de várias linhas
 * vira bloco recuado) e, no fim, os vazios agrupados ("A, B e C: ---").
 */
export function formatZohoRecord(fields: ZohoFieldRef[], record: Record<string, unknown>, locale: ZohoLocale = 'pt'): string[] {
  const lines: string[] = [];
  const empty: string[] = [];
  fields.forEach((f) => {
    const value = formatZohoValue(record[f.api], locale);
    const parts = value.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!parts.length) { empty.push(f.label); return; }
    if (parts.length > 1) {
      lines.push(`- ${f.label}:`);
      lines.push(...indentBlock(value));
    } else {
      lines.push(`- ${f.label}: ${parts[0]}`);
    }
  });
  if (empty.length) lines.push(`- ${joinList(empty, locale)}: ${ZOHO_TEXT[locale].empty}`);
  return lines;
}

/** Nota do Zoho já resolvida: data, autor, título e texto puro. */
export interface ZohoNote { createdAt: Date | null; author: string; title: string; text: string }

/** "- dd/mm/aaaa · Autor:" e o texto recuado; mais antigas primeiro. */
export function formatZohoNotes(notes: ZohoNote[], locale: ZohoLocale = 'pt'): string[] {
  const T = ZOHO_TEXT[locale];
  if (!notes.length) return [`- ${T.noNotes}`];
  const sorted = [...notes].sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0));
  const out: string[] = [];
  sorted.forEach((n) => {
    const when = n.createdAt ? formatDate(n.createdAt, locale, false) : T.empty;
    out.push(`- ${when} · ${n.author || T.empty}:`);
    const title = n.title && !n.text.startsWith(n.title) ? n.title : '';
    out.push(...indentBlock([title, n.text].filter(Boolean).join('\n') || T.empty));
  });
  return out;
}
