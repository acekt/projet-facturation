/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    // Pas de CDN d'images — app desktop offline
    unoptimized: true,
  },
  // better-sqlite3 est un module natif Node.js — il doit rester côté serveur
  serverExternalPackages: ['better-sqlite3'],
  // Désactiver la télémétrie Next.js (requêtes réseau inutiles en desktop)
  // (via variable d'env — voir aussi: NEXT_TELEMETRY_DISABLED=1 dans .env.local)
  compress: false, // Electron gère la compression nativement
  productionBrowserSourceMaps: false,
  experimental: {
    optimizeCss: false,
  },
  // Désactiver le serveur Node.js standalone pour l'export statique Electron
  // output: 'export', // Décommenter quand on utilise next export pour Electron
}

export default nextConfig
