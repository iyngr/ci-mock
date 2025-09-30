import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    turbopack: {
        resolveExtensions: [
            '.mdx',
            '.tsx',
            '.ts',
            '.jsx',
            '.js',
            '.mjs',
            '.json',
        ],
    },
    transpilePackages: [],
}

export default nextConfig
