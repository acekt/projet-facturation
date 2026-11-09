"use client"

import * as React from "react"
import { DownloadCloud, Plus } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { PageHeader } from "@/components/features/common/PageHeader"
import { SortSelect } from "@/components/features/common/SortSelect"
import { SearchBar } from "@workspace/ui/components/search-bar"
import { Pagination } from "@workspace/ui/components/pagination-custom"
import { FullScreenDocumentViewer } from "@/components/fullscreen-document-viewer"
import { CreateCreditNoteModal } from "@/components/features/credit-notes/CreateCreditNoteModal"
import { CreditNoteDetailsDialog } from "@/components/features/credit-notes/CreditNoteDetailsDialog"
import { DataExportModal } from "@/components/features/export/DataExportModal"
import {
  CreditNoteViews,
  getEffectiveCreditNoteCategory,
  getCreditNoteNatureInfo,
  type InvoiceStatusInfo,
} from "@/components/features/credit-notes/CreditNoteViews"
import { useStore, type CreditNote } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import { cn } from "@/lib/utils"
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value"
import { resolveCreditNoteInvoiceNumber } from "@/lib/utils/excel-export"
import { toast } from "sonner"

export function CreditNotesPage() {
  const {
    creditNotes,
    invoices,
    payments,
    settings,
    user,
    viewFormat,
  } = useStore(
    useShallow((state) => ({
      creditNotes: state.creditNotes,
      invoices: state.invoices,
      payments: state.payments,
      settings: state.settings,
      user: state.user,
      viewFormat: state.viewFormat,
    }))
  )

  const [searchQuery, setSearchQuery] = React.useState("")
  const debouncedSearch = useDebouncedValue(searchQuery, 200)
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [sortBy, setSortBy] = React.useState<string>("recent")
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 9 // Harmonisation Grille 3x3
  const [isDownloading, setIsDownloading] = React.useState<string | null>(null)
  const [previewNote, setPreviewNote] = React.useState<CreditNote | null>(null)
  const [detailsNote, setDetailsNote] = React.useState<CreditNote | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false)

  const canCreate = user?.role === "admin" || user?.role === "user"

  const getInvoiceStatusInfo = React.useCallback(
    (invoiceId: string): InvoiceStatusInfo | null => {
      const inv = invoices.find((i) => i.id === invoiceId)
      if (!inv) return null

      const invPayments = payments.filter((p) => p.invoiceId === invoiceId)
      const paid = invPayments.reduce((acc, curr) => acc + curr.amount, 0)
      const appliedCredits = creditNotes
        .filter((cn) => cn.invoiceId === invoiceId && !cn.deletedAt && (cn.status || "").toLowerCase() !== "cancelled")
        .reduce((acc, curr) => acc + curr.total, 0)
      const remaining = Math.max(0, inv.total - paid - appliedCredits)

      return {
        status: inv.status,
        total: inv.total,
        paidAmount: paid,
        remainingAmount: remaining,
        dueDate: inv.dueDate,
        invoiceNumber: inv.number,
      }
    },
    [invoices, payments, creditNotes]
  )

  const counts = React.useMemo(() => {
    let open = 0, applied = 0, cancelled = 0
    for (const note of creditNotes) {
      if (note.deletedAt) continue
      const invInfo = getInvoiceStatusInfo(note.invoiceId)
      const cat = getEffectiveCreditNoteCategory(note, invInfo)
      if (cat === "applied") applied++
      else if (cat === "cancelled") cancelled++
      else open++
    }
    return { total: open + applied + cancelled, open, applied, cancelled }
  }, [creditNotes, getInvoiceStatusInfo])

  const filtered = React.useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim()
    return creditNotes
      .filter((note) => {
        if (note.deletedAt) return false
        const invInfo = getInvoiceStatusInfo(note.invoiceId)
        const invNumber = (invInfo?.invoiceNumber || note.invoiceId || "").toLowerCase()
        const matchesSearch =
          !q ||
          note.number.toLowerCase().includes(q) ||
          note.clientName.toLowerCase().includes(q) ||
          invNumber.includes(q) ||
          (note.reason && note.reason.toLowerCase().includes(q))

        if (!matchesSearch) return false
        if (statusFilter === "all") return true
        const cat = getEffectiveCreditNoteCategory(note, invInfo)
        return cat === statusFilter
      })
      .sort((a, b) => {
        if (sortBy === "amount_desc") return (b.total || 0) - (a.total || 0)
        if (sortBy === "amount_asc") return (a.total || 0) - (b.total || 0)
        if (sortBy === "alpha_asc") return (a.clientName || "").localeCompare(b.clientName || "", "fr", { sensitivity: "base" })
        const tA = new Date(a.date || a.createdAt || 0).getTime()
        const tB = new Date(b.date || b.createdAt || 0).getTime()
        return sortBy === "oldest" ? tA - tB : tB - tA
      })
  }, [creditNotes, debouncedSearch, statusFilter, sortBy, getInvoiceStatusInfo])

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1
  const safePage = Math.min(currentPage, Math.max(1, totalPages))
  const paginated = filtered.slice(
    (safePage - 1) * itemsPerPage,
    safePage * itemsPerPage
  )

  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [currentPage, totalPages])

  const handleDownloadPDF = async (note: CreditNote) => {
    setIsDownloading(note.id)
    try {
      const { pdf } = await import("@react-pdf/renderer")
      const { PDFDocument } = await import("@/components/pdf-document")

      const relatedInvoiceNumber = resolveCreditNoteInvoiceNumber(note, invoices)

      const blob = await pdf(
        <PDFDocument
          document={note}
          type="avoir"
          settings={settings}
          relatedInvoiceNumber={relatedInvoiceNumber}
        />
      ).toBlob()

      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `Avoir-${note.number}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success("PDF téléchargé avec succès")
    } catch (err) {
      console.error("PDF generation failed:", err)
      toast.error("Erreur lors de la génération du PDF")
    } finally {
      setIsDownloading(null)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 pb-4 border-b border-border bg-background z-10 space-y-4">
        <PageHeader
          title="Avoirs & Remboursements"
          description="Gérez les notes d'avoir, réductions de créances et remboursements clients"
          actions={
            <>
              <Button
                variant="outline"
                onClick={() => setIsExportModalOpen(true)}
                className="gap-2 hidden sm:flex cursor-pointer"
              >
                <DownloadCloud className="w-4 h-4" /> Export Excel
              </Button>
              {canCreate && (
                <Button
                  className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer"
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                  Nouvel avoir
                </Button>
              )}
            </>
          }
        />

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="flex-1 sm:min-w-[380px]">
            <SearchBar
              placeholder="Rechercher par numéro d'avoir, client, numéro de facture ou motif..."
              value={searchQuery}
              onChange={(val) => {
                setSearchQuery(val)
                setCurrentPage(1)
              }}
              viewFormatKey="creditNotes"
            />
          </div>
          <div className="flex items-center gap-2.5">
            <SortSelect
              value={sortBy}
              onValueChange={(val) => {
                setSortBy(val)
                setCurrentPage(1)
              }}
              type="currency"
            />
            <div className="text-xs text-muted-foreground whitespace-nowrap hidden md:block font-medium">
              {filtered.length} avoir(s)
            </div>
          </div>
        </div>

        {/* Filtres d'accès rapide unifiés avec compteurs réactifs basés sur getEffectiveCreditNoteCategory */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => {
              setStatusFilter("all")
              setCurrentPage(1)
            }}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
              statusFilter === "all"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            )}
          >
            <span>Tous</span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded-full tabular-nums text-[10px] font-semibold",
                statusFilter === "all"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-background/80 text-foreground"
              )}
            >
              {counts.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter("open")
              setCurrentPage(1)
            }}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
              statusFilter === "open"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            )}
          >
            <span>En attente / À rembourser</span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded-full tabular-nums text-[10px] font-semibold",
                statusFilter === "open"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-background/80 text-foreground"
              )}
            >
              {counts.open}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setStatusFilter("applied")
              setCurrentPage(1)
            }}
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
              statusFilter === "applied"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            )}
          >
            <span>Imputés / Soldés</span>
            <span
              className={cn(
                "px-1.5 py-0.5 rounded-full tabular-nums text-[10px] font-semibold",
                statusFilter === "applied"
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-background/80 text-foreground"
              )}
            >
              {counts.applied}
            </span>
          </button>

        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 pt-4 pr-1 space-y-4">
        <CreditNoteViews
          creditNotes={paginated}
          viewFormat={viewFormat.creditNotes || "table"}
          isDownloading={isDownloading}
          getInvoiceStatusInfo={getInvoiceStatusInfo}
          onViewDetails={(note) => setDetailsNote(note)}
          onPreview={(note) => setPreviewNote(note)}
          onDownloadPDF={handleDownloadPDF}
        />
      </div>

      <div className="shrink-0 pt-3 border-t border-border bg-background">
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>

      <CreditNoteDetailsDialog
        isOpen={Boolean(detailsNote)}
        onOpenChange={(open) => !open && setDetailsNote(null)}
        creditNote={detailsNote}
        invoice={detailsNote ? invoices.find((i) => i.id === detailsNote.invoiceId) : null}
        invoiceStatusInfo={detailsNote ? getInvoiceStatusInfo(detailsNote.invoiceId) : null}
        onOpenPreview={(note) => {
          setDetailsNote(null)
          setPreviewNote(note)
        }}
        onDownloadPDF={handleDownloadPDF}
      />

      {previewNote && (
        <FullScreenDocumentViewer
          data={previewNote}
          type="avoir"
          title={`Avoir N° ${previewNote.number}`}
          onClose={() => setPreviewNote(null)}
        />
      )}

      <CreateCreditNoteModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        invoices={invoices}
        creditNotes={creditNotes}
        onPreview={(cn) => setPreviewNote(cn)}
      />

      <DataExportModal
        open={isExportModalOpen}
        onOpenChange={setIsExportModalOpen}
        defaultScope="credit-notes"
      />
    </div>
  )
}
