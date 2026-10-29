/**
 * Destino do rewrite de /.well-known/* (next.config.js) — o Tool Center não
 * publica metadados OAuth. O Next não roteia pastas iniciadas por ponto dentro
 * de app/, por isso o rewrite. Ver lib/mcp-oauth-stub.ts.
 */
import { oauthMetadataNotFound } from '@/lib/mcp-oauth-stub';

export const dynamic = 'force-dynamic';

export async function GET() {
  return oauthMetadataNotFound();
}
