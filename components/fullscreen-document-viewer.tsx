"use client"

/**
 * FullScreenDocumentViewer
 * ──────────────────────────────────────────────────────────────────────────
 * Expérience "Lecteur PDF" plein écran, fixed inset-0 z-[100].
 *
 * Ce composant est AUTONOME pour l'export PDF :
 *  - Il lit #fsdv-print-container (clone caché en taille native 210×297mm)
 *  - Il construit le HTML complet via buildPrintHtml()
 *  - Il appelle window.electron.exportPDF() → moteur printToPDF natif Electron
 *  - Il affiche un état de chargement (isExporting) et des toasts de résultat
 *
 * Structure :
 *   ┌──────────────────────── Topbar (h-14) ─────────────────────────────────┐
 *   │ ← Fermer      Facture N° FAC-001/GAB/2026     [Imprimer] [↓ PDF]      │
 *   └────────────────────────────────────────────────────────────────────────┘
 *   ┌──────────────────── Zone de lecture (flex-1) ───────────────────────────┐
 *   │              ┌───────────────────┐                                      │
 *   │              │   <DocumentA4 />  │  ← Fit-to-Screen (ResizeObserver)   │
 *   │              └───────────────────┘                                      │
 *   └────────────────────────────────────────────────────────────────────────┘
 */

import * as React from "react"
import { X, Printer, Download, FileText, Loader2, ZoomIn, ZoomOut, Maximize } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DocumentA4 } from "@/components/document-a4"
import { printElement, buildPrintHtml } from "@/lib/electron-print"
import { toast } from "sonner"
import type { DocumentA4Props } from "@/components/document-a4"

// ── Constantes A4 à 96 dpi ─────────────────────────────────────────────────
const A4_W = 794
const A4_H = 1123
const MARGIN = 32 // px de marge visuelle autour de la feuille

// ── Types ──────────────────────────────────────────────────────────────────
export interface FullScreenDocumentViewerProps extends DocumentA4Props {
  /** Appelé quand l'utilisateur ferme le viewer */
  onClose: () => void
  /** Titre affiché dans la topbar (ex: "Facture N° FAC-001/GAB/2026") */
  title?: string
  /**
   * Nom de fichier suggéré pour l'export PDF (ex: "FACTURE_001.pdf").
   * Si omis, construit automatiquement depuis type + numéro du document.
   */
  defaultFilename?: string
}

