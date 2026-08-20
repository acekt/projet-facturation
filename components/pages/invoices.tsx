"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
  Plus,
  Search,
  FileText,
  MoreVertical,
  Download,
  Printer,
  Trash2,
  Copy,
  Clock,
  CheckCircle2,
  AlertCircle,
  DownloadCloud,
  Edit2,
  Eye,
  RefreshCcw,
  Calendar,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useStore, type Invoice, type Payment } from "@/lib/store"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toast } from "sonner"
import { DocumentA4 } from "@/components/document-a4"
import { printElement, buildPrintHtml } from "@/lib/electron-print"
import { FullScreenDocumentViewer } from "@/components/fullscreen-document-viewer"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { VisuallyHidden } from "@/components/ui/visually-hidden"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Pagination } from "@/components/ui/pagination-custom"
import { EmptyState } from "@/components/ui/empty-state"
import { Switch } from "@/components/ui/switch"
// ── Design System components
import { PageHeader } from "@/components/ui/page-header"
import { SearchBar } from "@/components/ui/search-bar"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  DataTable,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableHeaderCell,
  DataTableCell,
  AmountCell,
  ActionsCell,
} from "@/components/ui/data-table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface InvoicesPageProps {
  onCreateInvoice: () => void
  onEditInvoice: (id: string) => void
}

