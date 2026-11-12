'use server';

import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { buildZohoSection, listZohoFields, saveZohoConfig, zohoConfigured, ZohoError } from '@/lib/zoho';
import type { ZohoConfig } from '@/lib/zoho-config';
import { recordAdminChange } from '@/lib/admin-audit';

async function requireAdmin() {
  const session: any = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) throw new Error('forbidden');
  return Number(session.user.id) || null;
}

export async function saveZohoConfigAction(config: ZohoConfig): Promise<{ ok: true; config: ZohoConfig } | { ok: false; error: string }> {
  try {
    const userId = await requireAdmin();
    const saved = await saveZohoConfig(config, userId);
    await recordAdminChange({
      userId, area: 'zoho', action: 'save',
      summary: `Zoho CRM: campos do prompt alterados (negócio ${saved.deal.fields.length}, contato ${saved.contact.enabled ? saved.contact.fields.length : 0}, módulo personalizado ${saved.custom.enabled ? saved.custom.fields.length : 0})`,
    });
    revalidatePath('/admin');
    return { ok: true, config: saved };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Campos de um módulo do Zoho (Deals, Contacts ou o personalizado), para escolher pelo nome. */
export async function zohoFieldsAction(module: string): Promise<{ ok: true; fields: { api: string; label: string; type: string }[] } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    if (!zohoConfigured()) return { ok: false, error: 'not_configured' };
    if (!/^[A-Za-z][A-Za-z0-9_]{0,99}$/.test(module)) return { ok: false, error: 'module' };
    return { ok: true, fields: await listZohoFields(module) };
  } catch (e) {
    return { ok: false, error: e instanceof ZohoError || e instanceof Error ? e.message : String(e) };
  }
}

/** Prévia da seção [ZOHO CRM] para um link de negócio, com a configuração da tela (salva ou não). */
export async function zohoTestAction(link: string, config: ZohoConfig, locale?: string | null): Promise<{ ok: true; lines: string[] } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    if (!zohoConfigured()) return { ok: false, error: 'not_configured' };
    return { ok: true, lines: (await buildZohoSection(link, config, locale)) || [] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
