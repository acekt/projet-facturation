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
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { PrintableDocument } from "@/components/printable-document"
import { DocumentPreview } from "@/components/document-preview"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { pdf } from '@react-pdf/renderer'
import { PDFDocument } from "@/components/pdf-document"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface InvoicesPageProps {
  onCreateInvoice: () => void
  onEditInvoice: (id: string) => void
}

export function InvoicesPage({ onCreateInvoice, onEditInvoice }: InvoicesPageProps) {
  const { invoices, setInvoices, setPayments, settings, setCreditNotes } = useStore()

  const [searchQuery, setSearchQuery] = React.useState("")
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
      setPaymentInvoice(invoice);
      setPaymentAmount(invoice.total.toString());
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
      const updatedNotes = await fetch('/api/credit-notes').then(res => res.json());
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
          try {
            const response = await fetch('/api/payments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  invoiceId: paymentInvoice.id,
                  amount: parseFloat(paymentAmount),
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

  const filteredInvoices = invoices.filter(
    (invoice) =>
      invoice.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.clientName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusBadge = (status: Invoice['status']) => {
    switch (status) {
      case "PAID":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">Payée</Badge>
      case "PARTIALLY_PAID":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200">Acompte</Badge>
      case "UNPAID":
        return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200">Impayée</Badge>
      case "overdue":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">En retard</Badge>
      case "draft":
        return <Badge variant="secondary" className="bg-slate-100 text-slate-700">Brouillon</Badge>
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

      <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une facture..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary/50 border-border text-foreground w-full md:max-w-md"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredInvoices.length > 0 ? (
          filteredInvoices.map((invoice, index) => (
            <motion.div
              key={invoice.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="bg-card border-border hover:border-primary/30 transition-all group shadow-sm">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-foreground text-lg">{invoice.number}</h3>
                          {getStatusBadge(invoice.status)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          <span className="font-medium text-foreground/80">{invoice.clientName}</span>
                          <span className="mx-2">•</span>
                          {invoice.date}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 md:gap-8">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Total TTC</p>
                        <p className="text-xl font-bold text-foreground">{formatCurrency(invoice.total)}</p>
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
                          {invoice.status !== 'PAID' && (
                            <DropdownMenuItem className="gap-2 text-emerald-600" onClick={() => markAsPaid(invoice)}>
                              <CheckCircle2 className="w-4 h-4" /> Enregistrer un règlement
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="gap-2 text-orange-600" onClick={() => handleCreateCreditNote(invoice)}>
                            <RefreshCcw className="w-4 h-4" /> Créer un avoir
                          </DropdownMenuItem>
                          <div className="h-px bg-border my-1" />
                          <DropdownMenuItem className="gap-2 text-destructive" onClick={() => handleDelete(invoice.id)}>
                            <Trash2 className="w-4 h-4" /> Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border">
            <h3 className="text-lg font-semibold text-foreground">Aucune facture trouvée</h3>
            <p className="text-muted-foreground mt-1">Les factures sont générées automatiquement lors de la confirmation d'un devis.</p>
          </div>
        )}
      </div>

      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className="max-w-[900px] max-h-[90vh] overflow-y-auto p-0 border-none bg-white">
          <div className="no-print p-4 bg-gray-50 border-b flex justify-between items-center sticky top-0 z-10">
            <h2 className="font-bold">Aperçu avant impression</h2>
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
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase font-bold tracking-wider">Type de règlement</Label>
                <Select value={paymentType} onValueChange={(val) => {
                    setPaymentType(val);
                    if (val === 'full' && paymentInvoice) setPaymentAmount(paymentInvoice.total.toString());
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
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="bg-secondary border-border h-11 font-bold text-lg"
                disabled={paymentType === 'full'}
              />
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
