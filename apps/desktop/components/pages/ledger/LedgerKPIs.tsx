"use client"

import * as React from "react"
import { TrendingUp, TrendingDown, Wallet, CreditCard } from "lucide-react"
import { Card } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import type { LedgerSummary } from "@/lib/repositories/LedgerRepository"

interface LedgerKPIsProps {
  summary: LedgerSummary | null
  formatAmount: (val: number) => string
}

export function LedgerKPIs({ summary, formatAmount }: LedgerKPIsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
      <Card className="bg-card border border-border rounded-xl shadow-sm p-5 shrink-0">
        <div className="flex flex-row items-center justify-between pb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Recettes (Entrées)</span>
          <TrendingUp className="w-4 h-4 text-emerald-600" />
        </div>
        <div>
          <div className="text-2xl font-bold text-emerald-600 tabular-nums">{formatAmount(summary?.totalIn || 0)}</div>
          <p className="text-xs text-muted-foreground mt-1">{summary?.countIn || 0} entrées sur la période</p>
        </div>
      </Card>

      <Card className="bg-card border border-border rounded-xl shadow-sm p-5 shrink-0">
        <div className="flex flex-row items-center justify-between pb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Dépenses (Sorties)</span>
          <TrendingDown className="w-4 h-4 text-rose-600" />
        </div>
        <div>
          <div className="text-2xl font-bold text-rose-600 tabular-nums">{formatAmount(summary?.totalOut || 0)}</div>
          <p className="text-xs text-muted-foreground mt-1">{summary?.countOut || 0} sorties sur la période</p>
        </div>
      </Card>

      <Card className="bg-card border border-border rounded-xl shadow-sm p-5 shrink-0">
        <div className="flex flex-row items-center justify-between pb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Solde Net de Trésorerie</span>
          <Wallet className="w-4 h-4 text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <div className={`text-2xl font-bold tabular-nums ${(summary?.netBalance ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatAmount(summary?.netBalance || 0)}
            </div>
            {(summary?.netBalance ?? 0) >= 0 ? (
              <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">Excédent</Badge>
            ) : (
              <Badge variant="outline" className="bg-rose-100 text-rose-800 border-rose-200">Déficit</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Entrées − Sorties</p>
        </div>
      </Card>

      <Card className="bg-card border border-border rounded-xl shadow-sm p-5 shrink-0">
        <div className="flex flex-row items-center justify-between pb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Modes de Paiement (Net)</span>
          <CreditCard className="w-4 h-4 text-muted-foreground" />
        </div>
        <div>
          <div className="text-sm space-y-1">
            {summary && Object.entries(summary.byPaymentMethod).length > 0 ? (
              Object.entries(summary.byPaymentMethod).slice(0, 3).map(([method, amount]) => (
                <div key={method} className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground truncate">{method}</span>
                  <span className={`font-semibold tabular-nums ${amount >= 0 ? 'text-foreground' : 'text-rose-600'}`}>
                    {formatAmount(amount)}
                  </span>
                </div>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">Aucune donnée</span>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