export function InvoicesPage({ onCreateInvoice, onEditInvoice }: InvoicesPageProps) {
  const invoices = useStore(state => state.invoices)
  const setInvoices = useStore(state => state.setInvoices)
  const quotes = useStore(state => state.quotes)
  const setQuotes = useStore(state => state.setQuotes)
  const setPayments = useStore(state => state.setPayments)
  const settings = useStore(state => state.settings)
  const setCreditNotes = useStore(state => state.setCreditNotes)
  const user = useStore(state => state.user)
  const viewFormat = useStore(state => state.viewFormat)
  const setViewFormat = useStore(state => state.setViewFormat)
  const isDataLoaded = useStore(state => state.isDataLoaded)

  const [searchQuery, setSearchQuery] = React.useState("")
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 10
  const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null)

  const [isDownloading, setIsDownloading] = React.useState<string | null>(null)
  const [paymentDialogOpen, setPaymentDialogOpen] = React.useState(false)
  const [paymentInvoice, setPaymentInvoice] = React.useState<Invoice | null>(null)
  const [paymentMethod, setPaymentMethod] = React.useState("cash")
  const [paymentAmount, setPaymentAmount] = React.useState("")
  const [paymentType, setPaymentType] = React.useState("full")
  const [invoiceToDeleteId, setInvoiceToDeleteId] = React.useState<string | null>(null)
  const [invoiceToCancel, setInvoiceToCancel] = React.useState<Invoice | null>(null)
  const [deleteAssociatedQuote, setDeleteAssociatedQuote] = React.useState(false)
  // [P2-A] Protège le bouton d'impression contre le double-clic accidentel
  const [isPrinting, setIsPrinting] = React.useState(false)
  // [QA-Phase 1] Protection contre le double-clic et les actions concurrentes
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [isCancelling, setIsCancelling] = React.useState(false)
  const [statusFilter, setStatusFilter] = React.useState<string>("all")

  const filteredInvoices = React.useMemo(() => {
    return invoices.filter(
      (invoice) => {
        const matchesSearch = invoice.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              invoice.clientName.toLowerCase().includes(searchQuery.toLowerCase())
        if (statusFilter === "all") return matchesSearch
        return matchesSearch && invoice.status === statusFilter
      }
    )
  }, [invoices, searchQuery, statusFilter])

  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage)
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const handleDelete = async (id: string) => {
    if (isDeleting) return
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
      if (response.status === 403) {
        toast.error("Action refusée : Vous manquez de droits pour supprimer cette facture.")
        setInvoiceToDeleteId(null)
        return
      }
      if (!response.ok) throw new Error('Delete failed')
      toast.success("Facture supprimée")
      setInvoiceToDeleteId(null)
      const updatedInvoices = await fetch('/api/invoices').then(res => res.json())
      setInvoices(updatedInvoices)
    } catch (error) {
      toast.error("Erreur lors de la suppression")
    } finally {
      setIsDeleting(false)
    }
  }

  const confirmCancelInvoice = async () => {
    if (!invoiceToCancel || isCancelling) return
    setIsCancelling(true)
    try {
      const response = await fetch(`/api/invoices/${invoiceToCancel.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteQuote: deleteAssociatedQuote }),
      });

      if (response.status === 403) {
        toast.error("Action refusée : Vous manquez de droits pour annuler/supprimer cette facture.")
        setInvoiceToCancel(null)
        return
      }
      if (!response.ok) throw new Error('Failed to cancel invoice');

      toast.success("Facture annulée avec succès");
      setInvoiceToCancel(null);
      setDeleteAssociatedQuote(false);

      // Replace Promise.all with sequential fetches to prevent Zustand race conditions
      const updatedInvoices = await fetch('/api/invoices').then(res => res.json());
      setInvoices(updatedInvoices);
      const updatedQuotes = await fetch('/api/quotes').then(res => res.json());
      setQuotes(updatedQuotes);
      const updatedNotes = await fetch('/api/credit-notes').then(res => res.json());
      setCreditNotes(updatedNotes);
    } catch (error) {
      toast.error("Erreur lors de l'annulation de la facture");
    } finally {
      setIsCancelling(false)
    }
  }

  const markAsPaid = (invoice: Invoice) => {
      const totalPaid = invoice.payments?.reduce((sum, p) => sum + p.amount, 0) || 0
      const remaining = invoice.total - totalPaid
      setPaymentInvoice(invoice);
      setPaymentAmount(remaining.toString());
      setPaymentDialogOpen(true);
  }

  const handleDownloadPDF = async (invoice: Invoice) => {
    // ── Moteur natif Electron : printToPDF via fenêtre cachée ───────────────
    if (window.electron?.exportPDF) {
      try {
        setIsDownloading(invoice.id)
        // Rendu temporaire du DocumentA4 dans un div hors-écran
        const tempDiv = document.createElement('div')
        tempDiv.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:794px;min-height:1123px;visibility:hidden;'
        document.body.appendChild(tempDiv)

        // On attend le prochain tick pour que React puisse rendre
        // Note : on passe par le FullScreenDocumentViewer qui gère ça nativement.
        // Pour les boutons de liste, la solution la plus fiable est d'ouvrir
        // directement le viewer (le PDF button y est intégré).
        document.body.removeChild(tempDiv)

        // → Ouvre le viewer plein écran : l'utilisateur clique "Télécharger PDF"
        //   depuis la topbar qui utilise le moteur natif.
        setSelectedInvoice(invoice)
      } finally {
        setIsDownloading(null)
      }
      return
    }

    // ── Fallback : navigateur web sans Electron (ancienne méthode) ────────
    try {
      setIsDownloading(invoice.id)
      const { pdf } = await import('@react-pdf/renderer')
      const { PDFDocument } = await import('@/components/pdf-document')
      const blob = await pdf(<PDFDocument document={invoice} type="facture" settings={settings} />).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `FACTURE_${invoice.number}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success("Téléchargement démarré")
    } catch (error) {
      console.error("PDF Error:", error)
      toast.error("Erreur lors de la génération du PDF")
    } finally {
      setIsDownloading(null)
    }
  }

  const confirmPayment = async () => {
      if (paymentInvoice) {
          const totalPaid = paymentInvoice.payments?.reduce((sum, p) => sum + p.amount, 0) || 0
          const remaining = paymentInvoice.total - totalPaid
          const amount = parseFloat(paymentAmount)
          
          if (amount <= 0) {
              toast.error("Le montant doit être supérieur à 0")
              return
          }
          
          if (amount > remaining) {
              toast.error(`Le montant ne peut pas dépasser le reste à payer (${formatCurrency(remaining)})`)
              return
          }
          
          try {
            const response = await fetch('/api/payments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  invoiceId: paymentInvoice.id,
                  amount: amount,
                  paymentMethod,
                  date: new Date().toISOString().split('T')[0]
              }),
            })

            if (!response.ok) throw new Error('Failed to record payment')

            toast.success("Paiement enregistré")

            // Replace Promise.all with sequential fetches to prevent Zustand race conditions
            const updatedInvoices = await fetch('/api/invoices').then(res => res.json());
            setInvoices(updatedInvoices);
            const updatedPayments = await fetch('/api/payments').then(res => res.json());
            setPayments(updatedPayments);
            setPaymentDialogOpen(false);
            setPaymentInvoice(null);
          } catch (error) {
              toast.error("Erreur lors de l'enregistrement")
          }
      }
  }

  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter])

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

  // ── Calcul statut de paiement ───────────────────────────────────────────────
  const getPaymentStatus = (invoice: Invoice) => {
    const totalPaid = invoice.payments?.reduce((sum, p) => sum + p.amount, 0) || 0
    const remaining = invoice.total - totalPaid
    if (totalPaid === 0) return { status: 'unpaid' as const, paid: 0, remaining: invoice.total }
    if (totalPaid >= invoice.total) return { status: 'paid' as const, paid: totalPaid, remaining: 0 }
    return { status: 'partial' as const, paid: totalPaid, remaining }
  }

  // ── Rendu du badge de paiement via StatusBadge unifié ──────────────────────
  const getPaymentBadge = (invoice: Invoice) => {
    const ps = getPaymentStatus(invoice)
    if (ps.status === 'paid') {
      return <StatusBadge variant="invoice-paid" amount={ps.paid} />
    }
    if (ps.status === 'partial') {
      return <StatusBadge variant="invoice-partial" paidAmount={ps.paid} remainingAmount={ps.remaining} />
    }
    return <StatusBadge variant="invoice-unpaid" remainingAmount={ps.remaining} />
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden space-y-6">
      {/* ── En-tête de page (Design System) ───────────────────────────── */}
      <PageHeader
        title="Factures"
        description="Gérez vos factures et suivez vos paiements"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                const headers = ["Numero", "Client", "Date", "Total", "Statut"];
                const rows = invoices.map(i => [i.number, i.clientName, i.date, i.total, i.status]);
                const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.setAttribute("download", `factures_${new Date().toISOString().split('T')[0]}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="gap-2 hidden sm:flex"
            >
              <DownloadCloud className="w-4 h-4" />
              Export CSV
            </Button>
            {user?.role === 'user' && (
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

      {/* ── Barre de recherche + sélecteur de vue (Design System) ──────── */}
      <SearchBar
        placeholder="Rechercher une facture..."
        value={searchQuery}
        onChange={setSearchQuery}
        viewFormatKey="invoices"
      />

      {/* ── Vue Tableau (Design System) ─────────────────────────────────── */}
      {(!viewFormat.invoices || viewFormat.invoices === 'table') && (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Facture</DataTableHeaderCell>
              <DataTableHeaderCell>Client</DataTableHeaderCell>
              <DataTableHeaderCell>Date</DataTableHeaderCell>
              <DataTableHeaderCell>Statut</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Total</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {paginatedInvoices.map((invoice) => (
              <DataTableRow key={invoice.id}>
                {/* Numéro de facture */}
                <DataTableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-primary/5 flex items-center justify-center text-primary flex-shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <span className="font-medium text-sm text-foreground">{invoice.number}</span>
                  </div>
                </DataTableCell>
                {/* Client */}
                <DataTableCell truncate title={invoice.clientName}>
                  {invoice.clientName}
                </DataTableCell>
                {/* Date */}
                <DataTableCell>
                  <span className="text-xs text-muted-foreground">{formatDate(invoice.date)}</span>
                </DataTableCell>
                {/* Statut de paiement */}
                <DataTableCell>
                  {getPaymentBadge(invoice)}
                </DataTableCell>
                {/* Total (AmountCell unifié) */}
                <AmountCell amount={invoice.total} />
                {/* Actions */}
                <ActionsCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                      <DropdownMenuItem className="gap-2" onClick={() => setSelectedInvoice(invoice)}>
                        <Eye className="w-4 h-4" /> Aperçu
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2" onClick={() => setSelectedInvoice(invoice)}>
                        <Printer className="w-4 h-4" /> Imprimer
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="gap-2"
                        onClick={() => handleDownloadPDF(invoice)}
                        disabled={isDownloading === invoice.id}
                      >
                        <Download className="w-4 h-4" />
                        {isDownloading === invoice.id ? "Génération..." : "Télécharger PDF"}
                      </DropdownMenuItem>
                      {invoice.status !== 'PAID' && user?.role === 'user' && invoice.created_by === user?.id && (
                        <DropdownMenuItem className="gap-2 text-emerald-600" onClick={() => markAsPaid(invoice)}>
                          <CheckCircle2 className="w-4 h-4" /> Enregistrer un règlement
                        </DropdownMenuItem>
                      )}
                      {user?.role === 'user' && invoice.created_by === user?.id && (
                        <DropdownMenuItem className="gap-2 text-orange-600" onClick={() => {
                          setInvoiceToCancel(invoice)
                          setDeleteAssociatedQuote(false)
                        }}>
                          <RefreshCcw className="w-4 h-4" /> Annuler la facture
                        </DropdownMenuItem>
                      )}
                      {user?.role === 'user' && invoice.created_by === user?.id && (
                        <>
                          <div className="h-px bg-border my-1" />
                          <DropdownMenuItem
                            className="gap-2 text-destructive focus:text-destructive"
                            onClick={() => setInvoiceToDeleteId(invoice.id)}
                          >
                            <Trash2 className="w-4 h-4" /> Supprimer
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </ActionsCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}
      {(!viewFormat.invoices || viewFormat.invoices === 'table') && paginatedInvoices.length === 0 && (
        <div className="p-8 text-center">
          <EmptyState
            icon={FileText}
            title={searchQuery ? "Aucun résultat" : "Aucune facture"}
            description={searchQuery ? "Aucune facture ne correspond à votre recherche." : "Les factures sont générées automatiquement après la conversion d'un devis accepté."}
          />
        </div>
      )}

      {viewFormat.invoices === 'horizontal' && (
        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          <div className="grid grid-cols-1 gap-4">
          {paginatedInvoices.map((invoice, index) => (
            <motion.div
              key={invoice.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="bg-card border-border hover:border-border/80 transition-all group shadow-sm">
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-md bg-primary/5 flex items-center justify-center text-primary">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-sm">{invoice.number}</h3>
                          {getPaymentBadge(invoice)}
                        </div>
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                          <span className="font-medium text-foreground">{invoice.clientName}</span>
                          <span className="mx-2 opacity-30">•</span>
                          <span>{formatDate(invoice.date)}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Total</p>
                        <p className="text-sm font-semibold tracking-tight text-foreground">{formatCurrency(invoice.total)}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Plus d'options">
                            <MoreVertical className="w-5 h-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                          <DropdownMenuItem className="gap-2" onClick={() => setSelectedInvoice(invoice)}>
                            <Eye className="w-4 h-4" /> Aperçu
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2" onClick={() => setSelectedInvoice(invoice)}>
                            <Printer className="w-4 h-4" /> Imprimer
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2"
                            onClick={() => handleDownloadPDF(invoice)}
                            disabled={isDownloading === invoice.id}
                          >
                            <Download className="w-4 h-4" />
                            {isDownloading === invoice.id ? "Génération..." : "Télécharger PDF"}
                          </DropdownMenuItem>
                          {invoice.status !== 'PAID' && user?.role === 'user' && invoice.created_by === user?.id && (
                            <DropdownMenuItem className="gap-2 text-emerald-600" onClick={() => markAsPaid(invoice)}>
                              <CheckCircle2 className="w-4 h-4" /> Enregistrer un règlement
                            </DropdownMenuItem>
                          )}
                          {user?.role === 'user' && invoice.created_by === user?.id && (
                             <DropdownMenuItem className="gap-2 text-orange-600" onClick={() => {
                               setInvoiceToCancel(invoice)
                               setDeleteAssociatedQuote(false)
                             }}>
                               <RefreshCcw className="w-4 h-4" /> Annuler la facture
                             </DropdownMenuItem>
                          )}
                          {user?.role === 'user' && invoice.created_by === user?.id && (
                            <>
                              <div className="h-px bg-border my-1" />
                              <DropdownMenuItem
                                className="gap-2 text-destructive focus:text-destructive"
                                onClick={() => setInvoiceToDeleteId(invoice.id)}
                              >
                                <Trash2 className="w-4 h-4" /> Supprimer
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {paginatedInvoices.length === 0 && (
            <EmptyState
              icon={FileText}
              title={searchQuery ? "Aucun résultat" : "Aucune facture"}
              description={searchQuery ? "Aucune facture ne correspond à votre recherche." : "Les factures sont générées automatiquement après la conversion d'un devis accepté."}
            />
          )}
        </div>
        </div>
      )}

      {viewFormat.invoices === 'block' && (
        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedInvoices.map((invoice, index) => (
            <motion.div
              key={invoice.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="bg-card border-border hover:border-primary/30 transition-all group shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-2">
                      {getPaymentBadge(invoice)}
                    </div>
                  </div>
                  <h3 className="font-bold text-sm mb-1">{invoice.number}</h3>
                  <p className="text-xs text-muted-foreground mb-2">{invoice.clientName}</p>
                  <div className="space-y-1 mb-3">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>Émission: {formatDate(invoice.date)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-border/50">
                    <p className="text-sm font-semibold tracking-tight text-foreground">{formatCurrency(invoice.total)}</p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                        <DropdownMenuItem className="gap-2" onClick={() => setSelectedInvoice(invoice)}>
                          <Eye className="w-4 h-4" /> Aperçu
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2" onClick={() => setSelectedInvoice(invoice)}>
                          <Printer className="w-4 h-4" /> Imprimer
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2"
                          onClick={() => handleDownloadPDF(invoice)}
                          disabled={isDownloading === invoice.id}
                        >
                          <Download className="w-4 h-4" />
                          {isDownloading === invoice.id ? "Génération..." : "Télécharger PDF"}
                        </DropdownMenuItem>
                        {invoice.status !== 'PAID' && user?.role === 'user' && invoice.created_by === user?.id && (
                          <DropdownMenuItem className="gap-2 text-emerald-600" onClick={() => markAsPaid(invoice)}>
                            <CheckCircle2 className="w-4 h-4" /> Enregistrer un règlement
                          </DropdownMenuItem>
                        )}
                        {user?.role === 'user' && invoice.created_by === user?.id && (
                          <DropdownMenuItem
                            className="gap-2 text-orange-600"
                            onClick={() => { setInvoiceToCancel(invoice); setDeleteAssociatedQuote(false) }}
                          >
                            <RefreshCcw className="w-4 h-4" /> Annuler
                          </DropdownMenuItem>
                        )}
                        {user?.role === 'user' && invoice.created_by === user?.id && (
                          <>
                            <div className="h-px bg-border my-1" />
                            <DropdownMenuItem className="gap-2 text-destructive" onClick={() => setInvoiceToDeleteId(invoice.id)}>
                                <Trash2 className="w-4 h-4" /> Supprimer
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {paginatedInvoices.length === 0 && (
            <div className="col-span-full">
              <EmptyState
                icon={FileText}
                title={searchQuery ? "Aucun résultat" : "Aucune facture"}
                description={searchQuery ? "Aucune facture ne correspond à votre recherche." : "Les factures sont générées automatiquement après la conversion d'un devis accepté."}
              />
            </div>
          )}
        </div>
        </div>
      )}

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

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Confirmer le règlement</DialogTitle>
            <VisuallyHidden>
              <DialogDescription>Formulaire pour enregistrer un paiement partiel ou total pour cette facture</DialogDescription>
            </VisuallyHidden>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Type de règlement</Label>
                <Select value={paymentType} onValueChange={(val) => {
                    setPaymentType(val);
                    if (val === 'full' && paymentInvoice) {
                        const totalPaid = paymentInvoice.payments?.reduce((sum, p) => sum + p.amount, 0) || 0
                        const remaining = paymentInvoice.total - totalPaid
                        setPaymentAmount(remaining.toString());
                    }
                }}>
                    <SelectTrigger className="bg-secondary border-border text-foreground h-11">
                        <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                        <SelectItem value="full">Solde complet (100%)</SelectItem>
                        <SelectItem value="acompte">Acompte / Partiel</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-amount" className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Montant du paiement (XAF)</Label>
              <Input
                id="payment-amount"
                type="number"
                value={paymentAmount}
                onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0
                    if (paymentInvoice) {
                        const totalPaid = paymentInvoice.payments?.reduce((sum, p) => sum + p.amount, 0) || 0
                        const remaining = paymentInvoice.total - totalPaid
                        if (value <= remaining) {
                            setPaymentAmount(e.target.value)
                        }
                    } else {
                        setPaymentAmount(e.target.value)
                    }
                }}
                className="bg-secondary border-border h-11 font-bold text-lg"
                disabled={paymentType === 'full'}
              />
              {paymentInvoice && (
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                      Reste à payer: {formatCurrency(paymentInvoice.total - (paymentInvoice.payments?.reduce((sum, p) => sum + p.amount, 0) || 0))}
                  </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Mode de règlement</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="bg-secondary border-border text-foreground h-11">
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                    <SelectItem value="Espèces">Espèces</SelectItem>
                    <SelectItem value="Airtel Money">Airtel Money</SelectItem>
                    <SelectItem value="Moov Money">Moov Money</SelectItem>
                    <SelectItem value="Virement Bancaire">Virement Bancaire</SelectItem>
                    <SelectItem value="Chèque">Chèque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={confirmPayment} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11">
              Valider l'encaissement
            </Button>
          </div>
        </DialogContent>
      </Dialog>



      <AlertDialog open={invoiceToDeleteId !== null} onOpenChange={(open) => !open && !isDeleting && setInvoiceToDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette facture ? Cette action appliquera un Soft Delete pour conserver la traçabilité fiscale.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => invoiceToDeleteId && handleDelete(invoiceToDeleteId)}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isDeleting ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={invoiceToCancel !== null} onOpenChange={(open) => !open && !isCancelling && setInvoiceToCancel(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Annuler la facture {invoiceToCancel?.number}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <span>
                Cette action va générer un avoir pour annuler comptablement cette facture.
              </span>
              {invoiceToCancel?.quoteId && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border mt-3">
                  <div className="space-y-0.5 text-left">
                    <Label className="text-sm font-medium">Supprimer également le devis associé</Label>
                    <p className="text-[10px] text-muted-foreground">Le devis lié sera également marqué comme supprimé</p>
                  </div>
                  <Switch checked={deleteAssociatedQuote} onCheckedChange={setDeleteAssociatedQuote} disabled={isCancelling} />
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Retour</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancelInvoice}
              disabled={isCancelling}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isCancelling ? "Annulation..." : "Confirmer l'annulation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
