import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AEViewClient from "./AEViewClient";
import { getServerT } from "@/app/i18n/server";

export const dynamic = 'force-dynamic';

export default async function AEViewPage({ params }: { params: { id: string } }) {
  const t = getServerT();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return (
    <div className="p-12 text-center">
      <p className="text-slate-400 font-bold uppercase tracking-widest">{t('common.sessionExpired')}</p>
    </div>
  );

  const rawId = params.id;
  const id = parseInt(rawId);
  if (Number.isNaN(id) || id <= 0) return (
    <div className="p-12 text-center">
      <p className="text-slate-400 font-bold uppercase tracking-widest">{t('aeView.notFound')}</p>
    </div>
  );

  const userId = parseInt(session.user.id);
  const estimate = await prisma.aEEstimate.findUnique({ where: { id } });
  if (!estimate || estimate.createdBy !== userId) return (
    <div className="p-12 text-center">
      <p className="text-slate-400 font-bold uppercase tracking-widest">{t('aeView.notFoundOrNoPermission')}</p>
    </div>
  );

  const categoriesData = await prisma.category.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  const packages = await prisma.package.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  const variables = await prisma.variable.findMany({ where: { isActive: true } });
  const categories = categoriesData.map(c => c.name);

  let allVersions: { id: number; version: number; createdAt: Date; needsSC: boolean }[] = [];
  try {
    allVersions = await prisma.aEEstimate.findMany({
      where: { clientName: estimate.clientName, createdBy: userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, version: true, createdAt: true, needsSC: true } as any,
    });
  } catch (_) {
    try {
      allVersions = await prisma.aEEstimate.findMany({
        where: { clientName: estimate.clientName, createdBy: userId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, createdAt: true, needsSC: true },
      }).then(rows => (rows as any[]).map((r, i) => ({ ...r, version: (r as any).version ?? (i + 1) })));
    } catch (__) {
      allVersions = [];
    }
  }

  // Garante ordenação: version crescente; na ausência de versão, por createdAt.
  allVersions = [...allVersions].sort((a, b) => {
    const va = typeof a.version === 'number' ? a.version : 0;
    const vb = typeof b.version === 'number' ? b.version : 0;
    if (va !== vb) return va - vb;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  // Se houver linhas sem versão numérica, numera em memória como V1, V2… para UI.
  allVersions = allVersions.map((r, i) =>
    typeof r.version === 'number' && r.version > 0 ? r : { ...r, version: i + 1 },
  );

  let data: any = {};
  try {
    data = JSON.parse(estimate.data);
  } catch (_) {
    data = {};
  }

  return (
    <AEViewClient
      estimateId={estimate.id}
      clientName={estimate.clientName}
      zohoLink={estimate.zohoLink || null}
      resultHours={estimate.resultHours}
      needsSC={estimate.needsSC}
      version={typeof (estimate as any).version === 'number' ? (estimate as any).version : (() => {
        const found = allVersions.find(v => v.id === estimate.id);
        return found ? found.version : 1;
      })()}
      createdAt={estimate.createdAt}
      parentId={(estimate as any).parentId ?? null}
      data={data}
      packages={packages}
      variables={variables}
      categories={categories}
      allVersions={allVersions}
    />
  );
}
