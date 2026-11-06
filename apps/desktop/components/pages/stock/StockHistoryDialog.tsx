"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@workspace/ui/components/dialog";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { getStockMovements } from "@/app/actions/stock.actions";
import { Pagination } from "@workspace/ui/components/pagination-custom";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Loader2, Search, ArrowUpDown, FileText, Package } from "lucide-react";

interface StockHistoryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  serviceId: string | null;
  serviceName: string;
  stockItemName?: string | null;
}

function getMovementBadge(type: string) {
  const norm = (type || "").toUpperCase().replace(/\s+/g, "_");
  switch (norm) {
    case "IN":
    case "INVENTORY_IN":
    case "INITIAL":
      return { key: "ENTRY", label: "Entrée en stock", isEntry: true };
    case "OUT":
    case "INVENTORY_OUT":
      return { key: "MANUAL_OUT", label: "Sortie manuelle", isEntry: false };
    case "INVOICE_DEDUCTION":
      return { key: "INVOICE", label: "Vente (Facture)", isEntry: false };
    case "CREDIT_NOTE_RESTOCK":
      return { key: "CREDIT_NOTE", label: "Retour (Avoir)", isEntry: true };
    case "ADJUSTMENT":
      return { key: "ADJUSTMENT", label: "Ajustement", isEntry: true };
    default:
      return { key: "OTHER", label: type ? type.replace(/_/g, " ") : "-", isEntry: false };
  }
}

export function StockHistoryDialog({
  isOpen,
  onOpenChange,
  serviceId,
  serviceName,
  stockItemName,
}: StockHistoryDialogProps) {
  const [movements, setMovements] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const debouncedSearch = useDebouncedValue(searchQuery, 200);
  const [typeFilter, setTypeFilter] = React.useState<string>("ALL");
  const [sortOrder, setSortOrder] = React.useState<"desc" | "asc">("desc");
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 10;

  React.useEffect(() => {
    async function load() {
      if (!isOpen || !serviceId) return;
      setLoading(true);
      setSearchQuery("");
      setTypeFilter("ALL");
      setSortOrder("desc");
      setCurrentPage(1);
      try {
        const res = await getStockMovements(serviceId);
        if (res.success && res.data) {
          setMovements(res.data);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isOpen, serviceId]);

  const filteredAndSortedMovements = React.useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return movements
      .filter((mov) => {
        const badge = getMovementBadge(mov.type);
        if (typeFilter !== "ALL" && badge.key !== typeFilter) return false;
        if (!q) return true;
        const notesMatch = (mov.notes || "").toLowerCase().includes(q);
        const refMatch = (mov.referenceDoc || "").toLowerCase().includes(q);
        const typeMatch = badge.label.toLowerCase().includes(q);
        return notesMatch || refMatch || typeMatch;
      })
      .sort((a, b) => {
        const tA = new Date(a.createdAt || 0).getTime();
        const tB = new Date(b.createdAt || 0).getTime();
        return sortOrder === "desc" ? tB - tA : tA - tB;
      });
  }, [movements, debouncedSearch, typeFilter, sortOrder]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, typeFilter, sortOrder]);

  const totalPages = Math.ceil(filteredAndSortedMovements.length / itemsPerPage) || 1;
  const paginatedMovements = React.useMemo(() => {
    return filteredAndSortedMovements.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [filteredAndSortedMovements, currentPage]);

  const primaryTitle = stockItemName?.trim() || serviceName;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[780px] max-h-[85vh] flex flex-col overflow-hidden [&>button]:focus:ring-0 [&>button]:focus-visible:ring-1 [&>button]:focus:outline-none">
        <DialogHeader className="pb-2 border-b border-border/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-foreground text-base font-bold">
                Historique des mouvements — {primaryTitle}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Service lié : <span className="font-medium text-foreground/80">{serviceName}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Barre d'outils de fouille : Recherche + Filtre par type + Tri chronologique */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-3 pb-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher dans les notes ou références..."
              className="pl-9 h-9 text-xs bg-secondary/50 border-border"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[190px] h-9 text-xs bg-secondary/50 border-border">
              <SelectValue placeholder="Tous les mouvements" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="ALL">Tous les mouvements</SelectItem>
              <SelectItem value="ENTRY">Entrée en stock</SelectItem>
              <SelectItem value="MANUAL_OUT">Sortie manuelle</SelectItem>
              <SelectItem value="INVOICE">Vente (Facture)</SelectItem>
              <SelectItem value="CREDIT_NOTE">Retour (Avoir)</SelectItem>
              <SelectItem value="ADJUSTMENT">Ajustement</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
            className="h-9 text-xs gap-1.5 shrink-0"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
            {sortOrder === "desc" ? "Plus récents d'abord" : "Plus anciens d'abord"}
          </Button>
        </div>

        <div className="flex-1 overflow-auto mt-1 rounded-lg border border-border">
          {loading ? (
            <div className="flex items-center justify-center p-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filteredAndSortedMovements.length === 0 ? (
            <div className="text-center p-10 text-muted-foreground text-sm">
              {movements.length === 0
                ? "Aucun mouvement enregistré pour cet article."
                : "Aucun mouvement ne correspond à vos critères de recherche."}
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-muted/80 text-muted-foreground sticky top-0 z-10 border-b border-border">
                <tr>
                  <th className="p-2.5 font-semibold whitespace-nowrap">Date &amp; Heure</th>
                  <th className="p-2.5 font-semibold whitespace-nowrap">Type</th>
                  <th className="p-2.5 font-semibold text-right whitespace-nowrap">Quantité</th>
                  <th className="p-2.5 font-semibold text-right whitespace-nowrap">Stock Avant</th>
                  <th className="p-2.5 font-semibold text-right whitespace-nowrap">Stock Après</th>
                  <th className="p-2.5 font-semibold whitespace-nowrap">Réf. Document</th>
                  <th className="p-2.5 font-semibold">Notes / Motif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedMovements.map((mov) => {
                  const { label: typeLabel, isEntry } = getMovementBadge(mov.type);
                  return (
                    <tr key={mov.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-2.5 whitespace-nowrap text-muted-foreground tabular-nums">
                        {format(new Date(mov.createdAt), "dd/MM/yyyy à HH:mm", { locale: fr })}
                      </td>
                      <td className="p-2.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            isEntry
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {typeLabel}
                        </span>
                      </td>
                      <td
                        className={`p-2.5 text-right font-bold tabular-nums whitespace-nowrap ${
                          isEntry ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                        }`}
                      >
                        {isEntry ? "+" : "-"}
                        {mov.quantity}
                      </td>
                      <td className="p-2.5 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {mov.previousStock}
                      </td>
                      <td className="p-2.5 text-right font-bold text-foreground tabular-nums whitespace-nowrap">
                        {mov.newStock}
                      </td>
                      <td className="p-2.5 whitespace-nowrap">
                        {mov.referenceDoc ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary text-foreground font-mono text-[11px]">
                            <FileText className="w-3 h-3 text-primary" />
                            {mov.referenceDoc}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="p-2.5 text-foreground/90 break-words min-w-[160px] max-w-[260px]">
                        {mov.notes || <span className="text-muted-foreground/50">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </DialogContent>
    </Dialog>
  );
}
