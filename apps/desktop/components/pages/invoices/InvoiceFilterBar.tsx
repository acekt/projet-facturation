"use client"

import * as React from "react"
import { SearchBar } from "@workspace/ui/components/search-bar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { cn } from "@/lib/utils"

interface InvoiceFilterBarProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  statusFilter: string
  onStatusFilterChange: (value: string) => void
  totalCount: number
  unpaidCount: number
}

export function InvoiceFilterBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  totalCount,
  unpaidCount,
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
        <div className="w-full sm:w-[220px]">
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="bg-card border-border text-foreground h-10">
              <SelectValue placeholder="Filtrer par statut" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="unpaid_any">Toutes les impayées</SelectItem>
              <SelectItem value="UNPAID">Non payées</SelectItem>
              <SelectItem value="PARTIALLY_PAID">Partiellement payées</SelectItem>
              <SelectItem value="PAID">Payées</SelectItem>
              <SelectItem value="OVERDUE">En retard</SelectItem>
              <SelectItem value="cancelled">Annulées</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filtres d'accès rapide (Effet Von Restorff & Seuil de Doherty) */}
      <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1">
        <button
          onClick={() => onStatusFilterChange("all")}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
            statusFilter === "all"
              ? "bg-secondary text-foreground shadow-xs"
              : "text-muted-foreground hover:bg-secondary/60"
          )}
        >
          Toutes <span className="ml-1 text-[11px] tabular-nums font-normal">({totalCount})</span>
        </button>
        <button
          onClick={() => onStatusFilterChange("unpaid_any")}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer",
            statusFilter === "unpaid_any"
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
          onClick={() => onStatusFilterChange("PAID")}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
            statusFilter === "PAID"
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-muted-foreground hover:bg-secondary/60"
          )}
        >
          Payées
        </button>
      </div>
    </>
  )
}

