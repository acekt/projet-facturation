"use client"

import { useState, useEffect } from "react"
import { useStore } from "@/lib/store"
import {
    UserPlus, 
    FileText, 
    Clock, 
    AlertCircle,
    ArrowUpRight, 
    CheckCircle, 
    TrendingUp,
    BarChart2
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { FullScreenDocumentViewer } from "@/components/fullscreen-document-viewer"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { VisuallyHidden } from "@/components/ui/visually-hidden"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { type Invoice } from "@/lib/store"
import { DashboardMetricsResponse } from "@/lib/types/api"

interface DashboardUserProps {
  onNavigate: (page: string) => void
}

interface UserDashboardState extends Omit<Partial<DashboardMetricsResponse>, 'userPerformance' | 'revenueData'> {
  metrics?: DashboardMetricsResponse;
  revenueData?: Array<{ label?: string; value?: number; date: string; revenue: number }>;
  paymentMethodData?: Array<{ method: string; amount: number }>;
  recentInvoices?: Invoice[];
  activityTimeline?: Array<{ id: string; action: string; client: string; time: string }>;
  userPerformance?: Array<{ username: string; total_collected: number }>;
}

export function DashboardUser({ onNavigate }: DashboardUserProps) {
  const [isMounted, setIsMounted] = useState(false)
  const isDataLoaded = useStore(state => state.isDataLoaded)
  const user = useStore(state => state.user)

  const [data, setData] = useState<UserDashboardState>({
    metrics: {
      totalRevenue: 0,
      growth: "0",
      pendingRevenue: 0,
      overdueRevenue: 0,
      paidCount: 0,
      unpaidCount: 0,
      partiallyPaidCount: 0,
      totalInvoicesCount: 0,
      pendingQuotesCount: 0,
      topClients: [],
      userPerformance: []
    },
    revenueData: [],
    paymentMethodData: [],
    recentInvoices: [],
    activityTimeline: [],
    topClients: [],
    userPerformance: []
  })
  const [isLoading, setIsLoading] = useState(true)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewData, setPreviewData] = useState<Invoice | null>(null)

  useEffect(() => {
    setIsMounted(true)

    // AbortController prevents setState on unmounted component
    const controller = new AbortController()

    ;(async () => {
      try {
        const res = await fetch('/api/dashboard/metrics?range=month', {
          signal: controller.signal,
          cache: 'no-store',
        })

        // --- Guard 1: HTTP error (401 Middleware redirect, 500 crash, etc.) ---
        if (!res.ok) {
          const contentType = res.headers.get('content-type') ?? ''
          if (!contentType.includes('application/json')) {
            throw new Error(
              `Le serveur a renvoyé une page inattendue (HTTP ${res.status}). ` +
              `Vérifiez que SESSION_SECRET est configuré dans .env.local et que le serveur est démarré.`
            )
          }
          const errorBody = await res.json().catch(() => ({}))
          throw new Error(errorBody?.error || `Erreur HTTP ${res.status}`)
        }

        // --- Guard 2: Successful response but wrong Content-Type (e.g. proxy returning HTML) ---
        const contentType = res.headers.get('content-type') ?? ''
        if (!contentType.includes('application/json')) {
          throw new Error(
            'Le serveur a renvoyé une réponse non-JSON. ' +
            'Le middleware ou un proxy a peut-être intercepté la requête.'
          )
        }

        const d = await res.json().catch(() => null)
        if (!controller.signal.aborted && d && typeof d === 'object') {
          const normalizedData: UserDashboardState = {
            ...d,
            metrics: d.metrics || {
              totalRevenue: d.totalRevenue ?? 0,
              growth: d.growth ?? 0,
              pendingRevenue: d.pendingRevenue ?? 0,
              overdueRevenue: d.overdueRevenue ?? 0,
              paidCount: d.paidCount ?? 0,
              unpaidCount: d.unpaidCount ?? 0,
              partiallyPaidCount: d.partiallyPaidCount ?? 0,
              totalInvoicesCount: d.totalInvoicesCount ?? 0,
              pendingQuotesCount: d.pendingQuotesCount ?? 0,
            },
            revenueData: d.revenueData || [],
            paymentMethodData: d.paymentMethodData || [],
            recentInvoices: d.recentInvoices || [],
            activityTimeline: d.activityTimeline || [],
            topClients: d.topClients || [],
            userPerformance: d.userPerformance || [],
          }
          setData(normalizedData)
          useStore.getState().setDashboardMetrics(normalizedData as unknown as DashboardMetricsResponse)
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        console.error('[Dashboard User] Error fetching metrics:', err instanceof Error ? err.message : err)
        if (!controller.signal.aborted) {
          setData({
            metrics: {
              totalRevenue: 0,
              growth: "0",
              pendingRevenue: 0,
              overdueRevenue: 0,
              paidCount: 0,
              unpaidCount: 0,
              partiallyPaidCount: 0,
              totalInvoicesCount: 0,
              pendingQuotesCount: 0,
              topClients: [],
              userPerformance: []
            },
            revenueData: [],
            paymentMethodData: [],
            recentInvoices: [],
            activityTimeline: [],
            topClients: [],
            userPerformance: []
          })
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      controller.abort()
    }
  }, [])

  // LE GUARD CLAUSE OBLIGATOIRE (Anti-Flash)
  if (!isMounted || !isDataLoaded) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground font-medium">
        Chargement sécurisé de votre espace...
      </div>
    )
  }

  const rawMetrics: Partial<DashboardMetricsResponse> = data?.metrics || {}
  const metrics = {
    totalRevenue: rawMetrics.totalRevenue ?? data?.totalRevenue ?? 0,
    growth: String(rawMetrics.growth ?? data?.growth ?? 0),
    pendingRevenue: rawMetrics.pendingRevenue ?? data?.pendingRevenue ?? 0,
    overdueRevenue: rawMetrics.overdueRevenue ?? data?.overdueRevenue ?? 0,
    paidCount: rawMetrics.paidCount ?? data?.paidCount ?? 0,
    unpaidCount: rawMetrics.unpaidCount ?? data?.unpaidCount ?? 0,
    partiallyPaidCount: rawMetrics.partiallyPaidCount ?? data?.partiallyPaidCount ?? 0,
    totalInvoicesCount: rawMetrics.totalInvoicesCount ?? data?.totalInvoicesCount ?? 0,
    pendingQuotesCount: rawMetrics.pendingQuotesCount ?? data?.pendingQuotesCount ?? 0,
  }

  const totalRevenu = metrics.totalRevenue ?? 0

  // Formateur intelligent pour l'axe Y
  const formatYAxis = (val: number) => {
    if (val === 0) return '0';
    if (val >= 1000) {
      return new Intl.NumberFormat('fr-FR', {
        notation: 'compact',
        compactDisplay: 'short',
        maximumFractionDigits: 1
      }).format(val);
    }
    return val.toString();
  }

  return (
    <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-8">
      
      {/* En-tête du Dashboard */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tighter">Tableau de Bord</h1>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-widest mt-1">Espace Opérateur</p>
        </div>
        
        <div className="flex gap-2">
            {user?.role === 'admin' && (
              <Button 
                onClick={() => onNavigate('clients')} 
                className="bg-primary hover:bg-primary/90 text-primary-foreground h-10 px-5 font-bold gap-2 text-xs shadow-md shadow-primary/10"
              >
                  <UserPlus className="w-4 h-4" /> NOUVEAU CLIENT
              </Button>
            )}
        </div>
      </div>

      {/* Cartes KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border hover:border-indigo-500/30 transition-all group shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardDescription className="uppercase text-[10px] font-medium tracking-widest">Mes Devis Actifs</CardDescription>
                <FileText className="w-4 h-4 text-indigo-500 opacity-40" />
            </CardHeader>
            <CardContent>
                <p className="text-3xl font-semibold mb-0">{metrics.pendingQuotesCount ?? 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-tighter">Non convertis en factures</p>
            </CardContent>
        </Card>

        <Card className="bg-card border-border hover:border-emerald-500/30 transition-all group shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardDescription className="uppercase text-[10px] font-medium tracking-widest text-emerald-600">Factures Payées</CardDescription>
                <CheckCircle className="w-4 h-4 text-emerald-500 opacity-40" />
            </CardHeader>
            <CardContent>
                <p className="text-3xl font-semibold text-emerald-600 mb-0">{metrics.paidCount ?? 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-tighter">Règlements complets</p>
            </CardContent>
        </Card>

        <Card className="bg-card border-border hover:border-amber-500/30 transition-all group shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardDescription className="uppercase text-[10px] font-medium tracking-widest text-amber-600">Factures Partielles</CardDescription>
                <Clock className="w-4 h-4 text-amber-500 opacity-40" />
            </CardHeader>
            <CardContent>
                <p className="text-3xl font-semibold text-amber-600 mb-0">{metrics.partiallyPaidCount ?? 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-tighter">Acomptes reçus</p>
            </CardContent>
        </Card>

        <Card className="bg-card border-border hover:border-red-500/30 transition-all group shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardDescription className="uppercase text-[10px] font-medium tracking-widest text-red-500">Factures Non Payées</CardDescription>
                <AlertCircle className="w-4 h-4 text-red-500 opacity-40" />
            </CardHeader>
            <CardContent>
                <p className="text-3xl font-semibold text-red-500 mb-0">{metrics.unpaidCount ?? 0}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-tighter">En attente de paiement</p>
            </CardContent>
        </Card>
      </div>

      {/* Section Graphique & Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-md font-semibold text-indigo-600">Performance de Facturation</CardTitle>
                    <CardDescription className="text-[10px] uppercase font-medium tracking-widest">Revenus encaissés (XAF)</CardDescription>
                </div>
                <TrendingUp className="w-4 h-4 text-muted-foreground opacity-30" />
            </CardHeader>
            <CardContent className="h-[350px]">
                {totalRevenu === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[300px] border border-dashed rounded-lg text-muted-foreground text-center">
                    <BarChart2 className="w-8 h-8 text-muted-foreground/20 mb-2" />
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">
                      Aucune donnée financière générée sur cette période.
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={data.revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorRevUser" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
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
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '10px' }}
                            formatter={(val: number) => [formatCurrency(val), 'Encaissé']}
                        />
                        <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorRevUser)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
            </CardContent>
        </Card>

        {/* Bloc Performance / CA */}
        <Card className="border-border bg-indigo-500/[0.02] border-indigo-500/10">
            <CardHeader>
                <div className="flex items-center gap-2 text-indigo-600">
                    <TrendingUp className="w-4 h-4" />
                    <CardTitle className="text-sm uppercase tracking-widest font-semibold">Performance</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-500/20 shadow-sm shadow-indigo-500/5">
                    <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold">Croissance</span>
                        <Badge className="bg-emerald-100 text-emerald-700 text-[10px] px-1 py-0 h-4 border-emerald-200">+{metrics.growth ?? 0}%</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">vs mois précédent</p>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-500/20 shadow-sm shadow-indigo-500/5">
                    <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold">Chiffre d'Affaires</span>
                        <Badge className="bg-indigo-100 text-indigo-700 text-[10px] px-1 py-0 h-4 border-indigo-200">Mois</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">{formatCurrency(metrics.totalRevenue ?? 0)}</p>
                </div>
            </CardContent>
        </Card>
      </div>

      {/* Activité Récente */}
      <Card className="border-border shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-secondary/10">
                <div>
                    <CardTitle className="text-md font-semibold">Activité Récente</CardTitle>
                    <CardDescription className="text-[10px] uppercase font-medium tracking-widest">Derniers documents émis</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="text-indigo-600 font-semibold text-[10px] uppercase tracking-tighter" onClick={() => onNavigate('invoices')}>
                    TOUT VOIR <ArrowUpRight className="w-3 h-3 ml-1" />
                </Button>
            </CardHeader>
            <CardContent className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/50">
                    {(data.activityTimeline || []).map((log) => (
                        <div key={log.id} className="flex items-center justify-between p-3 hover:bg-secondary/20 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                                    <FileText className="w-4 h-4 text-indigo-500" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold">{log.action}</p>
                                    <p className="text-[9px] text-muted-foreground uppercase font-semibold">{log.client}</p>
                                </div>
                            </div>
                            <span className="text-[9px] font-bold text-muted-foreground">{log.time}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
      </Card>

      {previewOpen && previewData && (
        <FullScreenDocumentViewer
          type="facture"
          data={previewData as Invoice}
          title={`Document N° ${(previewData as Invoice).number || 'Inconnu'}`}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  )
}
