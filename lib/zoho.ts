/**
 * Zoho CRM — leitura do negócio para o prompt de escopo. SÓ SERVIDOR.
 *
 * SOMENTE LEITURA: toda chamada à API do CRM passa por `crmGet`, que só faz
 * GET. A única requisição que não é GET é a renovação do token de acesso
 * (POST para o servidor de login do Zoho, accounts.zoho.*), que não toca em
 * dados do CRM. Use um refresh token com escopo só de leitura (…READ).
 *
 * Variáveis de ambiente:
 *   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN  (obrigatórias)
 *   ZOHO_ACCOUNTS_URL  (opcional; padrão https://accounts.zoho.com — use o do
 *                       seu data center: .eu, .in, .com.au…)
 *
 * O token de acesso (válido por ~1 hora) fica em memória e, cifrado, na
 * tabela app_settings, para as várias instâncias do servidor não renovarem a
 * cada requisição (o Zoho limita quantas renovações aceita por minuto).
 */
import { createHash } from 'crypto';
import prisma from '@/lib/prisma';
import { fernetDecrypt, fernetEncrypt } from '@/lib/zdcfg/fernet';
import {
  ZOHO_SETTINGS_KEY, ZOHO_TEXT, dealIdFromLink, formatZohoNotes, formatZohoRecord, htmlToText, normalizeZohoConfig, zohoLocale,
  type ZohoConfig, type ZohoLocale, type ZohoNote,
} from './zoho-config';

const TOKEN_KEY = 'zoho.token';

export class ZohoError extends Error {}

export function zohoConfigured(): boolean {
  return Boolean(process.env.ZOHO_CLIENT_ID?.trim() && process.env.ZOHO_CLIENT_SECRET?.trim() && process.env.ZOHO_REFRESH_TOKEN?.trim());
}

