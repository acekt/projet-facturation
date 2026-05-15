"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { useTheme } from "next-themes"
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Sparkles,
  BarChart3,
  PieChart as PieChartIcon,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"

import { useStore } from "@/lib/store"
import { formatCurrency, formatShortCurrency } from "@/lib/utils"

const getStatusBadge = (status: string) => {
  switch (status) {
    case "paid":
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20">
          <CheckCircle className="w-3 h-3 mr-1" />
          Paye
        </Badge>
      )
    case "pending":
      return (
        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20">
          <Clock className="w-3 h-3 mr-1" />
          En attente
        </Badge>
      )
    case "overdue":
      return (
        <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 hover:bg-red-500/20">
          <AlertCircle className="w-3 h-3 mr-1" />
          Retard
        </Badge>
      )
    default:
      return null
  }
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

interface StatCardProps {
  title: string
  value: string
  trend: string
  trendUp: boolean
  icon: React.ElementType
  iconBg: string
  iconColor: string
  delay?: number
}

function StatCard({ title, value, trend, trendUp, icon: Icon, iconBg, iconColor, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <Card className="bg-card border-border overflow-hidden group hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 hover:border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className={`w-12 h-12 rounded-2xl ${iconBg} flex items-center justify-center shadow-lg`}>
              <Icon className={`w-6 h-6 ${iconColor}`} />
            </div>
            <div className={`flex items-center gap-1 text-sm font-medium ${trendUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {trendUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>{trend}</span>
            </div>
          </div>
          <p className="text-muted-foreground text-sm mb-1">{title}</p>
          <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function Dashboard() {
  const { invoices, clients, quotes } = useStore()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((acc, i) => acc + i.total, 0)
  const pendingRevenue = invoices.filter(i => i.status === 'pending').reduce((acc, i) => acc + i.total, 0)
  const overdueRevenue = invoices.filter(i => i.status === 'overdue').reduce((acc, i) => acc + i.total, 0)
  const paidCount = invoices.filter(i => i.status === 'paid').length

  const revenueData = [
    { month: "Jan", revenue: 4500000 },
    { month: "Fev", revenue: 5200000 },
    { month: "Mar", revenue: 4800000 },
    { month: "Avr", revenue: 6100000 },
    { month: "Mai", revenue: 5500000 },
    { month: "Jun", revenue: 7200000 },
    { month: "Jul", revenue: 6800000 },
    { month: "Aou", revenue: 7500000 },
    { month: "Sep", revenue: 8200000 },
    { month: "Oct", revenue: 7900000 },
    { month: "Nov", revenue: 9100000 },
    { month: "Dec", revenue: 8500000 },
  ]

  const paymentMethodData = [
    { name: "Airtel Money", value: 45, color: "#ef4444" },
    { name: "Moov Money", value: 30, color: "#3b82f6" },
    { name: "Virement", value: 25, color: "#10b981" },
  ]

  const activityTimeline = [
    ...quotes.slice(0, 3).map(q => ({
      id: q.id,
      action: q.status === 'invoiced' ? "Devis converti" : "Nouveau devis",
      client: q.clientName,
      time: q.date,
      type: "send"
    })),
    ...invoices.slice(0, 3).map(i => ({
      id: i.id,
      action: i.status === 'paid' ? "Facture payée" : "Facture émise",
      client: i.clientName,
      time: i.date,
      type: "payment"
    }))
  ].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 5)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && resolvedTheme === "dark"

  const chartColors = {
    grid: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
    axis: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
    tick: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
    tooltipBg: isDark ? "rgba(10, 10, 10, 0.95)" : "rgba(255, 255, 255, 0.98)",
    tooltipBorder: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
    tooltipText: isDark ? "#ffffff" : "#0a0a0a",
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Tableau de bord</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              <Sparkles className="w-3 h-3 mr-1" />
              Live
            </Badge>
          </div>
          <p className="text-muted-foreground">Apercu de votre activite de facturation</p>
        </div>
        <div className="flex items-center gap-3">
          <select className="px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all">
            <option>Ce mois</option>
            <option>Ce trimestre</option>
            <option>Cette annee</option>
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Chiffre d'affaires"
          value={formatShortCurrency(totalRevenue) + " XAF"}
          trend="+12.5%"
          trendUp={true}
          icon={DollarSign}
          iconBg="bg-primary/10"
          iconColor="text-primary"
          delay={0}
        />
        <StatCard
          title="Factures payees"
          value={paidCount.toString()}
          trend="+8.2%"
          trendUp={true}
          icon={CheckCircle}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-500"
          delay={0.1}
        />
        <StatCard
          title="En attente"
          value={formatShortCurrency(pendingRevenue) + " XAF"}
          trend={`${invoices.filter(i => i.status === 'pending').length} factures`}
          trendUp={false}
          icon={Clock}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-500"
          delay={0.2}
        />
        <StatCard
          title="En retard"
          value={formatShortCurrency(overdueRevenue) + " XAF"}
          trend="-2 ce mois"
          trendUp={true}
          icon={AlertCircle}
          iconBg="bg-red-500/10"
          iconColor="text-red-500"
          delay={0.3}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Chart */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="bg-card border-border h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-foreground font-semibold">Revenus mensuels</CardTitle>
                    <p className="text-sm text-muted-foreground">Evolution sur 12 mois</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium bg-emerald-500/10 px-3 py-1.5 rounded-full">
                  <TrendingUp className="w-4 h-4" />
                  <span>+18.2% vs annee precedente</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                    <XAxis 
                      dataKey="month" 
                      stroke={chartColors.axis} 
                      tick={{ fill: chartColors.tick, fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      stroke={chartColors.axis}
                      tick={{ fill: chartColors.tick, fontSize: 12 }}
                      tickFormatter={(value) => formatShortCurrency(value)}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: chartColors.tooltipBg,
                        border: `1px solid ${chartColors.tooltipBorder}`,
                        borderRadius: '12px',
                        color: chartColors.tooltipText,
                        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                      }}
                      formatter={(value: number) => [formatCurrency(value), 'Revenus']}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Payment Methods */}
        <motion.div variants={itemVariants}>
          <Card className="bg-card border-border h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <PieChartIcon className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <CardTitle className="text-foreground font-semibold">Methodes de paiement</CardTitle>
                  <p className="text-sm text-muted-foreground">Repartition des paiements</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[200px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentMethodData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {paymentMethodData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: chartColors.tooltipBg,
                        border: `1px solid ${chartColors.tooltipBorder}`,
                        borderRadius: '12px',
                        color: chartColors.tooltipText,
                      }}
                      formatter={(value: number) => [`${value}%`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3 mt-4">
                {paymentMethodData.map((method) => (
                  <div key={method.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full shadow-sm" 
                        style={{ backgroundColor: method.color }}
                      />
                      <span className="text-sm text-foreground">{method.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">{method.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Invoices */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-foreground font-semibold">Factures recentes</CardTitle>
                    <p className="text-sm text-muted-foreground">5 dernieres factures</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary hover:bg-primary/10">
                  Voir tout
                  <ArrowUpRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {invoices.slice(0, 5).map((invoice, index) => (
                  <motion.div
                    key={invoice.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.08 }}
                    className="group flex items-center justify-between p-3 rounded-xl hover:bg-secondary/50 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <FileText className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div>
                        <p className="text-foreground font-medium text-sm">{invoice.id}</p>
                        <p className="text-muted-foreground text-xs">{invoice.clientName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-foreground font-semibold">{formatCurrency(invoice.total)}</p>
                      {getStatusBadge(invoice.status)}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Activity Timeline */}
        <motion.div variants={itemVariants}>
          <Card className="bg-card border-border h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <CardTitle className="text-foreground font-semibold">Activite recente</CardTitle>
                  <p className="text-sm text-muted-foreground">Derniers evenements</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activityTimeline.map((activity, index) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-3 group"
                  >
                    <div className="relative">
                      <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${
                        activity.type === 'payment' ? 'bg-emerald-500' :
                        activity.type === 'new' ? 'bg-purple-500' :
                        'bg-primary'
                      }`} />
                      {index < activityTimeline.length - 1 && (
                        <div className="absolute top-4 left-1 w-0.5 h-8 bg-border" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground text-sm font-medium">{activity.action}</p>
                      <p className="text-muted-foreground text-xs truncate">{activity.client}</p>
                    </div>
                    <span className="text-muted-foreground text-xs whitespace-nowrap">{activity.time}</span>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  )
}
