'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canAccessAE, canAccessScopes } from '@/lib/segments';
import { buildZohoSection } from '@/lib/zoho';

/** Seção [ZOHO CRM] do prompt de escopo (null = integração desligada). */
export async function zohoPromptSectionAction(link: string | null | undefined): Promise<string[] | null> {
  const session: any = await getServerSession(authOptions);
  const user = session?.user;
  if (!user || !(canAccessScopes(user) || canAccessAE(user))) return null;
  return buildZohoSection(link);
}
