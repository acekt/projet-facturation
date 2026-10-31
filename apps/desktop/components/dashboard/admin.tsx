"use client"

import { getDashboardMetrics } from "@/app/actions/dashboard.actions"
import { useState, useEffect, useCallback } from "react"
import { useStore } from "@/lib/store"
import type { DashboardMetricsResponse } from "@/lib/types/api"
import {
  Users,
  FileText,
  AlertCircle,
  ScrollText,
  Clock,
  ShieldCheck,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { formatCurrency } from "@/lib/utils"
import { DashboardSkeleton } from "@/components/dashboard/skeleton"
import { DashboardRevenueChart } from "@/components/dashboard/DashboardRevenueChart"
import { DashboardActivityTimeline } from "@/components/dashboard/DashboardActivityTimeline"

interface DashboardAdminProps {
  onNavigate: (page: string) => void
}

type DashboardPeriod = "month" | "quarter" | "year"

interface DashboardAdminData extends Omit<DashboardMetricsResponse, "revenueData" | "paymentMethodData"> {
  paidCount: number
  partiallyPaidCount: number
  unpaidCount: number
  pendingQuotesCount: number
  totalRevenue: number
  growth: string
  pendingRevenue: number
  overdueRevenue: number
  totalInvoicesCount: number
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
      setData(currentMetrics as unknown as DashboardAdminData)
    }
  }, [])

  useEffect(() => {
    fetchMetrics(period)
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

  return (
    <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tighter">Tableau de Bord</h1>
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-widest mt-1">
            Vision stratégique admin
          </p>
        </div>
        <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-lg border border-border">
          {PERIOD_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={period === opt.value ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setPeriod(opt.value)}
              className="text-xs h-7 px-3 font-semibold rounded-md transition-all"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase text-[10px] font-medium tracking-widest text-emerald-600 flex items-center gap-2">
              <ShieldCheck className="w-3 h-3" /> Chiffre d&apos;Affaires Réalisé
            </CardDescription>
            <CardTitle className="text-2xl font-semibold text-foreground tracking-tight tabular-nums">
              {formatCurrency(totalRevenu)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-tighter">
              {data.paidCount ?? 0} factures soldées
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase text-[10px] font-medium tracking-widest text-amber-600 flex items-center gap-2">
              <Clock className="w-3 h-3" /> Factures Partielles
            </CardDescription>
            <CardTitle className="text-3xl font-semibold text-amber-600 tabular-nums">
              {data.partiallyPaidCount ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-tighter">Acomptes reçus</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase text-[10px] font-medium tracking-widest text-red-500 flex items-center gap-2">
              <AlertCircle className="w-3 h-3" /> Factures Non Payées
            </CardDescription>
            <CardTitle className="text-3xl font-semibold text-red-500 tabular-nums">
              {data.unpaidCount ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-tighter">
              En attente de paiement
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase text-[10px] font-medium tracking-widest text-blue-500 flex items-center gap-2">
              <ScrollText className="w-3 h-3" /> Devis En Attente
            </CardDescription>
            <CardTitle className="text-3xl font-semibold text-blue-500 tabular-nums">
              {data.pendingQuotesCount ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-tighter">
              Non convertis en factures
            </p>
          </CardContent>
        </Card>
      </div>

      <DashboardRevenueChart
        revenueData={data.revenueData}
        paymentMethodData={data.paymentMethodData}
        totalRevenue={totalRevenu}
        formatYAxis={formatYAxis}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-md font-semibold">Performance Opérateurs</CardTitle>
              <CardDescription className="text-[10px] uppercase font-medium tracking-widest">
                Volume et Revenus par compte
              </CardDescription>
            </div>
            <Users className="w-5 h-5 text-muted-foreground opacity-20" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(data?.userPerformance || []).map((u) => (
                <div
                  key={u.name}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold text-xs">
                      {u.name[0]}
                    </div>
                    <div>
                      <span className="text-xs font-bold block">{u.name}</span>
                      <span className="text-[9px] text-muted-foreground uppercase font-semibold tabular-nums">
                        {u.docsCount} DOCUMENTS
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold tabular-nums">{formatCurrency(u.totalRevenue)}</p>
                  </div>
                </div>
              ))}
              {(!data?.userPerformance || data.userPerformance.length === 0) && (
                <p className="text-xs text-muted-foreground italic text-center py-4">Aucune donnée disponible</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-md font-semibold">Top Clients</CardTitle>
              <CardDescription className="text-[10px] uppercase font-medium tracking-widest">
                Contributeurs majeurs au CA
              </CardDescription>
            </div>
            <ShieldCheck className="w-5 h-5 text-muted-foreground opacity-20" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(data?.topClients || []).map((client, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold text-xs tabular-nums">
                      {index + 1}
                    </div>
                    <span className="text-xs font-bold block">{client.clientName}</span>
                  </div>
                  <p className="text-xs font-semibold tabular-nums">{formatCurrency(client.totalRevenue)}</p>
                </div>
              ))}
              {(!data?.topClients || data.topClients.length === 0) && (
                <p className="text-xs text-muted-foreground italic text-center py-4">Aucun client</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <DashboardActivityTimeline
        activityTimeline={data.activityTimeline}
        onNavigate={onNavigate}
      />

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
  )
}
