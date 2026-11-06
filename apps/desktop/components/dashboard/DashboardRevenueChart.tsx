"use client"

import * as React from "react"
import { useState } from "react"
import { Activity, PieChart as PieIcon, BarChart2, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { formatCurrency } from "@/lib/utils"
import type { CashflowPoint, ForecastMetrics } from "@/lib/types/api"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"

const PIE_COLORS = ["#1E40AF", "#0D9488", "#F59E0B", "#E11D48", "#8B5CF6"]

interface DashboardRevenueChartProps {
  cashflowSeries?: CashflowPoint[]
  revenueData: Array<{ label: string; value: number; date?: string; revenue?: number }>
  paymentMethodData: Array<{ method: string; amount: number }>
  totalRevenue: number
  forecastMetrics?: ForecastMetrics
  formatYAxis: (val: number) => string
}

interface TooltipPayloadItem {
  dataKey: string
  value: number
  name?: string
  color?: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}

export function DashboardRevenueChart({
  cashflowSeries = [],
  revenueData,
  paymentMethodData,
  totalRevenue,
  forecastMetrics,
  formatYAxis,
}: DashboardRevenueChartProps) {
  const [chartMode, setChartMode] = useState<"cashflow" | "revenue">("cashflow")

  const chartData = React.useMemo(() => {
    if (chartMode === "cashflow") {
      if (cashflowSeries && cashflowSeries.length > 0) {
        return cashflowSeries
      }
      return revenueData.map((r) => ({
        label: r.label,
        date: r.date || r.label,
        income: r.value,
        expense: 0,
        revenue: r.revenue ?? r.value,
      }))
    }
    return revenueData
  }, [chartMode, cashflowSeries, revenueData])

  const hasCashflowData = React.useMemo(() => {
    if (chartMode === "cashflow") {
      return chartData.some((d) => ("income" in d && (d.income > 0 || d.expense > 0))) || totalRevenue > 0
    }
    return totalRevenue > 0
  }, [chartMode, chartData, totalRevenue])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Graphique Principal : Évolution Commerciale & Flux de Trésorerie */}
      <Card className="lg:col-span-2 border-border shadow-sm flex flex-col justify-between">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
          <div>
            <CardTitle className="text-md font-semibold text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              Évolution Commerciale & Flux de Trésorerie
            </CardTitle>
            <CardDescription className="text-[10px] uppercase font-medium tracking-widest mt-0.5">
              {chartMode === "cashflow"
                ? "Comparatif Recettes / Encaissements vs Dépenses / Sorties (XAF)"
                : "Revenus Facturés Émis sur la Période (XAF)"}
            </CardDescription>
          </div>

          <div className="flex items-center gap-1 bg-secondary/60 p-1 rounded-lg border border-border shrink-0">
            <Button
              variant={chartMode === "cashflow" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setChartMode("cashflow")}
              className={`text-xs h-7 px-2.5 font-semibold rounded-md transition-all ${
                chartMode === "cashflow" ? "shadow-xs text-foreground font-bold" : "text-muted-foreground"
              }`}
            >
              Flux Encaissés vs Dépenses
            </Button>
            <Button
              variant={chartMode === "revenue" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setChartMode("revenue")}
              className={`text-xs h-7 px-2.5 font-semibold rounded-md transition-all ${
                chartMode === "revenue" ? "shadow-xs text-foreground font-bold" : "text-muted-foreground"
              }`}
            >
              Revenus Facturés
            </Button>
          </div>
        </CardHeader>

        <CardContent className="h-[320px] pt-2">
          {!hasCashflowData ? (
            <div className="flex flex-col items-center justify-center h-full border border-dashed rounded-lg text-muted-foreground text-center p-6">
              <BarChart2 className="w-10 h-10 text-muted-foreground/30 mb-2" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                Aucun mouvement financier enregistré sur cette période.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  {/* Dégradé Recettes / Encaissements (Bleu primaire #1E40AF) */}
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1E40AF" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#1E40AF" stopOpacity={0.02} />
                  </linearGradient>

                  {/* Dégradé Dépenses / Sorties (Rose #E11D48) */}
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E11D48" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#E11D48" stopOpacity={0.02} />
                  </linearGradient>

                  {/* Dégradé Revenus Facturés */}
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 700 }}
                  tickFormatter={formatYAxis}
                />

                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (active && payload && payload.length) {
                      if (chartMode === "cashflow") {
                        const inc = payload.find((p: any) => p.dataKey === "income")?.value ?? 0
                        const exp = payload.find((p: any) => p.dataKey === "expense")?.value ?? 0
                        const net = inc - exp
                        return (
                          <div className="bg-popover text-popover-foreground border border-border shadow-lg rounded-lg p-3 text-xs space-y-1.5 min-w-[190px]">
                            <p className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
                            <div className="flex items-center justify-between text-blue-600 font-semibold gap-3">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                                Recettes :
                              </span>
                              <span className="tabular-nums font-mono">{formatCurrency(inc)}</span>
                            </div>
                            <div className="flex items-center justify-between text-rose-500 font-semibold gap-3">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                                Dépenses :
                              </span>
                              <span className="tabular-nums font-mono">{formatCurrency(exp)}</span>
                            </div>
                            <div className="border-t border-border pt-1.5 flex items-center justify-between font-bold">
                              <span className="text-muted-foreground">Solde net :</span>
                              <span className={`tabular-nums font-mono ${net >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                                {formatCurrency(net)}
                              </span>
                            </div>
                          </div>
                        )
                      }
                      const rev = payload[0]?.value ?? 0
                      return (
                        <div className="bg-popover text-popover-foreground border border-border shadow-lg rounded-lg p-3 text-xs space-y-1 min-w-[170px]">
                          <p className="font-bold text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
                          <div className="flex items-center justify-between text-blue-600 font-semibold gap-3">
                            <span>Revenu Facturé :</span>
                            <span className="tabular-nums font-mono">{formatCurrency(rev)}</span>
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />

                {chartMode === "cashflow" ? (
                  <>
                    <Area
                      type="monotone"
                      dataKey="income"
                      name="Recettes / Encaissements"
                      stroke="#1E40AF"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorIncome)"
                    />
                    <Area
                      type="monotone"
                      dataKey="expense"
                      name="Dépenses / Sorties"
                      stroke="#E11D48"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorExpense)"
                    />
                  </>
                ) : (
                  <Area
                    type="monotone"
                    dataKey="value"
                    name="Revenus Facturés"
                    stroke="#3B82F6"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorRev)"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Carte Latérale : Modes de Paiement & Prévisions d'Encaissement */}
      <Card className="border-border shadow-sm flex flex-col justify-between">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-md font-semibold text-foreground flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-primary opacity-80" />
              Modes de Paiement
            </CardTitle>
          </div>
          <CardDescription className="text-[10px] uppercase font-medium tracking-widest mt-0.5">
            Répartition des encaissements en %
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-1">
          {/* Donut Chart en haut */}
          <div className="h-[150px] flex items-center justify-center">
            {paymentMethodData && paymentMethodData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethodData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={4}
                    dataKey="amount"
                    nameKey="method"
                  >
                    {paymentMethodData.map((_entry, index: number) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(val: number) => [`${val}%`, "Part"]}
                  />
                  <Legend
                    iconType="circle"
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    wrapperStyle={{ fontSize: "10px", fontWeight: 700, paddingTop: "8px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground italic">Aucun paiement enregistré</p>
            )}
          </div>

          {/* Bloc Visuel : Prévisions & Ratios Clés */}
          <div className="pt-3 border-t border-border/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                Prévisions & Ratios Clés
              </span>
            </div>

            {/* Taux de recouvrement */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Taux de recouvrement</span>
                <span className="font-bold text-emerald-600 tabular-nums">
                  {forecastMetrics?.collectionRate ?? 0}%
                </span>
              </div>
              <div className="w-full bg-secondary/80 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, forecastMetrics?.collectionRate ?? 0))}%` }}
                />
              </div>
            </div>

            {/* Taux de conversion Devis */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Taux de conversion Devis</span>
                <span className="font-bold text-blue-600 tabular-nums">
                  {forecastMetrics?.quoteConversionRate ?? 0}%
                </span>
              </div>
              <div className="w-full bg-secondary/80 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, forecastMetrics?.quoteConversionRate ?? 0))}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
