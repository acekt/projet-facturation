"use client"

import * as React from "react"
import { motion } from "framer-motion"
import {
    Plus, UserPlus, FileText, Clock, AlertCircle,
    ArrowUpRight, Eye, CheckCircle, Search
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { DocumentPreview } from "@/components/document-preview"

interface DashboardUserProps {
  onNavigate: (page: string) => void
}

export function DashboardUser({ onNavigate }: DashboardUserProps) {
  const [data, setData] = React.useState<any>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [previewOpen, setPreviewOpen] = React.useState(false)
  const [previewData, setPreviewData] = React.useState<any>(null)

  React.useEffect(() => {
    fetch('/api/dashboard/metrics?range=month')
      .then(res => res.json())
      .then(d => {
        setData(d)
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

  if (isLoading) return <div className="p-12 text-center text-muted-foreground animate-pulse">Chargement de votre espace de travail...</div>

  const metrics = data?.metrics || {}
  const recentInvoices = data?.recentInvoices || []

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
            <h1 className="text-3xl font-black text-foreground tracking-tighter mb-1">Tableau de Bord</h1>
            <p className="text-muted-foreground text-sm uppercase font-bold tracking-widest">Espace Opérateur</p>
        </div>
        <div className="flex gap-3">
            <Button onClick={() => onNavigate('new-quote')} className="bg-indigo-600 hover:bg-indigo-700 h-12 px-8 font-bold gap-2 shadow-lg shadow-indigo-500/20">
                <Plus className="w-5 h-5" /> CRÉER UN DEVIS
            </Button>
            <Button variant="outline" onClick={() => onNavigate('clients')} className="h-12 px-6 font-bold gap-2">
                <UserPlus className="w-5 h-5" /> NOUVEAU CLIENT
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-card border-border hover:border-indigo-500/30 transition-all group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription className="uppercase text-[10px] font-bold tracking-widest">Mes Devis en Cours</CardDescription>
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
                    <FileText className="w-5 h-5" />
                </div>
            </CardHeader>
            <CardContent>
                <p className="text-4xl font-black mb-1">08</p>
                <p className="text-xs text-muted-foreground">Soumis & Acceptés en attente</p>
            </CardContent>
        </Card>

        <Card className="bg-card border-border hover:border-red-500/30 transition-all group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription className="uppercase text-[10px] font-bold tracking-widest text-red-500">Mes Factures à Relancer</CardDescription>
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                    <AlertCircle className="w-5 h-5" />
                </div>
            </CardHeader>
            <CardContent>
                <p className="text-4xl font-black text-red-500 mb-1">{formatCurrency(metrics.pendingRevenue || 0)}</p>
                <p className="text-xs text-muted-foreground">Volume total des impayés perso</p>
            </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-border overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-lg">Derniers Documents</CardTitle>
                    <CardDescription>Activité récente sur vos dossiers</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="text-indigo-500 font-bold text-xs uppercase" onClick={() => onNavigate('invoices')}>
                    Voir tout <ArrowUpRight className="w-3 h-3 ml-1" />
                </Button>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-border/50 border-t border-border/50">
                    {recentInvoices.map((inv: any) => (
                        <div key={inv.id} className="group flex items-center justify-between p-4 hover:bg-secondary/30 transition-all">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-indigo-500/10 group-hover:text-indigo-500 transition-colors">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold">{inv.number}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase">{inv.clientName}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-sm font-black">{formatCurrency(inv.total)}</span>
                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handlePreview(inv)}>
                                    <Eye className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>

        <Card className="border-border bg-amber-500/[0.02] border-amber-500/10">
            <CardHeader>
                <div className="flex items-center gap-2 text-amber-600">
                    <Clock className="w-4 h-4" />
                    <CardTitle className="text-sm uppercase tracking-widest font-black">Expirent Bientôt</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {[
                    { id: '1', num: '045/GM/2026', client: 'CGA Gabon', days: 2 },
                    { id: '2', num: '048/GM/2026', client: 'TOTAL ENERGIES', days: 5 },
                ].map(d => (
                    <div key={d.id} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-500/20 shadow-sm shadow-amber-500/5">
                        <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold">{d.num}</span>
                            <Badge className="bg-amber-100 text-amber-700 text-[10px] px-1 py-0 h-4 border-amber-200">J-{d.days}</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold truncate">{d.client}</p>
                    </div>
                ))}
                {recentInvoices.length === 0 && <p className="text-xs text-muted-foreground text-center py-8 italic">Aucune alerte pour le moment.</p>}
            </CardContent>
        </Card>
      </div>

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
