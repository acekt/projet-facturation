"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
  BookOpen,
  Plus,
  Minus,
  Download,
  Search,
  Filter,
  ArrowDownRight,
  ArrowUpRight,
  Trash2,
  Wallet,
  TrendingUp,
  TrendingDown,
  CreditCard,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Badge } from "@workspace/ui/components/badge"
import { toast } from "sonner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { LedgerEntryDialog } from "./ledger/LedgerEntryDialog"
import { CreationSuccessModal } from "@/components/features/common/CreationSuccessModal"
import { getLedgerEntriesAction, getLedgerSummaryAction, deleteLedgerEntryAction } from "@/app/actions/ledger.actions"
import type { LedgerEntry, LedgerSummary } from "@/lib/repositories/LedgerRepository"

const CATEGORIES = [
  "Toutes les catégories",
  "Ventes & Facturation",
  "Loyer & Charges",
  "Électricité & Eau",
  "Internet & Télécom",
  "Transport & Carburant",
  "Fournitures & Matériel",
  "Salaires & Rémunérations",
  "Impôts & Taxes",
  "Approvisionnement Stock",
  "Autre"
]

export function LedgerPage() {
  const [entries, setEntries] = React.useState<LedgerEntry[]>([])
  const [summary, setSummary] = React.useState<LedgerSummary | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  // Filtres
  const [currentMonth, setCurrentMonth] = React.useState(new Date().toISOString().slice(0, 7))
  const [activeTab, setActiveTab] = React.useState<"ALL" | "IN" | "OUT">("ALL")
  const [categoryFilter, setCategoryFilter] = React.useState("Toutes les catégories")
  const [searchQuery, setSearchQuery] = React.useState("")

  // Modales
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [dialogType, setDialogType] = React.useState<'IN' | 'OUT'>('IN')
  const [successModalOpen, setSuccessModalOpen] = React.useState(false)
  const [lastCreatedEntry, setLastCreatedEntry] = React.useState<LedgerEntry | null>(null)

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const filterParams = {
        month: currentMonth || undefined,
        type: activeTab === "ALL" ? undefined : activeTab,
        category: categoryFilter === "Toutes les catégories" ? undefined : categoryFilter,
        search: searchQuery || undefined
      }

      const [entriesRes, summaryRes] = await Promise.all([
        getLedgerEntriesAction(filterParams),
        getLedgerSummaryAction({ month: currentMonth || undefined })
      ])

      if (entriesRes.success && entriesRes.data) {
        setEntries(entriesRes.data)
      }
      if (summaryRes.success && summaryRes.data) {
        setSummary(summaryRes.data)
      }
    } catch (e) {
      toast.error("Impossible de charger le livre des comptes.");
    } finally {
      setIsLoading(false)
    }
  }, [currentMonth, activeTab, categoryFilter, searchQuery, toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleDelete = async (id: string) => {
    const res = await deleteLedgerEntryAction(id)
    if (res.success) {
      toast.success("L'écriture a été supprimée.");
      fetchData()
    } else {
      toast.error(res.error || "Échec de la suppression.");
    }
  }

  const handleExportCSV = () => {
    if (!entries.length) {
      toast.info("Aucune donnée à exporter.");
      return
    }

    const headers = ["Date", "Nature", "Catégorie", "Libellé", "Tiers", "Mode", "Référence", "Montant (FCFA)"]
    const rows = entries.map(e => [
      e.date,
      e.type === 'IN' ? 'Entrée' : 'Sortie',
      e.category,
      e.description,
      e.counterparty || '',
      e.paymentMethod,
      e.reference || '',
      e.amount.toString()
    ])

    const csvContent = [headers, ...rows].map(e => e.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n")
    // BOM pour Excel
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `livre_comptes_${currentMonth || 'tout'}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatAmount = (val: number) => new Intl.NumberFormat('fr-FR').format(val) + " FCFA"

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-primary" />
            Livre des Comptes
          </h1>
          <p className="text-muted-foreground mt-1">
            Suivi quotidien des entrées (recettes), des sorties (dépenses) et de la trésorerie.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
            onClick={() => { setDialogType('IN'); setDialogOpen(true); }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle Recette (Entrée)
          </Button>
          <Button
            variant="outline"
            className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:text-rose-800"
            onClick={() => { setDialogType('OUT'); setDialogOpen(true); }}
          >
            <Minus className="w-4 h-4 mr-2" />
            Nouvelle Dépense (Sortie)
          </Button>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Exporter CSV
          </Button>
        </div>
      </div>

      {/* Barre Temporelle */}
      <div className="flex items-center gap-4 bg-card p-3 rounded-xl border border-border shadow-sm overflow-x-auto">
        <Button variant="outline" size="sm" onClick={() => {
          if (!currentMonth) return;
          const d = new Date(currentMonth + '-01');
          d.setMonth(d.getMonth() - 1);
          setCurrentMonth(d.toISOString().slice(0, 7));
        }}>
          &lt; Mois précédent
        </Button>
        <Input
          type="month"
          value={currentMonth}
          onChange={(e) => setCurrentMonth(e.target.value)}
          className="w-48"
        />
        <Button variant="outline" size="sm" onClick={() => {
          if (!currentMonth) return;
          const d = new Date(currentMonth + '-01');
          d.setMonth(d.getMonth() + 1);
          setCurrentMonth(d.toISOString().slice(0, 7));
        }}>
          Mois suivant &gt;
        </Button>

        <div className="w-px h-6 bg-border mx-2" />

        <Input
          type="date"
          onChange={(e) => {
            if (e.target.value) {
              setSearchQuery(e.target.value)
            }
          }}
          placeholder="Date précise"
          className="w-48"
          title="Filtre par date précise"
        />

        <Button variant="ghost" onClick={() => {
          setCurrentMonth("")
          setSearchQuery("")
        }}>Tout afficher</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-emerald-50/50 border-emerald-100 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-emerald-800 text-sm font-medium">Total Recettes (Entrées)</CardTitle>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">{formatAmount(summary?.totalIn || 0)}</div>
            <p className="text-xs text-emerald-600/80 mt-1">{summary?.countIn || 0} entrées sur la période</p>
          </CardContent>
        </Card>

        <Card className="bg-rose-50/50 border-rose-100 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-rose-800 text-sm font-medium">Total Dépenses (Sorties)</CardTitle>
            <TrendingDown className="w-4 h-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-700">{formatAmount(summary?.totalOut || 0)}</div>
            <p className="text-xs text-rose-600/80 mt-1">{summary?.countOut || 0} sorties sur la période</p>
          </CardContent>
        </Card>

        <Card className="bg-indigo-50/50 border-indigo-100 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-indigo-800 text-sm font-medium">Solde Net de Trésorerie</CardTitle>
            <Wallet className="w-4 h-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-indigo-700">{formatAmount(summary?.netBalance || 0)}</div>
              {(summary?.netBalance ?? 0) >= 0 ? (
                <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">Excédent</Badge>
              ) : (
                <Badge variant="outline" className="bg-rose-100 text-rose-800 border-rose-200">Déficit</Badge>
              )}
            </div>
            <p className="text-xs text-indigo-600/80 mt-1">Entrées − Sorties</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-muted-foreground text-sm font-medium">Modes de Paiement</CardTitle>
            <CreditCard className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-1">
              {summary && Object.entries(summary.byPaymentMethod).length > 0 ? (
                Object.entries(summary.byPaymentMethod).slice(0, 3).map(([method, amount]) => (
                  <div key={method} className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground truncate">{method}</span>
                    <span className="font-medium tabular-nums">{formatAmount(amount)}</span>
                  </div>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">Aucune donnée</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres & Recherche */}
      <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden min-h-[400px]">
        <div className="p-4 border-b border-border space-y-4">
          <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
            <TabsList>
              <TabsTrigger value="ALL">Tous les flux</TabsTrigger>
              <TabsTrigger value="IN">Entrées / Recettes</TabsTrigger>
              <TabsTrigger value="OUT">Sorties / Dépenses</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher (libellé, tiers, référence)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[250px]">
                <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tableau */}
        <div className="flex-1 overflow-auto p-0">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Nature</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Libellé / Motif</TableHead>
                <TableHead>Tiers / Bénéficiaire</TableHead>
                <TableHead>Règlement</TableHead>
                <TableHead>Référence</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(entry => {
                const isIncome = entry.type === 'IN'
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">{entry.date}</TableCell>
                    <TableCell>
                      {isIncome ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none gap-1">
                          Entrée <ArrowDownRight className="w-3 h-3" />
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 border-none gap-1">
                          Sortie <ArrowUpRight className="w-3 h-3" />
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{entry.category}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate" title={entry.description}>{entry.description}</TableCell>
                    <TableCell>{entry.counterparty || '-'}</TableCell>
                    <TableCell>{entry.paymentMethod}</TableCell>
                    <TableCell>{entry.reference || '-'}</TableCell>
                    <TableCell className={`text-right font-bold tabular-nums whitespace-nowrap ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isIncome ? '+' : '-'} {formatAmount(entry.amount)}
                    </TableCell>
                    <TableCell>
                      {!entry.linkedInvoiceId && !entry.linkedPaymentId && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer l'écriture ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Êtes-vous sûr de vouloir supprimer cette {isIncome ? 'recette' : 'dépense'} de {formatAmount(entry.amount)} ? Cette action est irréversible.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => handleDelete(entry.id)}>
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
              {!isLoading && entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                    Aucune écriture trouvée pour cette période.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <LedgerEntryDialog
        isOpen={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultType={dialogType}
        onSuccess={(entry) => {
          setLastCreatedEntry(entry)
          setSuccessModalOpen(true)
          fetchData()
        }}
      />

      <CreationSuccessModal
        isOpen={successModalOpen}
        onOpenChange={setSuccessModalOpen}
        title={lastCreatedEntry?.type === 'IN' ? 'Recette enregistrée' : 'Dépense enregistrée'}
        subtitle={`L'écriture a été ajoutée avec succès au livre des comptes.`}
        details={[
          { label: "Catégorie", value: lastCreatedEntry?.category || "" },
          { label: "Mode de règlement", value: lastCreatedEntry?.paymentMethod || "" },
          { label: "Montant", value: formatAmount(lastCreatedEntry?.amount || 0), isAmount: true },
        ]}
        onClose={() => setSuccessModalOpen(false)}
      />
    </div>
  )
}
