/** Abre/baixa o anexo de um relato. Só SE e admin (quem trata os relatos). */
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { canUseSeTools } from '@/lib/segments';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session: any = await getServerSession(authOptions);
  if (!canUseSeTools(session?.user)) return new Response('forbidden', { status: 403 });
  const att = await prisma.feedbackAttachment.findUnique({ where: { id: String(params.id) } });
  if (!att) return new Response('not found', { status: 404 });
  // Imagens abrem na aba; o resto baixa. SVG e HTML nunca rodam como página.
  const inline = /^image\/(png|jpe?g|gif|webp)$/i.test(att.mimeType);
  const safeName = att.fileName.replace(/["\r\n]/g, '_');
  return new Response(new Uint8Array(att.data), {
    headers: {
      'Content-Type': inline || att.mimeType.startsWith('text/') ? att.mimeType : 'application/octet-stream',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${safeName}"`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'",
      'Cache-Control': 'private, max-age=300',
    },
  });
}
