"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdoptionFunnelData, TenantHealthDetail, HealthCategory } from "@/lib/kpi/adoptionQueries";
import { cn } from "@workspace/ui/lib/utils";
import {
  TrendingUp,
  HeartPulse,
  UserCheck,
  AlertTriangle,
  ArrowRight,
  Download,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Laptop,
  Receipt,
  ShieldCheck,
  Layers,
  ArrowUpRight,
  Flame,
  Award,
} from "lucide-react";

interface AdoptionFunnelViewProps {
  initialData: AdoptionFunnelData;
}

export function AdoptionFunnelView({ initialData }: AdoptionFunnelViewProps) {
  const router = useRouter();
  const [data] = useState(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | HealthCategory>("all");

  const { summary, funnelSteps, featuresAdoption, allTenantsHealth, churnRiskTenants } = data;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  // Export CSV Santé & Adoption
  const handleExportCsv = () => {
    const headers = [
      "ID Tenant",
      "Entreprise",
      "Statut",
      "Plan",
      "Health Score Total",
      "Catégorie Santé",
      "Score Activité (/30)",
      "Score Volume (/25)",
      "Score Synchro (/25)",
      "Score Recouvrement (/20)",
      "Jours Inactivité",
      "Factures 30j",
      "Total Facturé (XAF)",
      "Total Encaissé (XAF)",
      "Taux Recouvrement (%)",
      "Période de Grâce",
    ];

    const rows = filteredTenants.map((t) => [
      `"${t.tenantId}"`,
      `"${t.tenantName.replace(/"/g, '""')}"`,
      `"${t.status}"`,
      `"${t.planName}"`,
      t.health.totalScore,
      `"${t.health.category}"`,
      t.health.activityScore,
      t.health.volumeScore,
      t.health.syncQualityScore,
      t.health.recoveryScore,
      t.daysSinceLastSeen,
      t.invoicesLast30d,
      t.totalInvoicedXaf,
      t.totalPaidXaf,
      `${t.recoveryRate}%`,
      t.health.isGracePeriod ? "Oui" : "Non",
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `audit-sante-adoption-${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtrage des tenants
  const filteredTenants = useMemo(() => {
    return allTenantsHealth.filter((t) => {
      if (categoryFilter !== "all" && t.health.category !== categoryFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.tenantName.toLowerCase().includes(q) ||
        t.tenantId.toLowerCase().includes(q) ||
        t.planName.toLowerCase().includes(q)
      );
    });
  }, [allTenantsHealth, categoryFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* En-tête Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <TrendingUp className="h-6 w-6 text-primary" />
              Adoption SaaS, Funnel &amp; Health Score
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              Rétention Client
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Conversion du parcours d&apos;onboarding, modélisation de l&apos;indice de santé client et anticipation prédictive du churn.
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
            Exporter Audit Santé CSV
          </button>
        </div>
      </div>

      {/* Cartes KPI Synthétiques d'Adoption */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Taux d'Activation Global */}
        <div className="p-5 rounded-2xl bg-card border border-border flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Activation Globale</span>
            <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-foreground tracking-tight">
              {summary.globalActivationRate}%
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Des entreprises ont encaissé un 1er paiement
            </div>
          </div>
        </div>

        {/* Health Score Moyen */}
        <div className="p-5 rounded-2xl bg-card border border-border flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Health Score Moyen</span>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <HeartPulse className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-primary tracking-tight">
              {summary.averageHealthScore}{" "}
              <span className="text-xs font-normal text-muted-foreground">/ 100</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Sur {summary.totalTenants} compte(s) client(s)
            </div>
          </div>
        </div>

        {/* Clients Champions */}
        <div className="p-5 rounded-2xl bg-card border border-accent/20 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider text-accent">Champions (&ge; 80)</span>
            <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-accent tracking-tight">
              {summary.distribution.champions}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Usage intensif, forte satisfaction
            </div>
          </div>
        </div>

        {/* Risque de Churn */}
        <div className="p-5 rounded-2xl bg-card border border-destructive/20 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider text-destructive">Risque Churn (&lt; 40)</span>
            <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold text-destructive tracking-tight">
              {summary.distribution.churnRisk}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Désengagement ou synchro inactive
            </div>
          </div>
        </div>
      </div>

      {/* Visualiseur de Funnel d'Onboarding */}
      <div className="p-6 rounded-2xl bg-card border border-border space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Entonnoir d&apos;Activation (Onboarding SaaS)
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Étapes d&apos;engagement franchies depuis l&apos;enregistrement jusqu&apos;à la première rentrée financière.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">
            Base: {summary.totalTenants} entreprise(s)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
          {funnelSteps.map((step, idx) => {
            const isLast = idx === funnelSteps.length - 1;
            return (
              <div
                key={step.id}
                className="relative p-4 rounded-xl bg-secondary/50 border border-border flex flex-col justify-between hover:border-primary/40 transition"
              >
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {step.label}
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-foreground">{step.count}</span>
                    <span className="text-xs text-muted-foreground">
                      ({step.overallRate}% du total)
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                    {step.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
                  {idx > 0 ? (
                    <>
                      <span className="text-muted-foreground font-medium">
                        Conversion: <strong className="text-primary">{step.conversionRate}%</strong>
                      </span>
                      {step.dropOffRate > 0 && (
                        <span className="text-destructive font-semibold text-[11px]">
                          -{step.dropOffRate}% abandon
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-accent font-medium">Point d&apos;entrée (100%)</span>
                  )}
                </div>

                {/* Connecteur visuel sur desktop */}
                {!isLast && (
                  <div className="hidden md:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10 h-6 w-6 rounded-full bg-card border border-border items-center justify-center text-muted-foreground shadow-sm">
                    <ArrowRight className="h-3 w-3" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Distribution du Health Score & Adoption des Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribution des Segments de Santé */}
        <div className="p-5 rounded-2xl bg-card border border-border space-y-4 shadow-sm">
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-primary" />
              Segmentation de la Base Client
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Répartition selon l&apos;indice de santé global calculé.
            </p>
          </div>

          <div className="space-y-3">
            {/* Champions */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-accent font-semibold flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  Champions (80-100 pts)
                </span>
                <span className="text-foreground font-bold">{summary.distribution.champions}</span>
              </div>
              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                <div
                  className="bg-accent h-full rounded-full"
                  style={{
                    width: `${summary.totalTenants > 0 ? (summary.distribution.champions / summary.totalTenants) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Stables */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-primary font-semibold flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Stables (60-79 pts)
                </span>
                <span className="text-foreground font-bold">{summary.distribution.stable}</span>
              </div>
              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full"
                  style={{
                    width: `${summary.totalTenants > 0 ? (summary.distribution.stable / summary.totalTenants) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* À Surveiller */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  À Surveiller (40-59 pts)
                </span>
                <span className="text-foreground font-bold">{summary.distribution.watch}</span>
              </div>
              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full"
                  style={{
                    width: `${summary.totalTenants > 0 ? (summary.distribution.watch / summary.totalTenants) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Risque de Churn */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-destructive font-semibold flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-destructive" />
                  Risque Churn (&lt; 40 pts)
                </span>
                <span className="text-foreground font-bold">{summary.distribution.churnRisk}</span>
              </div>
              <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                <div
                  className="bg-destructive h-full rounded-full"
                  style={{
                    width: `${summary.totalTenants > 0 ? (summary.distribution.churnRisk / summary.totalTenants) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-muted-foreground leading-tight">
            * Score composé de 4 facteurs : Activité (30), Volume factures (25), Qualité synchro (25), Recouvrement (20).
          </div>
        </div>

        {/* Pénétration des Fonctionnalités Avancées (2 colonnes) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-card border border-border space-y-4 shadow-sm">
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Flame className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              Pénétration des Fonctionnalités Clés
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Taux d&apos;adoption des usages différenciants du Facturier Hub &amp; Spoke.
            </p>
          </div>

          <div className="space-y-4 pt-1">
            {featuresAdoption.map((feat) => (
              <div
                key={feat.featureKey}
                className="p-3.5 rounded-xl bg-secondary/50 border border-border flex flex-col justify-between space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{feat.label}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-secondary text-secondary-foreground border border-border">
                      {feat.badge}
                    </span>
                  </div>
                  <span className="font-bold text-primary">
                    {feat.adoptedCount} / {feat.totalCount} ({feat.percentage}%)
                  </span>
                </div>

                <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-primary to-accent h-full rounded-full transition-all duration-500"
                    style={{ width: `${feat.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Radar de Santé & Prévention du Churn */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border shadow-sm">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher une entreprise, plan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-secondary/50 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setCategoryFilter("all")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer",
                categoryFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground bg-secondary/60 hover:bg-secondary"
              )}
            >
              Tous ({allTenantsHealth.length})
            </button>
            <button
              onClick={() => setCategoryFilter("churn_risk")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer",
                categoryFilter === "churn_risk"
                  ? "bg-destructive text-destructive-foreground shadow-sm"
                  : "text-destructive bg-destructive/10 hover:bg-destructive/20 border border-destructive/20"
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              Risque Churn ({summary.distribution.churnRisk})
            </button>
            <button
              onClick={() => setCategoryFilter("watch")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer",
                categoryFilter === "watch"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20"
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              À Surveiller ({summary.distribution.watch})
            </button>
            <button
              onClick={() => setCategoryFilter("stable")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer",
                categoryFilter === "stable"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground bg-secondary/60 hover:bg-secondary"
              )}
            >
              Stables ({summary.distribution.stable})
            </button>
            <button
              onClick={() => setCategoryFilter("champion")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer",
                categoryFilter === "champion"
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "text-accent bg-accent/10 hover:bg-accent/20 border border-accent/20"
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              Champions ({summary.distribution.champions})
            </button>
          </div>
        </div>

        {/* Tableau Détaillé du Health Score */}
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="py-3 px-4">Entreprise &amp; Plan</th>
                  <th className="py-3 px-4">Health Score</th>
                  <th className="py-3 px-4">Facteurs de Santé</th>
                  <th className="py-3 px-4">Dernière Activité</th>
                  <th className="py-3 px-4">Factures 30j</th>
                  <th className="py-3 px-4">Recouvrement</th>
                  <th className="py-3 px-4 text-right">Vue 360°</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      Aucune entreprise ne correspond aux critères sélectionnés.
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map((t) => {
                    const score = t.health.totalScore;
                    return (
                      <tr key={t.tenantId} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <Link
                            href={`/admin/tenants/${t.tenantId}`}
                            className="font-semibold text-foreground hover:text-primary transition"
                          >
                            {t.tenantName}
                          </Link>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground border border-border">
                              {t.planName}
                            </span>
                            {t.health.isGracePeriod && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20">
                                Nouveau (&lt; 7j)
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-xs font-bold border",
                                score >= 80
                                  ? "bg-accent/10 text-accent border-accent/30"
                                  : score >= 60
                                  ? "bg-primary/10 text-primary border-primary/30"
                                  : score >= 40
                                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                  : "bg-destructive/10 text-destructive border-destructive/30"
                              )}
                            >
                              {score} / 100
                            </span>
                            <span className="text-xs font-medium text-muted-foreground">
                              {t.health.category === "champion" && "Champion"}
                              {t.health.category === "stable" && "Stable"}
                              {t.health.category === "watch" && "À Surveiller"}
                              {t.health.category === "churn_risk" && "Risque Churn"}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-xs font-mono">
                          <div className="text-foreground">
                            Act: <span className="text-primary font-medium">{t.health.activityScore}</span>/30 •
                            Vol: <span className="text-primary font-medium">{t.health.volumeScore}</span>/25
                          </div>
                          <div className="text-muted-foreground mt-0.5 text-[11px]">
                            Sync: <span className="text-accent font-medium">{t.health.syncQualityScore}</span>/25 •
                            Rec: <span className="text-amber-600 dark:text-amber-400 font-medium">{t.health.recoveryScore}</span>/20
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-xs">
                          {t.lastSeenAt ? (
                            <div>
                              <div className="text-foreground">
                                {new Date(t.lastSeenAt).toLocaleDateString("fr-FR")}
                              </div>
                              <div
                                className={cn(
                                  "text-[11px] font-medium",
                                  t.daysSinceLastSeen <= 1
                                    ? "text-accent"
                                    : t.daysSinceLastSeen <= 7
                                    ? "text-muted-foreground"
                                    : "text-amber-600 dark:text-amber-400 font-semibold"
                                )}
                              >
                                {t.daysSinceLastSeen === 0
                                  ? "Aujourd'hui"
                                  : `Il y a ${t.daysSinceLastSeen}j`}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic text-xs">
                              Aucun poste appairé
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-sm font-mono text-foreground">
                          {t.invoicesLast30d} factures
                          <span className="text-[11px] text-muted-foreground block">
                            (Total: {t.invoicesCount})
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-xs font-semibold">
                          <span
                            className={cn(
                              t.recoveryRate >= 80
                                ? "text-accent"
                                : t.recoveryRate >= 50
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-destructive"
                            )}
                          >
                            {t.recoveryRate}%
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <Link
                            href={`/admin/tenants/${t.tenantId}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-foreground bg-secondary hover:bg-secondary/80 border border-border transition"
                          >
                            Fiche 360°
                            <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
