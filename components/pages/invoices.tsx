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
import { useStore, type Invoice } from "@/lib/store"
import { formatCurrency } from "@/lib/utils"
import { toast } from "sonner"

interface InvoicesPageProps {
  onCreateInvoice: () => void
}

export function InvoicesPage({ onCreateInvoice }: InvoicesPageProps) {
  const { invoices } = useStore()
  const [searchQuery, setSearchQuery] = React.useState("")

  const filteredInvoices = invoices.filter(
    (invoice) =>
      invoice.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.clientName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getStatusBadge = (status: Invoice['status']) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">Payée</Badge>
      case "pending":
        return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200">En attente</Badge>
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
        <Button
          onClick={onCreateInvoice}
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          Nouvelle facture
        </Button>
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
                          <Button variant="ghost" size="icon" className="text-muted-foreground">
                            <MoreVertical className="w-5 h-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-card border-border">
                          <DropdownMenuItem className="gap-2">
                            <Printer className="w-4 h-4" /> Imprimer
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2">
                            <Download className="w-4 h-4" /> PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2">
                            <CheckCircle2 className="w-4 h-4" /> Marquer comme payée
                          </DropdownMenuItem>
                          <div className="h-px bg-border my-1" />
                          <DropdownMenuItem className="gap-2 text-destructive">
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
            <p className="text-muted-foreground mt-1">Créez votre première facture pour commencer.</p>
          </div>
        )}
      </div>
    </div>
  )
}
