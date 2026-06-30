"use client"

import { useState, useEffect } from "react"
import { useStore } from "@/lib/store"
import {
    Users, FileText, TrendingUp, DollarSign, AlertCircle,
    ArrowUpRight, Plus, ScrollText, Activity, ShieldCheck,
    Smartphone, Database, LayoutDashboard, Clock, PieChart as PieIcon,
    BarChart2, Inbox
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

interface DashboardAdminProps {
  onNavigate: (page: string) => void
}

interface DashboardAdminData {
  paidCount: number;
  partiallyPaidCount: number;
  unpaidCount: number;
  pendingQuotesCount: number;
  totalRevenue: number;
  growth: number | string;
  pendingRevenue: number;
  overdueRevenue: number;
  totalInvoicesCount: number;
  revenueData: Array<{ label: string; value: number }>;
  paymentMethodData: Array<{ method: string; amount: number }>;
  userPerformance: Array<{ name: string; docsCount: number; totalRevenue: number }>;
  topClients: Array<{ clientName: string; totalRevenue: number }>;
  activityTimeline: Array<{ id: string; action: string; client: string; time: string }>;
}

export function DashboardAdmin({ onNavigate }: DashboardAdminProps) {
  const [isMounted, setIsMounted] = useState(false)
  const isDataLoaded = useStore(state => state.isDataLoaded)

  const [data, setData] = useState<DashboardAdminData>({
    paidCount: 0,
    partiallyPaidCount: 0,
    unpaidCount: 0,
    pendingQuotesCount: 0,
    totalRevenue: 0,
    growth: 0,
    pendingRevenue: 0,
    overdueRevenue: 0,
    totalInvoicesCount: 0,
    revenueData: [],
    paymentMethodData: [],
    userPerformance: [],
    topClients: [],
    activityTimeline: []
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsMounted(true)
    fetch('/api/dashboard/metrics?range=month')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch metrics')
        return res.json()
      })
      .then((d: DashboardAdminData) => {
        setData(d)
        setIsLoading(false)
      })
      .catch(err => {
        console.error('[Dashboard Admin] Error fetching metrics:', err)
        setIsLoading(false)
      })
  }, [])

  // LE GUARD CLAUSE OBLIGATOIRE (Anti-Flash)
  if (!isMounted || !isDataLoaded) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground font-medium">
        Chargement sécurisé de votre espace...
      </div>
    )
  }

  const PIE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444']
  const totalRevenu = data.totalRevenue ?? 0

  // Formateur intelligent pour l'axe Y (Recharts)
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
    <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-semibold text-foreground tracking-tighter">Tableau de Bord</h1>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-widest mt-1">Vision stratégique admin</p>
        </div>
        <div className="flex items-center gap-2">
            <Badge variant="outline" className="h-8 border-amber-500/20 text-amber-600 bg-amber-500/5 px-3">SANTÉ OPTIMALE</Badge>
        </div>
      </div>

      {/* Cartes KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase text-[10px] font-medium tracking-widest flex items-center gap-2">
                <FileText className="w-3 h-3 text-indigo-500" /> Factures Payées
            </CardDescription>
            <CardTitle className="text-3xl font-semibold text-emerald-600">
              {data.paidCount ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-tighter">Règlements complets</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase text-[10px] font-medium tracking-widest text-amber-600 flex items-center gap-2">
                <Clock className="w-3 h-3" /> Factures Partielles
            </CardDescription>
            <CardTitle className="text-3xl font-semibold text-amber-600">
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
            <CardTitle className="text-3xl font-semibold text-red-500">
              {data.unpaidCount ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-tighter">En attente de paiement</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase text-[10px] font-medium tracking-widest text-blue-500 flex items-center gap-2">
                <ScrollText className="w-3 h-3" /> Devis En Attente
            </CardDescription>
            <CardTitle className="text-3xl font-semibold text-blue-500">
              {data.pendingQuotesCount ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-tighter">Non convertis en factures</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Graphique avec rendu conditionnel strict */}
        <Card className="md:col-span-2 border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-md font-semibold">Évolution Commerciale</CardTitle>
                    <CardDescription className="text-[10px] uppercase font-medium tracking-widest">Revenus perçus par mois (XAF)</CardDescription>
                </div>
                <Activity className="w-5 h-5 text-muted-foreground opacity-20" />
            </CardHeader>
            <CardContent className="h-[300px]">
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
                              <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
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
                              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                              formatter={(val: number) => [formatCurrency(val), 'Revenu']}
                          />
                          <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                      </AreaChart>
                  </ResponsiveContainer>
                )}
            </CardContent>
        </Card>

        {/* Modes de paiement */}
        <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-md font-semibold">Modes de Paiement</CardTitle>
                    <CardDescription className="text-[10px] uppercase font-medium tracking-widest">Répartition en %</CardDescription>
                </div>
                <PieIcon className="w-4 h-4 text-muted-foreground opacity-30" />
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
                {data?.paymentMethodData && data.paymentMethodData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data.paymentMethodData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="amount"
                                nameKey="method"
                            >
                                {data.paymentMethodData.map((_entry, index: number) => (
                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                                formatter={(val: number) => [`${val}%`, 'Part']}
                            />
                            <Legend
                                iconType="circle"
                                layout="horizontal"
                                verticalAlign="bottom"
                                align="center"
                                wrapperStyle={{ fontSize: '10px', fontWeight: 700, paddingTop: '20px' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Aucun paiement enregistré
                    </p>
                )}
            </CardContent>
        </Card>
      </div>

      {/* Reste de la page */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-md font-semibold">Performance Opérateurs</CardTitle>
                    <CardDescription className="text-[10px] uppercase font-medium tracking-widest">Volume et Revenus par compte</CardDescription>
                </div>
                <Users className="w-5 h-5 text-muted-foreground opacity-20" />
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {(data?.userPerformance || []).map((u) => (
                        <div key={u.name} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold text-xs">
                                    {u.name[0]}
                                </div>
                                <div>
                                    <span className="text-xs font-bold block">{u.name}</span>
                                    <span className="text-[9px] text-muted-foreground uppercase font-semibold">{u.docsCount} DOCUMENTS</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-semibold">{formatCurrency(u.totalRevenue)}</p>
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
                    <CardDescription className="text-[10px] uppercase font-medium tracking-widest">Contributeurs majeurs au CA</CardDescription>
                </div>
                <ShieldCheck className="w-5 h-5 text-muted-foreground opacity-20" />
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {(data?.topClients || []).map((client, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold text-xs">
                                    {index + 1}
                                </div>
                                <div>
                                    <span className="text-xs font-bold block">{client.clientName}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-semibold">{formatCurrency(client.totalRevenue)}</p>
                            </div>
                        </div>
                    ))}
                    {(!data?.topClients || data.topClients.length === 0) && (
                        <p className="text-xs text-muted-foreground italic text-center py-4">Aucun client</p>
                    )}
                </div>
            </CardContent>
        </Card>
      </div>

      <Card className="border-border overflow-hidden">
         <CardHeader className="bg-secondary/30">
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle className="text-lg">Journal d'Audit Récent</CardTitle>
                    <CardDescription>Dernières actions administratives et métier</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="text-indigo-500 font-bold text-xs uppercase tracking-tighter" onClick={() => onNavigate('audit')}>
                    Voir tout <ArrowUpRight className="w-3 h-3 ml-1" />
                </Button>
            </div>
         </CardHeader>
         <CardContent className="p-0">
            <div className="divide-y divide-border/50">
                {(data.activityTimeline || []).slice(0, 5).map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-4 hover:bg-secondary/20 transition-colors">
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                                <ScrollText className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">{log.action}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">{log.client}</p>
                            </div>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">{log.time}</span>
                    </div>
                ))}
                {data.activityTimeline.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                        <Inbox className="w-10 h-10 text-muted-foreground opacity-20" />
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Journal vide — aucune action enregistrée</p>
                    </div>
                )}
            </div>
         </CardContent>
      </Card>

      <div className="flex gap-4">
         <Button className="flex-1 bg-amber-500 hover:bg-amber-600 h-14 text-lg font-semibold tracking-tighter" onClick={() => onNavigate('users')}>
            <Users className="w-5 h-5 mr-2" /> AJOUTER UN UTILISATEUR
         </Button>
         <Button variant="secondary" className="flex-1 h-14 text-lg font-semibold tracking-tighter" onClick={() => onNavigate('audit')}>
            <ScrollText className="w-5 h-5 mr-2" /> VOIR LES LOGS
         </Button>
      </div>
    </div>
  )
}
