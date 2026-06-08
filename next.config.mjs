/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['better-sqlite3'],
  compress: true,
  productionBrowserSourceMaps: false,
  experimental: {
    optimizeCss: false,
  },
}

export default nextConfig
