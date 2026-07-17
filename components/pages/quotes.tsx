"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
  Plus,
  FileText,
  MoreVertical,
  Download,
  Printer,
  Trash2,
  Clock,
  CheckCircle2,
  Eye,
  Edit2,
  Calendar,
  DownloadCloud,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useStore, type Quote } from "@/lib/store"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toast } from "sonner"
import { DocumentPreview } from "@/components/document-preview"
import { PrintableDocument } from "@/components/printable-document"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { VisuallyHidden } from "@/components/ui/visually-hidden"
import { Pagination } from "@/components/ui/pagination-custom"
import { EmptyState } from "@/components/ui/empty-state"
import { pdf } from '@react-pdf/renderer'
import { PDFDocument } from "@/components/pdf-document"
// ── Design System
import { PageHeader } from "@/components/ui/page-header"
import { SearchBar } from "@/components/ui/search-bar"
import { StatusBadge, getQuoteStatusVariant } from "@/components/ui/status-badge"
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
import { ViewFormatSelector } from "@/components/ui/view-format-selector"
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

interface QuotesPageProps {
  onCreateQuote: (id?: string) => void
}

export function QuotesPage({ onCreateQuote }: QuotesPageProps) {
  const quotes = useStore(state => state.quotes)
  const setQuotes = useStore(state => state.setQuotes)
  const setInvoices = useStore(state => state.setInvoices)
  const settings = useStore(state => state.settings)
  const user = useStore(state => state.user)
  const viewFormat = useStore(state => state.viewFormat)
  const isDataLoaded = useStore(state => state.isDataLoaded)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 10
  const [previewQuote, setPreviewQuote] = React.useState<Quote | null>(null)
  const [selectedQuote, setSelectedQuote] = React.useState<Quote | null>(null)
  const [isDownloading, setIsDownloading] = React.useState<string | null>(null)
  const [quoteToDeleteId, setQuoteToDeleteId] = React.useState<string | null>(null)
  // [P2-A] Protège le bouton d'impression contre le double-clic accidentel
  const [isPrinting, setIsPrinting] = React.useState(false)
  const [statusFilter, setStatusFilter] = React.useState<string>("all")

  const filteredQuotes = React.useMemo(() => {
    return quotes.filter(
      (quote) => {
        const matchesSearch = quote.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              quote.clientName.toLowerCase().includes(searchQuery.toLowerCase())
        if (statusFilter === "all") return matchesSearch
        return matchesSearch && quote.status === statusFilter
      }
    )
  }, [quotes, searchQuery, statusFilter])

  const totalPages = Math.ceil(filteredQuotes.length / itemsPerPage)
  const paginatedQuotes = filteredQuotes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter])

  if (!isDataLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-medium">Chargement des devis...</p>
        </div>
      </div>
    )
  }

  // Supprimé : getStatusBadge() remplacé par <StatusBadge /> du Design System

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/quotes/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Delete failed')
      toast.success("Devis supprimé")
      setQuoteToDeleteId(null)
      const updatedQuotes = await fetch('/api/quotes').then(res => res.json())
      setQuotes(updatedQuotes)
    } catch (error) {
      toast.error("Erreur lors de la suppression")
    }
  }

  const handleDownloadPDF = async (quote: Quote) => {
    try {
      setIsDownloading(quote.id)
      const { pdf } = await import('@react-pdf/renderer')
      const { PDFDocument } = await import('@/components/pdf-document')
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
      setInvoices(newInvoices)
    } catch (error: any) {
      toast.error(`Erreur: ${error.message}`)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden space-y-6">
      {/* ── En-tête de page (Design System) */}
      <PageHeader
        title="Devis"
        description="Gérez vos propositions commerciales et proformas"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                const headers = ["Numero", "Client", "Date", "Total", "Statut"];
                const rows = paginatedQuotes.map(q => [q.number, q.clientName, q.date, q.total, q.status]);
                const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.setAttribute("download", `devis_${new Date().toISOString().split('T')[0]}.csv`);
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
                onClick={() => onCreateQuote()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-lg shadow-primary/20"
              >
                <Plus className="w-4 h-4" />
                Nouveau devis
              </Button>
            )}
          </>
        }
      />

      {/* ── Barre de recherche et filtres */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex-1">
          <SearchBar
            placeholder="Rechercher un devis (numéro, client)..."
            value={searchQuery}
            onChange={setSearchQuery}
            viewFormatKey="quotes"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
            className="rounded-full"
          >
            Tous
          </Button>
          <Button
            variant={statusFilter === 'EN_ATTENTE' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('EN_ATTENTE')}
            className="rounded-full"
          >
            En Attente
          </Button>
          <Button
            variant={statusFilter === 'CONVERTI' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('CONVERTI')}
            className="rounded-full"
          >
            Converti
          </Button>
        </div>
      </div>

      {/* ── Vue Tableau (Design System) */}
      {(!viewFormat.quotes || viewFormat.quotes === 'table') && (
        <DataTable>
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>Devis</DataTableHeaderCell>
              <DataTableHeaderCell>Client</DataTableHeaderCell>
              <DataTableHeaderCell>Date</DataTableHeaderCell>
              <DataTableHeaderCell>Statut</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Total</DataTableHeaderCell>
              <DataTableHeaderCell align="right">Actions</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {paginatedQuotes.map((quote) => (
              <DataTableRow key={quote.id}>
                <DataTableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-primary/5 flex items-center justify-center text-primary flex-shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <span className="font-medium text-sm text-foreground">{quote.number}</span>
                  </div>
                </DataTableCell>
                <DataTableCell truncate title={quote.clientName}>
                  {quote.clientName}
                </DataTableCell>
                <DataTableCell>
                  <span className="text-xs text-muted-foreground">Émission : {formatDate(quote.date)}</span>
                </DataTableCell>
                <DataTableCell>
                  <StatusBadge variant={getQuoteStatusVariant(quote.status as any)} />
                </DataTableCell>
                <AmountCell amount={quote.total} />
                <ActionsCell>
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
                      {quote.status !== 'CONVERTI' && user?.role === 'user' && quote.created_by === user?.id && (
                        <>
                          <DropdownMenuItem className="gap-2" onClick={() => onCreateQuote(quote.id)}>
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
                      {user?.role === 'user' && quote.created_by === user?.id && (
                        <>
                          <div className="h-px bg-border my-1" />
                          <DropdownMenuItem
                            className="gap-2 text-destructive focus:text-destructive"
                            onClick={() => setQuoteToDeleteId(quote.id)}
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
      {(!viewFormat.quotes || viewFormat.quotes === 'table') && paginatedQuotes.length === 0 && (
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
                          <StatusBadge variant={getQuoteStatusVariant(quote.status as any)} />
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
                          {quote.status !== 'CONVERTI' && user?.role === 'user' && quote.created_by === user?.id && (
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
                          {user?.role === 'user' && quote.created_by === user?.id && (
                            <>
                            <div className="h-px bg-border my-1" />
                            <DropdownMenuItem
                                className="gap-2 text-destructive focus:text-destructive"
                                onClick={() => setQuoteToDeleteId(quote.id)}
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
                    <StatusBadge variant={getQuoteStatusVariant(quote.status as any)} />
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
                        {quote.status !== 'CONVERTI' && user?.role === 'user' && quote.created_by === user?.id && (
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
                        {user?.role === 'user' && quote.created_by === user?.id && (
                          <>
                            <div className="h-px bg-border my-1" />
                            <DropdownMenuItem
                                className="gap-2 text-destructive focus:text-destructive"
                                onClick={() => setQuoteToDeleteId(quote.id)}
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

      <AlertDialog open={quoteToDeleteId !== null} onOpenChange={(open) => !open && setQuoteToDeleteId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce devis ? Cette action appliquera un Soft Delete.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => quoteToDeleteId && handleDelete(quoteToDeleteId)}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            <Button
              disabled={isPrinting}
              onClick={async () => {
                setIsPrinting(true)
                try {
                  if (window.electron) {
                    await window.electron.print()
                  } else {
                    window.print()
                  }
                } catch (err) {
                  console.error('[Print] IPC error:', err)
                  toast.error("Erreur lors du lancement de l'impression")
                } finally {
                  setIsPrinting(false)
                }
              }}
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Printer className={`w-4 h-4 ${isPrinting ? 'animate-spin' : ''}`} />
              {isPrinting ? 'En cours...' : "Lancer l'impression"}
            </Button>
          </div>
          {selectedQuote && <PrintableDocument document={selectedQuote} type="devis" />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
