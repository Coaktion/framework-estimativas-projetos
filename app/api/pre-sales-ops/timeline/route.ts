/** GET /api/pre-sales-ops/timeline — o Pre-Sales Ops: histórico com link para a fonte. */
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/psops/lib/db';
import { exigirUsuario } from '@/lib/psops/lib/auth';
import { handler, lerQuery, ok } from '@/lib/psops/lib/http';
import { queryTimeline } from '@/lib/psops/schemas';
import { timeline } from '@/lib/psops/services/signals';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handler(async () => {
    await exigirUsuario();
    const q = lerQuery(req, queryTimeline);
    return ok(await timeline(prisma, q));
  });
}
