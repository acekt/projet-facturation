"use client"

import * as React from "react"
import { Plus, DownloadCloud } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { useStore, type Invoice } from "@/lib/store"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { exportInvoicesToExcel } from "@/lib/services/ExportService"
import { getInvoices, deleteInvoice } from "@/app/actions/invoice.actions"
import { getQuotes } from "@/app/actions/quote.actions"
import { getCreditNotes } from "@/app/actions/credit-note.actions"
import { createPayment, getPayments } from "@/app/actions/payment.actions"
import { FullScreenDocumentViewer } from "@/components/fullscreen-document-viewer"
import { Pagination } from "@workspace/ui/components/pagination-custom"
import { PageHeader } from "@workspace/ui/components/page-header"
import { InvoiceFilterBar } from "./invoices/InvoiceFilterBar"
import { PaymentDialog } from "./invoices/PaymentDialog"
import { InvoiceDeleteDialog } from "./invoices/InvoiceDeleteDialog"
import { InvoiceCancelDialog } from "./invoices/InvoiceCancelDialog"
import { InvoiceViews } from "./invoices/InvoiceViews"
import { CreateCreditNoteModal } from "@/components/features/credit-notes/CreateCreditNoteModal"
import { DataExportModal } from "@/components/features/export/DataExportModal"
import { useCommandFilter } from "@/lib/command-navigation"
import { useShallow } from "zustand/react/shallow"

interface InvoicesPageProps {
  onCreateInvoice: () => void
  onEditInvoice: (id: string) => void
}

