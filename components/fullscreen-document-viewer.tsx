"use client"

/**
 * FullScreenDocumentViewer
 * ──────────────────────────────────────────────────────────────────────────
 * Remplace la modale classique par une expérience "Lecteur PDF" plein écran.
 * Le composant se pose en `fixed inset-0 z-[100]` pour passer au-dessus
 * de la sidebar, du topbar et de toute autre UI de l'application.
 *
 * Structure :
 *   ┌─────────────────────────── Topbar (h-14) ────────────────────────────┐
 *   │ ← Fermer    Facture N° FAC-001/GAB/2026    [Imprimer] [PDF]         │
 *   └──────────────────────────────────────────────────────────────────────┘
 *   ┌─────────────────── Zone de lecture (flex-1) ─────────────────────────┐
 *   │                                                                       │
 *   │              ┌───────────────────┐                                   │
 *   │              │   <DocumentA4 />  │  ← Fit-to-Screen (scale)         │
 *   │              └───────────────────┘                                   │
 *   │                                                                       │
 *   └──────────────────────────────────────────────────────────────────────┘
 */

import * as React from "react"
import { X, Printer, Download, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DocumentA4 } from "@/components/document-a4"
import { printElement } from "@/lib/electron-print"
import { toast } from "sonner"
import { useStore } from "@/lib/store"
import type { DocumentA4Props } from "@/components/document-a4"

// ── Constantes A4 à 96 dpi ─────────────────────────────────────────────────
const A4_W = 794
const A4_H = 1123
const MARGIN = 32 // px de marge autour de la feuille dans la zone de lecture

// ── Types ──────────────────────────────────────────────────────────────────
export interface FullScreenDocumentViewerProps extends DocumentA4Props {
  /** Appelé quand l'utilisateur ferme le viewer */
  onClose: () => void
  /** Titre affiché dans la topbar (ex: "Facture N° FAC-001/GAB/2026") */
  title?: string
  /** Fonction de téléchargement PDF (déléguée au parent qui connaît les dépendances) */
  onDownloadPDF?: () => void
  /** Indique si le PDF est en cours de génération */
  isDownloading?: boolean
}

// ── Composant ──────────────────────────────────────────────────────────────
export function FullScreenDocumentViewer({
  onClose,
  title,
  onDownloadPDF,
  isDownloading = false,
  ...docProps
}: FullScreenDocumentViewerProps) {
  const [scale, setScale] = React.useState(0.8)
  const [isPrinting, setIsPrinting] = React.useState(false)
  const viewerRef = React.useRef<HTMLDivElement>(null)

  // ── Fermeture par Échap ─────────────────────────────────────────────────
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // ── Fit-to-Screen : ResizeObserver sur la zone de lecture ───────────────
  React.useEffect(() => {
    const el = viewerRef.current
    if (!el) return

    function recalc() {
      const w = el!.clientWidth
      const h = el!.clientHeight
      const scaleX = (w - MARGIN * 2) / A4_W
      const scaleY = h > 0 ? (h - MARGIN * 2) / A4_H : scaleX
      setScale(Math.min(scaleX, scaleY, 1))
    }

    recalc()
    const ro = new ResizeObserver(recalc)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── Handler impression ──────────────────────────────────────────────────
  const handlePrint = async () => {
    setIsPrinting(true)
    try {
      await printElement('printable-a4-document')
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
      if (!msg.includes('cancel') && !msg.includes('annul')) {
        console.error('[FullScreenViewer] Print error:', err)
        toast.error("Erreur lors du lancement de l'impression")
      }
    } finally {
      setIsPrinting(false)
    }
  }

  // ── Titre par défaut ────────────────────────────────────────────────────
  const displayTitle = title ?? `${docProps.type === 'facture' ? 'Facture' : docProps.type === 'devis' ? 'Devis' : 'Avoir'} — ${(docProps.data as any).number ?? ''}`

  return (
    // ── Overlay plein écran ────────────────────────────────────────────────
    <div className="fixed inset-0 z-[100] w-screen h-screen bg-gray-200 flex flex-col">

      {/* ── TOPBAR ─────────────────────────────────────────────────────── */}
      <div className="h-14 flex-none flex items-center justify-between px-4 bg-white border-b border-gray-200 shadow-sm no-print">

        {/* Gauche : Bouton Fermer */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="gap-2 text-slate-600 hover:text-slate-900 hover:bg-gray-100"
        >
          <X className="w-4 h-4" />
          <span className="hidden sm:inline">Fermer l'aperçu</span>
        </Button>

        {/* Centre : Nom du document */}
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 select-none">
          <FileText className="w-4 h-4 text-slate-400" />
          <span>{displayTitle}</span>
        </div>

        {/* Droite : Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isPrinting}
            onClick={handlePrint}
            className="gap-2 border-slate-200 text-slate-700 hover:bg-gray-50"
          >
            <Printer className={`w-4 h-4 ${isPrinting ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">
              {isPrinting ? 'En cours...' : 'Imprimer'}
            </span>
          </Button>

          {onDownloadPDF && (
            <Button
              size="sm"
              disabled={isDownloading}
              onClick={onDownloadPDF}
              className="gap-2 bg-[#1e3a5f] hover:bg-[#16305a] text-white"
            >
              <Download className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
              <span className="hidden sm:inline">
                {isDownloading ? 'Génération...' : 'Télécharger PDF'}
              </span>
            </Button>
          )}
        </div>
      </div>

      {/* ── ZONE DE LECTURE (Fit-to-Screen) ─────────────────────────────── */}
      <div
        ref={viewerRef}
        className="flex-1 flex items-center justify-center overflow-hidden relative"
      >
        {/* Feuille A4 scalée au centre */}
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
            width: `${A4_W}px`,
            minWidth: `${A4_W}px`,
            height: `${A4_H}px`,
            minHeight: `${A4_H}px`,
            flexShrink: 0,
          }}
        >
          <DocumentA4 {...docProps} />
        </div>

        {/* Clone caché pour l'impression IPC (electron-print.ts) */}
        <div id="printable-a4-document" className="hidden" aria-hidden="true">
          <DocumentA4 {...docProps} />
        </div>
      </div>
    </div>
  )
}
