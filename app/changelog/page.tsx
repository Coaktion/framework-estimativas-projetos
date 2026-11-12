import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canUseSeTools } from '@/lib/segments';
import { normalizeEntryData } from '@/lib/changelog';
import { CODE_CHANGELOG_DRAFTS } from '@/lib/changelog-drafts';
import ChangelogClient from './ChangelogClient';

export const dynamic = 'force-dynamic';

/**
 * Changelog do Tool Center. Todos leem as publicações; SE e admin também veem
 * os rascunhos (inclusive os que vêm do código, importados aqui) e o registro
 * das alterações feitas no Admin.
 */
export default async function ChangelogPage() {
  const session: any = await getServerSession(authOptions);
  const editor = canUseSeTools(session?.user);

  if (editor) {
    // Rascunhos novos do código entram como rascunho (nunca publicados sozinhos).
    const known = await prisma.changelogEntry.findMany({
      where: { sourceKey: { in: CODE_CHANGELOG_DRAFTS.map((d) => d.key) } },
      select: { sourceKey: true },
    });
    const have = new Set(known.map((k) => k.sourceKey));
    for (const draft of CODE_CHANGELOG_DRAFTS) {
      if (have.has(draft.key)) continue;
      const data = normalizeEntryData(draft);
      await prisma.changelogEntry.create({
        data: { source: 'code', sourceKey: draft.key, status: 'draft', release: data.release, title: data.title as any, summary: data.summary as any, items: data.items as any },
      }).catch(() => null); // outra aba importou ao mesmo tempo: a chave única barra
    }
  }

  const entries = await prisma.changelogEntry.findMany({
    where: editor ? { status: { in: ['published', 'draft'] } } : { status: 'published' },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: 300,
  });
  const changes = editor
    ? await prisma.adminChange.findMany({ orderBy: { createdAt: 'desc' }, take: 1000 })
    : [];
  const userIds = Array.from(new Set([...entries.map((e) => e.publishedBy), ...changes.flatMap((c) => [c.userId, c.publishedBy])].filter(Boolean))) as number[];
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : [];
  const nameOf = (id: number | null) => {
    const u = users.find((x) => x.id === id);
    return u ? String(u.name || u.email) : null;
  };

  return (
    <ChangelogClient
      canEdit={editor}
      entries={entries.map((e) => ({
        id: e.id,
        status: e.status,
        source: e.source,
        createdAt: e.createdAt.toISOString(),
        publishedAt: e.publishedAt ? e.publishedAt.toISOString() : null,
        publishedBy: nameOf(e.publishedBy),
        ...normalizeEntryData(e),
      }))}
      adminChanges={changes.map((c) => ({
        id: c.id,
        createdAt: c.createdAt.toISOString(),
        user: nameOf(c.userId) || '—',
        area: c.area,
        action: c.action,
        summary: c.summary,
        publishedAt: c.publishedAt ? c.publishedAt.toISOString() : null,
        publishedBy: nameOf(c.publishedBy),
      }))}
    />
  );
}
