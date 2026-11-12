/**
 * Anexo de um relato (bug/sugestão): POST multipart com `reportId` e `file`.
 * Rota (e não server action) porque server actions limitam o corpo a 1 MB;
 * aqui o limite é o do Netlify (~6 MB), e cada arquivo tem até 4 MB.
 * Só quem enviou o relato anexa, e só nos primeiros minutos.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MAX_COUNT, isAllowedAttachment } from '@/lib/tool-features';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session: any = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const reportId = Number(form?.get('reportId'));
  const file = form?.get('file');
  if (!Number.isInteger(reportId) || !(file instanceof File)) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const report = await prisma.feedbackReport.findUnique({ where: { id: reportId }, include: { _count: { select: { attachments: true } } } });
  const isOwner = report && Number(report.userId) === Number(session.user.id);
  const fresh = report && Date.now() - new Date(report.createdAt).getTime() < 15 * 60 * 1000;
  if (!report || !isOwner || !fresh) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (report._count.attachments >= ATTACHMENT_MAX_COUNT) return NextResponse.json({ error: 'too_many' }, { status: 400 });
  if (file.size > ATTACHMENT_MAX_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 413 });
  if (!isAllowedAttachment(file.type)) return NextResponse.json({ error: 'type' }, { status: 415 });

  const data = Buffer.from(await file.arrayBuffer());
  const saved = await prisma.feedbackAttachment.create({
    data: { reportId, fileName: String(file.name || 'arquivo').slice(0, 200), mimeType: file.type, size: file.size, data },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: saved.id });
}
