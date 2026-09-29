import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AEHistoryClient from "./AEHistoryClient";
import { getServerT } from "@/app/i18n/server";

export const dynamic = 'force-dynamic';

type HistoryScope = 'mine' | 'all';

export default async function AEHistoryPage({
  searchParams,
}: {
  searchParams?: { scope?: string; q?: string };
}) {
  const t = getServerT();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return (
    <div className="p-12 text-center">
      <p className="text-slate-400 font-bold uppercase tracking-widest">{t('common.sessionExpired')}</p>
    </div>
  );

  const userSession = session.user as any;
  const isAdmin = Boolean(userSession.isAdmin) || (userSession.role && String(userSession.role).toUpperCase() === 'ADMIN');
  const userId = parseInt(session.user.id);

  const rawScope = String(searchParams?.scope || '').toLowerCase();
  let scope: HistoryScope = isAdmin ? 'all' : 'mine';
  if (isAdmin && (rawScope === 'mine' || rawScope === 'all')) {
    scope = rawScope;
  }

  const createdByFilter =
    !isAdmin || scope === 'mine'
      ? { createdBy: userId }
      : {};

  const estimates = await prisma.aEEstimate.findMany({
    where: createdByFilter,
    orderBy: { createdAt: 'desc' },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        }
      }
    }
  });

  // Agrupa por cliente (projeto). Cada cliente aparece apenas UMA vez no histórico,
  // com todas as suas versões sintetizadas dentro do mesmo card.
  // A ordenação dos grupos é por data da última versão (mais recente primeiro).
  const grouped = new Map<string, any[]>();
  for (const est of estimates) {
    const key = String((est as any).clientName || t('aeView.unnamedClient')).trim();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(est);
  }

  const groups = Array.from(grouped.entries()).map(([clientName, rows]) => {
    // Determina a versão numérica de cada registro (fallback caso a coluna
    // version ainda não exista no banco ou no Prisma cliente gerado).
    const withVersion = rows.map((r, idx) => {
      const rawVersion = (r as any).version;
      const version = typeof rawVersion === 'number' && rawVersion > 0 ? rawVersion : idx + 1;

      const ownerRaw = (r as any).creator || null;
      const owner = ownerRaw
        ? {
            id: Number(ownerRaw.id),
            name: String(ownerRaw.name || ownerRaw.email || ''),
            email: String(ownerRaw.email || ''),
            role: String(ownerRaw.role || ''),
          }
        : null;
      return { ...r, version, owner };
    });

    withVersion.sort((a, b) => {
      if (a.version !== b.version) return a.version - b.version;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    // Se alguma linha ainda ficou sem versão numérica (improvável),
    // re-numera sequencialmente com base na ordem.
    withVersion.forEach((r, i) => {
      if (!(typeof r.version === 'number' && r.version > 0)) {
        r.version = i + 1;
      }
    });

    const latest = withVersion[withVersion.length - 1];
    return {
      clientName,
      latestId: latest.id,
      latestVersion: latest.version,
      latestCreatedAt: latest.createdAt,
      latestNeedsSC: Boolean(latest.needsSC),
      owner: (latest as any).owner || null,
      // Horas da ÚLTIMA versão, para o card mostrar o número corrente sem que o
      // usuário precise abrir a estimativa.
      latestHours: Number((latest as any).resultHours) || 0,
      count: withVersion.length,
      versions: withVersion.map((r: any) => ({
        id: r.id,
        version: r.version,
        createdAt: r.createdAt,
        needsSC: Boolean(r.needsSC),
        // Total gravado no momento em que a versão foi calculada. Vem do banco,
        // e não de um recálculo: o histórico deve mostrar o que foi acordado
        // naquela versão, ainda que a tabela de preços tenha mudado depois.
        hours: Number(r.resultHours) || 0,
      })),
    };
  });

  // Mais recentes primeiro
  groups.sort((a, b) => new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime());

  return (
    <AEHistoryClient
      groups={groups}
      isAdmin={isAdmin}
      currentUserId={userId}
      scope={scope}
    />
  );
}
