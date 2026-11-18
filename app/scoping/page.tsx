import prisma from '@/lib/prisma';
import { loadBank } from '@/lib/scoping/bank';
import { completeness } from '@/lib/scoping/rules';
import { requireScopingUser, toSessionAnswer, userNames } from '@/lib/scoping/server';
import ScopingListClient, { type SessionRow } from './ScopingListClient';

export default async function ScopingPage() {
  const me = await requireScopingUser();
  const sessions = await prisma.scopingSession.findMany({
    where: { deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    take: 200,
    include: { answers: true },
  });
  const names = await userNames(sessions.map((s) => s.createdBy));
  const rows: SessionRow[] = [];
  for (const s of sessions) {
    const bank = await loadBank(s.bankVersionId);
    const c = completeness(bank, s.trackKeys, s.answers.map((a) => toSessionAnswer(a)));
    rows.push({
      id: s.id,
      clientName: s.clientName,
      title: s.title,
      status: s.status,
      language: s.language,
      trackNames: bank.tracks.filter((t) => s.trackKeys.includes(t.key)).map((t) => t.name),
      essentialDone: c.essentialTotal - c.essentialOpen.length,
      essentialTotal: c.essentialTotal,
      pending: c.counts.pendente,
      createdByName: names.get(s.createdBy) ?? null,
      canDelete: me.isAdmin || s.createdBy === me.id,
      updatedAt: s.updatedAt.toISOString(),
    });
  }
  return <ScopingListClient rows={rows} />;
}
