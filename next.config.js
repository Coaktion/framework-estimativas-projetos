/**
 * URL do deploy no Netlify, fixada no BUILD (onde CONTEXT e DEPLOY_PRIME_URL
 * sempre existem; em tempo de execução o servidor do Next nem sempre as
 * recebe). Só vale fora de produção: branch deploys (design--site,
 * development--site) e previews. Lida em lib/auth.ts para o NEXTAUTH_URL.
 */
const netlifyContext = process.env.CONTEXT || '';
const BUILD_DEPLOY_URL =
    process.env.NETLIFY === 'true' && netlifyContext && netlifyContext !== 'production'
        ? String(process.env.DEPLOY_PRIME_URL || '').replace(/\/$/, '')
        : '';

/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        BUILD_DEPLOY_URL,
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    experimental: {
        // Pre-Sales Ops: o parser das release notes do Zendesk usa cheerio no servidor.
        serverComponentsExternalPackages: ['cheerio'],
    },
    // Cabeçalhos de segurança em todas as respostas. Não há CSP completa (os
    // scripts inline do Next exigiriam nonce); `frame-ancestors` já impede
    // que o site seja embutido em iframe de terceiros (clickjacking).
    async headers() {
        return [
            {
                source: '/:path*',
                headers: [
                    { key: 'X-Frame-Options', value: 'DENY' },
                    { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
                ],
            },
        ];
    },
    async rewrites() {
        return [
            // Clientes MCP sem chave procuram metadados OAuth aqui; respondemos
            // JSON explicando a chave de API (ver lib/mcp-oauth-stub.ts).
            { source: '/.well-known/:path*', destination: '/api/oauth-stub/:path*' },
        ];
    },
}

module.exports = nextConfig
