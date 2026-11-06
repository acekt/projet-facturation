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
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/60 text-muted-foreground hover:bg-muted"
          )}
        >
          <span>Toutes</span>
          <span
            className={cn(
              "px-1.5 py-0.5 rounded-full tabular-nums text-[10px] font-semibold",
              statusFilter === "all"
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-background/80 text-foreground"
            )}
          >
            {totalCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onStatusFilterChange("draft")}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
            statusFilter === "draft"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/60 text-muted-foreground hover:bg-muted"
          )}
        >
          <span>Brouillons</span>
          <span
            className={cn(
              "px-1.5 py-0.5 rounded-full tabular-nums text-[10px] font-semibold",
              statusFilter === "draft"
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-background/80 text-foreground"
            )}
          >
            {draftCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onStatusFilterChange("unpaid_any")}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
            statusFilter === "unpaid_any" || statusFilter === "UNPAID" || statusFilter === "PARTIALLY_PAID"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/60 text-muted-foreground hover:bg-muted"
          )}
        >
          <span>À encaisser</span>
          <span
            className={cn(
              "px-1.5 py-0.5 rounded-full tabular-nums text-[10px] font-semibold",
              statusFilter === "unpaid_any" || statusFilter === "UNPAID" || statusFilter === "PARTIALLY_PAID"
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-background/80 text-foreground"
            )}
          >
            {unpaidCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onStatusFilterChange("PAID")}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
            statusFilter === "PAID"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/60 text-muted-foreground hover:bg-muted"
          )}
        >
          <span>Payées</span>
          <span
            className={cn(
              "px-1.5 py-0.5 rounded-full tabular-nums text-[10px] font-semibold",
              statusFilter === "PAID"
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-background/80 text-foreground"
            )}
          >
            {paidCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onStatusFilterChange("overdue")}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
            statusFilter === "overdue"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/60 text-muted-foreground hover:bg-muted"
          )}
        >
          <span>En retard</span>
          <span
            className={cn(
              "px-1.5 py-0.5 rounded-full tabular-nums text-[10px] font-semibold",
              statusFilter === "overdue"
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-background/80 text-foreground"
            )}
          >
            {overdueCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onStatusFilterChange("cancelled")}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
            statusFilter === "cancelled"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/60 text-muted-foreground hover:bg-muted"
          )}
        >
          <span>Annulées</span>
          <span
            className={cn(
              "px-1.5 py-0.5 rounded-full tabular-nums text-[10px] font-semibold",
              statusFilter === "cancelled"
                ? "bg-primary-foreground/20 text-primary-foreground"
                : "bg-background/80 text-foreground"
            )}
          >
            {cancelledCount}
          </span>
        </button>
      </div>
    </>
  )
}
