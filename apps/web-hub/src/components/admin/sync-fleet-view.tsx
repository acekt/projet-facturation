"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { DetailedSyncFleetData, SyncDeviceDetail, SyncRunDetail } from "@/lib/kpi/fleetQueries";
import { cn } from "@workspace/ui/lib/utils";
import {
  Laptop,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  Download,
  Search,
  Filter,
  Copy,
  Check,
  ChevronRight,
  Radio,
  SlidersHorizontal,
  Flame,
  ArrowUpRight,
  ArrowDownLeft,
  FileCode,
} from "lucide-react";

interface SyncFleetViewProps {
  initialData: DetailedSyncFleetData;
}

export function SyncFleetView({ initialData }: SyncFleetViewProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [liveRuns, setLiveRuns] = useState<SyncRunDetail[]>(initialData.recentRuns);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active_24h" | "moderate_7d" | "stale_gt_7d" | "error">("all");
  const [activeTab, setActiveTab] = useState<"devices" | "live_feed" | "errors">("devices");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedError, setSelectedError] = useState<SyncRunDetail | null>(null);

  // Synchronisation avec initialData lors des revalidations serveur
  useEffect(() => {
    setData(initialData);
    setLiveRuns(initialData.recentRuns);
  }, [initialData]);

  // Abonnement Supabase Realtime pour le fil d'activité en direct
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("sync_runs_live_feed")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "sync_runs",
        },
        async (payload: any) => {
          const newRow = payload.new;
          if (!newRow) return;

          // Résolution du nom du tenant si disponible
          const tenantName =
            data.devices.find((d) => d.tenantId === newRow.tenant_id)?.tenantName ||
            "Entreprise synchronisée";

          const newRun: SyncRunDetail = {
            id: newRow.id,
            tenantId: newRow.tenant_id,
            tenantName,
            deviceId: newRow.device_id,
            startedAt: newRow.started_at,
            completedAt: newRow.completed_at,
            durationMs: Number(newRow.duration_ms) || 0,
            pushed: Number(newRow.pushed) || 0,
            pulled: Number(newRow.pulled) || 0,
            deleted: Number(newRow.deleted) || 0,
            skipped: Number(newRow.skipped) || 0,
            errorCount: Number(newRow.error_count) || 0,
            errors: Array.isArray(newRow.errors) ? newRow.errors : [],
            appVersion: newRow.app_version || null,
            os: newRow.os || null,
            createdAt: newRow.created_at || new Date().toISOString(),
          };

          setLiveRuns((prev) => [newRun, ...prev.slice(0, 99)]);
        }
      )
      .subscribe((status: string) => {
        setIsLiveConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [data.devices]);

  // Rafraîchissement manuel
  const handleRefresh = async () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  // Copier dans le presse-papier
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export CSV du parc
  const handleExportCsv = () => {
    const headers = [
      "ID Poste",
      "Nom du Poste",
      "Tenant ID",
      "Entreprise",
      "Système d'Exploitation",
      "Version Application",
      "Statut Récent",
      "Classe d'Âge",
      "Jours Inactivité",
      "Dernière Activité",
      "Dernière Synchronisation",
    ];

    const rows = filteredDevices.map((d) => [
      `"${d.deviceId}"`,
      `"${d.deviceName || "Non nommé"}"`,
      `"${d.tenantId}"`,
      `"${d.tenantName.replace(/"/g, '""')}"`,
      `"${d.os || "Inconnu"}"`,
      `"${d.appVersion || "Inconnue"}"`,
      `"${d.lastStatus}"`,
      `"${d.stalenessCategory}"`,
      d.daysSinceLastSeen,
      `"${new Date(d.lastSeenAt).toLocaleString("fr-FR")}"`,
      d.lastSyncAt ? `"${new Date(d.lastSyncAt).toLocaleString("fr-FR")}"` : '"Jamais"',
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `parc-synchronisation-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtrage des postes
  const filteredDevices = useMemo(() => {
    return data.devices.filter((d) => {
      // Filtre statut / classe d'âge
      if (statusFilter === "active_24h" && d.stalenessCategory !== "active_24h") return false;
      if (statusFilter === "moderate_7d" && d.stalenessCategory !== "moderate_7d") return false;
      if (statusFilter === "stale_gt_7d" && d.stalenessCategory !== "stale_gt_7d") return false;
      if (statusFilter === "error" && d.lastStatus !== "error") return false;

      // Filtre recherche
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        d.deviceId.toLowerCase().includes(q) ||
        d.tenantName.toLowerCase().includes(q) ||
        (d.deviceName && d.deviceName.toLowerCase().includes(q)) ||
        (d.os && d.os.toLowerCase().includes(q)) ||
        (d.appVersion && d.appVersion.toLowerCase().includes(q))
      );
    });
  }, [data.devices, statusFilter, searchQuery]);

  const { summary } = data;

  return (
    <div className="space-y-6">
      {/* En-tête principal & statut Realtime */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Laptop className="h-6 w-6 text-primary" />
              Parc Desktop & Supervision Synchro
            </h1>
            <div
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                isLiveConnected
                  ? "bg-accent/10 text-accent border-accent/20"
                  : "bg-secondary text-muted-foreground border-border"
              )}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  isLiveConnected ? "bg-accent animate-pulse" : "bg-muted-foreground"
                )}
              />
              {isLiveConnected ? "Flux Realtime Actif" : "Connexion flux..."}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Cartographie de la flotte des clients lourds SQLite, latences de réplication et détection des postes dormants.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-secondary/60 hover:bg-secondary text-foreground border border-border transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            Actualiser
          </button>
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover text-primary-foreground border border-primary/20 transition shadow-xs cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Exporter CSV
          </button>
        </div>
      </div>

      {/* Cartes KPI Synthétiques & Performance SLA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Postes */}
        <div className="p-4 rounded-2xl bg-card border border-border flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Flotte Totale</span>
            <Laptop className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-foreground font-mono">{summary.totalDevices}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Postes Desktop enregistrés</div>
          </div>
        </div>

        {/* Actifs < 24h */}
        <div className="p-4 rounded-2xl bg-card border border-border flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider text-accent">Actifs &lt; 24h</span>
            <Activity className="h-4 w-4 text-accent" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-accent font-mono">{summary.activeLast24h}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {summary.totalDevices > 0
                ? `${Math.round((summary.activeLast24h / summary.totalDevices) * 100)}% de la flotte active`
                : "Aucun poste"}
            </div>
          </div>
        </div>

        {/* Postes Dormants > 7j */}
        <div className="p-4 rounded-2xl bg-card border border-border flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">Dormants &gt; 7j</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono">{summary.stale7d}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Risque de désynchronisation</div>
          </div>
        </div>

        {/* Postes en Erreur */}
        <div className="p-4 rounded-2xl bg-card border border-border flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider text-destructive">En Erreur</span>
            <XCircle className="h-4 w-4 text-destructive" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-destructive font-mono">{summary.errorDevices}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {summary.errorsLast24h} erreurs enregistrées (24h)
            </div>
          </div>
        </div>

        {/* SLA & Latence Percentile 95 */}
        <div className="p-4 rounded-2xl bg-card border border-border flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider text-primary">Latence SLA (p95)</span>
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-primary font-mono">
              {summary.p95DurationMs} <span className="text-xs font-normal text-muted-foreground">ms</span>
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Moyenne: {summary.avgDurationMs} ms • Taux: {summary.successRate24h}%
            </div>
          </div>
        </div>
      </div>

      {/* Barre de navigation d'onglets */}
      <div className="flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("devices")}
            className={cn(
              "px-4 py-3 text-sm font-semibold border-b-2 transition -mb-px flex items-center gap-2 cursor-pointer",
              activeTab === "devices"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Laptop className="h-4 w-4" />
            Flotte des Postes ({filteredDevices.length})
          </button>
          <button
            onClick={() => setActiveTab("live_feed")}
            className={cn(
              "px-4 py-3 text-sm font-semibold border-b-2 transition -mb-px flex items-center gap-2 cursor-pointer",
              activeTab === "live_feed"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Radio className="h-4 w-4 text-accent" />
            Flux Live des Synchros ({liveRuns.length})
          </button>
          <button
            onClick={() => setActiveTab("errors")}
            className={cn(
              "px-4 py-3 text-sm font-semibold border-b-2 transition -mb-px flex items-center gap-2 cursor-pointer",
              activeTab === "errors"
                ? "border-destructive text-destructive bg-destructive/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Journal des Erreurs ({data.recentErrors.length})
          </button>
        </div>
      </div>

      {/* ONGLET 1 : Flotte des Postes */}
      {activeTab === "devices" && (
        <div className="space-y-4">
          {/* Filtres & Recherche */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-card border border-border shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Rechercher par ID poste, entreprise, OS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-secondary/50 border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setStatusFilter("all")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer",
                  statusFilter === "all"
                    ? "bg-secondary text-foreground border border-border shadow-xs"
                    : "text-muted-foreground hover:text-foreground bg-transparent"
                )}
              >
                Tous ({data.devices.length})
              </button>
              <button
                onClick={() => setStatusFilter("active_24h")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer",
                  statusFilter === "active_24h"
                    ? "bg-accent/15 text-accent border border-accent/30"
                    : "text-muted-foreground hover:text-foreground bg-transparent"
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Actifs &lt; 24h ({summary.activeLast24h})
              </button>
              <button
                onClick={() => setStatusFilter("moderate_7d")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer",
                  statusFilter === "moderate_7d"
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground bg-transparent"
                )}
              >
                Modérés 1-7j ({summary.active1to7d})
              </button>
              <button
                onClick={() => setStatusFilter("stale_gt_7d")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer",
                  statusFilter === "stale_gt_7d"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                    : "text-muted-foreground hover:text-foreground bg-transparent"
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Dormants &gt; 7j ({summary.stale7d})
              </button>
              <button
                onClick={() => setStatusFilter("error")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer",
                  statusFilter === "error"
                    ? "bg-destructive/15 text-destructive border border-destructive/30"
                    : "text-muted-foreground hover:text-foreground bg-transparent"
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                En Erreur ({summary.errorDevices})
              </button>
            </div>
          </div>

          {/* Tableau des Postes */}
          <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-4">Poste & ID</th>
                    <th className="py-3 px-4">Entreprise (Tenant)</th>
                    <th className="py-3 px-4">OS & Version</th>
                    <th className="py-3 px-4">Statut Synchro</th>
                    <th className="py-3 px-4">Activité</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-sm">
                  {filteredDevices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        Aucun poste ne correspond aux critères de recherche.
                      </td>
                    </tr>
                  ) : (
                    filteredDevices.map((device) => {
                      return (
                        <tr
                          key={`${device.deviceId}-${device.tenantId}`}
                          className="hover:bg-muted/40 transition-colors"
                        >
                          {/* Poste & ID */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-xl bg-secondary flex items-center justify-center text-foreground">
                                <Laptop className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <div className="font-semibold text-foreground flex items-center gap-2">
                                  {device.deviceName || "Poste Desktop"}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-xs font-mono text-muted-foreground">
                                    {device.deviceId.slice(0, 12)}...
                                  </span>
                                  <button
                                    onClick={() => handleCopy(device.deviceId)}
                                    className="text-muted-foreground hover:text-foreground transition cursor-pointer"
                                    title="Copier l'ID complet"
                                  >
                                    {copiedId === device.deviceId ? (
                                      <Check className="h-3 w-3 text-accent" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Entreprise */}
                          <td className="py-3.5 px-4">
                            <Link
                              href={`/admin/tenants/${device.tenantId}`}
                              className="font-medium text-primary hover:underline flex items-center gap-1"
                            >
                              {device.tenantName}
                              <ArrowUpRight className="h-3 w-3 opacity-70" />
                            </Link>
                          </td>

                          {/* OS & Version */}
                          <td className="py-3.5 px-4">
                            <div className="text-xs text-foreground">{device.os || "OS inconnu"}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                              v{device.appVersion || "1.0.0"}
                            </div>
                          </td>

                          {/* Statut Synchro */}
                          <td className="py-3.5 px-4">
                            {device.lastStatus === "success" && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent/10 text-accent border border-accent/20">
                                <CheckCircle2 className="h-3 w-3" />
                                OK
                              </span>
                            )}
                            {device.lastStatus === "error" && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                                <XCircle className="h-3 w-3" />
                                Erreur
                              </span>
                            )}
                            {device.lastStatus === "pending" && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                <Clock className="h-3 w-3" />
                                En cours
                              </span>
                            )}
                          </td>

                          {/* Activité */}
                          <td className="py-3.5 px-4">
                            <div className="text-xs text-foreground">
                              {new Date(device.lastSeenAt).toLocaleString("fr-FR", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                            <div className="text-[11px] mt-0.5">
                              {device.stalenessCategory === "active_24h" && (
                                <span className="text-accent font-medium">Actif (&lt;24h)</span>
                              )}
                              {device.stalenessCategory === "moderate_7d" && (
                                <span className="text-muted-foreground font-medium">Il y a {device.daysSinceLastSeen}j</span>
                              )}
                              {device.stalenessCategory === "stale_gt_7d" && (
                                <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Dormant ({device.daysSinceLastSeen}j)
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <Link
                              href={`/admin/tenants/${device.tenantId}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium text-foreground bg-secondary/60 hover:bg-secondary border border-border transition cursor-pointer"
                            >
                              Fiche Tenant
                              <ChevronRight className="h-3 w-3" />
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
      )}

      {/* ONGLET 2 : Fil d'Activité en Direct (Realtime) */}
      {activeTab === "live_feed" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent"></span>
              </span>
              <span className="text-xs text-muted-foreground">
                Fil d&apos;événements de synchronisation en continu (abonnés via WebSocket Supabase Realtime).
              </span>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {liveRuns.length} cycles affichés
            </span>
          </div>

          <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    <th className="py-3 px-4">Heure / Date</th>
                    <th className="py-3 px-4">Entreprise</th>
                    <th className="py-3 px-4">Poste</th>
                    <th className="py-3 px-4">Durée (ms)</th>
                    <th className="py-3 px-4">Poussés / Reçus</th>
                    <th className="py-3 px-4">Résultat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-sm font-mono">
                  {liveRuns.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground font-sans">
                        Aucun cycle de réplication enregistré récemment.
                      </td>
                    </tr>
                  ) : (
                    liveRuns.map((run, idx) => {
                      const isFirst = idx === 0;
                      return (
                        <tr
                          key={run.id}
                          className={cn(
                            "hover:bg-muted/40 transition-colors",
                            isFirst && "bg-primary/5"
                          )}
                        >
                          <td className="py-3 px-4 text-xs text-foreground">
                            {new Date(run.createdAt).toLocaleTimeString("fr-FR")}
                            <span className="text-muted-foreground ml-1.5 text-[10px]">
                              {new Date(run.createdAt).toLocaleDateString("fr-FR")}
                            </span>
                          </td>

                          <td className="py-3 px-4 font-sans font-medium text-foreground">
                            <Link
                              href={`/admin/tenants/${run.tenantId}`}
                              className="text-primary hover:underline"
                            >
                              {run.tenantName}
                            </Link>
                          </td>

                          <td className="py-3 px-4 text-xs text-muted-foreground font-mono">
                            {run.deviceId.slice(0, 8)}...
                          </td>

                          <td className="py-3 px-4 text-xs">
                            <span
                              className={cn(
                                "font-semibold",
                                run.durationMs > 2000
                                  ? "text-amber-600 dark:text-amber-400"
                                  : run.durationMs > 5000
                                  ? "text-destructive"
                                  : "text-accent"
                              )}
                            >
                              {run.durationMs} ms
                            </span>
                          </td>

                          <td className="py-3 px-4 text-xs text-foreground">
                            <span className="text-primary font-semibold">↑ {run.pushed}</span>
                            <span className="text-muted-foreground mx-1.5">•</span>
                            <span className="text-primary font-semibold">↓ {run.pulled}</span>
                          </td>

                          <td className="py-3 px-4 font-sans">
                            {run.errorCount === 0 ? (
                              <span className="inline-flex items-center gap-1 text-xs text-accent font-medium">
                                <CheckCircle2 className="h-3 w-3" />
                                Succès
                              </span>
                            ) : (
                              <button
                                onClick={() => setSelectedError(run)}
                                className="inline-flex items-center gap-1 text-xs text-destructive font-medium hover:underline cursor-pointer"
                              >
                                <XCircle className="h-3 w-3" />
                                {run.errorCount} erreur(s)
                              </button>
                            )}
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
      )}

      {/* ONGLET 3 : Journal des Erreurs */}
      {activeTab === "errors" && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-between text-sm text-destructive">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-xs">
                Historique des rejets de synchronisation et des exceptions techniques enregistrées.
              </span>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">
              {data.recentErrors.length} incident(s)
            </span>
          </div>

          <div className="space-y-3">
            {data.recentErrors.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-card border border-border text-muted-foreground shadow-xs">
                <CheckCircle2 className="h-8 w-8 text-accent mx-auto mb-2" />
                Aucune erreur de réplication récente. Flotte 100% saine !
              </div>
            ) : (
              data.recentErrors.map((err) => (
                <div
                  key={err.id}
                  className="p-4 rounded-2xl bg-card border border-border hover:border-primary/30 transition space-y-3 shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                        ÉCHEC
                      </span>
                      <span className="font-semibold text-foreground">{err.tenantName}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        (Poste: {err.deviceId.slice(0, 10)}...)
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(err.createdAt).toLocaleString("fr-FR")}
                    </span>
                  </div>

                  {err.errors && err.errors.length > 0 && (
                    <div className="p-3 rounded-xl bg-secondary/50 border border-border text-xs font-mono text-foreground overflow-x-auto">
                      <pre className="text-destructive">{JSON.stringify(err.errors, null, 2)}</pre>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                    <span>
                      Durée du cycle: <strong>{err.durationMs} ms</strong> • OS: {err.os || "Inconnu"} • App: v
                      {err.appVersion || "1.0.0"}
                    </span>
                    <Link
                      href={`/admin/tenants/${err.tenantId}`}
                      className="text-primary hover:underline flex items-center gap-1 font-medium"
                    >
                      Diagnostiquer le Tenant
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal Détails d'Erreur */}
      {selectedError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl rounded-2xl bg-card border border-border shadow-2xl p-6 space-y-4 text-foreground">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                Détail de l&apos;Incident Synchro
              </h3>
              <button
                onClick={() => setSelectedError(null)}
                className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
              >
                Fermer
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-foreground">
                <span className="text-muted-foreground">Entreprise:</span>
                <span className="font-semibold text-foreground">{selectedError.tenantName}</span>
              </div>
              <div className="flex justify-between text-foreground">
                <span className="text-muted-foreground">ID Poste:</span>
                <span className="font-mono text-muted-foreground">{selectedError.deviceId}</span>
              </div>
              <div className="flex justify-between text-foreground">
                <span className="text-muted-foreground">Date & Heure:</span>
                <span>{new Date(selectedError.createdAt).toLocaleString("fr-FR")}</span>
              </div>
              <div className="flex justify-between text-foreground">
                <span className="text-muted-foreground">Durée avant échec:</span>
                <span>{selectedError.durationMs} ms</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Payload JSON d&apos;Erreur :
              </span>
              <div className="p-3 rounded-xl bg-secondary/50 border border-border max-h-60 overflow-y-auto text-xs font-mono text-destructive">
                <pre>{JSON.stringify(selectedError.errors, null, 2)}</pre>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedError(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-secondary/80 hover:bg-secondary text-foreground transition border border-border cursor-pointer"
              >
                Fermer la vue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
