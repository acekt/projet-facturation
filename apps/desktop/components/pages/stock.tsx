"use client"

import * as React from "react"
import { Package, AlertTriangle, ArrowDown, ArrowUp, Activity, Download } from "lucide-react"
import { useStore } from "@/lib/store"
import { PageHeader } from "@workspace/ui/components/page-header"
import { SearchBar } from "@workspace/ui/components/search-bar"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { getStockCatalog, getLowStockAlerts } from "@/app/actions/stock.actions"
import { StockMovementDialog } from "./stock/StockMovementDialog"
import { StockHistoryDialog } from "./stock/StockHistoryDialog"

export function StockPage() {
  const user = useStore(state => state.user)
  const isDataLoaded = useStore(state => state.isDataLoaded)
  const [catalog, setCatalog] = React.useState<any[]>([])
  const [searchQuery, setSearchQuery] = React.useState("")
  const [filter, setFilter] = React.useState<"all" | "in_stock" | "low_stock" | "out_of_stock">("all")
  const [movementDialog, setMovementDialog] = React.useState<{ isOpen: boolean, type: "INVENTORY_IN" | "INVENTORY_OUT" | null, serviceId: string | null, serviceName: string }>({ isOpen: false, type: null, serviceId: null, serviceName: "" });
  const [historyDialog, setHistoryDialog] = React.useState<{ isOpen: boolean, serviceId: string | null, serviceName: string }>({ isOpen: false, serviceId: null, serviceName: "" });

  const loadCatalog = React.useCallback(async () => {
    const res = await getStockCatalog()
    if (res.success && res.data) {
      setCatalog(res.data)
    }
  }, []);

  React.useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  const filteredCatalog = React.useMemo(() => {
    return catalog.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase())
      if (!matchSearch) return false;

      switch (filter) {
        case "in_stock": return item.stockQuantity > item.minStockAlert;
        case "low_stock": return item.stockQuantity <= item.minStockAlert && item.stockQuantity > 0;
        case "out_of_stock": return item.stockQuantity <= 0;
        default: return true;
      }
    });
  }, [catalog, searchQuery, filter])

  const totalValue = catalog.reduce((sum, item) => sum + (item.stockQuantity * item.unitPrice), 0);
  const lowStockCount = catalog.filter(item => item.stockQuantity <= item.minStockAlert && item.stockQuantity > 0).length;
  const outOfStockCount = catalog.filter(item => item.stockQuantity <= 0).length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden space-y-6">
      <PageHeader
        title="Gestion de Stock"
        description="Gérez et suivez le stock de vos produits et services"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2 cursor-pointer" onClick={() => {}}>
              <Download className="w-4 h-4 mr-2" /> Export
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Références suivies</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{catalog.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock faible</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{lowStockCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ruptures de stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{outOfStockCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valeur totale (FCFA)</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{totalValue.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <SearchBar
            placeholder="Rechercher une référence..."
            value={searchQuery}
            onChange={setSearchQuery}
          />
        </div>
        <div className="flex gap-2">
           <Button variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>Tous</Button>
           <Button variant={filter === "in_stock" ? "default" : "outline"} onClick={() => setFilter("in_stock")}>En stock</Button>
           <Button variant={filter === "low_stock" ? "default" : "outline"} onClick={() => setFilter("low_stock")}>Stock faible</Button>
           <Button variant={filter === "out_of_stock" ? "default" : "outline"} onClick={() => setFilter("out_of_stock")}>Rupture</Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded-md border">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="p-4 font-medium">Référence</th>
              <th className="p-4 font-medium">Quantité</th>
              <th className="p-4 font-medium">Alerte</th>
              <th className="p-4 font-medium">Unité</th>
              <th className="p-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCatalog.map(item => (
              <tr key={item.id} className="border-t">
                <td className="p-4">{item.name}</td>
                <td className="p-4 font-bold">{item.stockQuantity}</td>
                <td className="p-4 text-muted-foreground">{item.minStockAlert}</td>
                <td className="p-4 text-muted-foreground">{item.unit || "Unité"}</td>
                <td className="p-4 text-right flex justify-end gap-2">
                  <Button variant="outline" size="sm" className="gap-2 cursor-pointer hover:bg-destructive hover:text-destructive-foreground" onClick={() => setMovementDialog({ isOpen: true, type: "INVENTORY_OUT", serviceId: item.id, serviceName: item.name })}>
                    <ArrowDown className="w-3 h-3" /> Sortie
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2 cursor-pointer hover:bg-primary hover:text-primary-foreground" onClick={() => setMovementDialog({ isOpen: true, type: "INVENTORY_IN", serviceId: item.id, serviceName: item.name })}>
                    <ArrowUp className="w-3 h-3" /> Entrée
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setHistoryDialog({ isOpen: true, serviceId: item.id, serviceName: item.name })}>
                    Historique
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredCatalog.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            Aucun article ne correspond à votre recherche.
          </div>
        )}
      </div>

      <StockMovementDialog
        isOpen={movementDialog.isOpen}
        onOpenChange={(open) => setMovementDialog(prev => ({ ...prev, isOpen: open }))}
        serviceId={movementDialog.serviceId}
        serviceName={movementDialog.serviceName}
        type={movementDialog.type}
        onSuccess={loadCatalog}
      />

      <StockHistoryDialog
        isOpen={historyDialog.isOpen}
        onOpenChange={(open) => setHistoryDialog(prev => ({ ...prev, isOpen: open }))}
        serviceId={historyDialog.serviceId}
        serviceName={historyDialog.serviceName}
      />
    </div>
  )
}
