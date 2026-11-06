"use client"

import { getDashboardMetrics } from "@/app/actions/dashboard.actions"
import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import { useStore } from "@/lib/store"
import type { DashboardMetricsResponse } from "@/lib/types/api"
import {
  Users,
  FileText,
  AlertCircle,
  ScrollText,
  ShieldCheck,
  Wallet,
  Package,
  CheckCircle2,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { formatCurrency } from "@/lib/utils"
import { DashboardSkeleton } from "@/components/dashboard/skeleton"
import { DashboardRevenueChart } from "@/components/dashboard/DashboardRevenueChart"
import { DashboardActivityTimeline } from "@/components/dashboard/DashboardActivityTimeline"

interface DashboardAdminProps {
  onNavigate: (page: string) => void
}

type DashboardPeriod = "month" | "quarter" | "year"

interface DashboardAdminData extends DashboardMetricsResponse {
  revenueData: Array<{ date: string; revenue: number; label: string; value: number }>
  paymentMethodData: Array<{ method: string; amount: number }>
  userPerformance: Array<{ name: string; docsCount: number; totalRevenue: number }>
  topClients: Array<{ clientName: string; totalRevenue: number }>
  activityTimeline: Array<{ id: string; action: string; client: string; time: string }>
}

const PERIOD_OPTIONS: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "month", label: "30 jours" },
  { value: "quarter", label: "Trimestre" },
  { value: "year", label: "Année" },
]

