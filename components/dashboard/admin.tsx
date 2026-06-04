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
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch metrics')
        return res.json()
      })
      .then(d => {
        setData(d)
      })
      .catch(err => {
        console.error('[Dashboard Admin] Error fetching metrics:', err)
      })
  }, [])

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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase text-[10px] font-bold tracking-widest flex items-center gap-2">
                <FileText className="w-3 h-3 text-indigo-500" /> Factures Payées
            </CardDescription>
            <CardTitle className="text-3xl font-black text-emerald-600">{metrics.paidCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Règlements complets</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase text-[10px] font-bold tracking-widest text-amber-600 flex items-center gap-2">
                <Clock className="w-3 h-3" /> Factures Partielles
            </CardDescription>
            <CardTitle className="text-3xl font-black text-amber-600">{metrics.partiallyPaidCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Acomptes reçus</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase text-[10px] font-bold tracking-widest text-red-500 flex items-center gap-2">
                <AlertCircle className="w-3 h-3" /> Factures Non Payées
            </CardDescription>
            <CardTitle className="text-3xl font-black text-red-500">{metrics.unpaidCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">En attente de paiement</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase text-[10px] font-bold tracking-widest text-blue-500 flex items-center gap-2">
                <ScrollText className="w-3 h-3" /> Devis En Attente
            </CardDescription>
            <CardTitle className="text-3xl font-black text-blue-500">{metrics.pendingQuotesCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Non convertis en factures</p>
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
                        <div key={u.id || u.name} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
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

        <Card className="border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-md font-bold">Top Clients</CardTitle>
                    <CardDescription className="text-[10px] uppercase font-bold tracking-widest">Par chiffre d'affaires</CardDescription>
                </div>
                <Users className="w-5 h-5 text-muted-foreground opacity-20" />
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {(data.topClients || []).map((client: any, index: number) => (
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
                                <p className="text-xs font-black">{formatCurrency(client.totalRevenue)}</p>
                            </div>
                        </div>
                    ))}
                    {(!data.topClients || data.topClients.length === 0) && (
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
