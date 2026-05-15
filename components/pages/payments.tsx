"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { useTheme } from "next-themes"
import {
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle,
  Clock,
  AlertCircle,
  Smartphone,
  Building,
  CreditCard,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Filter,
  Wallet,
  ArrowRight,
  Activity,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

import { useStore } from "@/lib/store"

const cashflowData = [
  { date: "01/01", entrees: 4500000, sorties: 2100000 },
  { date: "05/01", entrees: 3200000, sorties: 1800000 },
  { date: "10/01", entrees: 5800000, sorties: 2400000 },
  { date: "15/01", entrees: 4100000, sorties: 1900000 },
  { date: "20/01", entrees: 6200000, sorties: 2800000 },
  { date: "25/01", entrees: 5500000, sorties: 2200000 },
  { date: "30/01", entrees: 7100000, sorties: 3100000 },
]

const transactions = [
  {
    id: "TRX-001",
    type: "income",
    method: "airtel",
    client: "Societe Gabon Mining",
    amount: 2450000,
    status: "completed",
    date: "2024-01-15 14:32",
    reference: "AIRTEL-87654321",
  },
  {
    id: "TRX-002",
    type: "income",
    method: "moov",
    client: "Banque BGFI",
    amount: 1850000,
    status: "pending",
    date: "2024-01-15 12:15",
    reference: "MOOV-12345678",
  },
  {
    id: "TRX-003",
    type: "income",
    method: "virement",
    client: "Total Gabon",
    amount: 3200000,
    status: "completed",
    date: "2024-01-14 16:45",
    reference: "VIR-98765432",
  },
  {
    id: "TRX-004",
    type: "income",
    method: "airtel",
    client: "Comilog",
    amount: 890000,
    status: "failed",
    date: "2024-01-14 10:20",
    reference: "AIRTEL-11223344",
  },
  {
    id: "TRX-005",
    type: "income",
    method: "moov",
    client: "Olam Gabon",
    amount: 1560000,
    status: "completed",
    date: "2024-01-13 09:10",
    reference: "MOOV-55667788",
  },
]

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("fr-GA", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value) + " XAF"
}

const formatShortCurrency = (value: number) => {
  if (value >= 1000000) {
    return (value / 1000000).toFixed(1) + "M"
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(0) + "K"
  }
  return value.toString()
}

const getMethodIcon = (method: string) => {
  switch (method) {
    case "airtel":
    case "moov":
      return <Smartphone className="w-4 h-4" />
    case "virement":
      return <Building className="w-4 h-4" />
    default:
      return <CreditCard className="w-4 h-4" />
  }
}

const getMethodColor = (method: string) => {
  switch (method) {
    case "airtel":
      return "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/20"
    case "moov":
      return "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20"
    case "virement":
      return "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
    default:
      return "text-muted-foreground bg-secondary border-border"
  }
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
          <CheckCircle className="w-3 h-3 mr-1" />
          Complete
        </Badge>
      )
    case "pending":
      return (
        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
          <Clock className="w-3 h-3 mr-1" />
          En cours
        </Badge>
      )
    case "failed":
      return (
        <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
          <AlertCircle className="w-3 h-3 mr-1" />
          Echoue
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

export function PaymentsPage() {
  const { invoices } = useStore()
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  const incomeThisMonth = invoices.filter(i => i.status === 'paid').reduce((acc, i) => acc + i.amount, 0)
  const pendingPayments = invoices.filter(i => i.status === 'pending').reduce((acc, i) => acc + i.amount, 0)

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

  const filteredTransactions = transactions.filter(
    (trx) =>
      trx.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trx.reference.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Paiements</h1>
          <p className="text-muted-foreground mt-1">Suivez vos transactions et flux de tresorerie</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="border-border gap-2">
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-sm">Entrees ce mois</p>
                  <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                    <TrendingUp className="w-3 h-3" />
                    +18.2%
                  </div>
                </div>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatShortCurrency(incomeThisMonth)} XAF
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5 text-red-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-sm">Sorties ce mois</p>
                  <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-medium">
                    <TrendingDown className="w-3 h-3" />
                    +5.4%
                  </div>
                </div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">16.3M XAF</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Solde net</p>
                <p className="text-2xl font-bold text-foreground">{formatShortCurrency(incomeThisMonth)} XAF</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">En attente</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {formatShortCurrency(pendingPayments)} XAF
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Mobile Money Actions */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card border-border overflow-hidden group hover:border-red-500/30 hover:shadow-lg transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/20">
                  <Smartphone className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-foreground font-semibold text-lg">Airtel Money</h3>
                  <p className="text-muted-foreground text-sm">Gerez vos transactions Airtel</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                >
                  <ArrowDownLeft className="w-4 h-4 mr-2" />
                  Retrait
                </Button>
                <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
                  Statut
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border overflow-hidden group hover:border-blue-500/30 hover:shadow-lg transition-all">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Smartphone className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-foreground font-semibold text-lg">Moov Africa</h3>
                  <p className="text-muted-foreground text-sm">Gerez vos transactions Moov</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                >
                  <ArrowDownLeft className="w-4 h-4 mr-2" />
                  Retrait
                </Button>
                <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
                  Statut
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Cashflow Chart */}
      <motion.div variants={itemVariants}>
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-foreground font-semibold">Flux de tresorerie</CardTitle>
                  <p className="text-sm text-muted-foreground">Evolution mensuelle</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-muted-foreground">Entrees</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-muted-foreground">Sorties</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashflowData}>
                  <defs>
                    <linearGradient id="colorEntrees" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorSorties" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis
                    dataKey="date"
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
                      borderRadius: "12px",
                      color: chartColors.tooltipText,
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                    }}
                    formatter={(value: number) => [formatCurrency(value), ""]}
                  />
                  <Area
                    type="monotone"
                    dataKey="entrees"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorEntrees)"
                  />
                  <Area
                    type="monotone"
                    dataKey="sorties"
                    stroke="#ef4444"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorSorties)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Transactions */}
      <motion.div variants={itemVariants}>
        <Card className="bg-card border-border">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-foreground font-semibold">Transactions recentes</CardTitle>
                  <p className="text-sm text-muted-foreground">Historique des paiements</p>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <Button variant="outline" className="border-border">
                  <Filter className="w-4 h-4 mr-2" />
                  Filtrer
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredTransactions.map((transaction, index) => (
                <motion.div
                  key={transaction.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-4 rounded-xl hover:bg-muted/30 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center border ${getMethodColor(
                        transaction.method
                      )}`}
                    >
                      {getMethodIcon(transaction.method)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-foreground font-medium">{transaction.client}</p>
                        <span className="text-muted-foreground text-xs font-mono">{transaction.reference}</span>
                      </div>
                      <p className="text-muted-foreground text-sm">{transaction.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p
                        className={`font-bold ${
                          transaction.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {transaction.type === "income" ? "+" : "-"}
                        {formatCurrency(transaction.amount)}
                      </p>
                    </div>
                    {getStatusBadge(transaction.status)}
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
