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
 * Campos sem valor saem agrupados numa linha só ("A, B e C: sem valor."), para
 * o prompt não virar uma lista de vazios.
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
  deal: { label: string; fields: ZohoFieldRef[] };
  contact: { enabled: boolean; label: string; lookupField: string; fields: ZohoFieldRef[] };
  custom: {
    enabled: boolean;
    label: string;
    module: string;
    linkMode: 'deal_lookup' | 'search';
    linkField: string;
    maxRecords: number;
    fields: ZohoFieldRef[];
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

/** Valor de um campo do Zoho como texto, ou '' quando vazio. */
export function formatZohoValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'sim' : 'não';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value).replace('.', ',') : '';
  if (Array.isArray(value)) return value.map(formatZohoValue).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    return formatZohoValue(v.name ?? v.display_value ?? v.full_name ?? v.email ?? '');
  }
  const text = String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const date = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (date) return `${date[3]}/${date[2]}/${date[1]}`;
  const dateTime = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (dateTime) {
    const d = new Date(text);
    if (!Number.isNaN(d.getTime())) return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return text;
}

/** "A", "A e B", "A, B e C". */
export function joinPt(list: string[]): string {
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} e ${list[list.length - 1]}`;
}

/**
 * Linhas de um registro: um campo preenchido por linha e, no fim, os vazios
 * agrupados ("A, B e C: sem valor.").
 */
export function formatZohoRecord(fields: ZohoFieldRef[], record: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const empty: string[] = [];
  fields.forEach((f) => {
    const value = formatZohoValue(record[f.api]);
    if (value) lines.push(`- ${f.label}: ${value}`);
    else empty.push(f.label);
  });
  if (empty.length) lines.push(`- ${joinPt(empty)}: sem valor.`);
  return lines;
}
