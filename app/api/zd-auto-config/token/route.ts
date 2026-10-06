import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canAccessZdAutoConfig, zdAutoConfigUrl } from '@/lib/segments';
import { signZdAutoConfigToken, zdAutoConfigSsoSecret } from '@/lib/zdAutoConfigSso';

// Sempre dinâmico: cada pedido gera um token novo e nada pode ser cacheado.
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Entrega à tela do ZD Auto Config um token para chamar a API do serviço.
 *
 * Confere a sessão do NextAuth (o mesmo login do site) e o segmento, que o
 * callback de sessão relê do banco a cada pedido: quem deixar de ser ADMIN/SC
 * perde o acesso na próxima renovação do token.
 */
export async function GET() {
  const session: any = await getServerSession(authOptions);
  const user = session?.user;

  if (!user?.email) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401, headers: NO_STORE });
  }
  if (!canAccessZdAutoConfig(user)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: NO_STORE });
  }

  const serviceUrl = zdAutoConfigUrl().replace(/\/+$/, '');
  if (!serviceUrl || !zdAutoConfigSsoSecret()) {
    return NextResponse.json({ error: 'not_configured' }, { status: 503, headers: NO_STORE });
  }

  const { token, expiresAt } = signZdAutoConfigToken({
    email: user.email,
    name: user.name,
    role: user.role,
    isAdmin: user.isAdmin,
  });
  return NextResponse.json({ token, expiresAt, serviceUrl }, { headers: NO_STORE });
}
