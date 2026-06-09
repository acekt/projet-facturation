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
import { Badge } from "@/components/ui/badge"
import { useStore, type Quote } from "@/lib/store"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toast } from "sonner"
import { DocumentPreview } from "@/components/document-preview"
import { PrintableDocument } from "@/components/printable-document"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { VisuallyHidden } from "@/components/ui/visually-hidden"
import { Pagination } from "@/components/ui/pagination-custom"
import { EmptyState } from "@/components/ui/empty-state"
import { ViewFormatSelector } from "@/components/ui/view-format-selector"
import { pdf } from '@react-pdf/renderer'
import { PDFDocument } from "@/components/pdf-document"

interface QuotesPageProps {
  onCreateQuote: (id?: string) => void
}

export function QuotesPage({ onCreateQuote }: QuotesPageProps) {
  const quotes = useStore(state => state.quotes)
  const setQuotes = useStore(state => state.setQuotes)
  const settings = useStore(state => state.settings)
  const user = useStore(state => state.user)
  const viewFormat = useStore(state => state.viewFormat)
  const setViewFormat = useStore(state => state.setViewFormat)
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
      case "EN_ATTENTE":
        return <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200">En Attente</Badge>
      case "CONVERTI":
        return <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">Converti</Badge>
      default:
        return null
    }
  }

  const getStatusIcon = (status: Quote['status']) => {
    switch (status) {
      case "EN_ATTENTE":
        return <Clock className="w-4 h-4 text-amber-500" />
      case "CONVERTI":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      default:
        return null
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
    <div className="flex-1 flex flex-col overflow-hidden space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Devis</h1>
          <p className="text-muted-foreground mt-1">Gérez vos propositions commerciales et proformas</p>
        </div>
        {user?.role === 'user' && (
          <Button
            onClick={() => onCreateQuote()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Nouveau devis
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un devis (numéro, client)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground w-full md:max-w-md"
          />
        </div>
        <ViewFormatSelector
          currentFormat={viewFormat.quotes}
          onFormatChange={(format: 'table' | 'horizontal' | 'block') => setViewFormat('quotes', format)}
        />
      </div>

      {viewFormat.quotes === 'table' && (
        <div className="flex-1 min-h-0 bg-card rounded-xl border border-border overflow-auto shadow-sm">
          <table className="w-full min-w-[600px]">
            <thead className="bg-secondary/50">
              <tr>
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Devis</th>
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Client</th>
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Dates</th>
                <th className="text-left p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Statut</th>
                <th className="text-right p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Total</th>
                <th className="text-right p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {paginatedQuotes.map((quote) => (
                <tr key={quote.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <FileText className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-sm">{quote.number}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{quote.clientName}</td>
                  <td className="p-4">
                    <div className="text-xs text-muted-foreground">
                      <div>Émission: {formatDate(quote.date)}</div>
                    </div>
                  </td>
                  <td className="p-4">{getStatusBadge(quote.status)}</td>
                  <td className="p-4 text-right font-bold text-sm">{formatCurrency(quote.total)}</td>
                  <td className="p-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                          <MoreVertical className="w-4 h-4" />
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
                        {quote.status !== 'CONVERTI' && user?.role === 'user' && (
                          <>
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() => onCreateQuote(quote.id)}
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {paginatedQuotes.length === 0 && (
            <div className="p-8 text-center">
              <EmptyState
                icon={FileText}
                title={searchQuery ? "Aucun devis trouvé" : "Aucun devis"}
                description={searchQuery ? "Aucun devis ne correspond à votre recherche." : "Créez votre premier devis pour commencer."}
                actionLabel={!searchQuery && user?.role === 'user' ? "Nouveau devis" : undefined}
                onAction={!searchQuery && user?.role === 'user' ? () => onCreateQuote() : undefined}
              />
            </div>
          )}
        </div>
      )}

      {viewFormat.quotes === 'horizontal' && (
        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          <div className="grid grid-cols-1 gap-4">
          {paginatedQuotes.map((quote, index) => (
            <motion.div
              key={quote.id}
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
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-foreground text-sm">{quote.number}</h3>
                          {getStatusBadge(quote.status)}
                        </div>
                        <div className="flex flex-col md:flex-row md:items-center gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground/80 uppercase tracking-tighter">{quote.clientName}</span>
                          <span className="flex items-center gap-1 opacity-60">
                            <Clock className="w-3 h-3" />
                            Émission: {formatDate(quote.date)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 md:gap-6">
                      <div className="text-right hidden sm:block">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-semibold">Total TTC</p>
                        <p className="text-lg font-semibold text-foreground tracking-tighter">{formatCurrency(quote.total)}</p>
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
                          {quote.status !== 'CONVERTI' && user?.role === 'user' && (
                            <>
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() => onCreateQuote(quote.id)}
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
          ))}
          {paginatedQuotes.length === 0 && (
            <EmptyState
              icon={FileText}
              title={searchQuery ? "Aucun devis trouvé" : "Aucun devis"}
              description={searchQuery ? "Aucun devis ne correspond à votre recherche." : "Créez votre premier devis pour commencer."}
              actionLabel={!searchQuery && user?.role === 'user' ? "Nouveau devis" : undefined}
              onAction={!searchQuery && user?.role === 'user' ? () => onCreateQuote() : undefined}
            />
          )}
        </div>
        </div>
      )}

      {viewFormat.quotes === 'block' && (
        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedQuotes.map((quote, index) => (
            <motion.div
              key={quote.id}
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
                    {getStatusBadge(quote.status)}
                  </div>
                  <h3 className="font-bold text-sm mb-1">{quote.number}</h3>
                  <p className="text-xs text-muted-foreground mb-2">{quote.clientName}</p>
                  <div className="space-y-1 mb-3">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>Émission: {formatDate(quote.date)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-border/50">
                    <p className="text-lg font-semibold text-foreground tracking-tighter">{formatCurrency(quote.total)}</p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                          <MoreVertical className="w-4 h-4" />
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
                        {quote.status !== 'CONVERTI' && user?.role === 'user' && (
                          <>
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() => onCreateQuote(quote.id)}
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
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {paginatedQuotes.length === 0 && (
            <div className="col-span-full">
              <EmptyState
                icon={FileText}
                title={searchQuery ? "Aucun devis trouvé" : "Aucun devis"}
                description={searchQuery ? "Aucun devis ne correspond à votre recherche." : "Créez votre premier devis pour commencer."}
                actionLabel={!searchQuery && user?.role === 'user' ? "Nouveau devis" : undefined}
                onAction={!searchQuery && user?.role === 'user' ? () => onCreateQuote() : undefined}
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
          <VisuallyHidden>
            <DialogTitle>Impression du devis {selectedQuote?.number}</DialogTitle>
            <DialogDescription>Aperçu du devis avant impression physique ou PDF</DialogDescription>
          </VisuallyHidden>
          <div className="no-print p-4 bg-gray-50 border-b flex justify-between items-center sticky top-0 z-10">
            <h2 className="font-bold text-black">Aperçu avant impression</h2>
            <Button onClick={async () => {
                if (window.electron) {
                    try {
                        await window.electron.print();
                    } catch (err) {
                        console.error('[Print] IPC error:', err);
                        toast.error("Erreur lors du lancement de l'impression");
                    }
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
