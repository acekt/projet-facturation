"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  AnnouncementsAndAlertsData,
  AnnouncementItem,
  AlertItem,
} from "@/lib/kpi/announcementActions";
import {
  createAnnouncementAction,
  toggleAnnouncementAction,
  resolveAlertAction,
} from "@/lib/kpi/announcementActions";
import { cn } from "@workspace/ui/lib/utils";
import {
  Radio,
  BellRing,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Building2,
  ExternalLink,
  ShieldAlert,
  Send,
  ToggleLeft,
  ToggleRight,
  Filter,
  Check,
} from "lucide-react";
import { useToast } from "@/components/admin/toast-context";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@workspace/ui/components/sheet";

interface AnnouncementsAlertsViewProps {
  initialData: AnnouncementsAndAlertsData;
}

export function AnnouncementsAlertsView({ initialData }: AnnouncementsAlertsViewProps) {
  const router = useRouter();
  const toast = useToast();
  const [data] = useState(initialData);
  const [activeTab, setActiveTab] = useState<"alerts" | "announcements">("alerts");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filtrage des alertes
  const [severityFilter, setSeverityFilter] = useState<"all" | "critical" | "warning" | "info">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "acknowledged" | "resolved">("all");

  // Modal création annonce
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmittingAnnouncement, setIsSubmittingAnnouncement] = useState(false);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);

  // Actions de résolution d'alerte en cours
  const [pendingAlertId, setPendingAlertId] = useState<string | null>(null);
  // Action de toggle annonce en cours
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);

  const { summary, announcements, alerts, tenants } = data;

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleResolveAlert = async (alertId: string, newStatus: "acknowledged" | "resolved") => {
    setPendingAlertId(alertId);
    try {
      const res = await resolveAlertAction(alertId, newStatus);
      if (res.success) {
        toast.success(
          newStatus === "resolved" ? "Alerte clôturée" : "Alerte prise en compte",
          "L'état de l'alerte a été mis à jour et consigné dans l'audit."
        );
        router.refresh();
      } else {
        toast.error("Erreur de mise à jour", res.error);
      }
    } finally {
      setPendingAlertId(null);
    }
  };

  const handleToggleAnnouncement = async (id: string, currentStatus: boolean) => {
    setPendingToggleId(id);
    try {
      const res = await toggleAnnouncementAction(id, !currentStatus);
      if (res.success) {
        toast.info(
          "Statut de l'annonce mis à jour",
          `L'annonce est désormais ${!currentStatus ? "active" : "suspendue"}.`
        );
        router.refresh();
      } else {
        toast.error("Erreur de modification", res.error);
      }
    } finally {
      setPendingToggleId(null);
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmittingAnnouncement(true);
    setAnnouncementError(null);

    const formData = new FormData(e.currentTarget);
    const title = String(formData.get("title") || "");
    const res = await createAnnouncementAction(formData);

    setIsSubmittingAnnouncement(false);
    if (!res.success) {
      setAnnouncementError(res.error || "Erreur lors de la diffusion de l'annonce");
      toast.error("Échec de la diffusion", res.error);
    } else {
      toast.success(
        "Annonce diffusée en temps réel",
        `L'annonce "${title}" est maintenant active sur les postes ciblés.`
      );
      setIsCreateModalOpen(false);
      router.refresh();
    }
  };

  // Filtrage effectif des alertes
  const filteredAlerts = alerts.filter((a) => {
    if (severityFilter !== "all" && a.severity !== severityFilter) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    return true;
  });

  const getSeverityBadge = (sev: AlertItem["severity"]) => {
    switch (sev) {
      case "critical":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/10 text-destructive border border-destructive/30">
            <AlertCircle className="h-3 w-3 text-destructive" />
            CRITIQUE
          </span>
        );
      case "warning":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            ATTENTION
          </span>
        );
      case "info":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/30">
            <Info className="h-3 w-3 text-primary" />
            INFO
          </span>
        );
    }
  };

  const getStatusBadge = (status: AlertItem["status"]) => {
    switch (status) {
      case "open":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-destructive/10 text-destructive border border-destructive/20">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
            Ouverte
          </span>
        );
      case "acknowledged":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="h-2.5 w-2.5 text-amber-500" />
            Prise en compte
          </span>
        );
      case "resolved":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent/10 text-accent border border-accent/20">
            <CheckCircle2 className="h-2.5 w-2.5 text-accent" />
            Résolue
          </span>
        );
    }
  };

  const getLevelBadge = (lvl: AnnouncementItem["level"]) => {
    switch (lvl) {
      case "critical":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-destructive/10 text-destructive border border-destructive/30">
            Critique
          </span>
        );
      case "maintenance":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-secondary text-secondary-foreground border border-border">
            Maintenance
          </span>
        );
      case "warning":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            Avertissement
          </span>
        );
      case "info":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-primary/10 text-primary border border-primary/30">
            Information
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête de section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Radio className="h-5 w-5 animate-pulse text-primary" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
              Annonces Globales &amp; Centre d&apos;Alertes
            </h1>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground max-w-2xl">
            Diffusion de notifications descendantes vers les terminaux Desktop locaux et traitement proactif des alertes système de supervision.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-secondary border border-border hover:bg-secondary/80 text-foreground transition-colors cursor-pointer"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin text-primary")} />
            Rafraîchir
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Diffuser une Annonce
          </button>
        </div>
      </div>

      {/* Cartes KPI Synthétiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Annonces Actives */}
        <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Annonces Actives</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {summary.activeAnnouncements}
            </p>
            <p className="text-[10px] text-primary mt-1 font-medium">Diffusées en temps réel</p>
          </div>
          <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-primary">
            <Radio className="h-5 w-5" />
          </div>
        </div>

        {/* Alertes Ouvertes */}
        <div className="p-4 rounded-xl bg-card border border-amber-500/20 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Alertes Ouvertes</p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {summary.openAlerts}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">En attente de traitement</p>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500">
            <BellRing className="h-5 w-5" />
          </div>
        </div>

        {/* Alertes Critiques */}
        <div className="p-4 rounded-xl bg-card border border-destructive/20 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Alertes Critiques</p>
            <p className="text-2xl font-bold text-destructive mt-1">
              {summary.criticalAlerts}
            </p>
            <p className="text-[10px] text-destructive/80 mt-1">Action immédiate requise</p>
          </div>
          <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
            <AlertCircle className="h-5 w-5" />
          </div>
        </div>

        {/* Total Traitées */}
        <div className="p-4 rounded-xl bg-card border border-border flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Alertes Enregistrées</p>
            <p className="text-2xl font-bold text-foreground mt-1">
              {summary.totalAlerts}
            </p>
            <p className="text-[10px] text-accent mt-1 font-medium">Historique de supervision</p>
          </div>
          <div className="p-2.5 rounded-lg bg-secondary border border-border text-foreground">
            <ShieldAlert className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Onglets de navigation entre Alertes et Annonces */}
      <div className="flex border-b border-border gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab("alerts")}
          className={cn(
            "pb-3 flex items-center gap-2 border-b-2 transition-colors relative cursor-pointer",
            activeTab === "alerts"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <BellRing className="h-4 w-4" />
          <span>Flux des Alertes Système</span>
          {summary.openAlerts > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-semibold">
              {summary.openAlerts}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("announcements")}
          className={cn(
            "pb-3 flex items-center gap-2 border-b-2 transition-colors relative cursor-pointer",
            activeTab === "announcements"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Radio className="h-4 w-4" />
          <span>Annonces Broadcast Desktop</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-secondary text-secondary-foreground border border-border font-semibold">
            {announcements.length}
          </span>
        </button>
      </div>

      {/* VUE 1 : FLUX DES ALERTES SYSTÈME */}
      {activeTab === "alerts" && (
        <div className="space-y-4">
          {/* Barre de filtres pour alertes */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border text-xs shadow-sm">
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground font-medium">Sévérité :</span>
              <div className="flex items-center gap-1">
                {(["all", "critical", "warning", "info"] as const).map((sev) => (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] capitalize transition-colors cursor-pointer",
                      severityFilter === sev
                        ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                        : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    {sev === "all" ? "Toutes" : sev}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-medium">Statut :</span>
              <div className="flex items-center gap-1">
                {(["all", "open", "acknowledged", "resolved"] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] capitalize transition-colors cursor-pointer",
                      statusFilter === st
                        ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                        : "bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    {st === "all"
                      ? "Tous"
                      : st === "open"
                      ? "Ouverte"
                      : st === "acknowledged"
                      ? "Prise en compte"
                      : "Résolue"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Liste des alertes */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            {filteredAlerts.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-accent" />
                <p className="text-sm font-medium text-foreground">Aucune alerte correspondante</p>
                <p className="text-xs text-muted-foreground mt-1">Tous les indicateurs système et métriques de synchronisation sont nominaux.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredAlerts.map((alt) => (
                  <div
                    key={alt.id}
                    className="p-4 hover:bg-muted/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {getSeverityBadge(alt.severity)}
                        {getStatusBadge(alt.status)}
                        <h4 className="text-sm font-semibold text-foreground truncate">
                          {alt.title}
                        </h4>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {alt.message}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground/70" />
                          {new Date(alt.createdAt).toLocaleString("fr-FR")}
                        </span>

                        {alt.tenantName && (
                          <span className="flex items-center gap-1 text-foreground font-medium">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            {alt.tenantId ? (
                              <Link
                                href={`/admin/tenants/${alt.tenantId}`}
                                className="text-primary hover:underline flex items-center gap-0.5"
                              >
                                {alt.tenantName}
                                <ExternalLink className="h-2.5 w-2.5" />
                              </Link>
                            ) : (
                              alt.tenantName
                            )}
                          </span>
                        )}

                        {alt.ruleName && (
                          <span className="text-muted-foreground font-mono text-[10px]">
                            Règle : {alt.ruleName}
                          </span>
                        )}

                        {alt.resolvedAt && (
                          <span className="text-accent text-[10px] font-medium">
                            Clôturée le {new Date(alt.resolvedAt).toLocaleString("fr-FR")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions de prise en charge et clôture */}
                    <div className="flex items-center gap-2 shrink-0">
                      {alt.status === "open" && (
                        <button
                          onClick={() => handleResolveAlert(alt.id, "acknowledged")}
                          disabled={pendingAlertId === alt.id}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary hover:bg-secondary/80 text-foreground border border-border transition-colors cursor-pointer"
                        >
                          {pendingAlertId === alt.id ? "Traitement..." : "Prendre en compte"}
                        </button>
                      )}

                      {alt.status !== "resolved" && (
                        <button
                          onClick={() => handleResolveAlert(alt.id, "resolved")}
                          disabled={pendingAlertId === alt.id}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm transition-colors cursor-pointer"
                        >
                          {pendingAlertId === alt.id ? "Traitement..." : "Clôturer l'alerte"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VUE 2 : ANNONCES BROADCAST */}
      {activeTab === "announcements" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground font-medium border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Annonce &amp; Contenu</th>
                    <th className="py-3 px-4">Niveau</th>
                    <th className="py-3 px-4">Cible</th>
                    <th className="py-3 px-4">Période de Validité</th>
                    <th className="py-3 px-4">Statut</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {announcements.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        Aucune annonce diffusée actuellement.
                      </td>
                    </tr>
                  ) : (
                    announcements.map((a) => (
                      <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 max-w-sm">
                          <p className="font-semibold text-foreground">{a.title}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                            {a.body}
                          </p>
                        </td>

                        <td className="py-3 px-4">
                          {getLevelBadge(a.level)}
                        </td>

                        <td className="py-3 px-4">
                          <span className={cn(
                            "inline-flex items-center gap-1 font-medium",
                            a.targetTenantId ? "text-primary" : "text-accent"
                          )}>
                            <Building2 className="h-3 w-3" />
                            {a.targetTenantName}
                          </span>
                        </td>

                        <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                          <div>Du : {new Date(a.startsAt).toLocaleDateString("fr-FR")}</div>
                          <div>
                            {a.endsAt
                              ? `Au : ${new Date(a.endsAt).toLocaleDateString("fr-FR")}`
                              : "Sans expiration"}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border",
                              a.isActive
                                ? "bg-accent/10 text-accent border-accent/20"
                                : "bg-secondary text-muted-foreground border-border"
                            )}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                a.isActive ? "bg-accent animate-pulse" : "bg-muted-foreground/60"
                              )}
                            />
                            {a.isActive ? "Active (En ligne)" : "Désactivée"}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleToggleAnnouncement(a.id, a.isActive)}
                            disabled={pendingToggleId === a.id}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer",
                              a.isActive
                                ? "bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20"
                                : "bg-accent/10 text-accent border-accent/20 hover:bg-accent/20"
                            )}
                          >
                            {a.isActive ? (
                              <>
                                <ToggleRight className="h-4 w-4" />
                                Suspendre
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="h-4 w-4" />
                                Activer
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tiroir Latéral (Side Sheet) : Nouvelle Annonce Broadcast */}
      <Sheet open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full sm:max-w-lg lg:max-w-xl p-0 gap-0 overflow-hidden"
        >
          <form onSubmit={handleCreateAnnouncement} className="flex flex-col h-full">
            <div className="flex items-start justify-between p-6 border-b border-border bg-card shrink-0">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <Send className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <SheetTitle className="text-lg font-bold text-foreground tracking-tight">
                    Diffuser une Annonce Broadcast
                  </SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground">
                    Notification prioritaire affichée sur les terminaux Desktop locaux connectés.
                  </SheetDescription>
                </div>
              </div>
              <SheetClose asChild>
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer"
                  aria-label="Fermer"
                >
                  ✕
                </button>
              </SheetClose>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 focus:outline-none">
              {announcementError && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                  {announcementError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
                  Titre de l&apos;annonce *
                </label>
                <input
                  type="text"
                  name="title"
                  placeholder="Ex : Maintenance planifiée du Hub Cloud ce samedi"
                  required
                  className="w-full h-10 px-3.5 bg-secondary/50 border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
                  Contenu détaillé du message *
                </label>
                <textarea
                  name="body"
                  rows={4}
                  placeholder="Ex : Une mise à jour de sécurité sera déployée entre 22h et 23h UTC. Vos terminaux locaux continueront de fonctionner en mode hors-ligne."
                  required
                  className="w-full p-3 bg-secondary/50 border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
                    Niveau d&apos;importance *
                  </label>
                  <select
                    name="level"
                    defaultValue="info"
                    className="w-full h-10 px-3 bg-secondary/50 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="info">Information (Générale)</option>
                    <option value="warning">Avertissement (Important)</option>
                    <option value="maintenance">Maintenance Planifiée</option>
                    <option value="critical">Critique / Sécurité</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
                    Date de fin (Optionnel)
                  </label>
                  <input
                    type="date"
                    name="endsAt"
                    className="w-full h-10 px-3 bg-secondary/50 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
                  Cible de diffusion
                </label>
                <select
                  name="targetTenantId"
                  defaultValue=""
                  className="w-full h-10 px-3 bg-secondary/50 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Tous les tenants (Diffusion globale)</option>
                  {tenants?.map((t) => (
                    <option key={t.id} value={t.id}>
                      Entreprise : {t.name}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Laissez sur &quot;Tous les tenants&quot; pour toucher l&apos;ensemble du parc Desktop connecté.
                </p>
              </div>
            </div>

            <div className="p-4 border-t border-border bg-card shrink-0 flex items-center justify-end gap-3">
              <SheetClose asChild>
                <button
                  type="button"
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary border border-border transition-colors cursor-pointer"
                >
                  Annuler
                </button>
              </SheetClose>
              <button
                type="submit"
                disabled={isSubmittingAnnouncement}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover text-primary-foreground shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                {isSubmittingAnnouncement ? "Diffusion en cours..." : "Diffuser immédiatement"}
              </button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
