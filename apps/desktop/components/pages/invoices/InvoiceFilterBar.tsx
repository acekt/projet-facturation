"use client"

import * as React from "react"
import { SearchBar } from "@workspace/ui/components/search-bar"
import { cn } from "@/lib/utils"

interface InvoiceFilterBarProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  statusFilter: string
  onStatusFilterChange: (value: string) => void
  totalCount: number
  draftCount: number
  unpaidCount: number
  paidCount: number
  overdueCount: number
  cancelledCount: number
}

export function InvoiceFilterBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  totalCount,
  draftCount,
  unpaidCount,
  paidCount,
  overdueCount,
  cancelledCount,
}: InvoiceFilterBarProps) {
  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4 mb-2">
        <div className="flex-1">
          <SearchBar
            placeholder="Rechercher une facture..."
            value={searchQuery}
            onChange={onSearchChange}
            viewFormatKey="invoices"
          />
        </div>
      </div>

      {/* Filtres d'accès rapide unifiés avec compteurs réactifs */}
      <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => onStatusFilterChange("all")}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
            statusFilter === "all"
              ? "bg-secondary text-foreground shadow-xs"
              : "text-muted-foreground hover:bg-secondary/60"
          )}
        >
          <span>Toutes</span>
          <span className="text-[11px] tabular-nums font-normal opacity-80">({totalCount})</span>
        </button>

        <button
          type="button"
          onClick={() => onStatusFilterChange("draft")}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
            statusFilter === "draft"
              ? "bg-slate-800 text-white shadow-xs"
              : "bg-slate-500/10 text-slate-700 dark:text-slate-300 hover:bg-slate-500/20"
          )}
        >
          <span>Brouillons</span>
          <span className="px-1.5 py-0.5 bg-slate-500/20 rounded-full tabular-nums text-[10px] font-bold">
            {draftCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onStatusFilterChange("unpaid_any")}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
            statusFilter === "unpaid_any" || statusFilter === "UNPAID" || statusFilter === "PARTIALLY_PAID"
              ? "bg-amber-500 text-white shadow-xs"
              : "bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20"
          )}
        >
          <span>À encaisser</span>
          <span className="px-1.5 py-0.5 bg-amber-600/20 rounded-full tabular-nums text-[10px] font-bold">
            {unpaidCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onStatusFilterChange("PAID")}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
            statusFilter === "PAID"
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-muted-foreground hover:bg-secondary/60"
          )}
        >
          <span>Payées</span>
          <span className="px-1.5 py-0.5 bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 rounded-full tabular-nums text-[10px] font-bold">
            {paidCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onStatusFilterChange("overdue")}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
            statusFilter === "overdue"
              ? "bg-rose-600 text-white shadow-xs"
              : "text-muted-foreground hover:bg-secondary/60"
          )}
        >
          <span>En retard</span>
          <span className="px-1.5 py-0.5 bg-rose-600/15 text-rose-700 dark:text-rose-400 rounded-full tabular-nums text-[10px] font-bold">
            {overdueCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onStatusFilterChange("cancelled")}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
            statusFilter === "cancelled"
              ? "bg-slate-700 text-white shadow-xs"
              : "text-muted-foreground hover:bg-secondary/60"
          )}
        >
          <span>Annulées</span>
          <span className="px-1.5 py-0.5 bg-slate-500/15 text-slate-700 dark:text-slate-300 rounded-full tabular-nums text-[10px] font-bold">
            {cancelledCount}
          </span>
        </button>
      </div>
    </>
  )
}
