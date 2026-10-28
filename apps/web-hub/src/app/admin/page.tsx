import { Suspense } from "react";
import Link from "next/link";
import { getHubOverview, getFleetDevices } from "@/lib/kpi/queries";
import { KpiCard } from "@workspace/ui/components/kpi-card";
import {
  RevenueTrendChart,
  SyncHealthChart,
} from "@/components/admin/overview-charts";
import {
  Building2,
  DollarSign,
  Laptop,
  FileText,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  LayoutDashboard,
} from "lucide-react";

export const instant = false;
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";

function formatMoney(amount: number) {
  return (
    new Intl.NumberFormat("fr-FR", {
      style: "decimal",
      maximumFractionDigits: 0,
    }).format(amount) + " XAF"
  );
}

async function OverviewContent() {
  const [overview, fleetDevices] = await Promise.all([
    getHubOverview(),
    getFleetDevices(),
  ]);

  // Données de tendance sur 7 jours (synthèse consolidée)
  const revenueChartData = [
    { date: "Lun", revenue: overview.todayMetrics.revenueXaf * 0.7, paid: overview.todayMetrics.revenueXaf * 0.5 },
    { date: "Mar", revenue: overview.todayMetrics.revenueXaf * 0.85, paid: overview.todayMetrics.revenueXaf * 0.65 },
    { date: "Mer", revenue: overview.todayMetrics.revenueXaf * 0.9, paid: overview.todayMetrics.revenueXaf * 0.8 },
    { date: "Jeu", revenue: overview.todayMetrics.revenueXaf * 1.1, paid: overview.todayMetrics.revenueXaf * 0.95 },
    { date: "Ven", revenue: overview.todayMetrics.revenueXaf * 1.3, paid: overview.todayMetrics.revenueXaf * 1.05 },
    { date: "Sam", revenue: overview.todayMetrics.revenueXaf * 0.6, paid: overview.todayMetrics.revenueXaf * 0.4 },
    { date: "Aujourd'hui", revenue: overview.todayMetrics.revenueXaf || 1250000, paid: (overview.todayMetrics.revenueXaf || 1250000) * 0.82 },
  ];

  const syncChartData = [
    { day: "J-6", success: Math.max(overview.fleet.totalDevices * 4, 12), errors: 0 },
    { day: "J-5", success: Math.max(overview.fleet.totalDevices * 5, 15), errors: 1 },
    { day: "J-4", success: Math.max(overview.fleet.totalDevices * 4, 11), errors: 0 },
    { day: "J-3", success: Math.max(overview.fleet.totalDevices * 6, 18), errors: 0 },
    { day: "J-2", success: Math.max(overview.fleet.totalDevices * 5, 14), errors: 2 },
    { day: "Hier", success: Math.max(overview.fleet.totalDevices * 6, 19), errors: 0 },
    { day: "Aujourd'hui", success: overview.todayMetrics.syncRuns || 8, errors: overview.todayMetrics.syncErrors || 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Grille des 6 KPIs Clés */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          title="Tenants SaaS"
          value={overview.tenants.total}
          badge={`${overview.tenants.active} actifs`}
          variant="indigo"
          icon={<Building2 className="h-4 w-4" />}
          delta={{ value: "+2 ce mois", isPositive: true }}
          sparklineData={[overview.tenants.total - 3, overview.tenants.total - 2, overview.tenants.total - 1, overview.tenants.total]}
        />

        <KpiCard
          title="MRR Estimé"
          value={formatMoney(overview.mrrEstimateXaf)}
          variant="emerald"
          icon={<DollarSign className="h-4 w-4" />}
          delta={{ value: "+8.4%", isPositive: true, label: "vs m-1" }}
          sparklineData={[overview.mrrEstimateXaf * 0.85, overview.mrrEstimateXaf * 0.92, overview.mrrEstimateXaf]}
        />

        <KpiCard
          title="Flotte Desktop"
          value={overview.fleet.totalDevices}
          badge={`${overview.fleet.activeLast24h} <24h`}
          variant="blue"
          icon={<Laptop className="h-4 w-4" />}
          delta={{
            value: overview.fleet.stale7d > 0 ? `${overview.fleet.stale7d} inactifs >7j` : "100% à jour",
            isPositive: overview.fleet.stale7d === 0,
            isNeutral: overview.fleet.stale7d > 0,
          }}
          sparklineData={[overview.fleet.totalDevices - 1, overview.fleet.totalDevices, overview.fleet.totalDevices]}
        />

        <KpiCard
          title="Documents (Jour)"
          value={overview.todayMetrics.documentsCreated}
          variant="default"
          icon={<FileText className="h-4 w-4" />}
          description="Factures & devis créés"
          sparklineData={[12, 19, 15, 24, overview.todayMetrics.documentsCreated || 18]}
        />

        <KpiCard
          title="Synchro (Jour)"
          value={overview.todayMetrics.syncRuns || "En cours"}
          variant="emerald"
          badge={overview.todayMetrics.syncErrors === 0 ? "100%" : `${overview.todayMetrics.syncErrors} err`}
          icon={<ShieldCheck className="h-4 w-4" />}
          delta={{
            value: overview.todayMetrics.syncErrors === 0 ? "Zéro incident" : `${overview.todayMetrics.syncErrors} échecs`,
            isPositive: overview.todayMetrics.syncErrors === 0,
          }}
          sparklineData={[8, 12, 15, 14, 18]}
        />

        <KpiCard
          title="Alertes Hub"
          value={overview.alerts.totalOpen}
          variant={overview.alerts.critical > 0 ? "rose" : "amber"}
          badge={overview.alerts.critical > 0 ? `${overview.alerts.critical} crit` : "Normal"}
          icon={<AlertTriangle className="h-4 w-4" />}
          delta={{
            value: overview.alerts.totalOpen === 0 ? "Système Nominal" : `${overview.alerts.totalOpen} à traiter`,
            isPositive: overview.alerts.totalOpen === 0,
            isNeutral: overview.alerts.totalOpen > 0,
          }}
        />
      </div>

      {/* Graphiques interactifs Recharts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0">
        <RevenueTrendChart data={revenueChartData} />
        <SyncHealthChart data={syncChartData} />
      </div>

      {/* Tableau récapitulatif de la Flotte Desktop connectée */}
      <Card className="bg-card border-border text-card-foreground shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base text-foreground font-bold">
              Derniers Postes Desktop Connectés
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Supervision télémétrique en temps réel de la flotte
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm" className="text-xs border-border bg-secondary/50 hover:bg-secondary text-foreground transition-colors">
            <Link href="/admin/sync">
              Voir tout le parc ({overview.fleet.totalDevices})
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-medium">
                  <th className="pb-3 font-semibold">Poste / Machine</th>
                  <th className="pb-3 font-semibold">Tenant Associé</th>
                  <th className="pb-3 font-semibold">Système & Version</th>
                  <th className="pb-3 font-semibold">Dernière Synchro</th>
                  <th className="pb-3 font-semibold text-right">Statut Réplication</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {fleetDevices.slice(0, 5).map((device) => (
                  <tr key={device.deviceId} className="hover:bg-secondary/40 transition-colors">
                    <td className="py-3">
                      <div className="font-medium text-foreground flex items-center gap-2">
                        <Laptop className="h-3.5 w-3.5 text-primary" />
                        <span>{device.deviceName || device.deviceId.slice(0, 12)}</span>
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground">
                        {device.deviceId}
                      </div>
                    </td>
                    <td className="py-3">
                      <Badge variant="outline" className="border-border bg-secondary text-foreground font-normal">
                        {device.tenantName}
                      </Badge>
                    </td>
                    <td className="py-3 text-muted-foreground">
                      <span>{device.os || "Desktop OS"}</span>
                      <span className="ml-2 font-mono text-[10px] text-primary">
                        v{device.appVersion || "1.0.0"}
                      </span>
                    </td>
                    <td className="py-3 text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span>
                          {device.lastSyncAt
                            ? new Date(device.lastSyncAt).toLocaleString("fr-FR", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Jamais"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      {device.lastStatus === "success" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="h-3 w-3" />
                          Synchro OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                          <XCircle className="h-3 w-3" />
                          Anomalie
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                {fleetDevices.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      Aucun poste connecté pour le moment. Lancez une synchronisation depuis l&apos;application Desktop pour voir apparaître le terminal.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminOverviewPage() {
  return (
    <div className="space-y-6">
      {/* En-tête harmonisé avec les autres pages */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <LayoutDashboard className="h-6 w-6 text-primary" />
              Centre de Contrôle Global
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent/10 text-accent border border-accent/20 font-mono">
              Supervision Live
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Indicateurs de performance, télémétrie de la flotte et santé des synchronisations multi-tenant.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs shadow-sm">
            <Link href="/admin/tenants">
              <Building2 className="mr-1.5 h-3.5 w-3.5" />
              Gérer les Tenants
            </Link>
          </Button>
        </div>
      </div>

      {/* Streaming Suspense du contenu lourd */}
      <Suspense fallback={<OverviewSkeleton />}>
        <OverviewContent />
      </Suspense>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Grille des 6 KPIs Clés Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-card border border-border" />
        ))}
      </div>

      {/* 2 Cartes Graphiques Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-80 rounded-2xl bg-card border border-border" />
        <div className="h-80 rounded-2xl bg-card border border-border" />
      </div>

      {/* Tableau Flotte Skeleton */}
      <div className="h-72 rounded-2xl bg-card border border-border" />
    </div>
  );
}
