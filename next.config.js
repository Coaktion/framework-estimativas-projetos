/** @type {import('next').NextConfig} */
const nextConfig = {
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
    async rewrites() {
        return [
            // Clientes MCP sem chave procuram metadados OAuth aqui; respondemos
            // JSON explicando a chave de API (ver lib/mcp-oauth-stub.ts).
            { source: '/.well-known/:path*', destination: '/api/oauth-stub/:path*' },
        ];
    },
}

module.exports = nextConfig
