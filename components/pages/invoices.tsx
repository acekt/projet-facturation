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
import { Badge } from "@/components/ui/badge"
import { useStore, type Invoice, type Payment } from "@/lib/store"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toast } from "sonner"
import { PrintableDocument } from "@/components/printable-document"
import { DocumentPreview } from "@/components/document-preview"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { VisuallyHidden } from "@/components/ui/visually-hidden"
import { pdf } from '@react-pdf/renderer'
import { PDFDocument } from "@/components/pdf-document"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Pagination } from "@/components/ui/pagination-custom"
import { EmptyState } from "@/components/ui/empty-state"
import { ViewFormatSelector } from "@/components/ui/view-format-selector"

interface InvoicesPageProps {
  onCreateInvoice: () => void
  onEditInvoice: (id: string) => void
}

export function InvoicesPage({ onCreateInvoice, onEditInvoice }: InvoicesPageProps) {
  const { invoices, setInvoices, setPayments, settings, setCreditNotes, user, viewFormat, setViewFormat } = useStore()

  const [searchQuery, setSearchQuery] = React.useState("")
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 10
  const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null)
  const [previewInvoice, setPreviewInvoice] = React.useState<Invoice | null>(null)
  const [isDownloading, setIsDownloading] = React.useState<string | null>(null)
  const [paymentDialogOpen, setPaymentDialogOpen] = React.useState(false)
  const [paymentInvoice, setPaymentInvoice] = React.useState<Invoice | null>(null)
  const [paymentMethod, setPaymentMethod] = React.useState("cash")
  const [paymentAmount, setPaymentAmount] = React.useState("")
  const [paymentType, setPaymentType] = React.useState("full")

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cette facture ?")) return
    try {
      const response = await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Delete failed')
      toast.success("Facture supprimée")
      const updatedInvoices = await fetch('/api/invoices').then(res => res.json())
      setInvoices(updatedInvoices)
    } catch (error) {
      toast.error("Erreur lors de la suppression")
    }
  }

  const markAsPaid = (invoice: Invoice) => {
      const totalPaid = invoice.payments?.reduce((sum, p) => sum + p.amount, 0) || 0
      const remaining = invoice.total - totalPaid
      setPaymentInvoice(invoice);
      setPaymentAmount(remaining.toString());
      setPaymentDialogOpen(true);
  }

  const handleCreateCreditNote = async (invoice: Invoice) => {
    if (!confirm(`Voulez-vous créer un avoir pour la facture ${invoice.number} ? Cela annulera comptablement cette facture.`)) return;

    try {
      const response = await fetch('/api/credit-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          reason: "Annulation de facture / Retour",
          items: invoice.items
        }),
      });

      if (!response.ok) throw new Error('Failed to create credit note');

      toast.success("Avoir créé avec succès");
      const [updatedInvoices, updatedNotes] = await Promise.all([
          fetch('/api/invoices').then(res => res.json()),
          fetch('/api/credit-notes').then(res => res.json())
      ]);
      setInvoices(updatedInvoices);
      setCreditNotes(updatedNotes);
    } catch (error) {
      toast.error("Erreur lors de la création de l'avoir");
    }
  }

  const handleDownloadPDF = async (invoice: Invoice) => {
    try {
      setIsDownloading(invoice.id)
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

            const [updatedInvoices, updatedPayments] = await Promise.all([
                fetch('/api/invoices').then(res => res.json()),
                fetch('/api/payments').then(res => res.json())
            ]);

            setInvoices(updatedInvoices);
            setPayments(updatedPayments);
            setPaymentDialogOpen(false);
            setPaymentInvoice(null);
          } catch (error) {
              toast.error("Erreur lors de l'enregistrement")
          }
      }
  }

  const filteredInvoices = React.useMemo(() => {
    return invoices.filter(
      (invoice) =>
        invoice.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        invoice.clientName.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [invoices, searchQuery])

  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage)
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const getStatusBadge = (status: Invoice['status']) => {
    switch (status) {
      case "PAID":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">Soldé</Badge>
      case "PARTIALLY_PAID":
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">Partiel</Badge>
      case "UNPAID":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">Non payé</Badge>
      case "overdue":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">En retard</Badge>
      case "draft":
        return <Badge variant="secondary" className="bg-slate-100 text-slate-700">Brouillon</Badge>
      case "cancelled":
        return <Badge className="bg-gray-100 text-gray-600 border-gray-200">Annulée</Badge>
      default:
        return null
    }
  }

  const getPaymentStatus = (invoice: Invoice) => {
    const totalPaid = invoice.payments?.reduce((sum, p) => sum + p.amount, 0) || 0
    const remaining = invoice.total - totalPaid
    
    if (totalPaid === 0) {
      return { status: 'unpaid', paid: 0, remaining: invoice.total }
    }
    if (totalPaid >= invoice.total) {
      return { status: 'paid', paid: totalPaid, remaining: 0 }
    }
    return { status: 'partial', paid: totalPaid, remaining }
  }

  const getPaymentBadge = (invoice: Invoice) => {
    const paymentStatus = getPaymentStatus(invoice)
    
    switch (paymentStatus.status) {
      case 'paid':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
            Soldé ({formatCurrency(paymentStatus.paid)})
          </Badge>
        )
      case 'partial':
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200">
            Partiel - Payé: {formatCurrency(paymentStatus.paid)} | Reste: {formatCurrency(paymentStatus.remaining)}
          </Badge>
        )
      case 'unpaid':
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200">
            Non payé - Reste: {formatCurrency(paymentStatus.remaining)}
          </Badge>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Factures</h1>
          <p className="text-muted-foreground mt-1">Gérez vos factures et suivez vos paiements</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const headers = ["Numero", "Client", "Date", "Echeance", "Total", "Statut"];
              const rows = invoices.map(i => [i.number, i.clientName, i.date, i.dueDate, i.total, i.status]);
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
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une facture..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary/50 border-border text-foreground w-full md:max-w-md"
          />
        </div>
        <ViewFormatSelector
          currentFormat={viewFormat.invoices}
          onFormatChange={(format: 'table' | 'horizontal' | 'block') => setViewFormat('invoices', format)}
        />
      </div>

      {viewFormat.invoices === 'table' && (
        <div className="bg-card rounded-xl border border-border overflow-x-auto shadow-sm">
          <table className="w-full min-w-[600px]">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Facture</th>
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Client</th>
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Dates</th>
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Statut</th>
                <th className="text-right p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Total</th>
                <th className="text-right p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {paginatedInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <FileText className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-sm">{invoice.number}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{invoice.clientName}</td>
                  <td className="p-4">
                    <div className="text-xs text-muted-foreground">
                      <div>Émission: {formatDate(invoice.date)}</div>
                      <div>Échéance: {formatDate(invoice.dueDate)}</div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(invoice.status)}
                      {getPaymentBadge(invoice)}
                    </div>
                  </td>
                  <td className="p-4 text-right font-bold text-sm">{formatCurrency(invoice.total)}</td>
                  <td className="p-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                        <DropdownMenuItem className="gap-2" onClick={() => setPreviewInvoice(invoice)}>
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
                        {invoice.status !== 'PAID' && user?.role === 'user' && (
                          <DropdownMenuItem className="gap-2 text-emerald-600" onClick={() => markAsPaid(invoice)}>
                            <CheckCircle2 className="w-4 h-4" /> Enregistrer un règlement
                          </DropdownMenuItem>
                        )}
                        {user?.role === 'user' && (
                          <DropdownMenuItem className="gap-2 text-orange-600" onClick={() => handleCreateCreditNote(invoice)}>
                            <RefreshCcw className="w-4 h-4" /> Annuler
                          </DropdownMenuItem>
                        )}
                        {user?.role === 'admin' && (
                          <>
                            <div className="h-px bg-border my-1" />
                            <DropdownMenuItem className="gap-2 text-destructive" onClick={() => handleDelete(invoice.id)}>
                                <Trash2 className="w-4 h-4" /> Supprimer
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {paginatedInvoices.length === 0 && (
            <div className="p-8 text-center">
              <EmptyState
                icon={FileText}
                title={searchQuery ? "Aucun résultat" : "Aucune facture"}
                description={searchQuery ? "Aucune facture ne correspond à votre recherche." : "Les factures sont générées automatiquement après la conversion d'un devis accepté."}
              />
            </div>
          )}
        </div>
      )}

      {viewFormat.invoices === 'horizontal' && (
        <div className="grid grid-cols-1 gap-4">
          {paginatedInvoices.map((invoice, index) => (
            <motion.div
              key={invoice.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="bg-card border-border hover:border-primary/30 transition-all group shadow-sm">
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-foreground text-sm">{invoice.number}</h3>
                          {getStatusBadge(invoice.status)}
                          {getPaymentBadge(invoice)}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          <span className="font-black text-foreground/80 uppercase tracking-tighter">{invoice.clientName}</span>
                          <span className="mx-2 opacity-30">•</span>
                          <span>Émission: {formatDate(invoice.date)}</span>
                          <span className="mx-2 opacity-30">•</span>
                          <span>Échéance: {formatDate(invoice.dueDate)}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 md:gap-6">
                      <div className="text-right hidden sm:block">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-black">Total TTC</p>
                        <p className="text-lg font-black text-foreground tracking-tighter">{formatCurrency(invoice.total)}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Plus d'options">
                            <MoreVertical className="w-5 h-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                          <DropdownMenuItem className="gap-2" onClick={() => setPreviewInvoice(invoice)}>
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
                          {invoice.status !== 'PAID' && user?.role === 'user' && (
                            <DropdownMenuItem className="gap-2 text-emerald-600" onClick={() => markAsPaid(invoice)}>
                              <CheckCircle2 className="w-4 h-4" /> Enregistrer un règlement
                            </DropdownMenuItem>
                          )}
                          {user?.role === 'user' && (
                            <DropdownMenuItem className="gap-2 text-orange-600" onClick={() => handleCreateCreditNote(invoice)}>
                              <RefreshCcw className="w-4 h-4" /> Annuler
                            </DropdownMenuItem>
                          )}
                          {user?.role === 'admin' && (
                            <>
                            <div className="h-px bg-border my-1" />
                            <DropdownMenuItem className="gap-2 text-destructive" onClick={() => handleDelete(invoice.id)}>
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
      )}

      {viewFormat.invoices === 'block' && (
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
                      {getStatusBadge(invoice.status)}
                      {getPaymentBadge(invoice)}
                    </div>
                  </div>
                  <h3 className="font-bold text-sm mb-1">{invoice.number}</h3>
                  <p className="text-xs text-muted-foreground mb-2">{invoice.clientName}</p>
                  <div className="space-y-1 mb-3">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>Émission: {formatDate(invoice.date)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>Échéance: {formatDate(invoice.dueDate)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-border/50">
                    <p className="text-lg font-black text-foreground tracking-tighter">{formatCurrency(invoice.total)}</p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                        <DropdownMenuItem className="gap-2" onClick={() => setPreviewInvoice(invoice)}>
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
                        {invoice.status !== 'PAID' && user?.role === 'user' && (
                          <DropdownMenuItem className="gap-2 text-emerald-600" onClick={() => markAsPaid(invoice)}>
                            <CheckCircle2 className="w-4 h-4" /> Enregistrer un règlement
                          </DropdownMenuItem>
                        )}
                        {user?.role === 'user' && (
                          <DropdownMenuItem className="gap-2 text-orange-600" onClick={() => handleCreateCreditNote(invoice)}>
                            <RefreshCcw className="w-4 h-4" /> Annuler
                          </DropdownMenuItem>
                        )}
                        {user?.role === 'admin' && (
                          <>
                            <div className="h-px bg-border my-1" />
                            <DropdownMenuItem className="gap-2 text-destructive" onClick={() => handleDelete(invoice.id)}>
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
      )}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className="max-w-[900px] max-h-[90vh] overflow-y-auto p-0 border-none bg-white">
          <VisuallyHidden>
            <DialogTitle>Impression de la facture {selectedInvoice?.number}</DialogTitle>
          </VisuallyHidden>
          <div className="no-print p-4 bg-gray-50 border-b flex justify-between items-center sticky top-0 z-10">
            <h2 className="font-bold text-black">Aperçu avant impression</h2>
            <Button onClick={() => {
                if ((window as any).electron) {
                    (window as any).electron.print();
                } else {
                    window.print();
                }
            }} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
              <Printer className="w-4 h-4" /> Lancer l'impression
            </Button>
          </div>
          {selectedInvoice && <PrintableDocument document={selectedInvoice} type="facture" />}
        </DialogContent>
      </Dialog>

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
              <Label htmlFor="payment-amount" className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Montant encaissé (XAF)</Label>
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
                    <SelectItem value="cash">Espèces / Cash</SelectItem>
                    <SelectItem value="cheque">Chèques</SelectItem>
                  <SelectItem value="virement">Virement Bancaire</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={confirmPayment} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11">
              Valider l'encaissement
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {previewInvoice && (
        <DocumentPreview
          open={!!previewInvoice}
          onOpenChange={(open) => !open && setPreviewInvoice(null)}
          type="Invoice"
          data={previewInvoice}
        />
      )}
    </div>
  )
}
