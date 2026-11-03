/**
 * Define o NEXTAUTH_URL certo para o deploy atual. Chamado no servidor
 * (lib/auth.ts) E no middleware (edge): os dois leem process.env.NEXTAUTH_URL,
 * e o middleware do next-auth quebra com "Invalid URL: ''" se ela estiver vazia.
 *
 * No Netlify o NEXTAUTH_URL é uma variável só (o valor de "Branch deploys" vale
 * para TODAS as branches), mas cada deploy tem a sua URL. Ordem de decisão:
 *  1. BUILD_DEPLOY_URL — gravada no build (next.config.js) só fora de
 *     produção: design--site, development--site, previews.
 *  2. DEPLOY_PRIME_URL diferente de URL em tempo de execução (reserva).
 *  3. Produção: mantém o NEXTAUTH_URL configurado (ex.: domínio próprio) ou,
 *     se estiver vazio, usa URL.
 *  4. Nada disso: NEXTAUTH_URL vazio é removido e o next-auth passa a usar o
 *     host da requisição (AUTH_TRUST_HOST), em vez de quebrar.
 *
 * Sem imports: precisa rodar no edge.
 */
export function resolveNextAuthUrl(): void {
  const clean = (v: string | undefined) => (v || '').trim().replace(/\/$/, '');
  const buildDeployUrl = clean(process.env.BUILD_DEPLOY_URL);
  const deployUrl = clean(process.env.DEPLOY_PRIME_URL);
  const siteUrl = clean(process.env.URL);
  const configured = clean(process.env.NEXTAUTH_URL);

  if (buildDeployUrl) {
    process.env.NEXTAUTH_URL = buildDeployUrl;
  } else if (deployUrl && siteUrl && deployUrl !== siteUrl) {
    process.env.NEXTAUTH_URL = deployUrl;
  } else if (configured) {
    process.env.NEXTAUTH_URL = configured;
  } else if (siteUrl) {
    process.env.NEXTAUTH_URL = siteUrl;
  } else {
    delete process.env.NEXTAUTH_URL;
    process.env.AUTH_TRUST_HOST = 'true';
  }
}
