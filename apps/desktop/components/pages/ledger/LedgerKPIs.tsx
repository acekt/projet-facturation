"use client"

import * as React from "react"
import { TrendingUp, TrendingDown, Wallet, CreditCard } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import type { LedgerSummary } from "@/lib/repositories/LedgerRepository"

interface LedgerKPIsProps {
  summary: LedgerSummary | null
  formatAmount: (val: number) => string
}

export function LedgerKPIs({ summary, formatAmount }: LedgerKPIsProps) {
  return (
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
  )
}

