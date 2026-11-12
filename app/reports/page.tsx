import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canUseSeTools } from '@/lib/segments';
import ReportsClient from './ReportsClient';

export const dynamic = 'force-dynamic';

/** Bugs e sugestões enviados pela janela do cabeçalho. Só SE e admin. */
export default async function ReportsPage() {
  const session: any = await getServerSession(authOptions);
  if (!canUseSeTools(session?.user)) redirect('/');

  const reports = await prisma.feedbackReport.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: { attachments: { select: { id: true, fileName: true, mimeType: true, size: true } } },
  });
  const userIds = Array.from(new Set(reports.flatMap((r) => [r.userId, r.statusBy]).filter(Boolean))) as number[];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } });
  const nameOf = (id: number | null) => {
    const u = users.find((x) => x.id === id);
    return u ? String(u.name || u.email) : '—';
  };

  return (
    <ReportsClient
      reports={reports.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        feature: r.feature,
        kind: r.kind,
        body: r.body,
        status: r.status,
        statusAt: r.statusAt ? r.statusAt.toISOString() : null,
        statusBy: r.statusBy ? nameOf(r.statusBy) : null,
        pageUrl: r.pageUrl,
        submitter: nameOf(r.userId),
        attachments: r.attachments,
      }))}
    />
  );
}
