'use server';

/**
 * Admin › Estimativas excluídas: o que os usuários excluíram "só na tela"
 * (projetos, versões e estimativas da Calculadora AE). Só admin vê e restaura.
 */
import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { recordAdminChange } from '@/lib/admin-audit';

async function requireAdmin() {
  const session: any = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) throw new Error('forbidden');
  return Number(session.user.id) || null;
}

export interface DeletedRow {
  id: number;
  kind: 'project' | 'version' | 'ae';
  title: string;
  subtitle: string;
  hours: number | null;
  deletedAt: string;
  deletedBy: string;
  href: string;
}

export async function listDeletedEstimatesAction(): Promise<{ ok: true; rows: DeletedRow[] } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    const [projects, versions, estimates] = await Promise.all([
      prisma.project.findMany({
        where: { deletedAt: { not: null } },
        include: { owner: { select: { name: true, email: true } }, _count: { select: { versions: true } } },
        orderBy: { deletedAt: 'desc' },
      }),
      prisma.projectVersion.findMany({
        // Versões excluídas de projetos que continuam ativos (as de um projeto
        // excluído voltam junto com ele).
        where: { deletedAt: { not: null }, project: { deletedAt: null } },
        include: { project: { select: { id: true, name: true } } },
        orderBy: { deletedAt: 'desc' },
      }),
      prisma.aEEstimate.findMany({
        where: { deletedAt: { not: null } },
        include: { creator: { select: { name: true, email: true } } },
        orderBy: { deletedAt: 'desc' },
      }),
    ]);
    const userIds = Array.from(new Set([...projects, ...versions, ...estimates].map((r: any) => r.deletedBy).filter(Boolean)));
    const users = await prisma.user.findMany({ where: { id: { in: userIds as number[] } }, select: { id: true, name: true, email: true } });
    const nameOf = (id: number | null) => {
      const u = users.find((x) => x.id === id);
      return u ? String(u.name || u.email) : '—';
    };
    const rows: DeletedRow[] = [
      ...projects.map((p: any) => ({
        id: p.id,
        kind: 'project' as const,
        title: p.name,
        subtitle: `${p.owner?.name || p.owner?.email || '—'} · ${p._count.versions}`,
        hours: null,
        deletedAt: new Date(p.deletedAt).toISOString(),
        deletedBy: nameOf(p.deletedBy),
        href: `/sc/project/${p.id}`,
      })),
      ...versions.map((v: any) => ({
        id: v.id,
        kind: 'version' as const,
        title: `${v.project?.name || '—'} · ${v.versionName}`,
        subtitle: String(v.description || ''),
        hours: Number(v.totalHours) || 0,
        deletedAt: new Date(v.deletedAt).toISOString(),
        deletedBy: nameOf(v.deletedBy),
        href: `/sc/project/${v.projectId}?version_id=${v.id}`,
      })),
      ...estimates.map((e: any) => ({
        id: e.id,
        kind: 'ae' as const,
        title: `${e.clientName} · v${e.version ?? 1}`,
        subtitle: String(e.creator?.name || e.creator?.email || '—'),
        hours: Number(e.resultHours) || 0,
        deletedAt: new Date(e.deletedAt).toISOString(),
        deletedBy: nameOf(e.deletedBy),
        href: `/ae/${e.id}`,
      })),
    ].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
    return { ok: true, rows };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function restoreDeletedAction(kind: DeletedRow['kind'], id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const adminId = await requireAdmin();
    const data = { deletedAt: null, deletedBy: null };
    let label = '';
    if (kind === 'project') {
      const p = await prisma.project.update({ where: { id: Number(id) }, data });
      label = p.name;
      revalidatePath('/sc');
    } else if (kind === 'version') {
      const v = await prisma.projectVersion.update({ where: { id: Number(id) }, data, include: { project: { select: { name: true } } } });
      label = `${v.project?.name} · ${v.versionName}`;
      revalidatePath(`/sc/project/${v.projectId}`);
      revalidatePath('/sc');
    } else {
      const e = await prisma.aEEstimate.update({ where: { id: Number(id) }, data });
      label = `${e.clientName} · v${e.version ?? 1}`;
      revalidatePath('/ae/history');
    }
    await recordAdminChange({ userId: adminId, area: 'deletedEstimates', action: 'restore', summary: `${kind}: ${label}`, details: { kind, id } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
