"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PlansAndLicencesData, PlanDetail, ExpiringTenantLicense } from "@/lib/kpi/licenceActions";
import { createPlanAction, extendLicenseAction } from "@/lib/kpi/licenceActions";
import { cn } from "@workspace/ui/lib/utils";
import {
  CreditCard,
  Plus,
  RefreshCw,
  Users,
  Laptop,
  Check,
  AlertTriangle,
  Clock,
  CalendarPlus,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/components/admin/toast-context";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@workspace/ui/components/sheet";

interface LicencesManagementViewProps {
  initialData: PlansAndLicencesData;
}

export function LicencesManagementView({ initialData }: LicencesManagementViewProps) {
  const router = useRouter();
  const toast = useToast();
  const [data] = useState(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTenantToExtend, setSelectedTenantToExtend] = useState<ExpiringTenantLicense | null>(null);

  // Formulaire d'extension
  const [extendDays, setExtendDays] = useState(30);
  const [extendReason, setExtendReason] = useState("");
  const [isSubmittingExtend, setIsSubmittingExtend] = useState(false);
  const [extendError, setExtendError] = useState<string | null>(null);

  // Formulaire de création de plan
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  const { summary, plans, expiringLicenses } = data;

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

  const handleExtendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantToExtend) return;

    setIsSubmittingExtend(true);
    setExtendError(null);

    const res = await extendLicenseAction(
      selectedTenantToExtend.tenantId,
      extendDays,
      extendReason
    );

    setIsSubmittingExtend(false);
    if (!res.success) {
      setExtendError(res.error || "Erreur lors de la prolongation");
      toast.error("Échec de la prolongation", res.error);
    } else {
      toast.success(
        "Licence prolongée avec succès",
        `${selectedTenantToExtend.tenantName} bénéficie désormais de ${extendDays} jours supplémentaires.`
      );
      setSelectedTenantToExtend(null);
      setExtendReason("");
      router.refresh();
    }
  };

  const handleCreatePlanSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmittingPlan(true);
    setPlanError(null);

    const formData = new FormData(e.currentTarget);
    const planName = String(formData.get("name") || "Nouveau plan");
    const res = await createPlanAction(formData);

    setIsSubmittingPlan(false);
    if (!res.success) {
      setPlanError(res.error || "Erreur de création de plan");
      toast.error("Erreur de création du plan", res.error);
    } else {
      toast.success(
        "Plan créé avec succès",
        `Le plan "${planName}" a été ajouté au catalogue SaaS.`
      );
      setIsCreateModalOpen(false);
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <CreditCard className="h-6 w-6 text-primary" />
              Catalogue des Plans &amp; Licences SaaS
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              Modèle d&apos;Abonnement
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Plafonds techniques, barèmes tarifaires et prolongation administrative des droits d&apos;usage clients.
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
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Nouveau Plan SaaS
          </button>
        </div>
      </div>

      {/* Cartes Synthétiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Plans au Catalogue</span>
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-foreground">{summary.totalPlans}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Formules tarifaires actives</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-accent/20 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider text-accent">Abonnés Actifs</span>
            <Users className="h-4 w-4 text-accent" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-accent">{summary.activeSubscribers}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Organisations sous contrat</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-amber-500/20 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">Échéance &lt; 30j</span>
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{summary.expiringCount}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Licences à renouveler</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-card border border-primary/20 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider text-primary">MRR Souscrit</span>
            <CreditCard className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-primary">
              {formatXaf(summary.mrrTotalXaf)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Revenu récurrent mensuel</div>
          </div>
        </div>
      </div>

      {/* Grille des Plans d'Abonnement */}
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-foreground">
          Formules d&apos;Abonnement &amp; Plafonds Techniques
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((p) => (
            <div
              key={p.id}
              className="p-5 rounded-2xl bg-card border border-border hover:border-primary/40 transition flex flex-col justify-between space-y-4 shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold uppercase px-2 py-0.5 rounded bg-secondary text-secondary-foreground border border-border">
                    {p.code}
                  </span>
                  <span className="text-xs font-bold text-accent">
                    {p.subscribersCount} abonné(s)
                  </span>
                </div>

                <div className="mt-3">
                  <h4 className="text-lg font-bold text-foreground">{p.name}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5 min-h-[32px]">
                    {p.description || "Aucune description renseignée."}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-foreground">
                    {p.priceXaf === 0 ? "Gratuit" : formatXaf(p.priceXaf)}
                  </span>
                  {p.priceXaf > 0 && (
                    <span className="text-xs text-muted-foreground">/ mois</span>
                  )}
                </div>

                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-foreground">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    <span>Jusqu&apos;à <strong>{p.maxUsers}</strong> utilisateurs</span>
                  </div>
                  <div className="flex items-center gap-2 text-foreground">
                    <Laptop className="h-3.5 w-3.5 text-accent" />
                    <span>Jusqu&apos;à <strong>{p.maxDevices}</strong> postes synchronisés</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-border text-[11px] text-muted-foreground flex justify-between">
                <span>CA Mensuel généré :</span>
                <span className="font-semibold text-foreground">{formatXaf(p.totalRevenueXaf)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Veille des Licences Expirantes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Veille des Échéances de Licences (&le; 30 jours)
          </h3>
          <span className="text-xs text-muted-foreground font-mono">
            {expiringLicenses.length} compte(s) concerné(s)
          </span>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <th className="py-3 px-4">Entreprise</th>
                  <th className="py-3 px-4">Formule</th>
                  <th className="py-3 px-4">Date d&apos;Échéance</th>
                  <th className="py-3 px-4">Temps Restant</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {expiringLicenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-muted-foreground">
                      Toutes les licences sont en cours de validité (aucune expiration sous 30 jours).
                    </td>
                  </tr>
                ) : (
                  expiringLicenses.map((lic) => {
                    const isUrgent = lic.daysRemaining <= 7;
                    const isExpired = lic.daysRemaining <= 0;

                    return (
                      <tr key={lic.tenantId} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <Link
                            href={`/admin/tenants/${lic.tenantId}`}
                            className="font-semibold text-foreground hover:text-primary transition flex items-center gap-1.5"
                          >
                            {lic.tenantName}
                            <ArrowUpRight className="h-3 w-3 opacity-60" />
                          </Link>
                        </td>

                        <td className="py-3.5 px-4 text-xs text-muted-foreground">
                          {lic.planName}
                        </td>

                        <td className="py-3.5 px-4 font-mono text-xs text-foreground">
                          {lic.licenseExpiresAt
                            ? new Date(lic.licenseExpiresAt).toLocaleDateString("fr-FR")
                            : "Non définie"}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={cn(
                              "px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                              isExpired
                                ? "bg-destructive/10 text-destructive border-destructive/30"
                                : isUrgent
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                : "bg-primary/10 text-primary border-primary/20"
                            )}
                          >
                            {isExpired
                              ? "Expirée"
                              : `${lic.daysRemaining} jour(s) restant(s)`}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => setSelectedTenantToExtend(lic)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-primary bg-primary/10 border border-primary/20 hover:bg-primary/20 transition cursor-pointer"
                          >
                            <CalendarPlus className="h-3.5 w-3.5" />
                            Prolonger
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
      </div>

      {/* Tiroir Latéral (Side Sheet) : Prolongation de Licence */}
      <Sheet
        open={Boolean(selectedTenantToExtend)}
        onOpenChange={(open) => {
          if (!open) setSelectedTenantToExtend(null);
        }}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full sm:max-w-lg lg:max-w-xl p-0 gap-0 overflow-hidden"
        >
          {selectedTenantToExtend && (
            <form onSubmit={handleExtendSubmit} className="flex flex-col h-full">
              <div className="flex items-start justify-between p-6 border-b border-border bg-card shrink-0">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <CalendarPlus className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <SheetTitle className="text-lg font-bold text-foreground tracking-tight">
                      Prolonger la Licence Tenant
                    </SheetTitle>
                    <SheetDescription className="text-xs text-muted-foreground">
                      Attribuer des jours de validité supplémentaires pour cette organisation.
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
                {extendError && (
                  <div className="p-3 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 text-xs">
                    {extendError}
                  </div>
                )}

                <div className="p-3.5 rounded-xl bg-secondary/50 border border-border space-y-1 text-xs">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Entreprise bénéficiaire
                  </span>
                  <div className="text-sm font-bold text-foreground">
                    {selectedTenantToExtend.tenantName}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    ID : {selectedTenantToExtend.tenantId}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
                    Période de prolongation (Jours) :
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[15, 30, 90, 365].map((d) => (
                      <button
                        type="button"
                        key={d}
                        onClick={() => setExtendDays(d)}
                        className={cn(
                          "py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer",
                          extendDays === d
                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                            : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                        )}
                      >
                        +{d} jours
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
                    Motif administratif obligatoire (Audit) :
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Ex: Renouvellement annuel validé avec la direction financière..."
                    value={extendReason}
                    onChange={(e) => setExtendReason(e.target.value)}
                    className="w-full p-3 bg-secondary/50 border border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 leading-relaxed"
                  />
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
                  disabled={isSubmittingExtend}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingExtend ? "Prolongation..." : "Confirmer Prolongation"}
                </button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>

      {/* Tiroir Latéral (Side Sheet) : Création de Nouveau Plan */}
      <Sheet open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full sm:max-w-lg lg:max-w-xl p-0 gap-0 overflow-hidden"
        >
          <form onSubmit={handleCreatePlanSubmit} className="flex flex-col h-full">
            <div className="flex items-start justify-between p-6 border-b border-border bg-card shrink-0">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <Plus className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <SheetTitle className="text-lg font-bold text-foreground tracking-tight">
                    Créer un Nouveau Plan SaaS
                  </SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground">
                    Définissez la tarification, les quotas et la périodicité de facturation.
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
              {planError && (
                <div className="p-3 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 text-xs">
                  {planError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
                  Code Unique Identifiant *
                </label>
                <input
                  required
                  type="text"
                  name="code"
                  placeholder="ex: enterprise_plus"
                  className="w-full h-10 px-3.5 bg-secondary/50 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
                  Nom Commercial du Plan *
                </label>
                <input
                  required
                  type="text"
                  name="name"
                  placeholder="ex: Plan Scale PME"
                  className="w-full h-10 px-3.5 bg-secondary/50 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
                    Tarif Mensuel (XAF) *
                  </label>
                  <input
                    required
                    type="number"
                    name="priceXaf"
                    defaultValue={50000}
                    step={1000}
                    className="w-full h-10 px-3.5 bg-secondary/50 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
                    Facturation *
                  </label>
                  <select
                    name="billingPeriod"
                    className="w-full h-10 px-3 bg-secondary/50 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="monthly">Mensuelle</option>
                    <option value="annual">Annuelle</option>
                    <option value="lifetime">À Vie</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
                    Max Utilisateurs
                  </label>
                  <input
                    type="number"
                    name="maxUsers"
                    defaultValue={15}
                    className="w-full h-10 px-3.5 bg-secondary/50 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
                    Max Postes Desktop
                  </label>
                  <input
                    type="number"
                    name="maxDevices"
                    defaultValue={8}
                    className="w-full h-10 px-3.5 bg-secondary/50 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
                  Description du Plan
                </label>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Description sommaire du public cible et fonctionnalités incluses..."
                  className="w-full p-3 bg-secondary/50 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 leading-relaxed"
                />
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
                disabled={isSubmittingPlan}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingPlan ? "Création..." : "Enregistrer le Plan"}
              </button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
