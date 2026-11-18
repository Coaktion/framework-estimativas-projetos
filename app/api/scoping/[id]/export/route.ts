/**
 * Exportação da sessão de scoping: GET ?format=md|xlsx&lang=pt|en|es (RF-35).
 * Protegida pelo middleware de login e pelo acesso ao Scoping.
 */

import { NextResponse } from 'next/server';
import { getScopingUser, loadSessionView } from '@/lib/scoping/server';
import { exportFileName, exportMarkdown, exportXlsx } from '@/lib/scoping/export';
import { normalizeScopingLang } from '@/lib/scoping/i18n';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!(await getScopingUser())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const view = await loadSessionView(params.id);
  if (!view) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const url = new URL(req.url);
  const lang = normalizeScopingLang(url.searchParams.get('lang') || view.session.language);
  const format = url.searchParams.get('format') === 'xlsx' ? 'xlsx' : 'md';
  const name = exportFileName(view.session.clientName, format, lang);
  const disposition = `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`;

  if (format === 'xlsx') {
    const buf = await exportXlsx(view.bank, view.session, view.answers, lang, view.note.content);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': disposition,
        'Cache-Control': 'no-store',
      },
    });
  }
  const md = exportMarkdown(view.bank, view.session, view.answers, lang, view.note.content);
  return new NextResponse(md, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': disposition, 'Cache-Control': 'no-store' },
  });
}
