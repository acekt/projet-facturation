/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['better-sqlite3'],
  swcMinify: true,
  compress: true,
  productionBrowserSourceMaps: false,
  optimizePackageImports: ['lucide-react', 'framer-motion'],
  experimental: {
    optimizeCss: true,
  },
}

export default nextConfig