// ── Composant ──────────────────────────────────────────────────────────────
export function FullScreenDocumentViewer({
  onClose,
  title,
  defaultFilename,
  ...docProps
}: FullScreenDocumentViewerProps) {
  const [scale, setScale]       = React.useState(0.8)
  const [zoomLevel, setZoomLevel]     = React.useState(1)
  const [isPrinting, setIsPrinting]   = React.useState(false)
  const [isExporting, setIsExporting] = React.useState(false)
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

  // ── Handler : Impression native ─────────────────────────────────────────
  const handlePrint = async () => {
    setIsPrinting(true)
    try {
      await printElement('fsdv-print-container')
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

  // ── Handler : Export PDF natif (moteur Electron printToPDF) ────────────
  const handleExportPDF = async () => {
    if (isExporting) return // Protection double-clic

    // ── 1. Cible #printable-a4-document : le div racine de <DocumentA4 />
    //       (id ajouté en étape 1, taille native 210×297mm, pas de scale)
    //       On le cherche DANS le clone caché #fsdv-print-container pour
    //       éviter de capturer le div visuel (qui peut avoir un scale appliqué).
    const container = document.getElementById('fsdv-print-container')
    const element   = container?.querySelector<HTMLElement>('#printable-a4-document')
                      ?? document.getElementById('printable-a4-document')

    if (!element) {
      toast.error('Erreur : conteneur #printable-a4-document introuvable.')
      return
    }

    // ── 2. Fallback navigateur (sans Electron) ────────────────────────────
    if (!window.electron?.exportPDF) {
      toast.info("Export PDF natif non disponible — ouverture de l'impression navigateur.")
      window.print()
      return
    }

    setIsExporting(true)
    const toastId = toast.loading('Génération du PDF en cours...')

    try {
      // ── 3. Capture du HTML + debug ─────────────────────────────────────
      const contentHtml = element.outerHTML
      console.log('[PDF Export] HTML capturé — longueur:', contentHtml.length, 'chars | ID:', element.id)

      // ── 4. Construit le document HTML complet (sans script window.print)
      const htmlDoc = buildPrintHtml(contentHtml, /* includePrintScript */ false)

      // ── 5. Nom de fichier (sanitisation pour Windows) ─────────────────
      const docNumber = (docProps.data as any)?.number ?? 'document'
      const typePrefix = docProps.type === 'facture' ? 'FACTURE'
                        : docProps.type === 'devis'   ? 'DEVIS'
                        : 'AVOIR'
      const filename = defaultFilename
        ?? `${typePrefix}_${docNumber.replace(/\//g, '-').replace(/\s+/g, '_')}.pdf`

      // ── 5. Appel IPC → main.js → BrowserWindow cachée → printToPDF ──────
      const result = await window.electron.exportPDF(htmlDoc, filename)

      if (result.saved) {
        toast.success('PDF enregistré avec succès !', {
          id: toastId,
          description: result.filePath
            ? `Fichier : ${result.filePath.split(/[\\/]/).pop()}`
            : undefined,
          duration: 4000,
        })
      } else {
        // L'utilisateur a annulé la boîte de dialogue → pas d'erreur
        toast.dismiss(toastId)
      }

    } catch (err) {
      console.error('[FullScreenViewer] Export PDF error:', err)
      toast.error("Erreur lors de la génération du PDF", {
        id: toastId,
        description: err instanceof Error ? err.message : 'Erreur inconnue',
      })
    } finally {
      setIsExporting(false)
    }
  }

  // ── Titre affiché dans la topbar ─────────────────────────────────────────
  const displayTitle = title
    ?? `${docProps.type === 'facture' ? 'Facture' : docProps.type === 'devis' ? 'Devis' : 'Avoir'} — ${(docProps.data as any).number ?? ''}`

  return (
    // ── Overlay plein écran (passe au-dessus de la sidebar et du topbar) ──
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

        {/* Centre : Nom du document + Contrôles Zoom */}
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-2 text-sm font-semibold text-slate-700 select-none truncate max-w-[200px] lg:max-w-[400px]">
            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="truncate">{displayTitle}</span>
          </div>

          <div className="flex items-center rounded border border-slate-200 bg-slate-50 p-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 hover:bg-white text-slate-500 hover:text-slate-900"
              onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.25))}
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 hover:bg-white text-xs font-medium text-slate-500 hover:text-slate-900"
              onClick={() => setZoomLevel(1)}
              title="Ajuster à l'écran"
            >
              {Math.round(zoomLevel * 100)}%
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 hover:bg-white text-slate-500 hover:text-slate-900"
              onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.25))}
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Droite : Actions */}
        <div className="flex items-center gap-2">

          {/* Bouton Imprimer */}
          <Button
            variant="outline"
            size="sm"
            disabled={isPrinting || isExporting}
            onClick={handlePrint}
            className="gap-2 border-slate-200 text-slate-700 hover:bg-gray-50"
          >
            {isPrinting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Printer className="w-4 h-4" />
            }
            <span className="hidden sm:inline">
              {isPrinting ? 'En cours...' : 'Imprimer'}
            </span>
          </Button>

          {/* Bouton Télécharger PDF ← cœur de l'étape 3 */}
          <Button
            size="sm"
            disabled={isExporting || isPrinting}
            onClick={handleExportPDF}
            className="gap-2 bg-[#1e3a5f] hover:bg-[#16305a] text-white disabled:opacity-60"
          >
            {isExporting
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Download className="w-4 h-4" />
            }
            <span className="hidden sm:inline">
              {isExporting ? 'Génération...' : 'Télécharger PDF'}
            </span>
          </Button>

        </div>
      </div>

      {/* ── ZONE DE LECTURE ─────────────────────────────── */}
      <div
        ref={viewerRef}
        className="flex-1 overflow-auto relative p-8 flex flex-col items-center"
      >
        {/* Conteneur layout qui prend la vraie taille après scale */}
        <div
          style={{
            width: `${A4_W * scale * zoomLevel}px`,
            height: `${A4_H * scale * zoomLevel}px`,
            flexShrink: 0,
            position: 'relative'
          }}
        >
          {/* Feuille A4 scalée — affichage visuel */}
          <div
            style={{
              transform: `scale(${scale * zoomLevel})`,
              transformOrigin: 'top left',
              width: `${A4_W}px`,
              minWidth: `${A4_W}px`,
              height: `${A4_H}px`,
              minHeight: `${A4_H}px`,
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          >
            <DocumentA4 {...docProps} />
          </div>
        </div>

        {/*
          Clone caché en taille native 210×297mm (pas de scale).
          C'est CE clone que printElement() et handleExportPDF() capturent —
          il n'est jamais compressé par le viewer.
        */}
        <div id="fsdv-print-container" className="hidden" aria-hidden="true">
          <DocumentA4 {...docProps} />
        </div>
      </div>
    </div>
  )
}
