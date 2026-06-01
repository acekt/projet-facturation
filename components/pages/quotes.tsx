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
  XCircle,
  Eye,
  Edit2,
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
import { useStore, type Quote } from "@/lib/store"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { DocumentPreview } from "@/components/document-preview"
import { PrintableDocument } from "@/components/printable-document"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Pagination } from "@/components/ui/pagination-custom"
import { pdf } from '@react-pdf/renderer'
import { PDFDocument } from "@/components/pdf-document"

interface QuotesPageProps {
  onCreateQuote: () => void
}

export function QuotesPage({ onCreateQuote }: QuotesPageProps) {
  const { quotes, setQuotes, settings, user } = useStore()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 10
  const [previewQuote, setPreviewQuote] = React.useState<Quote | null>(null)
  const [selectedQuote, setSelectedQuote] = React.useState<Quote | null>(null)
  const [isDownloading, setIsDownloading] = React.useState<string | null>(null)

  const filteredQuotes = React.useMemo(() => {
    return quotes.filter(
      (quote) =>
        quote.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        quote.clientName.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [quotes, searchQuery])

  const totalPages = Math.ceil(filteredQuotes.length / itemsPerPage)
  const paginatedQuotes = filteredQuotes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const getStatusBadge = (status: Quote['status']) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-slate-200">Brouillon</Badge>
      case "sent":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">Envoyé</Badge>
      case "invoiced":
        return <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">Facturé</Badge>
      case "rejected":
        return <Badge variant="secondary" className="bg-red-100 text-red-700 border-red-200">Refusé</Badge>
      default:
        return null
    }
  }

  const getStatusIcon = (status: Quote['status']) => {
    switch (status) {
      case "draft":
        return <Clock className="w-4 h-4 text-slate-500" />
      case "sent":
        return <AlertCircle className="w-4 h-4 text-blue-500" />
      case "invoiced":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case "rejected":
        return <XCircle className="w-4 h-4 text-red-500" />
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer ce devis ?")) return
    try {
      const response = await fetch(`/api/quotes/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete quote');
      }

      toast.success("Devis supprimé avec succès")

      const newQuotes = await fetch('/api/quotes').then(res => res.json())
      setQuotes(newQuotes)
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la suppression")
    }
  }

  const handleDownloadPDF = async (quote: Quote) => {
    try {
      setIsDownloading(quote.id)
      const blob = await pdf(<PDFDocument document={quote} type="devis" settings={settings} />).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `DEVIS_${quote.number}.pdf`
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

  const handleConvertToInvoice = async (quoteId: string) => {
    try {
      const response = await fetch('/api/quotes/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Conversion failed')
      }

      toast.success("Devis converti en facture avec succès")

      // Refresh data
      const [newQuotes, newInvoices] = await Promise.all([
        fetch('/api/quotes').then(res => res.json()),
        fetch('/api/invoices').then(res => res.json())
      ])

      setQuotes(newQuotes)
      useStore.getState().setInvoices(newInvoices)
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Devis</h1>
          <p className="text-muted-foreground mt-1">Gérez vos propositions commerciales et proformas</p>
        </div>
        {user?.role === 'user' && (
          <Button
            onClick={onCreateQuote}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Nouveau devis
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un devis (numéro, client)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground w-full md:max-w-md"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {paginatedQuotes.length > 0 ? (
          paginatedQuotes.map((quote, index) => (
            <motion.div
              key={quote.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="bg-card border-border hover:border-primary/30 transition-all group shadow-sm hover:shadow-md">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-foreground text-lg">{quote.number}</h3>
                          {getStatusBadge(quote.status)}
                        </div>
                        <div className="flex flex-col md:flex-row md:items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground/80">{quote.clientName}</span>
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {quote.date}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 md:gap-8">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Total TTC</p>
                        <p className="text-xl font-bold text-foreground">{formatCurrency(quote.total)}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" aria-label="Plus d'options">
                            <MoreVertical className="w-5 h-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                          <DropdownMenuItem className="gap-2" onClick={() => setPreviewQuote(quote)}>
                            <Eye className="w-4 h-4" /> Aperçu
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2" onClick={() => setSelectedQuote(quote)}>
                            <Printer className="w-4 h-4" /> Imprimer
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2"
                            onClick={() => handleDownloadPDF(quote)}
                            disabled={isDownloading === quote.id}
                          >
                            <Download className="w-4 h-4" />
                            {isDownloading === quote.id ? "Génération..." : "Télécharger PDF"}
                          </DropdownMenuItem>
                          {quote.status !== 'invoiced' && user?.role === 'user' && (
                            <>
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() => onCreateQuote()}
                            >
                              <Edit2 className="w-4 h-4" /> Modifier le devis
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="gap-2 text-primary font-medium"
                              onClick={() => handleConvertToInvoice(quote.id)}
                            >
                              <CheckCircle2 className="w-4 h-4" /> Convertir en facture
                            </DropdownMenuItem>
                            </>
                          )}
                          {useStore.getState().user?.role === 'admin' && (
                            <>
                            <div className="h-px bg-border my-1" />
                            <DropdownMenuItem
                                className="gap-2 text-destructive focus:text-destructive"
                                onClick={() => handleDelete(quote.id)}
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
          ))
        ) : (
          <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Aucun devis trouvé</h3>
            <p className="text-muted-foreground max-w-xs mx-auto mt-2">
              {searchQuery ? "Essayez d'ajuster vos critères de recherche." : "Commencez par créer votre premier devis professionnel."}
            </p>
            {!searchQuery && (
              <Button onClick={onCreateQuote} variant="outline" className="mt-6 gap-2">
                <Plus className="w-4 h-4" />
                Créer un devis
              </Button>
            )}
          </div>
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      {previewQuote && (
        <DocumentPreview
          open={!!previewQuote}
          onOpenChange={(open) => !open && setPreviewQuote(null)}
          type="Quote"
          data={previewQuote}
        />
      )}

      <Dialog open={!!selectedQuote} onOpenChange={() => setSelectedQuote(null)}>
        <DialogContent className="max-w-[900px] max-h-[90vh] overflow-y-auto p-0 border-none bg-white">
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
          {selectedQuote && <PrintableDocument document={selectedQuote} type="devis" />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
