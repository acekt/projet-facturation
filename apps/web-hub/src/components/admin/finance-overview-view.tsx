"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FinancialOverviewData } from "@/lib/kpi/financeQueries";
import { cn } from "@workspace/ui/lib/utils";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart";
import {
  DollarSign,
  TrendingUp,
  Receipt,
  FileText,
  AlertCircle,
  Download,
  RefreshCw,
  ArrowUpRight,
  CreditCard,
  Building2,
  PieChart as PieChartIcon,
  ShieldCheck,
  Percent,
} from "lucide-react";

interface FinanceOverviewViewProps {
  initialData: FinancialOverviewData;
}

const financeTrendChartConfig = {
  invoiced: {
    label: "Volume Émis (XAF)",
    color: "#003399", // Desktop Brand Primary
  },
  paid: {
    label: "Encaissé Réel (XAF)",
    color: "#2CA02C", // Desktop Brand Accent
  },
} satisfies ChartConfig;

const paymentMethodsChartConfig = {
  total: {
    label: "Montant Encaissé (XAF)",
    color: "#003399", // Desktop Brand Primary
  },
} satisfies ChartConfig;

export function FinanceOverviewView({ initialData }: FinanceOverviewViewProps) {
  const router = useRouter();
  const [data] = useState(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { summary, topTenants, paymentMethods, timeSeries } = data;

  const formatXaf = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "decimal",
      maximumFractionDigits: 0,
    }).format(amount) + " XAF";
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  // Export CSV complet de la gouvernance financière
  const handleExportCsv = () => {
    const lines: string[] = [];

    // 1. Synthèse globale
    lines.push("SYNTHÈSE FINANCIÈRE GLOBALE;;;;");
    lines.push(`Chiffre d'Affaires Global Facturé;${summary.totalInvoicedXaf};XAF;;`);
    lines.push(`Total Règlements Encaissés;${summary.totalPaidXaf};XAF;;`);
    lines.push(`Encours Clients Restant (Créances);${summary.outstandingXaf};XAF;;`);
    lines.push(`Taux de Recouvrement Global;${summary.recoveryRate}%;;;`);
    lines.push(`Pipeline Devis Émis;${summary.totalQuotesXaf};XAF;;`);
    lines.push(`Factures Émises;${summary.invoicesCount};;;`);
    lines.push(`Factures Soldées;${summary.paidInvoicesCount};;;`);
    lines.push(`Factures Échues / En Retard;${summary.overdueInvoicesCount};;;`);
    lines.push(";;;;");

    // 2. Top Contributeurs
    lines.push("TOP CONTRIBUTEURS (TENANTS);;;;;;;");
    lines.push("Rang;ID Tenant;Entreprise;Plan;Factures;Total Facturé (XAF);Total Encaissé (XAF);Solde Dû (XAF);Taux Recouvrement (%)");

    topTenants.forEach((t, index) => {
      lines.push(
        [
          index + 1,
          `"${t.tenantId}"`,
          `"${t.tenantName.replace(/"/g, '""')}"`,
          `"${t.planName}"`,
          t.invoicesCount,
          t.invoicedXaf,
          t.paidXaf,
          t.outstandingXaf,
          `${t.recoveryRate}%`,
        ].join(";")
      );
    });

    lines.push(";;;;;;;;");

    // 3. Ventilation par Modes de Règlement
    lines.push("VENTILATION MODES DE RÈGLEMENT;;;;");
    lines.push("Mode de Règlement;Nombre de Transactions;Montant Total (XAF);Part (%)");
    paymentMethods.forEach((pm) => {
      lines.push([`"${pm.label}"`, pm.count, pm.totalXaf, `${pm.percentage}%`].join(";"));
    });

    const csvContent = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `gouvernance-financiere-${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Préparation des données pour le graphe temporel
  const chartTimeSeries = timeSeries.map((p) => {
    const parts = p.date.split("-");
    const shortDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : p.date;
    return {
      date: shortDate,
      fullDate: p.date,
      invoiced: p.invoicedXaf,
      paid: p.paidXaf,
    };
  });

  return (
    <div className="space-y-6">
      {/* En-tête Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <DollarSign className="h-6 w-6 text-accent" />
              Supervision Financière & Volumes d&apos;Affaires
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent/10 text-accent border border-accent/20">
              Consolidé Multi-Tenant
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Agrégation temps réel du chiffre d&apos;affaires facturé, des encaissements effectifs, des créances échues et du taux de recouvrement.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground border border-border transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin text-primary")} />
            Actualiser
          </button>
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Exporter Rapport CSV
          </button>
        </div>
      </div>

      {/* Cartes KPI Financières Principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Chiffre d'Affaires Global Facturé */}
        <div className="p-5 rounded-2xl bg-card border border-border flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Volume Facturé</span>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-foreground tracking-tight">
              {formatXaf(summary.totalInvoicedXaf)}
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <span>{summary.invoicesCount} factures émises</span>
              <span>•</span>
              <span className="text-accent font-medium">{summary.paidInvoicesCount} réglées</span>
            </div>
          </div>
        </div>

        {/* Total Règlements Encaissés */}
        <div className="p-5 rounded-2xl bg-card border border-accent/20 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider text-accent">Encaissé Réel</span>
            <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-accent tracking-tight">
              {formatXaf(summary.totalPaidXaf)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Règlements effectifs enregistrés
            </div>
          </div>
        </div>

        {/* Encours Clients / Créances */}
        <div className="p-5 rounded-2xl bg-card border border-amber-500/20 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">Encours & Impayés</span>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 tracking-tight">
              {formatXaf(summary.outstandingXaf)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {summary.overdueInvoicesCount > 0
                ? `${summary.overdueInvoicesCount} facture(s) en dépassement d'échéance`
                : "Solde global à recouvrer"}
            </div>
          </div>
        </div>

        {/* Taux de Recouvrement */}
        <div className="p-5 rounded-2xl bg-card border border-primary/20 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider text-primary">Taux Recouvrement</span>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Percent className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  "text-2xl font-bold tracking-tight",
                  summary.recoveryRate >= 80
                    ? "text-accent"
                    : summary.recoveryRate >= 60
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-destructive"
                )}
              >
                {summary.recoveryRate}%
              </span>
              <span className="text-xs text-muted-foreground">recouvré</span>
            </div>
            {/* Barre de progression miniature */}
            <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  summary.recoveryRate >= 80
                    ? "bg-accent"
                    : summary.recoveryRate >= 60
                    ? "bg-amber-500"
                    : "bg-destructive"
                )}
                style={{ width: `${Math.min(100, Math.max(0, summary.recoveryRate))}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Devis & Estimation MRR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Pipeline Commercial (Devis)
              </div>
              <div className="text-lg font-bold text-foreground mt-0.5">
                {formatXaf(summary.totalQuotesXaf)}
              </div>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">Potentiel de conversion</span>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Revenu Récurrent Estimé (MRR SaaS)
              </div>
              <div className="text-lg font-bold text-accent mt-0.5">
                {formatXaf(summary.mrrEstimateXaf)} / mois
              </div>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">Base abonnements actifs</span>
        </div>
      </div>

      {/* Graphiques Interactifs Recharts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graphique 1 : Évolution Temporelle Facturé vs Encaissé (2 colonnes) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-card border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Évolution Chronologique : Émis vs Encaissé (30 Jours)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Suivi comparatif des factures émises et des flux de trésorerie effectifs.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-primary">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Volume Émis
              </span>
              <span className="flex items-center gap-1.5 text-accent">
                <span className="h-2 w-2 rounded-full bg-accent" />
                Encaissé Réel
              </span>
            </div>
          </div>

          <div className="h-[280px] w-full pt-4">
            <ChartContainer config={financeTrendChartConfig} className="h-full w-full">
              <AreaChart data={chartTimeSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="fillInvoiced" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#003399" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#003399" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="fillPaid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2CA02C" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#2CA02C" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border opacity-50" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  stroke="currentColor"
                  className="text-muted-foreground"
                  fontSize={11}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  stroke="currentColor"
                  className="text-muted-foreground"
                  fontSize={11}
                  tickFormatter={(val) => `${Math.round(val / 1000)}k`}
                />
                <ChartTooltip
                  cursor={{ stroke: "currentColor", className: "text-border", strokeWidth: 1 }}
                  content={
                    <ChartTooltipContent
                      formatter={(val) => formatXaf(Number(val))}
                      labelFormatter={(_, payload) => {
                        const pt = payload?.[0]?.payload;
                        return pt?.fullDate ? `Date: ${pt.fullDate}` : "";
                      }}
                    />
                  }
                />
                <Area
                  dataKey="invoiced"
                  type="monotone"
                  fill="url(#fillInvoiced)"
                  stroke="#003399"
                  strokeWidth={2}
                />
                <Area
                  dataKey="paid"
                  type="monotone"
                  fill="url(#fillPaid)"
                  stroke="#2CA02C"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </div>

        {/* Graphique 2 : Modes de Règlement */}
        <div className="p-5 rounded-2xl bg-card border border-border space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-primary" />
              Canaux d&apos;Encaissement
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Répartition des encaissements par mode de règlement.
            </p>
          </div>

          <div className="space-y-3 my-auto">
            {paymentMethods.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Aucun règlement enregistré.
              </div>
            ) : (
              paymentMethods.map((pm) => (
                <div key={pm.method} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{pm.label}</span>
                    <span className="font-semibold text-foreground">
                      {formatXaf(pm.totalXaf)}{" "}
                      <span className="text-muted-foreground font-normal">({pm.percentage}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, pm.percentage)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t border-border text-[11px] text-muted-foreground flex justify-between">
            <span>Transactions totales:</span>
            <span className="font-semibold text-foreground">
              {paymentMethods.reduce((sum, p) => sum + p.count, 0)} règlements
            </span>
          </div>
        </div>
      </div>

      {/* Top 10 Clients / Entreprises Contributrices */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Top 10 Entreprises Contributrices & Taux de Recouvrement
            </h3>
            <p className="text-xs text-muted-foreground">
              Classement par volume d&apos;affaires émis et santé de recouvrement des créances.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="py-3 px-4">Rang & Entreprise</th>
                  <th className="py-3 px-4">Abonnement</th>
                  <th className="py-3 px-4">Factures</th>
                  <th className="py-3 px-4">Volume Facturé</th>
                  <th className="py-3 px-4">Encaissé Réel</th>
                  <th className="py-3 px-4">Solde Restant</th>
                  <th className="py-3 px-4">Taux Recouvrement</th>
                  <th className="py-3 px-4 text-right">Fiche</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {topTenants.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      Aucune donnée de facturation enregistrée dans le Hub.
                    </td>
                  </tr>
                ) : (
                  topTenants.map((t, idx) => (
                    <tr key={t.tenantId} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "h-6 w-6 rounded-md flex items-center justify-center text-xs font-bold",
                              idx === 0
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                : idx === 1
                                ? "bg-secondary text-foreground border border-border"
                                : idx === 2
                                ? "bg-amber-700/15 text-amber-700 dark:text-amber-500 border border-amber-700/20"
                                : "bg-secondary text-muted-foreground"
                            )}
                          >
                            #{idx + 1}
                          </span>
                          <div>
                            <Link
                              href={`/admin/tenants/${t.tenantId}`}
                              className="font-semibold text-foreground hover:text-primary transition"
                            >
                              {t.tenantName}
                            </Link>
                            <div className="text-[11px] font-mono text-muted-foreground">
                              ID: {t.tenantId.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                          {t.planName}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-muted-foreground font-mono">
                        {t.invoicesCount}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-foreground">
                        {formatXaf(t.invoicedXaf)}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-accent">
                        {formatXaf(t.paidXaf)}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-amber-600 dark:text-amber-400">
                        {formatXaf(t.outstandingXaf)}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="space-y-1 w-32">
                          <div className="flex justify-between text-xs font-semibold">
                            <span
                              className={cn(
                                t.recoveryRate >= 80
                                  ? "text-accent"
                                  : t.recoveryRate >= 60
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-destructive"
                              )}
                            >
                              {t.recoveryRate}%
                            </span>
                          </div>
                          <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-300",
                                t.recoveryRate >= 80
                                  ? "bg-accent"
                                  : t.recoveryRate >= 60
                                  ? "bg-amber-500"
                                  : "bg-destructive"
                              )}
                              style={{ width: `${Math.min(100, t.recoveryRate)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/admin/tenants/${t.tenantId}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-foreground bg-secondary hover:bg-secondary/80 border border-border transition"
                        >
                          Détails
                          <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
