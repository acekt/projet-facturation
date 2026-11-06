"use client"

import * as React from "react"
import {
  Plus,
  Minus,
  Download,
  Search,
  Filter,
  ArrowDownRight,
  ArrowUpRight,
  Trash2,
  MoreVertical,
  Eye,
  Shield,
  Image as ImageIcon,
  DownloadCloud,
  Loader2,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { DatePicker } from "@workspace/ui/components/date-picker"
import { Badge } from "@workspace/ui/components/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import { Pagination } from "@workspace/ui/components/pagination-custom"
import { PageHeader } from "@/components/features/common/PageHeader"
import { LedgerEntryDialog } from "./ledger/LedgerEntryDialog"
import { LedgerKPIs } from "./ledger/LedgerKPIs"
import { LedgerEntryDetailsDialog } from "./ledger/LedgerEntryDetailsDialog"
import { CreationSuccessModal } from "@/components/features/common/CreationSuccessModal"
import {
  getLedgerEntriesAction,
  getLedgerSummaryAction,
  deleteLedgerEntryAction,
  getLedgerProofImageAction,
} from "@/app/actions/ledger.actions"
import type { LedgerEntry, LedgerSummary } from "@/lib/repositories/LedgerRepository"
import { useStore } from "@/lib/store"
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value"
import { DataExportModal } from "@/components/features/export/DataExportModal"

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
  "Autre",
]

const MONTHS_FR = [
  { value: "01", label: "Janvier" },
  { value: "02", label: "Février" },
  { value: "03", label: "Mars" },
  { value: "04", label: "Avril" },
  { value: "05", label: "Mai" },
  { value: "06", label: "Juin" },
  { value: "07", label: "Juillet" },
  { value: "08", label: "Août" },
  { value: "09", label: "Septembre" },
  { value: "10", label: "Octobre" },
  { value: "11", label: "Novembre" },
  { value: "12", label: "Décembre" },
]

const YEARS_FR = ["2024", "2025", "2026", "2027", "2028"]
const ITEMS_PER_PAGE = 15

