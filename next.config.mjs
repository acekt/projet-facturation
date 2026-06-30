/**
 * next.config.mjs — Configuration Next.js pour L'Étoile (Desktop Electron)
 * =========================================================================
 *
 * ARCHITECTURE DE BUILD PRODUCTION :
 *
 * ❌ output: 'export' (statique) — INCOMPATIBLE avec nos API routes (/api/*)
 *    qui utilisent better-sqlite3. Un export statique supprime entièrement
 *    les Route Handlers Next.js, cassant toute la logique métier SQLite.
 *
 * ✅ output: 'standalone' — Génère un serveur Node.js autonome dans `.next/standalone`.
 *    Ce serveur embarqué reçoit les variables d'environnement explicitement
 *    passées par le processus Electron parent (voir main.js → spawnNextServer).
 *    Compatible electron-builder et packagé dans l'asar.
 *
 * FLUX DE BUILD PRODUCTION :
 *   npm run build:electron  →  next build  →  .next/standalone/server.js
 *   Electron main.js lance ce serveur en tant que processus enfant avec
 *   ELECTRON_USERDATA_PATH passé explicitement dans l'environnement.
 *
 * @type {import('next').NextConfig}
 */
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
  // Serveur Node.js autonome pour le packaging Electron
  output: 'standalone',
  // better-sqlite3 est un module natif Node.js — il doit rester côté serveur
  serverExternalPackages: ['better-sqlite3'],
  compress: false,           // Electron gère la compression nativement
  productionBrowserSourceMaps: false,
  experimental: {
    optimizeCss: false,
  },
}

export default nextConfig
