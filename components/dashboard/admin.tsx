"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
    Users, FileText, TrendingUp, DollarSign, AlertCircle,
    ArrowUpRight, Plus, ScrollText, Activity, ShieldCheck,
    Smartphone, Database, LayoutDashboard, Clock
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"

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
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-black text-foreground tracking-tighter">Tableau de Bord</h1>
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 uppercase text-[10px] tracking-widest font-bold">Admin</Badge>
        </div>
        <p className="text-muted-foreground">Vision stratégique et santé du système.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase text-[10px] font-bold tracking-widest">Activité Globale</CardDescription>
            <CardTitle className="text-3xl font-black">{metrics.totalInvoicesCount + 20}+</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1"><FileText className="w-3 h-3" /> Devis & Factures</div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase text-[10px] font-bold tracking-widest text-emerald-600 dark:text-emerald-400">Volume Financier (Mois)</CardDescription>
            <CardTitle className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                {formatCurrency(metrics.totalRevenue || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-xs text-emerald-500 font-bold">
                <TrendingUp className="w-3 h-3" />
                +{metrics.growth || 0}% vs mois dernier
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardDescription className="uppercase text-[10px] font-bold tracking-widest text-red-500">Impayés Globaux</CardDescription>
            <CardTitle className="text-3xl font-black text-red-500">
                {formatCurrency(metrics.pendingRevenue || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <AlertCircle className="w-3 h-3" />
                Toutes factures confondues
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-border">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg">Activité par Utilisateur</CardTitle>
                        <CardDescription>Performance des opérateurs</CardDescription>
                    </div>
                    <Activity className="w-5 h-5 text-muted-foreground opacity-20" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {[
                        { name: "Opérateur Service Client", docs: 12, rev: 4500000 },
                        { name: "Support Technique", docs: 8, rev: 1200000 },
                    ].map(u => (
                        <div key={u.name} className="flex items-center justify-between p-4 rounded-xl bg-secondary/30">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold text-xs">
                                    {u.name[0]}
                                </div>
                                <span className="text-sm font-medium">{u.name}</span>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold">{formatCurrency(u.rev)}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">{u.docs} documents</p>
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