export function InvoicesPage({ onCreateInvoice, onEditInvoice }: InvoicesPageProps) {
  const { invoices, setInvoices, setQuotes, setPayments, settings, creditNotes, setCreditNotes, user, viewFormat, isDataLoaded } = useStore(
    useShallow((s) => ({
      invoices: s.invoices, setInvoices: s.setInvoices, setQuotes: s.setQuotes, setPayments: s.setPayments,
      settings: s.settings, creditNotes: s.creditNotes, setCreditNotes: s.setCreditNotes,
      user: s.user, viewFormat: s.viewFormat, isDataLoaded: s.isDataLoaded,
    }))
  )

  const [searchQuery, setSearchQuery] = React.useState("")
  useCommandFilter("invoices", setSearchQuery)
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 9 // Harmonisation Grille 3x3 pour éviter les cartes orphelines et trous visuels (10 % 3 = 1)
  const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null)
  const [invoiceForCreditNote, setInvoiceForCreditNote] = React.useState<Invoice | null>(null)
  const [isDownloading, setIsDownloading] = React.useState<string | null>(null)
  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false)

  const [paymentDialogOpen, setPaymentDialogOpen] = React.useState(false)
  const [paymentInvoice, setPaymentInvoice] = React.useState<Invoice | null>(null)
  const [paymentMethod, setPaymentMethod] = React.useState("Espèces")
  const [paymentAmount, setPaymentAmount] = React.useState(""), [paymentType, setPaymentType] = React.useState("full")
  const [paymentDate, setPaymentDate] = React.useState(new Date().toISOString().split("T")[0])
  const [paymentReference, setPaymentReference] = React.useState(""), [isRecordingPayment, setIsRecordingPayment] = React.useState(false)
  const [invoiceToDeleteId, setInvoiceToDeleteId] = React.useState<string | null>(null)
  const [invoiceToCancel, setInvoiceToCancel] = React.useState<Invoice | null>(null)
  const [deleteAssociatedQuote, setDeleteAssociatedQuote] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false), [isCancelling, setIsCancelling] = React.useState(false)
  const [statusFilter, setStatusFilter] = React.useState<string>("all")

  const invoiceCounts = React.useMemo(() => {
    let draft = 0, unpaid = 0, paid = 0, overdue = 0, cancelled = 0
    const now = Date.now()
    for (const inv of invoices) {
      if (inv.deletedAt) continue
      const st = inv.status as string
      if (st === "draft" || st === "BROUILLON") draft++
      else if (st === "cancelled" || st === "CANCELLED") cancelled++
      else if (st === "PAID") paid++
      else {
        const isPastDue = inv.dueDate ? new Date(inv.dueDate).getTime() < now : false
        if (st === "overdue" || isPastDue) overdue++
        if (st === "UNPAID" || st === "PARTIALLY_PAID" || st === "overdue" || isPastDue) unpaid++
      }
    }
    return { draft, unpaid, paid, overdue, cancelled }
  }, [invoices])

  const filteredInvoices = React.useMemo(() => {
    return invoices.filter((invoice) => {
      const q = searchQuery.toLowerCase()
      const matchesSearch =
        (invoice.number || "").toLowerCase().includes(q) ||
        (invoice.clientName || "").toLowerCase().includes(q) ||
        (invoice.clientEmail || "").toLowerCase().includes(q)
      if (statusFilter === "all") return matchesSearch
      if (statusFilter === "draft") {
        return matchesSearch && (invoice.status === "draft" || (invoice.status as string) === "BROUILLON")
      }
      if (statusFilter === "unpaid_any") {
        return matchesSearch && (invoice.status === "UNPAID" || invoice.status === "PARTIALLY_PAID" || invoice.status === "overdue")
      }
      if (statusFilter === "overdue") {
        const isPastDue = invoice.dueDate ? new Date(invoice.dueDate).getTime() < Date.now() : false
        return matchesSearch && (invoice.status === "overdue" || (isPastDue && invoice.status !== "PAID" && (invoice.status as string) !== "cancelled" && (invoice.status as string) !== "CANCELLED"))
      }
      return matchesSearch && invoice.status === statusFilter
    })
  }, [invoices, searchQuery, statusFilter])

  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage)
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter])

  const handleDelete = async (id: string) => {
    if (isDeleting) return
    setIsDeleting(true)
    try {
      const response = await deleteInvoice(id)
      if (!response.success) {
        if (response.error?.includes("Forbidden")) {
          toast.error("Action refusée : Vous manquez de droits pour supprimer cette facture.")
        } else {
          throw new Error("Delete failed")
        }
        setInvoiceToDeleteId(null)
        return
      }
      toast.success("Facture supprimée")
      setInvoiceToDeleteId(null)
      const updatedInvoices = await getInvoices()
      if (updatedInvoices.success && updatedInvoices.data) {
        setInvoices(updatedInvoices.data)
      }
    } catch {
      toast.error("Erreur lors de la suppression")
    } finally {
      setIsDeleting(false)
    }
  }

  const confirmCancelInvoice = async () => {
    if (!invoiceToCancel || isCancelling) return
    setIsCancelling(true)
    try {
      const response = await deleteInvoice(invoiceToCancel.id, deleteAssociatedQuote)
      if (!response.success) {
        if (response.error?.includes("Forbidden")) {
          toast.error("Action refusée : Vous manquez de droits pour annuler/supprimer cette facture.")
        } else {
          throw new Error("Failed to cancel invoice")
        }
        setInvoiceToCancel(null)
        return
      }

      toast.success("Facture annulée avec succès")
      setInvoiceToCancel(null)
      setDeleteAssociatedQuote(false)

      const updatedInvoices = await getInvoices()
      if (updatedInvoices.success && updatedInvoices.data) setInvoices(updatedInvoices.data)
      const updatedQuotes = await getQuotes()
      if (updatedQuotes.success && updatedQuotes.data) setQuotes(updatedQuotes.data)
      const updatedNotes = await getCreditNotes()
      if (updatedNotes.success && updatedNotes.data) setCreditNotes(updatedNotes.data)
    } catch {
      toast.error("Erreur lors de l'annulation de la facture")
    } finally {
      setIsCancelling(false)
    }
  }

  const getInvoiceNetRemaining = React.useCallback((inv: Invoice | null) => {
    if (!inv) return 0
    const paid = inv.payments?.reduce((s, p) => s + p.amount, 0) || 0
    const credited = creditNotes.filter((c) => c.invoiceId === inv.id && !c.deletedAt).reduce((s, c) => s + c.total, 0)
    return Math.max(0, inv.total - paid - credited)
  }, [creditNotes])

  const handleOpenPayment = (invoice: Invoice) => {
    setPaymentInvoice(invoice)
    setPaymentAmount(getInvoiceNetRemaining(invoice).toString())
    setPaymentType("full")
    setPaymentMethod("Espèces")
    setPaymentDate(new Date().toISOString().split("T")[0])
    setPaymentReference("")
    setPaymentDialogOpen(true)
  }

  const handleDownloadPDF = async (invoice: Invoice) => {
    if (window.electron?.exportPDF) {
      setSelectedInvoice(invoice)
      return
    }

    const toastId = toast.loading("Génération du PDF...")
    try {
      setIsDownloading(invoice.id)
      const { pdf } = await import("@react-pdf/renderer")
      const { PDFDocument } = await import("@/components/pdf-document")
      const blob = await pdf(<PDFDocument document={invoice} type="facture" settings={settings} />).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `FACTURE_${invoice.number}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success("Téléchargement démarré", { id: toastId })
    } catch (error) {
      console.error("PDF Error:", error)
      toast.error("Erreur lors de la génération du PDF", { id: toastId })
    } finally {
      setIsDownloading(null)
    }
  }

  const confirmPayment = async () => {
    if (!paymentInvoice || isRecordingPayment) return
    const remaining = getInvoiceNetRemaining(paymentInvoice)
    const amount = parseFloat(paymentAmount)
    if (amount <= 0) return void toast.error("Le montant doit être supérieur à 0")
    if (amount > remaining) return void toast.error(`Le montant ne peut pas dépasser le reste à payer (${formatCurrency(remaining)})`)

    setIsRecordingPayment(true)
    try {
      const response = await createPayment({
        invoiceId: paymentInvoice.id,
        amount: Math.round(amount),
        paymentMethod,
        date: paymentDate || new Date().toISOString().split("T")[0],
        reference: paymentReference?.trim() || undefined,
      })

      if (!response.success) throw new Error("Failed to record payment")

      toast.success("Paiement enregistré")
      const updatedInvoices = await getInvoices()
      if (updatedInvoices.success && updatedInvoices.data) setInvoices(updatedInvoices.data)
      const updatedPayments = await getPayments()
      if (updatedPayments.success && updatedPayments.data) setPayments(updatedPayments.data)

      setPaymentDialogOpen(false)
      setPaymentInvoice(null)
    } catch {
      toast.error("Erreur lors de l'enregistrement")
    } finally {
      setIsRecordingPayment(false)
    }
  }

  if (!isDataLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Chargement des factures...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden space-y-6">
      <PageHeader
        title="Factures"
        description="Gérez vos factures et suivez vos paiements"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setIsExportModalOpen(true)}
              className="gap-2 hidden sm:flex cursor-pointer"
            >
              <DownloadCloud className="w-4 h-4" /> Export Excel
            </Button>
            {(user?.role === "user" || user?.role === "admin") && (
              <Button
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                onClick={() => onCreateInvoice()}
              >
                <Plus className="w-4 h-4" />
                Nouvelle Facture
              </Button>
            )}
          </>
        }
      />

      <InvoiceFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        totalCount={invoices.length}
        draftCount={invoiceCounts.draft}
        unpaidCount={invoiceCounts.unpaid}
        paidCount={invoiceCounts.paid}
        overdueCount={invoiceCounts.overdue}
        cancelledCount={invoiceCounts.cancelled}
      />

      <InvoiceViews
        invoices={paginatedInvoices}
        creditNotes={creditNotes}
        viewFormat={viewFormat.invoices || "table"}
        user={user}
        searchQuery={searchQuery}
        isDownloading={isDownloading}
        onPreview={(inv) => setSelectedInvoice(inv)}
        onDownloadPDF={handleDownloadPDF}
        onEdit={(id) => onEditInvoice(id)}
        onRecordPayment={handleOpenPayment}
        onEmitCreditNote={(inv) => setInvoiceForCreditNote(inv)}
        onCancel={(inv) => { setInvoiceToCancel(inv); setDeleteAssociatedQuote(false); }}
        onDelete={(id) => setInvoiceToDeleteId(id)}
        onCreateInvoice={onCreateInvoice}
      />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {selectedInvoice && (
        <FullScreenDocumentViewer
          data={selectedInvoice}
          type="facture"
          title={`Facture N° ${selectedInvoice.number}`}
          onClose={() => setSelectedInvoice(null)}
        />
      )}

      <CreateCreditNoteModal
        open={Boolean(invoiceForCreditNote)}
        onOpenChange={(open) => !open && setInvoiceForCreditNote(null)}
        initialInvoice={invoiceForCreditNote}
        invoices={invoices}
        creditNotes={creditNotes || []}
      />

      <PaymentDialog
        isOpen={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        invoice={paymentInvoice}
        totalCredited={paymentInvoice ? creditNotes.filter((c) => c.invoiceId === paymentInvoice.id && !c.deletedAt).reduce((s, c) => s + c.total, 0) : 0}
        paymentType={paymentType}
        onPaymentTypeChange={(val) => {
          setPaymentType(val)
          if (val === "full" && paymentInvoice) setPaymentAmount(getInvoiceNetRemaining(paymentInvoice).toString())
        }}
        paymentAmount={paymentAmount}
        onPaymentAmountChange={(val) => {
          const v = parseFloat(val) || 0
          if (!paymentInvoice || v <= getInvoiceNetRemaining(paymentInvoice)) setPaymentAmount(val)
        }}
        paymentMethod={paymentMethod}
        onPaymentMethodChange={setPaymentMethod}
        onConfirm={confirmPayment}
        isSubmitting={isRecordingPayment}
      />

      <InvoiceDeleteDialog
        invoiceId={invoiceToDeleteId}
        onOpenChange={(open) => !open && setInvoiceToDeleteId(null)}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />

      <InvoiceCancelDialog
        invoice={invoiceToCancel}
        onOpenChange={(open) => !open && setInvoiceToCancel(null)}
        deleteAssociatedQuote={deleteAssociatedQuote}
        onDeleteAssociatedQuoteChange={setDeleteAssociatedQuote}
        onConfirm={confirmCancelInvoice}
        isCancelling={isCancelling}
      />

      <DataExportModal
        open={isExportModalOpen}
        onOpenChange={setIsExportModalOpen}
        defaultScope="invoices"
      />
    </div>
  )
}
