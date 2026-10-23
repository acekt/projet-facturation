"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SecurityAuditOverviewData, HubAuditItem } from "@/lib/kpi/securityQueries";
import { cn } from "@workspace/ui/lib/utils";
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  KeyRound,
  FileCode,
  UserX,
  CreditCard,
  Bell,
  ArrowUpRight,
  Lock,
} from "lucide-react";

interface SecurityAuditViewProps {
  initialData: SecurityAuditOverviewData;
}

export function SecurityAuditView({ initialData }: SecurityAuditViewProps) {
  const router = useRouter();
  const [data] = useState(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [selectedLog, setSelectedLog] = useState<HubAuditItem | null>(null);

  const { summary, logs } = data;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  // Export CSV conforme audit
  const handleExportCsv = () => {
    const headers = [
      "ID Log",
      "Horodatage UTC",
      "Administrateur (Email)",
      "Action",
      "Type Cible",
      "ID Cible",
      "ID Tenant",
      "Entreprise",
      "Motif",
      "Adresse IP",
      "User-Agent",
    ];

    const rows = filteredLogs.map((l) => [
      `"${l.id}"`,
      `"${l.createdAt}"`,
      `"${l.actorEmail}"`,
      `"${l.action}"`,
      `"${l.targetType}"`,
      `"${l.targetId || ""}"`,
      `"${l.tenantId || ""}"`,
      `"${(l.tenantName || "").replace(/"/g, '""')}"`,
      `"${(l.reason || "").replace(/"/g, '""')}"`,
      `"${l.ipAddress || ""}"`,
      `"${(l.userAgent || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `journal-audit-securite-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (actionFilter === "break_glass" && !log.action.includes("BREAK_GLASS")) return false;
      if (actionFilter === "suspend" && !log.action.includes("SUSPEND")) return false;
      if (actionFilter === "licence" && !log.action.includes("PLAN") && !log.action.includes("LICENSE")) return false;
      if (actionFilter === "announcement" && !log.action.includes("ANNOUNCEMENT")) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        log.actorEmail.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        (log.reason && log.reason.toLowerCase().includes(q)) ||
        (log.tenantName && log.tenantName.toLowerCase().includes(q)) ||
        (log.targetId && log.targetId.toLowerCase().includes(q))
      );
    });
  }, [logs, actionFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* En-tête Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <ShieldAlert className="h-6 w-6 text-destructive" />
              Piste d&apos;Audit &amp; Sécurité Immuable
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">
              Append-Only (Non-Répudiation)
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Journal infalsifiable des accès de bris de glace, suspensions, modifications d&apos;abonnements et actions Super Admin.
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
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-destructive text-destructive-foreground hover:bg-destructive/90 transition shadow-sm cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            Exporter Registre CSV
          </button>
        </div>
      </div>

      {/* Cartes KPI Synthétiques Sécurité */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Logs */}
        <div className="p-4 rounded-xl bg-card border border-border flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Total Événements</span>
            <Lock className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-foreground">{summary.totalLogs}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Entrées immuables enregistrées</div>
          </div>
        </div>

        {/* Accès Bris de Glace */}
        <div className="p-4 rounded-xl bg-card border border-destructive/30 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider text-destructive">Bris de Glace</span>
            <KeyRound className="h-4 w-4 text-destructive" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-destructive">{summary.breakGlassCount}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Accès d&apos;urgence à des tenants</div>
          </div>
        </div>

        {/* Suspensions Administratives */}
        <div className="p-4 rounded-xl bg-card border border-amber-500/30 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">Suspensions</span>
            <UserX className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{summary.suspensionsCount}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Gels de service effectués</div>
          </div>
        </div>

        {/* Modifications Licences */}
        <div className="p-4 rounded-xl bg-card border border-primary/20 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider text-primary">Plans &amp; Licences</span>
            <CreditCard className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-primary">
              {summary.planUpdatesCount + summary.licenseExtensionsCount}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Modifications tarifaires ou durées</div>
          </div>
        </div>

        {/* Administrateurs Acteurs */}
        <div className="p-4 rounded-xl bg-card border border-accent/30 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider text-accent">Superadmins</span>
            <ShieldCheck className="h-4 w-4 text-accent" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-accent">{summary.uniqueActorsCount}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Comptes avec actions enregistrées</div>
          </div>
        </div>
      </div>

      {/* Barre de Recherche & Filtres */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher par admin, action, motif, entreprise..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-secondary/50 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActionFilter("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer",
              actionFilter === "all"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground bg-secondary/60 hover:bg-secondary"
            )}
          >
            Tous ({logs.length})
          </button>
          <button
            onClick={() => setActionFilter("break_glass")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer",
              actionFilter === "break_glass"
                ? "bg-destructive text-destructive-foreground shadow-sm"
                : "text-destructive bg-destructive/10 hover:bg-destructive/20 border border-destructive/20"
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Bris de Glace ({summary.breakGlassCount})
          </button>
          <button
            onClick={() => setActionFilter("suspend")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer",
              actionFilter === "suspend"
                ? "bg-amber-600 text-white shadow-sm"
                : "text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20"
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Suspensions ({summary.suspensionsCount})
          </button>
          <button
            onClick={() => setActionFilter("licence")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer",
              actionFilter === "licence"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground bg-secondary/60 hover:bg-secondary"
            )}
          >
            Plans &amp; Licences
          </button>
          <button
            onClick={() => setActionFilter("announcement")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer",
              actionFilter === "announcement"
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground bg-secondary/60 hover:bg-secondary"
            )}
          >
            Annonces
          </button>
        </div>
      </div>

      {/* Tableau du Registre d'Audit */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="py-3 px-4">Date &amp; Heure (UTC)</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Administrateur</th>
                <th className="py-3 px-4">Cible / Tenant</th>
                <th className="py-3 px-4">Motif Justificatif</th>
                <th className="py-3 px-4 text-right">Détails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    Aucune entrée d&apos;audit ne correspond aux critères sélectionnés.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isBreakGlass = log.action.includes("BREAK_GLASS");
                  const isSuspend = log.action.includes("SUSPEND");

                  return (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString("fr-FR")}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-xs font-mono font-semibold border",
                            isBreakGlass
                              ? "bg-destructive/10 text-destructive border-destructive/30"
                              : isSuspend
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                              : "bg-secondary text-secondary-foreground border-border"
                          )}
                        >
                          {log.action}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-xs font-medium text-foreground">
                        {log.actorEmail}
                      </td>

                      <td className="py-3 px-4">
                        {log.tenantId ? (
                          <Link
                            href={`/admin/tenants/${log.tenantId}`}
                            className="text-primary hover:underline flex items-center gap-1 text-xs font-medium"
                          >
                            {log.tenantName || log.tenantId.slice(0, 8)}
                            <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground font-mono">
                            {log.targetType}: {log.targetId ? log.targetId.slice(0, 10) : "Global"}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-xs text-muted-foreground max-w-xs truncate">
                        {log.reason || "—"}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-foreground bg-secondary hover:bg-secondary/80 border border-border transition cursor-pointer"
                        >
                          <Eye className="h-3 w-3" />
                          Payload
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal d'Inspection du Payload JSON */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-xl rounded-2xl bg-card border border-border shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <FileCode className="h-5 w-5 text-primary" />
                Détail de l&apos;Événement d&apos;Audit
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-muted-foreground hover:text-foreground text-sm cursor-pointer"
              >
                Fermer
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span className="text-muted-foreground">ID Événement :</span>
                <span className="font-mono text-foreground">{selectedLog.id}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span className="text-muted-foreground">Action :</span>
                <span className="font-mono font-semibold text-destructive">{selectedLog.action}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span className="text-muted-foreground">Administrateur :</span>
                <span className="text-foreground">{selectedLog.actorEmail}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span className="text-muted-foreground">Adresse IP :</span>
                <span className="font-mono text-foreground">{selectedLog.ipAddress || "Non capturée"}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span className="text-muted-foreground">User-Agent :</span>
                <span className="truncate max-w-xs text-foreground">{selectedLog.userAgent || "Non capturé"}</span>
              </div>
              {selectedLog.reason && (
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border text-foreground">
                  <span className="text-muted-foreground block mb-0.5">Motif renseigné :</span>
                  {selectedLog.reason}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase text-muted-foreground">
                Métadonnées Contexte (JSON) :
              </span>
              <div className="p-3 rounded-xl bg-secondary/50 border border-border max-h-60 overflow-y-auto text-xs font-mono text-foreground">
                <pre>{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
