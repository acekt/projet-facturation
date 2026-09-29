/**
 * Root Layout — Facturier (Desktop Electron)
 *
 * Corrections AXE 2 :
 *  ✅ Suppression de @vercel/analytics (tentait des requêtes réseau vers vitals.vercel-insights.com)
 *  ✅ Suppression de next/font/google (télécharge Geist depuis fonts.googleapis.com — bloqué offline)
 *  ✅ Remplacement par des variables CSS système (system-ui fallback robuste hors-ligne)
 *  ✅ Métadonnées SEO réduites au strict minimum (sans description publique)
 *  ✅ user-select: none appliqué globalement via CSS (voir globals.css)
 */
import type { Metadata } from 'next'
import { Providers } from '@/components/providers'
import { AppErrorBoundary } from '@/components/error-boundary'
import './globals.css'

export const metadata: Metadata = {
  title: "Facturier — Gestion & Facturation",
  // Pas de description SEO pour cette app desktop offline
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" suppressHydrationWarning className="bg-background">
      <body className="font-sans antialiased bg-background text-foreground select-none">
        <AppErrorBoundary>
          <Providers>
            {children}
          </Providers>
        </AppErrorBoundary>
        {/* ❌ Analytics Vercel supprimé — app offline, pas de tracking réseau */}
      </body>
    </html>
  )
}