export function LedgerPage() {
  const user = useStore((state) => state.user)
  const isAdmin = user?.role === "admin"

  const ledgerCache = useStore((state) => state.ledgerCache)
  const setLedgerCacheEntry = useStore((state) => state.setLedgerCacheEntry)
  const invalidateLedgerCache = useStore((state) => state.invalidateLedgerCache)

  const [entries, setEntries] = React.useState<LedgerEntry[]>([])
  const [summary, setSummary] = React.useState<LedgerSummary | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  // Filtres
  const [currentMonth, setCurrentMonth] = React.useState(new Date().toISOString().slice(0, 7))
  const [exactDate, setExactDate] = React.useState("")
  const [activeTab, setActiveTab] = React.useState<"ALL" | "IN" | "OUT">("ALL")
  const [categoryFilter, setCategoryFilter] = React.useState("Toutes les catégories")
  const [searchQuery, setSearchQuery] = React.useState("")
  const debouncedSearch = useDebouncedValue(searchQuery, 200)

  // Pagination
  const [currentPage, setCurrentPage] = React.useState(1)

  // Modales & Actions
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [dialogType, setDialogType] = React.useState<"IN" | "OUT">("IN")
  const [successModalOpen, setSuccessModalOpen] = React.useState(false)
  const [lastCreatedEntry, setLastCreatedEntry] = React.useState<LedgerEntry | null>(null)
  const [entryToDelete, setEntryToDelete] = React.useState<LedgerEntry | null>(null)
  const [selectedEntryDetails, setSelectedEntryDetails] = React.useState<LedgerEntry | null>(null)
  const [previewProofEntry, setPreviewProofEntry] = React.useState<LedgerEntry | null>(null)
  const [previewProofImage, setPreviewProofImage] = React.useState<string | null>(null)
  const [isLoadingPreviewProof, setIsLoadingPreviewProof] = React.useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false)

  const cacheKey = `${currentMonth || "ALL"}_${activeTab}_${categoryFilter}_${debouncedSearch}`

  const fetchData = React.useCallback(async (force = false) => {
    const cached = ledgerCache[cacheKey]
    const now = Date.now()

    if (!force && cached && cached.entries) {
      setEntries(cached.entries)
      setSummary(cached.summary)
      setIsLoading(false)
      if (now - cached.fetchedAt < 60_000) {
        return
      }
    } else {
      setIsLoading(true)
    }

    try {
      const filterParams = {
        month: currentMonth || undefined,
        type: activeTab === "ALL" ? undefined : activeTab,
        category: categoryFilter === "Toutes les catégories" ? undefined : categoryFilter,
        search: debouncedSearch || undefined,
      }

      const [entriesRes, summaryRes] = await Promise.all([
        getLedgerEntriesAction(filterParams),
        getLedgerSummaryAction({ month: currentMonth || undefined }),
      ])

      const nextEntries = entriesRes.success && entriesRes.data ? entriesRes.data : []
      const nextSummary = summaryRes.success && summaryRes.data ? summaryRes.data : null

      React.startTransition(() => {
        setEntries(nextEntries)
        setSummary(nextSummary)
        setLedgerCacheEntry(cacheKey, nextEntries, nextSummary)
      })
    } catch {
      toast.error("Impossible de charger le livre des comptes.")
    } finally {
      setIsLoading(false)
    }
  }, [cacheKey, currentMonth, activeTab, categoryFilter, debouncedSearch, ledgerCache, setLedgerCacheEntry])

  React.useEffect(() => {
    void fetchData()
  }, [fetchData])

  React.useEffect(() => {
    setCurrentPage(1)
  }, [currentMonth, exactDate, activeTab, categoryFilter, debouncedSearch])

  const handleDelete = async (id: string) => {
    const res = await deleteLedgerEntryAction(id)
    if (res.success) {
      toast.success("L'écriture a été supprimée.")
      invalidateLedgerCache()
      fetchData(true)
    } else {
      toast.error(res.error || "Échec de la suppression.")
    }
  }

  const handleOpenProofModal = async (entry: LedgerEntry) => {
    setPreviewProofEntry(entry)
    if (entry.proofImage) {
      setPreviewProofImage(entry.proofImage)
      setIsLoadingPreviewProof(false)
      return
    }

    if (entry.hasProofImage) {
      setIsLoadingPreviewProof(true)
      try {
        const res = await getLedgerProofImageAction(entry.id)
        if (res.success && res.data) {
          setPreviewProofImage(res.data)
        } else {
          setPreviewProofImage(null)
        }
      } catch {
        setPreviewProofImage(null)
      } finally {
        setIsLoadingPreviewProof(false)
      }
    } else {
      setPreviewProofImage(null)
      setIsLoadingPreviewProof(false)
    }
  }

  const formatAmount = (val: number) => new Intl.NumberFormat("fr-FR").format(val) + " FCFA"

  const totalPages = Math.ceil(entries.length / ITEMS_PER_PAGE) || 1
  const safePage = Math.min(currentPage, Math.max(1, totalPages))
  const paginatedEntries = React.useMemo(() => {
    return entries.slice(
      (safePage - 1) * ITEMS_PER_PAGE,
      safePage * ITEMS_PER_PAGE
    )
  }, [entries, safePage])

  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [currentPage, totalPages])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* En-tête fixe au défilement */}
      <div className="shrink-0 pb-4 border-b border-border bg-background z-10 space-y-4">
        <PageHeader
          title="Livre des Comptes"
          description="Suivi quotidien des entrées (recettes), des sorties (dépenses) et de la trésorerie."
          actions={
            <>
              <Button
                variant="outline"
                onClick={() => setIsExportModalOpen(true)}
                className="gap-2 hidden sm:flex cursor-pointer"
              >
                <DownloadCloud className="w-4 h-4" /> Export Excel
              </Button>
              <Button
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm cursor-pointer"
                onClick={() => {
                  setDialogType("IN")
                  setDialogOpen(true)
                }}
              >
                <Plus className="w-4 h-4" />
                Nouvelle Recette (Entrée)
              </Button>
              <Button
                variant="outline"
                className="gap-2 cursor-pointer"
                onClick={() => {
                  setDialogType("OUT")
                  setDialogOpen(true)
                }}
              >
                <Minus className="w-4 h-4" />
                Nouvelle Dépense (Sortie)
              </Button>
            </>
          }
        />

        {/* Barre Temporelle */}
        <div className="flex flex-wrap items-center gap-3 bg-card p-3 rounded-xl border border-border shadow-sm">
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => {
              const base = currentMonth || new Date().toISOString().slice(0, 7)
              const [yStr, mStr] = base.split("-")
              const d = new Date(Number(yStr), Number(mStr) - 2, 1)
              const nextYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
              setCurrentMonth(nextYm)
            }}
          >
            &lt; Mois précédent
          </Button>

          <div className="flex items-center gap-2">
            <Select
              value={currentMonth ? currentMonth.split("-")[1] : "ALL"}
              onValueChange={(m) => {
                if (m === "ALL") {
                  setCurrentMonth("")
                } else {
                  const yr = currentMonth
                    ? currentMonth.split("-")[0]
                    : String(new Date().getFullYear())
                  setCurrentMonth(`${yr}-${m}`)
                }
              }}
            >
              <SelectTrigger className="w-[140px] bg-secondary/50 border-border h-9 text-xs font-medium">
                <SelectValue placeholder="Mois" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="ALL">Tous les mois</SelectItem>
                {MONTHS_FR.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={currentMonth ? currentMonth.split("-")[0] : String(new Date().getFullYear())}
              onValueChange={(yr) => {
                const m = currentMonth
                  ? currentMonth.split("-")[1]
                  : String(new Date().getMonth() + 1).padStart(2, "0")
                setCurrentMonth(`${yr}-${m}`)
              }}
            >
              <SelectTrigger className="w-[95px] bg-secondary/50 border-border h-9 text-xs font-medium tabular-nums">
                <SelectValue placeholder="Année" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {YEARS_FR.map((yr) => (
                  <SelectItem key={yr} value={yr}>
                    {yr}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => {
              const base = currentMonth || new Date().toISOString().slice(0, 7)
              const [yStr, mStr] = base.split("-")
              const d = new Date(Number(yStr), Number(mStr), 1)
              const nextYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
              setCurrentMonth(nextYm)
            }}
          >
            Mois suivant &gt;
          </Button>

          <div className="w-px h-6 bg-border mx-1 hidden sm:block" />

          <div className="w-56">
            <DatePicker
              value={exactDate}
              onChange={(iso) => {
                setExactDate(iso)
                setSearchQuery(iso)
              }}
              placeholder="Filtrer par jour (JJ/MM/AAAA)"
              className="h-9 text-xs bg-secondary/50"
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="cursor-pointer"
            onClick={() => {
              setCurrentMonth("")
              setExactDate("")
              setSearchQuery("")
            }}
          >
            Tout afficher
          </Button>
        </div>
      </div>

      {/* Contenu scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0 pt-4 pr-1 space-y-6">
        {/* KPIs */}
        <LedgerKPIs summary={summary} formatAmount={formatAmount} />

      {/* Filtres & Recherche & Tableau */}
      <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col flex-1 min-h-[420px] overflow-hidden shrink-0">
        <div className="p-4 border-b border-border space-y-4 shrink-0">
          <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
            <TabsList>
              <TabsTrigger value="ALL">Tous les flux</TabsTrigger>
              <TabsTrigger value="IN">Entrées / Recettes</TabsTrigger>
              <TabsTrigger value="OUT">Sorties / Dépenses</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher (libellé, tiers, référence)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[250px] shrink-0">
                <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tableau */}
        <div className="flex-1 overflow-x-auto overflow-y-auto p-0 min-h-0">
          <Table className="w-full min-w-[1000px]">
            <TableHeader className="bg-muted/50 sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-[105px] whitespace-nowrap">Date</TableHead>
                <TableHead className="w-[115px] whitespace-nowrap">Nature</TableHead>
                <TableHead className="w-[155px] whitespace-nowrap">Catégorie</TableHead>
                <TableHead className="min-w-[190px] whitespace-nowrap">Libellé / Motif</TableHead>
                <TableHead className="w-[140px] whitespace-nowrap">Tiers / Bénéficiaire</TableHead>
                <TableHead className="w-[115px] whitespace-nowrap">Règlement</TableHead>
                <TableHead className="w-[130px] whitespace-nowrap">Référence / Reçu</TableHead>
                <TableHead className="w-[140px] text-right whitespace-nowrap">Montant</TableHead>
                <TableHead className="w-[60px] text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedEntries.map((entry) => {
                const isIncome = entry.type === "IN"
                const hasProof = Boolean(entry.proofImage || entry.hasProofImage)
                return (
                  <TableRow key={entry.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="w-[105px] whitespace-nowrap text-muted-foreground text-sm tabular-nums">
                      {entry.date}
                    </TableCell>
                    <TableCell className="w-[115px] whitespace-nowrap">
                      {isIncome ? (
                        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-none gap-1 font-medium">
                          Entrée <ArrowDownRight className="w-3 h-3 text-emerald-700" />
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 border-none gap-1 font-medium">
                          Sortie <ArrowUpRight className="w-3 h-3 text-rose-700" />
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="w-[155px] max-w-[175px] truncate" title={entry.category}>
                      <span className="font-medium text-foreground">{entry.category}</span>
                    </TableCell>
                    <TableCell className="min-w-[190px] max-w-[300px] truncate" title={entry.description}>
                      <span className="text-foreground">{entry.description}</span>
                    </TableCell>
                    <TableCell
                      className="w-[140px] max-w-[170px] truncate text-muted-foreground"
                      title={entry.counterparty || ""}
                    >
                      {entry.counterparty || <span className="text-muted-foreground/50">—</span>}
                    </TableCell>
                    <TableCell className="w-[115px] whitespace-nowrap text-muted-foreground">
                      {entry.paymentMethod}
                    </TableCell>
                    <TableCell className="w-[130px] whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="max-w-[105px] truncate text-muted-foreground font-mono text-xs"
                          title={entry.reference || ""}
                        >
                          {entry.reference || <span className="text-muted-foreground/50">—</span>}
                        </span>
                        {hasProof && (
                          <button
                            type="button"
                            title="Voir le reçu / justificatif joint"
                            onClick={() => handleOpenProofModal(entry)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 text-[10px] font-semibold cursor-pointer shrink-0"
                          >
                            <ImageIcon className="w-3 h-3" />
                            Reçu
                          </button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      className={`w-[140px] text-right font-bold tabular-nums whitespace-nowrap ${
                        isIncome
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {isIncome ? "+" : "-"} {formatAmount(entry.amount)}
                    </TableCell>
                    <TableCell className="w-[60px] text-right pr-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <MoreVertical className="w-4 h-4" />
                            <span className="sr-only">Actions de l&apos;écriture</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 bg-card border-border shadow-md">
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer"
                            onClick={() => setSelectedEntryDetails(entry)}
                          >
                            <Eye className="w-4 h-4 text-primary" />
                            <span>Voir les détails</span>
                          </DropdownMenuItem>
                          {hasProof && (
                            <DropdownMenuItem
                              className="gap-2 cursor-pointer"
                              onClick={() => handleOpenProofModal(entry)}
                            >
                              <ImageIcon className="w-4 h-4 text-primary" />
                              <span>Voir le reçu joint</span>
                            </DropdownMenuItem>
                          )}

                          {isAdmin && !entry.linkedInvoiceId && !entry.linkedPaymentId ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                                onClick={() => setEntryToDelete(entry)}
                              >
                                <Trash2 className="w-4 h-4" />
                                <span>Supprimer</span>
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                disabled
                                className="gap-2 text-xs text-muted-foreground opacity-75"
                              >
                                <Shield className="w-3.5 h-3.5" />
                                <span>
                                  {entry.linkedInvoiceId || entry.linkedPaymentId
                                    ? "Écriture protégée"
                                    : "Suppression (Admin)"}
                                </span>
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
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

        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>
      </div>

      {/* Dialogue de création d'écriture */}
      <LedgerEntryDialog
        isOpen={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultType={dialogType}
        onSuccess={(entry) => {
          setLastCreatedEntry(entry)
          setSuccessModalOpen(true)
          invalidateLedgerCache()
          fetchData(true)
        }}
      />

      {/* Dialogue de consultation détaillée */}
      <LedgerEntryDetailsDialog
        isOpen={Boolean(selectedEntryDetails)}
        onOpenChange={(open) => !open && setSelectedEntryDetails(null)}
        entry={selectedEntryDetails}
        onDeleteRequest={isAdmin ? (entry) => setEntryToDelete(entry) : undefined}
      />

      {/* Modale d'aperçu grand format du reçu / justificatif image */}
      <Dialog
        open={Boolean(previewProofEntry)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewProofEntry(null)
            setPreviewProofImage(null)
          }
        }}
      >
        <DialogContent className="bg-card border-border sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between pr-6">
              <span>
                Justificatif — {previewProofEntry?.reference || previewProofEntry?.category}
              </span>
              {previewProofImage && (
                <a
                  href={previewProofImage}
                  download={`Recu_${previewProofEntry?.reference || previewProofEntry?.id.slice(0, 8)}.png`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  <Download className="w-3.5 h-3.5" />
                  Télécharger
                </a>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-center justify-center min-h-[160px] max-h-[70vh] overflow-auto">
            {isLoadingPreviewProof ? (
              <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-xs">Chargement du justificatif...</span>
              </div>
            ) : previewProofImage ? (
              <img
                src={previewProofImage}
                alt="Reçu justificatif"
                className="max-h-[65vh] w-auto object-contain rounded"
              />
            ) : (
              <span className="text-xs text-muted-foreground py-6">Aucun justificatif disponible</span>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation de suppression */}
      <AlertDialog
        open={Boolean(entryToDelete)}
        onOpenChange={(open) => !open && setEntryToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l&apos;écriture ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette{" "}
              {entryToDelete?.type === "IN" ? "recette" : "dépense"} de{" "}
              {entryToDelete ? formatAmount(entryToDelete.amount) : ""} ? Cette action est
              irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEntryToDelete(null)}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
              onClick={() => {
                if (entryToDelete) {
                  handleDelete(entryToDelete.id)
                  setEntryToDelete(null)
                }
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de succès de création */}
      <CreationSuccessModal
        isOpen={successModalOpen}
        onOpenChange={setSuccessModalOpen}
        title={lastCreatedEntry?.type === "IN" ? "Recette enregistrée" : "Dépense enregistrée"}
        subtitle={`L'écriture a été ajoutée avec succès au livre des comptes.`}
        details={[
          { label: "Catégorie", value: lastCreatedEntry?.category || "" },
          { label: "Mode de règlement", value: lastCreatedEntry?.paymentMethod || "" },
          {
            label: "Montant",
            value: formatAmount(lastCreatedEntry?.amount || 0),
            isAmount: true,
          },
        ]}
        onClose={() => setSuccessModalOpen(false)}
      />

      <DataExportModal
        open={isExportModalOpen}
        onOpenChange={setIsExportModalOpen}
        defaultScope="ledger"
        initialEntity="ledger"
      />
    </div>
  )
}
