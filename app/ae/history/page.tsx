import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import AEHistoryClient from "./AEHistoryClient";

export const dynamic = 'force-dynamic';

export default async function AEHistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return (
    <div className="p-12 text-center">
      <p className="text-slate-400 font-bold uppercase tracking-widest">Sessão expirada. Por favor, faça login novamente.</p>
    </div>
  );

  const userId = parseInt(session.user.id);

  const estimates = await prisma.aEEstimate.findMany({
    where: { createdBy: userId },
    orderBy: { createdAt: 'desc' },
  });

  return <AEHistoryClient estimates={estimates} />;
}
