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
  ZOHO_SETTINGS_KEY, dealIdFromLink, formatZohoRecord, normalizeZohoConfig, type ZohoConfig,
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

/**
 * Linhas da seção [ZOHO CRM] para o link de um negócio. Devolve `null` quando
 * a integração não está configurada (a seção some do prompt) e uma linha de
 * aviso quando a consulta falha (o resto do prompt sai normalmente).
 */
export async function buildZohoSection(link: string | null | undefined, configOverride?: ZohoConfig): Promise<string[] | null> {
  if (!zohoConfigured()) return null;
  const dealId = dealIdFromLink(link);
  if (!dealId) return [`Não foi possível identificar o ID do negócio no link do Zoho (${String(link || '').trim() || 'link vazio'}).`];
  const config = configOverride ? normalizeZohoConfig(configOverride) : await loadZohoConfig();
  try {
    const deal = await getRecord(config.apiVersion, 'Deals', dealId);
    if (!deal) return [`Negócio ${dealId} não encontrado no Zoho CRM (ou sem permissão de leitura).`];
    const lines: string[] = [`${config.deal.label} (Deals):`, ...formatZohoRecord(config.deal.fields, deal)];

    if (config.contact.enabled && config.contact.fields.length) {
      const contactId = lookupId(deal[config.contact.lookupField]);
      const contact = contactId ? await getRecord(config.apiVersion, 'Contacts', contactId) : null;
      lines.push(`${config.contact.label} (Contacts):`);
      if (contact) lines.push(...formatZohoRecord(config.contact.fields, contact));
      else lines.push('- Nenhum contato vinculado ao negócio.');
    }

    const custom = config.custom;
    if (custom.enabled && custom.module && custom.fields.length) {
      const title = `${custom.label || custom.module} (${custom.module}):`;
      let records: Record<string, unknown>[] = [];
      if (custom.linkMode === 'deal_lookup' && custom.linkField) {
        const id = lookupId(deal[custom.linkField]);
        const record = id ? await getRecord(config.apiVersion, custom.module, id) : null;
        if (record) records = [record];
      } else if (custom.linkField) {
        const data = await crmGet(config.apiVersion, `${encodeURIComponent(custom.module)}/search`, {
          criteria: `(${custom.linkField}:equals:${dealId})`,
        });
        records = ((data?.data || []) as Record<string, unknown>[]).slice(0, custom.maxRecords);
      }
      lines.push(title);
      if (!records.length) lines.push('- Nenhum registro vinculado ao negócio.');
      records.forEach((record, i) => {
        if (records.length > 1) lines.push(`Registro ${i + 1}:`);
        lines.push(...formatZohoRecord(custom.fields, record));
      });
    }
    return lines;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return [`Não foi possível consultar o Zoho CRM agora (${msg.slice(0, 160)}).`];
  }
}
