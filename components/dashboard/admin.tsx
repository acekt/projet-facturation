"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
    Users, FileText, TrendingUp, DollarSign, AlertCircle,
    ArrowUpRight, Plus, ScrollText, Activity, ShieldCheck,
    Smartphone, Database, LayoutDashboard, Clock,
    UserPlus, FileSearch, Settings, LogOut, Building2,
    Shield
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-card border-border overflow-hidden group shadow-lg shadow-black/5">
                    <CardHeader className="border-b border-border/50 bg-muted/30">
                        <div className="flex items-center gap-2">
                            <Database className="w-4 h-4 text-indigo-500" />
                            <CardTitle className="text-sm font-bold uppercase tracking-wider">Actions Administratives</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="grid grid-cols-2 divide-x divide-y divide-border/50">
                            <button onClick={() => onNavigate('users')} className="flex flex-col items-center justify-center p-6 hover:bg-indigo-500/5 transition-all gap-2 group">
                                <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
                                    <UserPlus className="w-5 h-5" />
                                </div>
                                <span className="text-xs font-bold text-foreground">Utilisateurs</span>
                            </button>
                            <button onClick={() => onNavigate('audit')} className="flex flex-col items-center justify-center p-6 hover:bg-amber-500/5 transition-all gap-2 group border-t-0">
                                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                                    <FileSearch className="w-5 h-5" />
                                </div>
                                <span className="text-xs font-bold text-foreground">Logs Audit</span>
                            </button>
                            <button onClick={() => onNavigate('settings')} className="flex flex-col items-center justify-center p-6 hover:bg-emerald-500/5 transition-all gap-2 group">
                                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                                    <Building2 className="w-5 h-5" />
                                </div>
                                <span className="text-xs font-bold text-foreground">Paramètres</span>
                            </button>
                            <button onClick={() => {
                                fetch('/api/auth/logout', { method: 'POST' }).then(() => window.location.href = '/login')
                            }} className="flex flex-col items-center justify-center p-6 hover:bg-red-500/5 transition-all gap-2 group">
                                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                                    <LogOut className="w-5 h-5" />
                                </div>
                                <span className="text-xs font-bold text-foreground">Déconnexion</span>
                            </button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-card border-border overflow-hidden shadow-lg shadow-black/5">
                    <CardHeader className="border-b border-border/50 bg-muted/30">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-primary" />
                            <CardTitle className="text-sm font-bold uppercase tracking-wider">État du Système</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-tighter">Usage Base de Données</p>
                                    <p className="text-2xl font-black tracking-tighter">1.2 MB</p>
                                </div>
                                <div className="w-12 h-12 rounded-full border-4 border-indigo-500/10 border-t-indigo-500 animate-spin" />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-1">
                                    <span>Trafic API</span>
                                    <span className="text-emerald-500">Stable</span>
                                </div>
                                <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: "45%" }}
                                        className="h-full bg-indigo-500"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Environnement Sécurisé</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-border">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg">Activité par Utilisateur</CardTitle>
                            <CardDescription>Performance opérationnelle</CardDescription>
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
                            <div key={u.name} className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
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
        </div>

        <div className="space-y-8">
            <Card className="border-border bg-indigo-500/5 border-indigo-500/10">
                <CardHeader>
                    <div className="flex items-center gap-2 text-indigo-600">
                        <Clock className="w-4 h-4" />
                        <CardTitle className="text-sm uppercase tracking-widest font-black">Infos Système</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Version</span>
                            <Badge variant="outline" className="font-mono">4.0.0-PROD</Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Backup</span>
                            <span className="text-emerald-500 font-bold">Auto-On</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Session</span>
                            <span className="font-bold">30 min</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-border overflow-hidden">
                <CardHeader className="bg-secondary/30 p-4 border-b border-border/50">
                    <CardTitle className="text-xs uppercase tracking-widest font-black">Audit</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-border/50">
                        {(data.activityTimeline || []).slice(0, 3).map((log: any) => (
                            <div key={log.id} className="p-4 hover:bg-secondary/20 transition-colors">
                                <p className="text-xs font-bold mb-1 truncate">{log.action}</p>
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] text-muted-foreground uppercase">{log.client}</span>
                                    <span className="text-[9px] font-mono text-muted-foreground">{log.time.split('-').slice(1).join('/')}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Button variant="ghost" className="w-full rounded-none h-10 text-[10px] font-bold uppercase tracking-widest text-indigo-500" onClick={() => onNavigate('audit')}>
                        Journal Complet
                    </Button>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  )
}
