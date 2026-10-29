/**
 * /register — registro dinâmico de cliente OAuth, que o Tool Center não oferece.
 * Ver lib/mcp-oauth-stub.ts: clientes MCP sem chave chegam aqui e recebem a
 * explicação de como configurar a chave de API.
 */
import { oauthRegistrationRefused } from '@/lib/mcp-oauth-stub';

export const dynamic = 'force-dynamic';

export async function POST() {
  return oauthRegistrationRefused();
}
