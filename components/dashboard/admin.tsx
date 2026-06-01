"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
    Users, FileText, TrendingUp, DollarSign, AlertCircle,
    ArrowUpRight, Plus, ScrollText, Activity, ShieldCheck,
    Smartphone, Database, LayoutDashboard, Clock, PieChart as PieIcon
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

export function DashboardAdmin({ onNavigate }: DashboardAdminProps) {
  const [data, setData] = React.useState<any>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    fetch('/api/dashboard/metrics?range=month')
      .then(res => res.json())
      .then(d => {
        setData(d)
        setIsLoading(false)
      })
  }, [])

  if (isLoading) return <div className="p-12 text-center text-muted-foreground animate-pulse">Chargement de la vision stratégique...</div>

  const metrics = data?.metrics || {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-black text-foreground tracking-tighter">Tableau de Bord</h1>
            <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest mt-1">Vision stratégique admin</p>
        </div>
        <div className="flex items-center gap-2">
            <Badge variant="outline" className="h-8 border-amber-500/20 text-amber-600 bg-amber-500/5 px-3">SANTÉ OPTIMALE</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase text-[10px] font-bold tracking-widest flex items-center gap-2">
                <FileText className="w-3 h-3 text-indigo-500" /> Documents Actifs
            </CardDescription>
            <CardTitle className="text-3xl font-black">{metrics.totalInvoicesCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Factures & Devis en base</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase text-[10px] font-bold tracking-widest text-emerald-600 flex items-center gap-2">
                <TrendingUp className="w-3 h-3" /> Volume Financier (Mois)
            </CardDescription>
            <CardTitle className="text-3xl font-black text-emerald-600">
                {formatCurrency(metrics.totalRevenue || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-emerald-500 font-black uppercase tracking-tighter">
                +{metrics.growth || 0}% vs mois dernier
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase text-[10px] font-bold tracking-widest text-red-500 flex items-center gap-2">
                <AlertCircle className="w-3 h-3" /> Créances Globales
            </CardDescription>
            <CardTitle className="text-3xl font-black text-red-500">
                {formatCurrency(metrics.pendingRevenue || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Toutes factures confondues</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-md font-bold">Évolution Commerciale</CardTitle>
                    <CardDescription className="text-[10px] uppercase font-bold tracking-widest">Revenus perçus par mois (XAF)</CardDescription>
                </div>
                <Activity className="w-5 h-5 text-muted-foreground opacity-20" />
            </CardHeader>
            <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
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
                            tickFormatter={(val) => `${val/1000}k`}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                            formatter={(val: any) => [formatCurrency(val), 'Revenu']}
                        />
                        <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-md font-bold">Modes de Paiement</CardTitle>
                    <CardDescription className="text-[10px] uppercase font-bold tracking-widest">Répartition en %</CardDescription>
                </div>
                <PieIcon className="w-4 h-4 text-muted-foreground opacity-30" />
            </CardHeader>
            <CardContent className="h-[300px] flex items-center justify-center">
                {data.paymentMethodData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data.paymentMethodData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {data.paymentMethodData.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
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
                    <p className="text-xs text-muted-foreground italic">Aucune donnée disponible</p>
                )}
            </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-md font-bold">Performance Opérateurs</CardTitle>
                    <CardDescription className="text-[10px] uppercase font-bold tracking-widest">Volume et Revenus par compte</CardDescription>
                </div>
                <Users className="w-5 h-5 text-muted-foreground opacity-20" />
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {(data.userPerformance || []).map((u: any) => (
                        <div key={u.name} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold text-xs">
                                    {u.name[0]}
                                </div>
                                <div>
                                    <span className="text-xs font-bold block">{u.name}</span>
                                    <span className="text-[9px] text-muted-foreground uppercase font-black">{u.docsCount} DOCUMENTS</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-black">{formatCurrency(u.totalRevenue)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>

        <Card className="border-border">
            <CardHeader>
                <CardTitle className="text-lg">Santé Système</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Version App</span>
                        <Badge variant="outline">v4.0.0-prod</Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Base de données</span>
                        <span className="flex items-center gap-1 font-medium"><Database className="w-3 h-3" /> SQLite (Local)</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Dernier Backup</span>
                        <span className="text-emerald-500 font-bold">Aujourd'hui 04:00</span>
                    </div>
                </div>
                <div className="pt-4 border-t border-border">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        Environnement sécurisé
                    </div>
                    <Button variant="outline" className="w-full text-xs h-8" onClick={() => onNavigate('settings')}>
                        Maintenance
                    </Button>
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
                {(data.activityTimeline || []).slice(0, 5).map((log: any) => (
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
            </div>
         </CardContent>
      </Card>

      <div className="flex gap-4">
         <Button className="flex-1 bg-amber-500 hover:bg-amber-600 h-14 text-lg font-black tracking-tighter" onClick={() => onNavigate('users')}>
            <Users className="w-5 h-5 mr-2" /> AJOUTER UN UTILISATEUR
         </Button>
         <Button variant="secondary" className="flex-1 h-14 text-lg font-black tracking-tighter" onClick={() => onNavigate('audit')}>
            <ScrollText className="w-5 h-5 mr-2" /> VOIR LES LOGS
         </Button>
      </div>
    </div>
  )
}
