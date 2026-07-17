"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { useTheme } from "next-themes"
import {
  Search,
  ArrowDownLeft,
  CheckCircle,
  Clock,
  CreditCard,
  RefreshCw,
  Wallet,
  Activity,
  Trash2,
  DownloadCloud,
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
import { toast } from "sonner"

import { useStore } from "@/lib/store"
import { formatCurrency, formatShortCurrency, formatDate } from "@/lib/utils"
import { Pagination } from "@/components/ui/pagination-custom"

export function PaymentsPage() {
  const invoices = useStore((state) => state.invoices)
  const payments = useStore((state) => state.payments)
  const setPayments = useStore((state) => state.setPayments)
  const setInvoices = useStore((state) => state.setInvoices)
  const user = useStore((state) => state.user)
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [currentPage, setCurrentPage] = React.useState(1)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const itemsPerPage = 10

  // [P1-B] Re-fetch ciblé des données de paiements et factures.
  // Remplace l'anti-pattern window.location.reload() qui détruisait l'état
  // Zustand et provoquait un flash blanc dans la fenêtre Electron.
  const handleRefresh = React.useCallback(async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      const [paymentsRes, invoicesRes] = await Promise.all([
        fetch('/api/payments'),
        fetch('/api/invoices'),
      ])

      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json()
        if (Array.isArray(paymentsData)) setPayments(paymentsData)
      }
      if (invoicesRes.ok) {
        const invoicesData = await invoicesRes.json()
        if (Array.isArray(invoicesData)) setInvoices(invoicesData)
      }
      toast.success('Données actualisées')
    } catch {
      toast.error('Erreur lors de l\'actualisation')
    } finally {
      setIsRefreshing(false)
    }
  }, [isRefreshing, setPayments, setInvoices])


  const sortedPayments = React.useMemo(() =>
    [...payments].sort((a, b) => b.date.localeCompare(a.date)),
  [payments])

  const now = new Date();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
  const currentYear = now.getFullYear().toString();

  const incomeThisMonth = payments
    .filter(p => p.date?.startsWith(currentYear) && p.date?.split('-')[1] === currentMonth)
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0)

  const pendingPayments = invoices
    .filter(i => i.status === 'UNPAID' || i.status === 'PARTIALLY_PAID')
    .reduce((acc, i) => {
        const paidForThisInvoice = payments
            .filter(p => p.invoiceId === i.id)
            .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        return acc + (Number(i.total) || 0) - paidForThisInvoice;
    }, 0);

  const cashflowData = React.useMemo(() => {
    const dailyTotals: Record<string, number> = {};
    payments.forEach(p => {
        if (p.date) {
            const dateKey = p.date.split('-').slice(1).reverse().join('/');
            dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + (Number(p.amount) || 0);
        }
    });

    const data = Object.entries(dailyTotals).map(([date, total]) => ({
        date,
        entrees: total,
        sorties: 0
    })).sort((a, b) => {
        const [da, ma] = a.date.split('/').map(Number);
        const [db, mb] = b.date.split('/').map(Number);
        return ma !== mb ? ma - mb : da - db;
    }).slice(-10);

    return data.length > 0 ? data : [{date: "N/A", entrees: 0, sorties: 0}];
  }, [payments])

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

  const filteredTransactions = React.useMemo(() => {
    return sortedPayments.filter(
        (p) => {
          const invoice = invoices.find(i => i.id === p.invoiceId);
          return (
            invoice?.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            invoice?.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.paymentMethod?.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }
      )
  }, [sortedPayments, invoices, searchQuery])

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage)
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const handleDeletePayment = async (id: string) => {
      if (!confirm("Supprimer ce règlement ? Le statut de la facture sera recalculé.")) return;
      try {
          const response = await fetch(`/api/payments/${id}`, { method: 'DELETE' });
          if (!response.ok) throw new Error('Delete failed');

          toast.success("Règlement supprimé");
          const [updatedInvoices, updatedPayments] = await Promise.all([
              fetch('/api/invoices').then(res => res.json()),
              fetch('/api/payments').then(res => res.json())
          ]);
          setInvoices(updatedInvoices);
          setPayments(updatedPayments);
      } catch (error) {
          toast.error("Erreur lors de la suppression");
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

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex-1 flex flex-col overflow-hidden space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Paiements</h1>
          <p className="text-muted-foreground mt-1">Suivez vos encaissements et flux de trésorerie réels</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const headers = ["ID", "Facture", "Montant", "Méthode", "Date", "Référence"];
              const rows = payments.map(p => {
                const inv = invoices.find(i => i.id === p.invoiceId);
                return [p.id, inv?.number || p.invoiceId, p.amount, p.paymentMethod, p.date, p.reference || ''];
              });
              const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
              const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
              const link = document.createElement("a");
              link.href = URL.createObjectURL(blob);
              link.setAttribute("download", `paiements_${new Date().toISOString().split('T')[0]}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="gap-2 hidden sm:flex"
          >
            <DownloadCloud className="w-4 h-4" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Actualisation...' : 'Actualiser'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="bg-card border-border hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <ArrowDownLeft className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="flex-1">
                <p className="text-muted-foreground text-sm">Entrées ce mois</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatShortCurrency(incomeThisMonth)}
                </p>
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
                <p className="text-muted-foreground text-sm">Chiffre d'Affaires Annuel</p>
                <p className="text-2xl font-bold text-foreground">
                    {formatShortCurrency(invoices
                        .filter(i => i.status === 'PAID' && i.date?.startsWith(currentYear))
                        .reduce((sum, i) => sum + (Number(i.total) || 0), 0))}
                </p>
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
                  {formatShortCurrency(pendingPayments)}
                </p>
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
                  <CardTitle className="text-foreground font-semibold">Flux de trésorerie</CardTitle>
                  <p className="text-sm text-muted-foreground">Encaissements récents par jour</p>
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
                    tickFormatter={(value) => formatCurrency(value)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: chartColors.tooltipBg,
                      border: `1px solid ${chartColors.tooltipBorder}`,
                      borderRadius: "12px",
                      color: chartColors.tooltipText,
                    }}
                    formatter={(value: number) => [formatCurrency(value), "Encaissement"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="entrees"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorEntrees)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Transactions */}
      <motion.div variants={itemVariants} className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <Card className="flex-1 flex flex-col min-h-0 overflow-hidden bg-card border-border">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-foreground font-semibold">Historique des encaissements</CardTitle>
                  <p className="text-sm text-muted-foreground">Transactions validées</p>
                </div>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-secondary border-border text-foreground"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-2">
              {paginatedTransactions.length > 0 ? (
              paginatedTransactions.map((p, index) => {
                const invoice = invoices.find(i => i.id === p.invoiceId);
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="group flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-transparent hover:border-border transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 border border-emerald-500/20">
                        <CheckCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-foreground font-medium">{invoice?.clientName || 'Client inconnu'}</p>
                          <span className="text-muted-foreground text-[10px] font-mono uppercase bg-secondary px-1.5 py-0.5 rounded">
                            {p.paymentMethod || 'Cash'}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-xs">Facture {invoice?.number || 'N/A'} • {formatDate(p.date)}</p>
                      </div>
                      </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-bold text-emerald-600 dark:text-emerald-400">+{formatCurrency(p.amount)}</p>
                        <Badge variant="outline" className="text-[10px] uppercase font-bold text-emerald-600 border-emerald-600/20">Encaissé</Badge>
                        </div>
                      {user?.role === 'user' && p.created_by === user?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Supprimer le règlement de ${formatCurrency(p.amount)} du ${formatDate(p.date)}`}
                          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                          onClick={() => handleDeletePayment(p.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                      </div>
                  </motion.div>
                );
              })
              ) : (
                <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl">
                  Aucun encaissement trouvé.
                </div>
              )}
            </div>
            <div className="pt-4">
              <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
