"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
  FileText,
  Download,
  Search,
  RefreshCcw,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useStore, type CreditNote } from "@/lib/store"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"
import { pdf } from '@react-pdf/renderer'
import { PDFDocument } from "@/components/pdf-document"
import { Pagination } from "@/components/ui/pagination-custom"

export function CreditNotesPage() {
  const { creditNotes, settings } = useStore()
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Avoirs</h1>
        <p className="text-muted-foreground mt-1">Consultez les notes d'avoir émises (annulations)</p>
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
                          Pour {note.clientName} • {note.date}
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
            <h3 className="text-lg font-semibold text-foreground">Aucun avoir émis</h3>
            <p className="text-muted-foreground mt-1">Créez un avoir depuis le menu d'une facture pour l'annuler.</p>
          </div>
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  )
}
