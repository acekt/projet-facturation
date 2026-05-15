"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  Filter,
  Plus,
  MoreHorizontal,
  FileText,
  Eye,
  Edit,
  Trash2,
  Download,
  Send,
  Copy,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowUpDown,
  Receipt,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

import { useStore } from "@/lib/store"
import { formatCurrency, cn } from "@/lib/utils"

const getStatusBadge = (status: string) => {
  switch (status) {
    case "paid":
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20">
          <CheckCircle className="w-3 h-3 mr-1" />
          Paye
        </Badge>
      )
    case "pending":
      return (
        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20">
          <Clock className="w-3 h-3 mr-1" />
          En attente
        </Badge>
      )
    case "overdue":
      return (
        <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 hover:bg-red-500/20">
          <AlertCircle className="w-3 h-3 mr-1" />
          Retard
        </Badge>
      )
    case "draft":
      return (
        <Badge className="bg-secondary text-muted-foreground border-border hover:bg-secondary/80">
          <FileText className="w-3 h-3 mr-1" />
          Brouillon
        </Badge>
      )
    default:
      return null
  }
}

interface InvoicesPageProps {
  onCreateInvoice: () => void
}

export function InvoicesPage({ onCreateInvoice }: InvoicesPageProps) {
  const { invoices, deleteInvoice } = useStore()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [selectedInvoices, setSelectedInvoices] = React.useState<string[]>([])
  const [sortConfig, setSortConfig] = React.useState<{ key: string, direction: 'asc' | 'desc' | null }>({ key: 'date', direction: 'desc' })
  const [currentPage, setCurrentPage] = React.useState(1)
  const itemsPerPage = 10

  const filteredInvoices = React.useMemo(() => {
    let result = invoices.filter((invoice) => {
      const matchesSearch =
        invoice.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        invoice.clientName.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === "all" || invoice.status === statusFilter
      return matchesSearch && matchesStatus
    })

    if (sortConfig.direction) {
      result.sort((a: any, b: any) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }
    return result
  }, [invoices, searchQuery, statusFilter, sortConfig])

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter])

  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage)
  const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const toggleSelectAll = () => {
    if (selectedInvoices.length === filteredInvoices.length) {
      setSelectedInvoices([])
    } else {
      setSelectedInvoices(filteredInvoices.map((inv) => inv.id))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedInvoices((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Factures</h1>
          <p className="text-muted-foreground mt-1">Gerez vos factures et suivez les paiements</p>
        </div>
        <Button
          onClick={onCreateInvoice}
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          Nouvelle facture
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total factures</p>
                <p className="text-2xl font-bold text-foreground">{invoices.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Payees</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {invoices.filter(i => i.status === 'paid').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">En attente</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {invoices.filter(i => i.status === 'pending').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">En retard</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {invoices.filter(i => i.status === 'overdue').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher une facture..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground focus:border-primary"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px] bg-secondary border-border text-foreground">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="paid">Paye</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="overdue">En retard</SelectItem>
                <SelectItem value="draft">Brouillon</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="border-border text-foreground hover:bg-secondary">
              <Filter className="w-4 h-4 mr-2" />
              Plus de filtres
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="bg-card border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="p-4 text-left">
                  <Checkbox
                    checked={selectedInvoices.length === filteredInvoices.length && filteredInvoices.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th className="p-4 text-left">
                  <button 
                    onClick={() => handleSort('id')}
                    className="flex items-center gap-2 text-muted-foreground text-sm font-medium hover:text-foreground transition-colors"
                  >
                    Numero
                    <ArrowUpDown className={cn("w-3 h-3", sortConfig.key === 'id' && "text-primary")} />
                  </button>
                </th>
                <th className="p-4 text-left">
                  <button 
                    onClick={() => handleSort('clientName')}
                    className="flex items-center gap-2 text-muted-foreground text-sm font-medium hover:text-foreground transition-colors"
                  >
                    Client
                    <ArrowUpDown className={cn("w-3 h-3", sortConfig.key === 'clientName' && "text-primary")} />
                  </button>
                </th>
                <th className="p-4 text-left">
                  <button 
                    onClick={() => handleSort('amount')}
                    className="flex items-center gap-2 text-muted-foreground text-sm font-medium hover:text-foreground transition-colors"
                  >
                    Montant
                    <ArrowUpDown className={cn("w-3 h-3", sortConfig.key === 'amount' && "text-primary")} />
                  </button>
                </th>
                <th className="p-4 text-left">
                  <span className="text-muted-foreground text-sm font-medium">Statut</span>
                </th>
                <th className="p-4 text-left">
                  <button 
                    onClick={() => handleSort('date')}
                    className="flex items-center gap-2 text-muted-foreground text-sm font-medium hover:text-foreground transition-colors"
                  >
                    Date
                    <ArrowUpDown className={cn("w-3 h-3", sortConfig.key === 'date' && "text-primary")} />
                  </button>
                </th>
                <th className="p-4 text-left">
                  <span className="text-muted-foreground text-sm font-medium">Echeance</span>
                </th>
                <th className="p-4 text-right">
                  <span className="text-muted-foreground text-sm font-medium">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {paginatedInvoices.map((invoice, index) => (
                  <motion.tr
                    key={invoice.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.05 }}
                    className="border-b border-border group hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-4">
                      <Checkbox
                        checked={selectedInvoices.includes(invoice.id)}
                        onCheckedChange={() => toggleSelect(invoice.id)}
                      />
                    </td>
                    <td className="p-4">
                      <span className="text-foreground font-mono text-sm font-medium">{invoice.id}</span>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="text-foreground font-medium text-sm">{invoice.clientName}</p>
                        <p className="text-muted-foreground text-xs">{invoice.clientEmail}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-foreground font-semibold">{formatCurrency(invoice.amount)}</span>
                    </td>
                    <td className="p-4">{getStatusBadge(invoice.status)}</td>
                    <td className="p-4">
                      <span className="text-muted-foreground text-sm">{invoice.date}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-muted-foreground text-sm">{invoice.dueDate}</span>
                    </td>
                    <td className="p-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                            aria-label="Options de la facture"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border-border">
                          <DropdownMenuItem className="gap-2 cursor-pointer">
                            <Eye className="w-4 h-4" />
                            Voir
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer">
                            <Edit className="w-4 h-4" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer">
                            <Copy className="w-4 h-4" />
                            Dupliquer
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer">
                            <Send className="w-4 h-4" />
                            Envoyer
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer">
                            <Download className="w-4 h-4" />
                            Telecharger PDF
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => deleteInvoice(invoice.id)}
                            className="text-destructive focus:text-destructive gap-2 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">
            Affichage de <span className="text-foreground font-medium">{paginatedInvoices.length}</span> sur{" "}
            <span className="text-foreground font-medium">{filteredInvoices.length}</span> factures
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-border"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              aria-label="Page précédente"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <Button
                key={i}
                size="sm"
                variant={currentPage === i + 1 ? "default" : "ghost"}
                onClick={() => setCurrentPage(i + 1)}
                className={currentPage === i + 1 ? "bg-primary text-primary-foreground min-w-[36px]" : "min-w-[36px]"}
                aria-label={`Page ${i + 1}`}
              >
                {i + 1}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="border-border"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              aria-label="Page suivante"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
