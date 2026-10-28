/**
 * next.config.mjs — Configuration Next.js pour Facturier (Desktop Electron)
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

  // Autoriser Electron à se connecter au serveur Next en mode dev
  allowedDevOrigins: ['127.0.0.1', 'localhost'],

  transpilePackages: ["@workspace/ui", "@workspace/database"],
  typescript: {
    ignoreBuildErrors: false,
  },
  /*eslint: {
    ignoreDuringBuilds: true,
  },*/
  images: {
    // Pas de CDN d'images — app desktop offline
    unoptimized: true,
  },
  // Serveur Node.js autonome pour le packaging Electron
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3', '@react-pdf/renderer'],
  compress: false,           // Electron gère la compression nativement
  productionBrowserSourceMaps: false,
  devIndicators: false,
  experimental: {
    optimizeCss: false,
    agentUpgrade: 'security',
  },
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      {
        // Désactive le proxy buffering pour permettre le bon fonctionnement
        // de React Suspense & Streaming via le serveur interne / Electron
        source: '/:path*{/}?',
        headers: [
          {
            key: 'X-Accel-Buffering',
            value: 'no',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co http://127.0.0.1:* http://localhost:*; object-src 'none'; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      // Désactive totalement la minification (contournement du crash mémoire OOM Rust SWC sur Next 15)
      config.optimization.minimize = false;
    }

    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        'exceljs': 'exceljs/dist/exceljs.min.js',
      };
    }

    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/data/**',
          '**/*.sqlite*',
          '**/test-results/**',
          '**/tests/artifacts/**'
        ]
      };
    }

    return config;
  },
}

export default nextConfig