function cacheKey(): string {
  const secret = (process.env.NEXTAUTH_SECRET || process.env.ZOHO_CLIENT_SECRET || '').trim();
  return createHash('sha256').update(`tool-center-zoho:${secret}`).digest('base64').replace(/\+/g, '-').replace(/\//g, '_');
}

export async function loadZohoConfig(): Promise<ZohoConfig> {
  const row = await prisma.appSetting.findUnique({ where: { key: ZOHO_SETTINGS_KEY } }).catch(() => null);
  return normalizeZohoConfig(row?.value);
}

export async function saveZohoConfig(config: ZohoConfig, userId: number | null) {
  const clean = normalizeZohoConfig(config);
  await prisma.appSetting.upsert({
    where: { key: ZOHO_SETTINGS_KEY },
    create: { key: ZOHO_SETTINGS_KEY, value: clean as any, updatedBy: userId },
    update: { value: clean as any, updatedBy: userId },
  });
  return clean;
}

type Token = { token: string; apiDomain: string; expiresAt: number };
let memo: Token | null = null;

async function renewToken(): Promise<Token> {
  const accounts = (process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com').trim().replace(/\/+$/, '');
  const res = await fetch(`${accounts}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: process.env.ZOHO_REFRESH_TOKEN!.trim(),
      client_id: process.env.ZOHO_CLIENT_ID!.trim(),
      client_secret: process.env.ZOHO_CLIENT_SECRET!.trim(),
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new ZohoError(`renovação do token recusada pelo Zoho (${data.error || res.status})`);
  }
  const token: Token = {
    token: data.access_token,
    apiDomain: String(data.api_domain || 'https://www.zohoapis.com').replace(/\/+$/, ''),
    expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
  };
  memo = token;
  await prisma.appSetting.upsert({
    where: { key: TOKEN_KEY },
    create: { key: TOKEN_KEY, value: { enc: fernetEncrypt(token.token, cacheKey()), apiDomain: token.apiDomain, expiresAt: token.expiresAt } },
    update: { value: { enc: fernetEncrypt(token.token, cacheKey()), apiDomain: token.apiDomain, expiresAt: token.expiresAt } },
  }).catch(() => {});
  return token;
}

async function accessToken(force = false): Promise<Token> {
  if (!zohoConfigured()) throw new ZohoError('integração com o Zoho não configurada');
  const fresh = (t: Token | null) => t && t.expiresAt - 120000 > Date.now();
  if (!force && fresh(memo)) return memo!;
  if (!force) {
    const row = await prisma.appSetting.findUnique({ where: { key: TOKEN_KEY } }).catch(() => null);
    const v = row?.value as any;
    if (v?.enc && Number(v.expiresAt) - 120000 > Date.now()) {
      try {
        memo = { token: fernetDecrypt(v.enc, cacheKey()), apiDomain: String(v.apiDomain), expiresAt: Number(v.expiresAt) };
        return memo;
      } catch {
        // cache ilegível (chave trocada): renova abaixo
      }
    }
  }
  return renewToken();
}

/** GET na API do CRM. É a única função que conversa com os dados do CRM. */
async function crmGet(apiVersion: string, path: string, params: Record<string, string> = {}): Promise<any | null> {
  const query = new URLSearchParams(params).toString();
  const call = async (force: boolean) => {
    const t = await accessToken(force);
    return fetch(`${t.apiDomain}/crm/${apiVersion}/${path}${query ? `?${query}` : ''}`, {
      method: 'GET',
      headers: { Authorization: `Zoho-oauthtoken ${t.token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
  };
  let res = await call(false);
  if (res.status === 401) res = await call(true);
  if (res.status === 204 || res.status === 404) return null;
  const data: any = await res.json().catch(() => null);
  if (!res.ok) throw new ZohoError(String(data?.message || data?.code || `HTTP ${res.status}`));
  return data;
}

async function getRecord(apiVersion: string, module: string, id: string): Promise<Record<string, unknown> | null> {
  const data = await crmGet(apiVersion, `${encodeURIComponent(module)}/${encodeURIComponent(id)}`);
  return data?.data?.[0] || null;
}

/** Campos de um módulo (para o Admin escolher pelo nome de API). */
export async function listZohoFields(module: string): Promise<{ api: string; label: string; type: string }[]> {
  const config = await loadZohoConfig();
  const data = await crmGet(config.apiVersion, 'settings/fields', { module });
  return ((data?.fields || []) as any[])
    .map((f) => ({ api: String(f.api_name), label: String(f.field_label || f.api_name), type: String(f.data_type || '') }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
}

const lookupId = (value: unknown): string | null => {
  const id = value && typeof value === 'object' ? (value as any).id : null;
  return id ? String(id) : null;
};

/** Nome dos usuários do Zoho citados nas notas (GET /users/{id}), em memória. */
const userNames = new Map<string, string | null>();

async function userName(apiVersion: string, id: string): Promise<string | null> {
  if (userNames.has(id)) return userNames.get(id) ?? null;
  let name: string | null = null;
  try {
    const data = await crmGet(apiVersion, `users/${encodeURIComponent(id)}`);
    const u = data?.users?.[0];
    name = u ? String(u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || '').trim() || null : null;
  } catch {
    name = null; // sem o escopo de usuários: a menção sai do texto
  }
  userNames.set(id, name);
  return name;
}

/**
 * Menções do Zoho (`crm[user#<id>#<org>]crm`) viram o nome do usuário; sem
 * conseguir o nome, a menção é retirada do texto.
 */
async function resolveMentions(apiVersion: string, text: string): Promise<string> {
  const ids = Array.from(new Set(Array.from(text.matchAll(/crm\[user#(\d+)[^\]]*\]crm/g)).map((m) => m[1])));
  const names: Record<string, string | null> = {};
  for (const id of ids.slice(0, 20)) names[id] = await userName(apiVersion, id);
  return text
    .replace(/crm\[user#(\d+)[^\]]*\]crm/g, (_m, id: string) => (names[id] ? `@${names[id]}` : ''))
    .replace(/[ \t]{2,}/g, ' ');
}

/** Notas de um registro (somente leitura), já em texto puro. */
async function getNotes(apiVersion: string, module: string, id: string): Promise<ZohoNote[]> {
  const data = await crmGet(apiVersion, `${encodeURIComponent(module)}/${encodeURIComponent(id)}/Notes`, {
    fields: 'Note_Title,Note_Content,Created_Time,Owner,Created_By',
    per_page: '200',
  });
  const notes: ZohoNote[] = [];
  for (const n of ((data?.data || []) as any[])) {
    const created = n?.Created_Time ? new Date(String(n.Created_Time)) : null;
    const author = String(n?.Created_By?.name || n?.Owner?.name || '').trim();
    notes.push({
      createdAt: created && !Number.isNaN(created.getTime()) ? created : null,
      author,
      title: (await resolveMentions(apiVersion, htmlToText(n?.Note_Title || ''))).trim(),
      text: (await resolveMentions(apiVersion, htmlToText(n?.Note_Content || ''))).trim(),
    });
  }
  return notes;
}

/**
 * Linhas da seção [ZOHO CRM] para o link de um negócio, no idioma do bloco.
 * Devolve `null` quando a integração não está configurada (a seção some do
 * prompt) e uma linha de aviso quando a consulta falha (o resto do prompt sai
 * normalmente).
 */
export async function buildZohoSection(
  link: string | null | undefined,
  configOverride?: ZohoConfig,
  localeInput?: string | null,
): Promise<string[] | null> {
  if (!zohoConfigured()) return null;
  const locale: ZohoLocale = zohoLocale(localeInput);
  const T = ZOHO_TEXT[locale];
  const dealId = dealIdFromLink(link);
  if (!dealId) return [T.noDealId(String(link || '').trim() || T.emptyLink)];
  const config = configOverride ? normalizeZohoConfig(configOverride) : await loadZohoConfig();
  const api = config.apiVersion;
  // Comentário que acompanha as notas: contexto interno, nunca entra no documento.
  const notesNote: Record<ZohoLocale, string> = {
    pt: '# Notas internas do Zoho: só para entender melhor o negócio. Nunca são entregas, nunca justificam nada sozinhas e NUNCA aparecem no documento (nem citadas nem parafraseadas). Jamais mencione preços, margens, descontos ou concorrentes.',
    en: '# Internal Zoho notes: only to understand the deal better. They are never deliverables, never justify anything on their own and NEVER appear in the document (neither quoted nor paraphrased). Never mention prices, margins, discounts or competitors.',
    es: '# Notas internas de Zoho: solo para entender mejor el negocio. Nunca son entregables, nunca justifican nada por sí solas y NUNCA aparecen en el documento (ni citadas ni parafraseadas). Nunca menciones precios, márgenes, descuentos ni competidores.',
  };
  try {
    const deal = await getRecord(api, 'Deals', dealId);
    if (!deal) return [T.dealNotFound(dealId)];
    const lines: string[] = [`${config.deal.label} (Deals):`, ...formatZohoRecord(config.deal.fields, deal, locale)];
    const noteBlocks: string[] = [];

    if (config.contact.enabled && config.contact.fields.length) {
      const contactId = lookupId(deal[config.contact.lookupField]);
      const contact = contactId ? await getRecord(api, 'Contacts', contactId) : null;
      lines.push(`${config.contact.label} (Contacts):`);
      if (contact) lines.push(...formatZohoRecord(config.contact.fields, contact, locale));
      else lines.push(`- ${T.noContact}`);
    }

    const custom = config.custom;
    if (custom.enabled && custom.module && custom.fields.length) {
      const title = `${custom.label || custom.module} (${custom.module}):`;
      let records: Record<string, unknown>[] = [];
      if (custom.linkMode === 'deal_lookup' && custom.linkField) {
        const id = lookupId(deal[custom.linkField]);
        const record = id ? await getRecord(api, custom.module, id) : null;
        if (record) records = [record];
      } else if (custom.linkField) {
        const data = await crmGet(api, `${encodeURIComponent(custom.module)}/search`, {
          criteria: `(${custom.linkField}:equals:${dealId})`,
        });
        records = ((data?.data || []) as Record<string, unknown>[]).slice(0, custom.maxRecords);
      }
      lines.push(title);
      if (!records.length) lines.push(`- ${T.noRecord}`);
      records.forEach((record, i) => {
        if (records.length > 1) lines.push(`${T.record} ${i + 1}:`);
        lines.push(...formatZohoRecord(custom.fields, record, locale));
      });
      if (custom.includeNotes) {
        for (let i = 0; i < records.length; i++) {
          const record = records[i];
          const id = record?.id ? String(record.id) : null;
          if (!id) continue;
          const notes = await getNotes(api, custom.module, id).catch(() => null);
          if (!notes) continue;
          const suffix = records.length > 1 ? ` · ${T.record} ${i + 1}` : '';
          noteBlocks.push(`${T.notes} (${custom.module}${suffix}):`, ...formatZohoNotes(notes, locale));
        }
      }
    }

    if (config.deal.includeNotes) {
      const notes = await getNotes(api, 'Deals', dealId).catch(() => null);
      if (notes) noteBlocks.push(`${T.notes} (Deals):`, ...formatZohoNotes(notes, locale));
    }

    if (noteBlocks.length) lines.push(notesNote[locale], ...noteBlocks);
    return lines;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return [T.failed(msg.slice(0, 160))];
  }
}
