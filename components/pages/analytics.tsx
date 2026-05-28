"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { BarChart3, TrendingUp, Users, Calendar, Download, Filter } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, AreaChart, Area
} from "recharts"
import { formatCurrency } from "@/lib/utils"

export function AnalyticsPage() {
  const [data, setData] = React.useState<any>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    fetch('/api/dashboard/metrics?range=year')
      .then(res => res.json())
      .then(d => {
        setData(d)
        setIsLoading(false)
      })
  }, [])

  if (isLoading) return <div className="p-8 text-center">Chargement des analyses...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Statistiques & Analyses</h1>
          <p className="text-muted-foreground mt-1">Performance globale de l'entreprise sur l'année</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Exporter Rapport
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardDescription>Taux de Conversion Global</CardDescription>
            <CardTitle className="text-3xl font-bold text-primary">
              {data?.metrics?.growth || 0}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, data?.metrics?.growth || 0)}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardDescription>Volume Total Facturé</CardDescription>
            <CardTitle className="text-3xl font-bold text-foreground">
              {formatCurrency(data?.metrics?.totalRevenue || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
             <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-500" />
                +12% vs mois dernier
             </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardDescription>Documents Générés</CardDescription>
            <CardTitle className="text-3xl font-bold text-foreground">
              {data?.metrics?.totalInvoicesCount || 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
             <p className="text-xs text-muted-foreground">Factures et Avoirs combinés</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Évolution du Chiffre d'Affaires</CardTitle>
          <CardDescription>Revenus mensuels consolidés (XAF)</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.revenueData}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" fontSize={12} axisLine={false} tickLine={false} />
              <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} axisLine={false} tickLine={false} tickFormatter={formatCurrency} />
              <Tooltip
                contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                formatter={(val: any) => [formatCurrency(val), 'Revenue']}
              />
              <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} fill="url(#colorRev)" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
