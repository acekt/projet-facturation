"use client"

import * as React from "react"
import { Package, AlertTriangle, ArrowDown, ArrowUp, Activity, DownloadCloud } from "lucide-react"
import { useStore } from "@/lib/store"
import { PageHeader } from "@/components/features/common/PageHeader"
import { SortSelect } from "@/components/features/common/SortSelect"
import { SearchBar } from "@workspace/ui/components/search-bar"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Pagination } from "@workspace/ui/components/pagination-custom"
import { cn, formatCurrency } from "@/lib/utils"
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value"
import { getStockCatalog } from "@/app/actions/stock.actions"
import { StockMovementDialog } from "./stock/StockMovementDialog"
import { StockHistoryDialog } from "./stock/StockHistoryDialog"
import { DataExportModal } from "@/components/features/export/DataExportModal"

function getPhysicalStockTitle(item: { name: string; stockItemName?: string | null }): string {
  if (item.stockItemName && item.stockItemName.trim() !== "") {
    return item.stockItemName.trim()
  }
  const cleaned = (item.name || "")
    .trim()
    .replace(/^(achat\s+et\s+installation\s+d['’]|achat\s+et\s+installation\s+de\s+|achat\s+d['’]|achat\s+de\s+|achat\s+|fourniture\s+et\s+pose\s+d['’]|fourniture\s+et\s+pose\s+de\s+|fourniture\s+d['’]|fourniture\s+de\s+|vente\s+d['’]|vente\s+de\s+)/i, "")
    .trim()
  if (!cleaned) return item.name
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

type StockSortOption = "name_asc" | "stock_asc" | "stock_desc" | "value_desc"

const ITEMS_PER_PAGE = 12

export function StockPage() {
  const cachedCatalog = useStore((state) => state.stockCatalog)
  const setStockCatalog = useStore((state) => state.setStockCatalog)
  const refreshStockData = useStore((state) => state.refreshStockData)

  const [catalog, setCatalog] = React.useState<any[]>(() => cachedCatalog || [])
  const [searchQuery, setSearchQuery] = React.useState("")
  const debouncedSearch = useDebouncedValue(searchQuery, 200)
  const [filter, setFilter] = React.useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all")
  const [sortBy, setSortBy] = React.useState<string>("recent")
  const [currentPage, setCurrentPage] = React.useState(1)

  const [movementDialog, setMovementDialog] = React.useState<{
    isOpen: boolean
    type: "INVENTORY_IN" | "INVENTORY_OUT" | null
    serviceId: string | null
    serviceName: string
  }>({ isOpen: false, type: null, serviceId: null, serviceName: "" })
  const [historyDialog, setHistoryDialog] = React.useState<{
    isOpen: boolean
    serviceId: string | null
    serviceName: string
    stockItemName?: string | null
  }>({ isOpen: false, serviceId: null, serviceName: "", stockItemName: "" })

  React.useEffect(() => {
    if (cachedCatalog && cachedCatalog.length > 0) {
      setCatalog(cachedCatalog)
    }
  }, [cachedCatalog])

  const loadCatalog = React.useCallback(async (force = false) => {
    const res = await getStockCatalog()
    if (res.success && res.data) {
      React.startTransition(() => {
        setCatalog(res.data)
        setStockCatalog(res.data)
      })
    }
    if (force) {
      void refreshStockData(true)
    }
  }, [setStockCatalog, refreshStockData])

  React.useEffect(() => {
    void loadCatalog(false)
  }, [loadCatalog])

  React.useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch, filter, sortBy])

  const filteredCatalog = React.useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim()
    return catalog
      .filter((item) => {
        const physicalTitle = getPhysicalStockTitle(item).toLowerCase()
        const serviceTitle = (item.name || "").toLowerCase()
        const matchSearch = !q || physicalTitle.includes(q) || serviceTitle.includes(q)
        if (!matchSearch) return false

        switch (filter) {
          case "in_stock":
            return item.stockQuantity > item.minStockAlert
          case "low_stock":
            return item.stockQuantity <= item.minStockAlert && item.stockQuantity > 0
          case "out_of_stock":
            return item.stockQuantity <= 0
          default:
            return true
        }
      })
      .sort((a, b) => {
        if (sortBy === "amount_asc" || sortBy === "stock_asc") {
          return (Number(a.stockQuantity) || 0) - (Number(b.stockQuantity) || 0)
        }
        if (sortBy === "amount_desc" || sortBy === "stock_desc") {
          return (Number(b.stockQuantity) || 0) - (Number(a.stockQuantity) || 0)
        }
        if (sortBy === "alpha_asc") {
          const titleA = getPhysicalStockTitle(a)
          const titleB = getPhysicalStockTitle(b)
          return titleA.localeCompare(titleB, "fr", { sensitivity: "base" })
        }
        if (sortBy === "oldest") {
          return String(a.id || "").localeCompare(String(b.id || ""))
        }
        // recent by default
        return String(b.id || "").localeCompare(String(a.id || ""))
      })
  }, [catalog, debouncedSearch, filter, sortBy])

  const totalPages = Math.ceil(filteredCatalog.length / ITEMS_PER_PAGE) || 1
  const safePage = Math.min(currentPage, Math.max(1, totalPages))
  const paginatedCatalog = React.useMemo(() => {
    return filteredCatalog.slice(
      (safePage - 1) * ITEMS_PER_PAGE,
      safePage * ITEMS_PER_PAGE
    )
  }, [filteredCatalog, safePage])

  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [currentPage, totalPages])

  const totalValue = catalog.reduce((sum, item) => sum + item.stockQuantity * item.unitPrice, 0)
  const lowStockCount = catalog.filter(
    (item) => item.stockQuantity <= item.minStockAlert && item.stockQuantity > 0
  ).length
  const outOfStockCount = catalog.filter((item) => item.stockQuantity <= 0).length

  const [isExportModalOpen, setIsExportModalOpen] = React.useState(false)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 pb-4 border-b border-border bg-background z-10 space-y-4">
        <PageHeader
          title="Gestion de Stock"
          description="Gérez et suivez le stock physique de vos équipements et articles"
          actions={
            <Button
              variant="outline"
              onClick={() => setIsExportModalOpen(true)}
              className="gap-2 hidden sm:flex cursor-pointer"
            >
              <DownloadCloud className="w-4 h-4" /> Export Excel
            </Button>
          }
        />

        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex-1">
            <SearchBar
              placeholder="Rechercher un article en stock ou un service lié..."
              value={searchQuery}
              onChange={setSearchQuery}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
                  filter === "all"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                )}
              >
                <span>Tous</span>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full tabular-nums text-[10px] font-semibold",
                    filter === "all"
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-background/80 text-foreground"
                  )}
                >
                  {catalog.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setFilter("in_stock")}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
                  filter === "in_stock"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                )}
              >
                <span>En stock</span>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full tabular-nums text-[10px] font-semibold",
                    filter === "in_stock"
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-background/80 text-foreground"
                  )}
                >
                  {catalog.filter((item) => item.stockQuantity > item.minStockAlert).length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setFilter("low_stock")}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
                  filter === "low_stock"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                )}
              >
                <span>Stock faible</span>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full tabular-nums text-[10px] font-semibold",
                    filter === "low_stock"
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-background/80 text-foreground"
                  )}
                >
                  {lowStockCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setFilter("out_of_stock")}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
                  filter === "out_of_stock"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                )}
              >
                <span>Rupture</span>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full tabular-nums text-[10px] font-semibold",
                    filter === "out_of_stock"
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-background/80 text-foreground"
                  )}
                >
                  {outOfStockCount}
                </span>
              </button>
            </div>

            <SortSelect
              value={sortBy}
              onValueChange={(val) => setSortBy(val)}
              type="quantity"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 pt-4 pr-1 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Références suivies</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{catalog.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Stock faible</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 tabular-nums">{lowStockCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ruptures de stock</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive tabular-nums">{outOfStockCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valeur totale (FCFA)</CardTitle>
              <Activity className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary whitespace-nowrap tabular-nums">
                {formatCurrency(totalValue)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-muted-foreground sticky top-0 z-10">
              <tr>
                <th className="p-4 font-medium">Article en stock</th>
                <th className="p-4 font-medium">Quantité</th>
                <th className="p-4 font-medium">Alerte</th>
                <th className="p-4 font-medium">Unité</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCatalog.map((item) => {
                const physicalTitle = getPhysicalStockTitle(item)
                return (
                  <tr key={item.id} className="border-t hover:bg-muted/20 transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-foreground">{physicalTitle}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Service lié : {item.name}
                      </div>
                    </td>
                    <td className="p-4 font-bold tabular-nums">{item.stockQuantity}</td>
                    <td className="p-4 text-muted-foreground tabular-nums">{item.minStockAlert}</td>
                    <td className="p-4 text-muted-foreground">{item.unit || "Unité"}</td>
                    <td className="p-4 text-right flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 hover:bg-destructive hover:text-destructive-foreground cursor-pointer"
                        onClick={() =>
                          setMovementDialog({
                            isOpen: true,
                            type: "INVENTORY_OUT",
                            serviceId: item.id,
                            serviceName: physicalTitle,
                          })
                        }
                      >
                        <ArrowDown className="w-3 h-3" /> Sortie
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 hover:bg-primary hover:text-primary-foreground cursor-pointer"
                        onClick={() =>
                          setMovementDialog({
                            isOpen: true,
                            type: "INVENTORY_IN",
                            serviceId: item.id,
                            serviceName: physicalTitle,
                          })
                        }
                      >
                        <ArrowUp className="w-3 h-3" /> Entrée
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="cursor-pointer"
                        onClick={() =>
                          setHistoryDialog({
                            isOpen: true,
                            serviceId: item.id,
                            serviceName: item.name,
                            stockItemName: physicalTitle,
                          })
                        }
                      >
                        Historique
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filteredCatalog.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              Aucun article ne correspond à votre recherche.
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 pt-3 border-t border-border bg-background">
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>

      <StockMovementDialog
        isOpen={movementDialog.isOpen}
        onOpenChange={(open) => setMovementDialog((prev) => ({ ...prev, isOpen: open }))}
        serviceId={movementDialog.serviceId}
        serviceName={movementDialog.serviceName}
        type={movementDialog.type}
        onSuccess={() => void loadCatalog(true)}
      />

      <StockHistoryDialog
        isOpen={historyDialog.isOpen}
        onOpenChange={(open) => setHistoryDialog((prev) => ({ ...prev, isOpen: open }))}
        serviceId={historyDialog.serviceId}
        serviceName={historyDialog.serviceName}
        stockItemName={historyDialog.stockItemName}
      />

      <DataExportModal
        open={isExportModalOpen}
        onOpenChange={setIsExportModalOpen}
        defaultScope="stock"
        initialEntity="stock"
      />
    </div>
  )
}