export function DashboardAdmin({ onNavigate }: DashboardAdminProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [period, setPeriod] = useState<DashboardPeriod>("month")
  const isDataLoaded = useStore((state) => state.isDataLoaded)
  const invoicesCount = useStore((state) => state.invoices.length)
  const paymentsCount = useStore((state) => state.payments.length)
  const quotesCount = useStore((state) => state.quotes.length)
  const setDashboardMetrics = useStore((state) => state.setDashboardMetrics)

  const [data, setData] = useState<DashboardAdminData>({
    paidCount: 0,
    partiallyPaidCount: 0,
    unpaidCount: 0,
    pendingQuotesCount: 0,
    totalRevenue: 0,
    growth: "0",
    pendingRevenue: 0,
    overdueRevenue: 0,
    totalInvoicesCount: 0,
    revenueData: [],
    paymentMethodData: [],
    userPerformance: [],
    topClients: [],
    activityTimeline: [],
    ledgerSummary: {
      totalIn: 0,
      totalOut: 0,
      netTreasury: 0,
      averageMonthlyExpenses: 0,
    },
    cashflowSeries: [],
    forecastMetrics: {
      expectedInflows30d: 0,
      weightedQuotesPipeline: 0,
      totalPendingQuotesAmount: 0,
      projectedNetCash30d: 0,
      collectionRate: 100,
      quoteConversionRate: 0,
    },
    stockMetrics: {
      trackedCount: 0,
      lowStockCount: 0,
      outOfStockCount: 0,
      totalStockValue: 0,
      lowStockItems: [],
    },
    quotesPipelineAmount: {
      count: 0,
      ttc: 0,
      ht: 0,
    },
  })

  const fetchMetrics = useCallback(
    async (selectedPeriod: DashboardPeriod) => {
      try {
        const res = await getDashboardMetrics(selectedPeriod)
        if (!res.success) {
          console.warn("[Dashboard Admin] API returned error:", res.error)
          return
        }

        if (res.data) {
          const metrics = res.data
          const formatted: DashboardAdminData = {
            paidCount: metrics.paidCount || 0,
            partiallyPaidCount: metrics.partiallyPaidCount || 0,
            unpaidCount: metrics.unpaidCount || 0,
            pendingQuotesCount: metrics.pendingQuotesCount || 0,
            totalRevenue: metrics.totalRevenue || 0,
            growth: String(metrics.growth ?? "0"),
            pendingRevenue: metrics.pendingRevenue || 0,
            overdueRevenue: metrics.overdueRevenue || 0,
            totalInvoicesCount: metrics.totalInvoicesCount || 0,
            revenueData: (metrics.revenueData || []).map((r) => ({
              date: r.date || r.label || "",
              revenue: r.revenue ?? r.value ?? 0,
              label: r.label || r.date || "",
              value: r.value ?? r.revenue ?? 0,
            })),
            paymentMethodData: metrics.paymentMethodData || [],
            userPerformance: metrics.userPerformance || [],
            topClients: metrics.topClients || [],
            activityTimeline: metrics.activityTimeline || [],
            ledgerSummary: metrics.ledgerSummary || {
              totalIn: 0,
              totalOut: 0,
              netTreasury: 0,
              averageMonthlyExpenses: 0,
            },
            cashflowSeries: metrics.cashflowSeries || [],
            forecastMetrics: metrics.forecastMetrics || {
              expectedInflows30d: 0,
              weightedQuotesPipeline: 0,
              totalPendingQuotesAmount: 0,
              projectedNetCash30d: 0,
              collectionRate: 100,
              quoteConversionRate: 0,
            },
            stockMetrics: metrics.stockMetrics || {
              trackedCount: 0,
              lowStockCount: 0,
              outOfStockCount: 0,
              totalStockValue: 0,
              lowStockItems: [],
            },
            quotesPipelineAmount: metrics.quotesPipelineAmount || {
              count: 0,
              ttc: 0,
              ht: 0,
            },
          }
          setData(formatted)
          setDashboardMetrics(formatted as unknown as DashboardMetricsResponse)
        }
      } catch (err: unknown) {
        console.error("[Dashboard Admin] Failed to fetch metrics:", err)
      }
    },
    [setDashboardMetrics]
  )

  useEffect(() => {
    setIsMounted(true)
    const currentMetrics = useStore.getState().dashboardMetrics
    if (currentMetrics) {
      setData((prev) => ({
        ...prev,
        ...currentMetrics,
        revenueData: (currentMetrics.revenueData || []).map((r) => ({
          date: r.date || r.label || "",
          revenue: r.revenue ?? r.value ?? 0,
          label: r.label || r.date || "",
          value: r.value ?? r.revenue ?? 0,
        })),
        paymentMethodData: currentMetrics.paymentMethodData || [],
        userPerformance: currentMetrics.userPerformance || [],
        topClients: currentMetrics.topClients || [],
        activityTimeline: currentMetrics.activityTimeline || [],
      }))
    }
  }, [])

  const fetchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current)
    }
    fetchTimeoutRef.current = setTimeout(() => {
      fetchMetrics(period)
    }, 100)
    return () => {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current)
    }
  }, [period, invoicesCount, paymentsCount, quotesCount, fetchMetrics])

  useEffect(() => {
    const onRefresh = () => {
      fetchMetrics(period)
    }
    window.addEventListener("facturier:data-refresh", onRefresh)
    return () => window.removeEventListener("facturier:data-refresh", onRefresh)
  }, [period, fetchMetrics])

  if (!isMounted || !isDataLoaded) {
    return <DashboardSkeleton />
  }

  const totalRevenu = data.totalRevenue ?? 0

  const formatYAxis = (val: number) => {
    if (val === 0) return "0"
    if (val >= 1000) {
      return new Intl.NumberFormat("fr-FR", {
        notation: "compact",
        compactDisplay: "short",
        maximumFractionDigits: 1,
      }).format(val)
    }
    return val.toString()
  }

  const lowStockAlertCount = (data.stockMetrics?.lowStockCount ?? 0) + (data.stockMetrics?.outOfStockCount ?? 0)
  const forecastInflows30d = (data.forecastMetrics?.expectedInflows30d ?? 0) + (data.forecastMetrics?.weightedQuotesPipeline ?? 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Zone Haute Fixe : En-tête exécutif & Filtre temporel */}
      <div className="shrink-0 pb-4 border-b border-border bg-background z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tighter">Tableau de Bord</h1>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-widest mt-1">
            Vision stratégique &amp; Pilotage financier 360°
          </p>
        </div>
        <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-lg border border-border">
          {PERIOD_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={period === opt.value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setPeriod(opt.value)}
              className="text-xs h-7 px-3 font-semibold rounded-md transition-all cursor-pointer"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Zone Corps Défilable */}
      <div className="flex-1 overflow-y-auto min-h-0 pt-4 pr-1 space-y-6">

      {/* LIGNE 1 : Grille de 6 Cartes KPIs Exécutives */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* 1. Chiffre d'Affaires Encaissé */}
        <Card className="bg-card border-border shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase text-[10px] font-medium tracking-widest text-emerald-600 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> CA Encaissé
            </CardDescription>
            <CardTitle className="text-xl xl:text-2xl font-semibold text-foreground tracking-tight tabular-nums mt-1 font-mono">
              {formatCurrency(totalRevenu)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-tighter">
              {data.paidCount ?? 0} facture{(data.paidCount ?? 0) > 1 ? "s" : ""} soldée{(data.paidCount ?? 0) > 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        {/* 2. Trésorerie Nette (Livre) */}
        <Card className="bg-card border-border shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase text-[10px] font-medium tracking-widest text-indigo-600 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" /> Trésorerie Nette
            </CardDescription>
            <CardTitle
              className={`text-xl xl:text-2xl font-semibold tracking-tight tabular-nums mt-1 font-mono ${
                (data.ledgerSummary?.netTreasury ?? 0) >= 0 ? "text-foreground" : "text-rose-600"
              }`}
            >
              {formatCurrency(data.ledgerSummary?.netTreasury ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-[10px] text-muted-foreground font-medium tracking-tighter truncate" title={`+${formatCurrency(data.ledgerSummary?.totalIn ?? 0)} | -${formatCurrency(data.ledgerSummary?.totalOut ?? 0)}`}>
              +{formatCurrency(data.ledgerSummary?.totalIn ?? 0)} | -{formatCurrency(data.ledgerSummary?.totalOut ?? 0)}
            </p>
          </CardContent>
        </Card>

        {/* 3. Créances à Recouvrer */}
        <Card className="bg-card border-border shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase text-[10px] font-medium tracking-widest text-red-500 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> Créances à Recouvrer
            </CardDescription>
            <CardTitle className="text-xl xl:text-2xl font-semibold text-red-500 tabular-nums mt-1 font-mono">
              {formatCurrency(data.pendingRevenue ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-tighter">
              {(data.unpaidCount ?? 0) + (data.partiallyPaidCount ?? 0)} facture{((data.unpaidCount ?? 0) + (data.partiallyPaidCount ?? 0)) > 1 ? "s" : ""} en attente
            </p>
          </CardContent>
        </Card>

        {/* 4. Devis en Attente */}
        <Card className="bg-card border-border shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase text-[10px] font-medium tracking-widest text-blue-500 flex items-center gap-1.5">
              <ScrollText className="w-3.5 h-3.5" /> Devis En Attente
            </CardDescription>
            <CardTitle className="text-xl xl:text-2xl font-semibold text-blue-500 tabular-nums mt-1 font-mono">
              {data.pendingQuotesCount ?? 0} devis
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p
              className="text-[10px] text-muted-foreground uppercase font-medium tracking-tighter truncate"
              title={`${formatCurrency(data.quotesPipelineAmount?.ttc ?? 0)} TTC (${formatCurrency(data.quotesPipelineAmount?.ht ?? 0)} HT)`}
            >
              {formatCurrency(data.quotesPipelineAmount?.ttc ?? 0)} TTC
            </p>
          </CardContent>
        </Card>

        {/* 5. Valeur du Stock */}
        <Card className="bg-card border-border shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase text-[10px] font-medium tracking-widest text-amber-600 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> Valeur du Stock
            </CardDescription>
            <CardTitle className="text-xl xl:text-2xl font-semibold text-foreground tracking-tight tabular-nums mt-1 font-mono">
              {formatCurrency(data.stockMetrics?.totalStockValue ?? 0)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {lowStockAlertCount > 0 ? (
              <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-tighter flex items-center gap-1">
                <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                {lowStockAlertCount} alerte{lowStockAlertCount > 1 ? "s" : ""} ({data.stockMetrics?.trackedCount ?? 0} suivis)
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-tighter">
                {data.stockMetrics?.trackedCount ?? 0} article{(data.stockMetrics?.trackedCount ?? 0) > 1 ? "s" : ""} suivi{(data.stockMetrics?.trackedCount ?? 0) > 1 ? "s" : ""}
              </p>
            )}
          </CardContent>
        </Card>

        {/* 6. Prévision +30 Jours */}
        <Card className="bg-card border-border shadow-sm flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase text-[10px] font-medium tracking-widest text-teal-600 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Prévision +30 Jours
            </CardDescription>
            <CardTitle className="text-xl xl:text-2xl font-semibold text-teal-600 tracking-tight tabular-nums mt-1 font-mono">
              {formatCurrency(forecastInflows30d)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-1">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] text-muted-foreground tracking-tighter">
                Atterrissage :
              </span>
              <Badge variant="outline" className="text-[9px] font-bold py-0 px-1 border-teal-500/40 text-teal-600 bg-teal-500/5">
                {formatCurrency(data.forecastMetrics?.projectedNetCash30d ?? 0)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* LIGNE 2 : Graphiques Analytiques & Prévisions */}
      <DashboardRevenueChart
        cashflowSeries={data.cashflowSeries}
        revenueData={data.revenueData}
        paymentMethodData={data.paymentMethodData}
        totalRevenue={totalRevenu}
        forecastMetrics={data.forecastMetrics}
        formatYAxis={formatYAxis}
      />

      {/* LIGNE 3 : Top Clients, État des Stocks & Performance Opérateurs — ZÉRO COUPURE CSS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Carte 1 : Top Clients */}
        <Card className="border-border shadow-sm h-auto min-h-[280px] flex flex-col justify-between">
          <CardHeader className="flex flex-row items-center justify-between shrink-0 pb-2">
            <div>
              <CardTitle className="text-md font-semibold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> Top Clients
              </CardTitle>
              <CardDescription className="text-[10px] uppercase font-medium tracking-widest mt-0.5">
                Contributeurs majeurs au CA
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-3">
              {(data?.topClients || []).map((client, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50 hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 font-bold text-xs tabular-nums shrink-0">
                      {index + 1}
                    </div>
                    <span className="text-xs font-bold block truncate" title={client.clientName}>
                      {client.clientName}
                    </span>
                  </div>
                  <p className="text-xs font-semibold tabular-nums shrink-0 font-mono">
                    {formatCurrency(client.totalRevenue)}
                  </p>
                </div>
              ))}
              {(!data?.topClients || data.topClients.length === 0) && (
                <div className="text-center py-8">
                  <p className="text-xs text-muted-foreground italic">Aucun client enregistré</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Carte 2 : État des Stocks & Alertes */}
        <Card className="border-border shadow-sm h-auto min-h-[280px] flex flex-col justify-between">
          <CardHeader className="flex flex-row items-center justify-between shrink-0 pb-2">
            <div>
              <CardTitle className="text-md font-semibold flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-600" /> État des Stocks &amp; Alertes
              </CardTitle>
              <CardDescription className="text-[10px] uppercase font-medium tracking-widest mt-0.5">
                Articles prioritaires sous surveillance
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-2 font-medium text-muted-foreground hover:text-foreground"
              onClick={() => onNavigate("stock")}
            >
              Gérer <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-3">
              {(data?.stockMetrics?.lowStockItems || []).map((item) => {
                const isOutOfStock = item.stockQuantity <= 0
                const isLowStock = !isOutOfStock && item.stockQuantity <= item.minStockAlert
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="text-xs font-bold block truncate" title={item.physicalTitle || item.name}>
                        {item.physicalTitle || item.name}
                      </span>
                      <span className="text-[9px] text-muted-foreground uppercase font-semibold tabular-nums">
                        Stock : {item.stockQuantity} · Seuil : {item.minStockAlert}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isOutOfStock ? (
                        <Badge variant="destructive" className="text-[10px] uppercase font-bold py-0.5 px-2">
                          Rupture
                        </Badge>
                      ) : isLowStock ? (
                        <Badge className="bg-amber-500/10 text-amber-600 border border-amber-300 text-[10px] uppercase font-bold py-0.5 px-2">
                          Alerte
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] uppercase font-semibold py-0.5 px-2">
                          OK
                        </Badge>
                      )}
                    </div>
                  </div>
                )
              })}
              {(!data?.stockMetrics?.lowStockItems || data.stockMetrics.lowStockItems.length === 0) && (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mx-auto mb-1.5" />
                  <p className="text-xs text-muted-foreground font-medium">Tous les stocks sont à niveau optimal</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Carte 3 : Performance Opérateurs */}
        <Card className="border-border shadow-sm h-auto min-h-[280px] flex flex-col justify-between">
          <CardHeader className="flex flex-row items-center justify-between shrink-0 pb-2">
            <div>
              <CardTitle className="text-md font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" /> Performance Opérateurs
              </CardTitle>
              <CardDescription className="text-[10px] uppercase font-medium tracking-widest mt-0.5">
                Volume et Revenus par compte
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-3">
              {(data?.userPerformance || []).map((u) => (
                <div
                  key={u.name}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50 hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0">
                      {u.name[0]?.toUpperCase() || "U"}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-bold block truncate" title={u.name}>{u.name}</span>
                      <span className="text-[9px] text-muted-foreground uppercase font-semibold tabular-nums">
                        {u.docsCount} DOCUMENT{u.docsCount > 1 ? "S" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold tabular-nums font-mono">{formatCurrency(u.totalRevenue)}</p>
                  </div>
                </div>
              ))}
              {(!data?.userPerformance || data.userPerformance.length === 0) && (
                <div className="text-center py-8">
                  <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-1.5" />
                  <p className="text-xs text-muted-foreground italic">Profil administrateur unique actif</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activités Récentes */}
      <DashboardActivityTimeline
        activityTimeline={data.activityTimeline}
        onNavigate={onNavigate}
      />

      {/* Raccourcis d'action */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Button
          className="h-12 text-sm font-semibold gap-2 shadow-sm"
          onClick={() => onNavigate("new-invoice")}
        >
          <FileText className="w-4 h-4" /> Nouvelle Facture
        </Button>
        <Button
          variant="outline"
          className="h-12 text-sm font-semibold gap-2 border-border shadow-sm"
          onClick={() => onNavigate("new-user")}
        >
          <Users className="w-4 h-4" /> Gérer les Utilisateurs
        </Button>
        <Button
          variant="secondary"
          className="h-12 text-sm font-semibold gap-2 shadow-sm"
          onClick={() => onNavigate("audit")}
        >
          <ScrollText className="w-4 h-4" /> Journal d&apos;Audit
        </Button>
      </div>
    </div>
    </div>
  )
}
