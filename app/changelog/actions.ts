'use server';

/**
 * Changelog: escrever, publicar e descartar publicações (SE e admin), e marcar
 * as alterações do Admin como comunicadas. Ler as publicadas é de todos.
 */
import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canUseSeTools } from '@/lib/segments';
import { normalizeEntryData, type ChangelogEntryData } from '@/lib/changelog';

async function requireEditor() {
  const session: any = await getServerSession(authOptions);
  if (!canUseSeTools(session?.user)) throw new Error('forbidden');
  return Number(session.user.id) || null;
}

export async function saveChangelogEntryAction(id: number | null, raw: ChangelogEntryData, publish: boolean) {
  try {
    const userId = await requireEditor();
    const data = normalizeEntryData(raw);
    if (!data.title.pt.trim() && !data.title.en.trim() && !data.title.es.trim()) return { ok: false as const, error: 'title_required' };
    const fields = {
      release: data.release,
      title: data.title as any,
      summary: data.summary as any,
      items: data.items as any,
      ...(publish ? { status: 'published', publishedAt: new Date(), publishedBy: userId } : {}),
    };
    const saved = id
      ? await prisma.changelogEntry.update({ where: { id: Number(id) }, data: fields })
      : await prisma.changelogEntry.create({ data: { ...fields, createdBy: userId, source: 'manual', status: publish ? 'published' : 'draft' } });
    revalidatePath('/changelog');
    return { ok: true as const, id: saved.id };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/** draft = volta a ser rascunho; discarded = some (rascunho do código não é reimportado). */
export async function setChangelogStatusAction(id: number, status: 'draft' | 'discarded' | 'published') {
  try {
    const userId = await requireEditor();
    await prisma.changelogEntry.update({
      where: { id: Number(id) },
      data: status === 'published'
        ? { status, publishedAt: new Date(), publishedBy: userId }
        : { status, publishedAt: null, publishedBy: null },
    });
    revalidatePath('/changelog');
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Marca (ou desmarca) alterações do Admin como já comunicadas. */
export async function setAdminChangesPublishedAction(ids: string[], published: boolean) {
  try {
    const userId = await requireEditor();
    await prisma.adminChange.updateMany({
      where: { id: { in: (ids || []).map(String).slice(0, 1000) } },
      data: published ? { publishedAt: new Date(), publishedBy: userId } : { publishedAt: null, publishedBy: null },
    });
    revalidatePath('/changelog');
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}
