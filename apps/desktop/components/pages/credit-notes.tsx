"use client"

import * as React from "react"
import { DownloadCloud, Plus } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { PageHeader } from "@workspace/ui/components/page-header"
import { SearchBar } from "@workspace/ui/components/search-bar"
import { Pagination } from "@workspace/ui/components/pagination-custom"
import { FullScreenDocumentViewer } from "@/components/fullscreen-document-viewer"
import { CreateCreditNoteModal } from "@/components/features/credit-notes/CreateCreditNoteModal"
import { DataExportModal } from "@/components/features/export/DataExportModal"
import { CreditNoteViews, type InvoiceStatusInfo } from "@/components/features/credit-notes/CreditNoteViews"
import { useStore, type CreditNote } from "@/lib/store"
import { useShallow } from "zustand/react/shallow"
import { formatDate, downloadSafeCsv, cn } from "@/lib/utils"
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
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 9 // Harmonisation Grille 3x3
  const [isDownloading, setIsDownloading] = React.useState<string | null>(null)
  const [previewNote, setPreviewNote] = React.useState<CreditNote | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false)

  const canCreate = user?.role === "admin" || user?.role === "user"

  const counts = React.useMemo(() => {
    let open = 0, applied = 0, cancelled = 0;
    for (const note of creditNotes) {
      if (note.deletedAt) continue;
      const st = (note.status || "").toLowerCase();
      if (st === "applied") applied++;
      else if (st === "cancelled") cancelled++;
      else open++;
    }
    return { total: open + applied + cancelled, open, applied, cancelled };
  }, [creditNotes]);

  const filtered = React.useMemo(() => {
    return creditNotes.filter((note) => {
      if (note.deletedAt) return false;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        note.number.toLowerCase().includes(q) ||
        note.clientName.toLowerCase().includes(q) ||
        note.invoiceId.toLowerCase().includes(q) ||
        (note.reason && note.reason.toLowerCase().includes(q));

      if (!matchesSearch) return false;
      const st = (note.status || "").toLowerCase();
      if (statusFilter === "all") return true;
      if (statusFilter === "open") return st === "open";
      if (statusFilter === "applied") return st === "applied";
      if (statusFilter === "cancelled") return st === "cancelled";
      return true;
    });
  }, [creditNotes, searchQuery, statusFilter]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1
  const paginated = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const getInvoiceStatusInfo = React.useCallback(
    (invoiceId: string): InvoiceStatusInfo | null => {
      const inv = invoices.find((i) => i.id === invoiceId)
      if (!inv) return null

      const invPayments = payments.filter((p) => p.invoiceId === invoiceId)
      const paid = invPayments.reduce((acc, curr) => acc + curr.amount, 0)
      const remaining = Math.max(0, inv.total - paid)

      return {
        status: inv.status,
        total: inv.total,
        paidAmount: paid,
        remainingAmount: remaining,
        dueDate: inv.dueDate,
        invoiceNumber: inv.number,
      }
    },
    [invoices, payments]
  )

  const handleDownloadPDF = async (note: CreditNote) => {
    setIsDownloading(note.id)
    try {
      const { pdf } = await import("@react-pdf/renderer")
      const { PDFDocument } = await import("@/components/pdf-document")

      const relatedInv = invoices.find((i) => i.id === note.invoiceId);
      const relatedInvoiceNumber = relatedInv?.number || note.invoiceId;

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

  const exportToCSV = () => {
    try {
      const headers = ["Numéro", "Facture liée", "Client", "Date", "Montant TTC", "Motif", "Statut"]
      const rows = filtered.map((note) => {
        const inv = invoices.find((i) => i.id === note.invoiceId)
        return [
          note.number,
          inv?.number || note.invoiceId,
          note.clientName,
          formatDate(note.date),
          String(note.total),
          note.reason || "",
          note.status,
        ]
      })
      downloadSafeCsv("avoirs-remboursements.csv", headers, rows)
      toast.success("Export CSV téléchargé avec succès")
    } catch (err) {
      console.error("CSV export failed:", err)
      toast.error("Erreur lors de l'export CSV")
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden space-y-6">
      <PageHeader
        title="Avoirs & Remboursements"
        description="Gérez les remboursements, réductions commerciales et corrections de facturation"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="gap-2 bg-card border-border hover:bg-secondary cursor-pointer"
              onClick={() => setIsExportModalOpen(true)}
            >
              <DownloadCloud className="w-4 h-4" />
              Exporter
            </Button>
            {canCreate && (
              <Button
                className="gap-2 bg-primary hover:bg-primary-hover text-white shadow-sm cursor-pointer"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <Plus className="w-4 h-4" />
                Nouvel avoir / remboursement
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row gap-4 mb-2 items-center">
        <div className="flex-1">
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
        <div className="text-xs text-muted-foreground whitespace-nowrap hidden sm:block font-medium">
          {filtered.length} avoir(s) émis
        </div>
      </div>

      {/* Filtres d'accès rapide unifiés avec compteurs réactifs */}
      <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => {
            setStatusFilter("all")
            setCurrentPage(1)
          }}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
            statusFilter === "all"
              ? "bg-secondary text-foreground shadow-xs"
              : "text-muted-foreground hover:bg-secondary/60"
          )}
        >
          <span>Tous</span>
          <span className="text-[11px] tabular-nums font-normal opacity-80">({counts.total})</span>
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
              ? "bg-amber-500 text-white shadow-xs"
              : "bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
          )}
        >
          <span>En attente / Ouverts</span>
          <span className="px-1.5 py-0.5 bg-amber-600/20 rounded-full tabular-nums text-[10px] font-bold">
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
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-muted-foreground hover:bg-secondary/60"
          )}
        >
          <span>Remboursés / Déduits</span>
          <span className="px-1.5 py-0.5 bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 rounded-full tabular-nums text-[10px] font-bold">
            {counts.applied}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter("cancelled")
            setCurrentPage(1)
          }}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
            statusFilter === "cancelled"
              ? "bg-slate-700 text-white shadow-xs"
              : "text-muted-foreground hover:bg-secondary/60"
          )}
        >
          <span>Annulés</span>
          <span className="px-1.5 py-0.5 bg-slate-500/15 text-slate-700 dark:text-slate-300 rounded-full tabular-nums text-[10px] font-bold">
            {counts.cancelled}
          </span>
        </button>
      </div>

      <CreditNoteViews
        creditNotes={paginated}
        viewFormat={viewFormat.creditNotes || "table"}
        isDownloading={isDownloading}
        getInvoiceStatusInfo={getInvoiceStatusInfo}
        onPreview={(note) => setPreviewNote(note)}
        onDownloadPDF={handleDownloadPDF}
      />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
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
      />

      <DataExportModal
        open={isExportModalOpen}
        onOpenChange={setIsExportModalOpen}
        defaultScope="credit-notes"
      />
    </div>
  )
}
