"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
    Plus, UserPlus, FileText, Clock, AlertCircle,
    ArrowUpRight, Eye, CheckCircle, Search, TrendingUp
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { DocumentPreview } from "@/components/document-preview"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

interface DashboardUserProps {
  onNavigate: (page: string) => void
}

export function DashboardUser({ onNavigate }: DashboardUserProps) {
  const [data, setData] = React.useState({
    metrics: {
      totalRevenue: 0,
      growth: 0,
      pendingRevenue: 0,
      overdueRevenue: 0,
      paidCount: 0,
      unpaidCount: 0,
      partiallyPaidCount: 0,
      totalInvoicesCount: 0,
      pendingQuotesCount: 0
    },
    revenueData: [],
    paymentMethodData: [],
    recentInvoices: [],
    activityTimeline: [],
    topClients: []
  })
  const [isLoading, setIsLoading] = React.useState(false)
  const [previewOpen, setPreviewOpen] = React.useState(false)
  const [previewData, setPreviewData] = React.useState<any>(null)

  React.useEffect(() => {
    fetch('/api/dashboard/metrics?range=month')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch metrics')
        return res.json()
      })
      .then(d => {
        setData(d)
        setIsLoading(false)
      })
      .catch(err => {
        console.error('[Dashboard User] Error fetching metrics:', err)
        setData({ metrics: {} })
        setIsLoading(false)
      })
  }, [])

  const handlePreview = async (invoice: any) => {
    try {
        const res = await fetch(`/api/invoices/${invoice.id}`)
        if (res.ok) {
            const d = await res.json()
            setPreviewData(d)
            setPreviewOpen(true)
        }
    } catch (e) {}
  }

  const metrics = data?.metrics || {}
  const recentInvoices = data?.recentInvoices || []

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
            <h1 className="text-2xl font-black text-foreground tracking-tighter">Tableau de Bord</h1>
            <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mt-1">Espace Opérateur</p>
        </div>
        <div className="flex gap-2">
            <Button onClick={() => onNavigate('new-quote')} className="bg-indigo-600 hover:bg-indigo-700 h-10 px-6 font-bold gap-2 shadow-lg shadow-indigo-500/20 text-xs">
                <Plus className="w-4 h-4" /> CRÉER UN DEVIS
            </Button>
            <Button variant="outline" onClick={() => onNavigate('clients')} className="h-10 px-4 font-bold gap-2 text-xs">
                <UserPlus className="w-4 h-4" /> NOUVEAU CLIENT
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border hover:border-indigo-500/30 transition-all group shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardDescription className="uppercase text-[10px] font-bold tracking-widest">Mes Devis Actifs</CardDescription>
                <FileText className="w-4 h-4 text-indigo-500 opacity-40" />
            </CardHeader>
            <CardContent>
                <p className="text-3xl font-black mb-0">{metrics.pendingQuotesCount}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Non convertis en factures</p>
            </CardContent>
        </Card>

        <Card className="bg-card border-border hover:border-emerald-500/30 transition-all group shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardDescription className="uppercase text-[10px] font-bold tracking-widest text-emerald-600">Factures Payées</CardDescription>
                <CheckCircle className="w-4 h-4 text-emerald-500 opacity-40" />
            </CardHeader>
            <CardContent>
                <p className="text-3xl font-black text-emerald-600 mb-0">{metrics.paidCount}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Règlements complets</p>
            </CardContent>
        </Card>

        <Card className="bg-card border-border hover:border-amber-500/30 transition-all group shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardDescription className="uppercase text-[10px] font-bold tracking-widest text-amber-600">Factures Partielles</CardDescription>
                <Clock className="w-4 h-4 text-amber-500 opacity-40" />
            </CardHeader>
            <CardContent>
                <p className="text-3xl font-black text-amber-600 mb-0">{metrics.partiallyPaidCount}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Acomptes reçus</p>
            </CardContent>
        </Card>

        <Card className="bg-card border-border hover:border-red-500/30 transition-all group shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardDescription className="uppercase text-[10px] font-bold tracking-widest text-red-500">Factures Non Payées</CardDescription>
                <AlertCircle className="w-4 h-4 text-red-500 opacity-40" />
            </CardHeader>
            <CardContent>
                <p className="text-3xl font-black text-red-500 mb-0">{metrics.unpaidCount}</p>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">En attente de paiement</p>
            </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-md font-bold text-indigo-600">Performance de Facturation</CardTitle>
                    <CardDescription className="text-[10px] uppercase font-bold tracking-widest">Revenus encaissés (XAF)</CardDescription>
                </div>
                <TrendingUp className="w-4 h-4 text-muted-foreground opacity-30" />
            </CardHeader>
            <CardContent className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
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
                            tickFormatter={(val) => `${val/1000}k`}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '10px' }}
                            formatter={(val: any) => [formatCurrency(val), 'Encaissé']}
                        />
                        <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorRevUser)" />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>

        <Card className="border-border bg-indigo-500/[0.02] border-indigo-500/10">
            <CardHeader>
                <div className="flex items-center gap-2 text-indigo-600">
                    <TrendingUp className="w-4 h-4" />
                    <CardTitle className="text-sm uppercase tracking-widest font-black">Performance</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-500/20 shadow-sm shadow-indigo-500/5">
                    <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold">Croissance</span>
                        <Badge className="bg-emerald-100 text-emerald-700 text-[10px] px-1 py-0 h-4 border-emerald-200">+{metrics.growth || 0}%</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase font-black">vs mois précédent</p>
                </div>
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-indigo-500/20 shadow-sm shadow-indigo-500/5">
                    <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold">CA Encaissé</span>
                        <Badge className="bg-indigo-100 text-indigo-700 text-[10px] px-1 py-0 h-4 border-indigo-200">Mois</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase font-black">{formatCurrency(metrics.totalRevenue || 0)}</p>
                </div>
            </CardContent>
        </Card>
      </div>

      <Card className="border-border shadow-sm overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-secondary/10">
                <div>
                    <CardTitle className="text-md font-bold">Activité Récente</CardTitle>
                    <CardDescription className="text-[10px] uppercase font-bold tracking-widest">Derniers documents émis</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="text-indigo-600 font-black text-[10px] uppercase tracking-tighter" onClick={() => onNavigate('invoices')}>
                    TOUT VOIR <ArrowUpRight className="w-3 h-3 ml-1" />
                </Button>
            </CardHeader>
            <CardContent className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/50">
                    {(data.activityTimeline || []).map((log: any) => (
                        <div key={log.id} className="flex items-center justify-between p-3 hover:bg-secondary/20 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                                    <FileText className="w-4 h-4 text-indigo-500" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold">{log.action}</p>
                                    <p className="text-[9px] text-muted-foreground uppercase font-black">{log.client}</p>
                                </div>
                            </div>
                            <span className="text-[9px] font-bold text-muted-foreground">{log.time}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
      </Card>

      {previewData && (
        <DocumentPreview
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            type="Invoice"
            data={previewData}
        />
      )}
    </div>
  )
}
