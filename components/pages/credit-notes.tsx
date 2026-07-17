"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
  FileText,
  Download,
  Search,
  RefreshCcw,
  MoreVertical,
  DownloadCloud,
} from "lucide-react"
import { ViewFormatSelector } from "@/components/ui/view-format-selector"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useStore, type CreditNote } from "@/lib/store"
import { formatCurrency, formatDate } from "@/lib/utils"
import { toast } from "sonner"
import { Pagination } from "@/components/ui/pagination-custom"
import { cn } from "@/lib/utils"

export function CreditNotesPage() {
  const creditNotes = useStore(state => state.creditNotes)
  const settings = useStore(state => state.settings)
  const viewFormat = useStore(state => state.viewFormat)
  const setViewFormat = useStore(state => state.setViewFormat)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 10
  const [isDownloading, setIsDownloading] = React.useState<string | null>(null)

  const filtered = React.useMemo(() => {
    return creditNotes.filter(
        (n) =>
          n.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.clientName.toLowerCase().includes(searchQuery.toLowerCase())
      )
  }, [creditNotes, searchQuery])

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const handleDownloadPDF = async (note: CreditNote) => {
    try {
      setIsDownloading(note.id)
      const { pdf } = await import('@react-pdf/renderer')
      const { PDFDocument } = await import('@/components/pdf-document')
      const blob = await pdf(<PDFDocument document={note} type="avoir" settings={settings} />).toBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `AVOIR_${note.number}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast.success("Téléchargement démarré")
    } catch (error) {
      toast.error("Erreur PDF")
    } finally {
      setIsDownloading(null)
    }
  }

  const format = viewFormat.creditNotes || 'horizontal'

  return (
    <div className="flex-1 flex flex-col overflow-hidden space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Avoirs</h1>
          <p className="text-muted-foreground mt-1">Consultez les notes d'avoir émises (annulations)</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              const headers = ["Numero", "Client", "Montant", "Date", "Motif"];
              const rows = creditNotes.map(c => [c.number, c.clientName, c.total || (c as any).amount || 0, c.date, c.reason || '']);
              const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const link = document.createElement("a");
              link.href = URL.createObjectURL(blob);
              link.setAttribute("download", `avoirs_${new Date().toISOString().split('T')[0]}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="gap-2 hidden sm:flex"
          >
            <DownloadCloud className="w-4 h-4" />
            Export CSV
          </Button>
          <ViewFormatSelector
            currentFormat={format as 'table' | 'horizontal' | 'block'}
            onFormatChange={(f: 'table' | 'horizontal' | 'block') => setViewFormat('creditNotes', f)}
          />
        </div>
      </div>

      <div className="flex items-center gap-4 bg-card p-4 rounded-xl border border-border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un avoir..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary/50 border-border text-foreground w-full md:max-w-md"
          />
        </div>
      </div>

      {format === 'table' ? (
        <div className="flex-1 overflow-auto bg-card rounded-xl border border-border shadow-sm">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground bg-secondary/50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-medium">Numéro</th>
                <th className="px-6 py-4 font-medium">Client</th>
                <th className="px-6 py-4 font-medium text-right">Montant</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.map((note) => (
                <tr key={note.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4 font-medium whitespace-nowrap">{note.number}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{note.clientName}</td>
                  <td className="px-6 py-4 text-right whitespace-nowrap font-medium text-primary">
                    {formatCurrency(note.total)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-muted-foreground">
                    {formatDate(note.date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => handleDownloadPDF(note)}
                      disabled={isDownloading === note.id}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      PDF
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {paginated.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              Aucun avoir émis.
            </div>
          )}
        </div>
      ) : format === 'horizontal' ? (
        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          <div className="grid grid-cols-1 gap-4">
          {paginated.length > 0 ? (
            paginated.map((note, index) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="bg-card border-border hover:border-orange-200 transition-all group shadow-sm">
                  <CardContent className="p-4 md:p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600">
                          <RefreshCcw className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-bold text-foreground text-lg">{note.number}</h3>
                          <p className="text-sm text-muted-foreground">
                            Pour {note.clientName} • {formatDate(note.date)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="text-right hidden sm:block">
                          <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold text-orange-600">Montant Avoir</p>
                          <p className="text-xl font-bold text-foreground">{formatCurrency(note.total)}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => handleDownloadPDF(note)}
                          disabled={isDownloading === note.id}
                        >
                          <Download className="w-4 h-4" />
                          {isDownloading === note.id ? "..." : "PDF"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border">
              <h3 className="text-lg font-semibold text-foreground tracking-tight uppercase">Aucun avoir émis</h3>
              <p className="text-muted-foreground mt-1">Créez un avoir depuis le menu d'une facture pour l'annuler.</p>
            </div>
          )}
        </div>
        </div>
      ) : format === 'block' ? (
        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginated.length > 0 ? (
            paginated.map((note, index) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="bg-card border-border hover:border-orange-200 transition-all group shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 group-hover:bg-orange-200 transition-colors">
                        <RefreshCcw className="w-5 h-5" />
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                          <DropdownMenuItem className="gap-2" onClick={() => handleDownloadPDF(note)} disabled={isDownloading === note.id}>
                            <Download className="w-4 h-4" />
                            {isDownloading === note.id ? "Génération..." : "Télécharger PDF"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <h3 className="font-bold text-sm mb-1">{note.number}</h3>
                    <p className="text-xs text-muted-foreground mb-2">{note.clientName}</p>
                    <div className="space-y-1 mb-3">
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <FileText className="w-3 h-3" />
                        <span>Date: {formatDate(note.date)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-border/50">
                      <p className="text-lg font-semibold text-foreground tracking-tighter">{formatCurrency(note.total)}</p>
                      <Badge className="bg-orange-100 text-orange-700 text-[10px] px-2 py-0 h-5 border-orange-200">Avoir</Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full text-center py-20 bg-card rounded-2xl border border-dashed border-border">
              <h3 className="text-lg font-semibold text-foreground tracking-tight uppercase">Aucun avoir émis</h3>
              <p className="text-muted-foreground mt-1">Créez un avoir depuis le menu d'une facture pour l'annuler.</p>
            </div>
          )}
        </div>
        </div>
      ) : null}

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  )
}
