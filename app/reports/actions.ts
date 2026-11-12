'use server';

/**
 * Relatos de bugs e sugestões: qualquer usuário logado envia; SE e admin
 * acompanham em /reports e mudam o status.
 */
import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canUseSeTools } from '@/lib/segments';
import { FEATURE_KEYS, FEEDBACK_KINDS, FEEDBACK_STATUSES } from '@/lib/tool-features';

export async function createFeedbackAction(input: { feature: string; kind: string; body: string; pageUrl?: string | null }) {
  const session: any = await getServerSession(authOptions);
  if (!session?.user?.id) return { ok: false as const, error: 'unauthorized' };
  const feature = String(input.feature || '');
  const kind = String(input.kind || '');
  const body = String(input.body || '').trim().slice(0, 20000);
  if (!FEATURE_KEYS.includes(feature) || !(FEEDBACK_KINDS as readonly string[]).includes(kind) || !body) {
    return { ok: false as const, error: 'invalid' };
  }
  const report = await prisma.feedbackReport.create({
    data: {
      userId: Number(session.user.id) || null,
      feature,
      kind,
      body,
      pageUrl: String(input.pageUrl || '').slice(0, 500) || null,
    },
  });
  revalidatePath('/reports');
  return { ok: true as const, id: report.id };
}

export async function updateFeedbackStatusAction(id: number, status: string) {
  const session: any = await getServerSession(authOptions);
  if (!canUseSeTools(session?.user)) return { ok: false as const, error: 'forbidden' };
  if (!(FEEDBACK_STATUSES as readonly string[]).includes(status)) return { ok: false as const, error: 'invalid' };
  await prisma.feedbackReport.update({
    where: { id: Number(id) },
    data: { status, statusBy: Number(session.user.id) || null, statusAt: new Date() },
  });
  revalidatePath('/reports');
  return { ok: true as const };
}
