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
}

module.exports = nextConfig
