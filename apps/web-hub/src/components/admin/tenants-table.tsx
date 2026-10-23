"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TenantListItem } from "@/lib/kpi/tenant360";
import {
  createTenantAction,
  toggleTenantStatusAction,
} from "@/app/admin/tenants/actions";
import {
  Building2,
  Search,
  Plus,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Download,
  Laptop,
  Users,
  Loader2,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Badge } from "@workspace/ui/components/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Label } from "@workspace/ui/components/label";

export function TenantsTable({ initialTenants }: { initialTenants: TenantListItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modal création de tenant
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Modal suspension/réactivation
  const [tenantToToggle, setTenantToToggle] = useState<TenantListItem | null>(null);
  const [toggleReason, setToggleReason] = useState("");
  const [toggleLoading, setToggleLoading] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  // Filtrage local dynamique
  const filteredTenants = initialTenants.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.country.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ? true : t.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);

    const formData = new FormData(e.currentTarget);
    const res = await createTenantAction(formData);

    if (res.success && res.data) {
      setIsCreateOpen(false);
      router.refresh();
      router.push(`/admin/tenants/${res.data.id}`);
    } else {
      setCreateError(res.error || "Erreur de création");
    }
    setCreateLoading(false);
  };

  const handleToggleStatus = async () => {
    if (!tenantToToggle) return;
    setToggleLoading(true);
    setToggleError(null);

    const newStatus = tenantToToggle.status === "suspended" ? "active" : "suspended";
    const res = await toggleTenantStatusAction({
      tenantId: tenantToToggle.id,
      status: newStatus,
      reason: toggleReason,
    });

    if (res.success) {
      setTenantToToggle(null);
      setToggleReason("");
      router.refresh();
    } else {
      setToggleError(res.error || "Erreur lors du changement de statut");
    }
    setToggleLoading(false);
  };

  const exportCsv = () => {
    const headers = "ID,Nom,Statut,Plan,Pays,Postes,Utilisateurs,Date_Creation\n";
    const rows = filteredTenants
      .map(
        (t) =>
          `"${t.id}","${t.name}","${t.status}","${t.planName}","${t.country}",${t.devicesCount},${t.usersCount},"${t.createdAt}"`
      )
      .join("\n");

    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `tenants-facturier-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Barre de contrôle : Recherche + Filtres + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Filtrer par nom ou pays..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-secondary/50 border-border text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-primary"
            />
          </div>

          <div className="flex items-center gap-1 bg-secondary/50 border border-border p-1 rounded-xl text-xs">
            {["all", "active", "trial", "suspended"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-lg capitalize transition-colors text-xs cursor-pointer ${
                  statusFilter === s
                    ? "bg-card text-foreground font-semibold shadow-xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "all" ? "Tous" : s === "active" ? "Actifs" : s === "trial" ? "Essai" : "Suspendus"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            className="text-xs border-border bg-secondary/50 hover:bg-secondary text-foreground cursor-pointer"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>

          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="text-xs bg-primary hover:bg-primary-hover text-primary-foreground font-medium shadow-xs cursor-pointer"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nouveau Tenant
          </Button>
        </div>
      </div>

      {/* Tableau des entreprises clientes */}
      <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground font-semibold bg-muted/40">
                <th className="py-3 px-4">Entreprise / Raison Sociale</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4">Plan Actuel</th>
                <th className="py-3 px-4">Flotte Desktop</th>
                <th className="py-3 px-4">Utilisateurs</th>
                <th className="py-3 px-4">Date de Création</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredTenants.map((tenant) => (
                <tr
                  key={tenant.id}
                  className="hover:bg-muted/40 transition-colors group"
                >
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-foreground flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary shrink-0" />
                      <Link
                        href={`/admin/tenants/${tenant.id}`}
                        className="hover:text-primary hover:underline transition-colors"
                      >
                        {tenant.name}
                      </Link>
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground pl-6">
                      {tenant.id.slice(0, 8)}... • {tenant.country}
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    {tenant.status === "active" && (
                      <Badge className="bg-accent/10 border-accent/20 text-accent text-[10px]">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Actif
                      </Badge>
                    )}
                    {tenant.status === "trial" && (
                      <Badge className="bg-primary/10 border-primary/20 text-primary text-[10px]">
                        Essai Gratuit
                      </Badge>
                    )}
                    {tenant.status === "suspended" && (
                      <Badge className="bg-destructive/10 border-destructive/20 text-destructive text-[10px]">
                        <XCircle className="h-3 w-3 mr-1" />
                        Suspendu
                      </Badge>
                    )}
                    {tenant.status === "expired" && (
                      <Badge className="bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px]">
                        Expiré
                      </Badge>
                    )}
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="font-medium text-foreground">
                      {tenant.planName}
                    </div>
                    {tenant.priceXaf > 0 && (
                      <div className="text-[11px] font-mono text-muted-foreground">
                        {tenant.priceXaf.toLocaleString("fr-FR")} XAF/mois
                      </div>
                    )}
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5 text-foreground">
                      <Laptop className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{tenant.devicesCount} terminal(s)</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5 text-foreground">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{tenant.usersCount} compte(s)</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 text-muted-foreground">
                    {new Date(tenant.createdAt).toLocaleDateString("fr-FR")}
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setTenantToToggle(tenant);
                          setToggleReason("");
                          setToggleError(null);
                        }}
                        className={`text-[11px] h-7 px-2 cursor-pointer ${
                          tenant.status === "suspended"
                            ? "text-accent hover:text-accent hover:bg-accent/10"
                            : "text-destructive hover:text-destructive hover:bg-destructive/10"
                        }`}
                      >
                        {tenant.status === "suspended" ? "Réactiver" : "Suspendre"}
                      </Button>

                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="text-[11px] h-7 px-2.5 border-border bg-secondary/50 text-foreground hover:bg-secondary cursor-pointer"
                      >
                        <Link href={`/admin/tenants/${tenant.id}`}>
                          Vue 360°
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredTenants.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted-foreground">
                    Aucune entreprise cliente ne correspond aux critères de recherche.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tiroir Latéral (Side Sheet) : Création de Tenant */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent side="right" className="bg-card border-l border-border text-foreground max-w-md sm:max-w-lg lg:max-w-xl p-0 gap-0">
          <form onSubmit={handleCreate} className="flex flex-col h-full">
            <div className="flex items-start justify-between p-6 border-b border-border bg-card shrink-0">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <DialogTitle className="text-lg font-bold text-foreground tracking-tight">
                    Créer une Entreprise Cliente (Tenant)
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    L&apos;entreprise disposera de son espace de réplication dédié. Tout sera isolé par tenant_id.
                  </DialogDescription>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 focus:outline-none">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
                  Raison Sociale / Nom Entreprise *
                </Label>
                <Input
                  id="name"
                  name="name"
                  required
                  placeholder="Ex: Société Générale de Commerce SARL"
                  className="bg-secondary/50 border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-10"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="country" className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
                    Pays d&apos;activité
                  </Label>
                  <Input
                    id="country"
                    name="country"
                    defaultValue="Cameroun"
                    className="bg-secondary/50 border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="planId" className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
                    Formule / Plan
                  </Label>
                  <select
                    id="planId"
                    name="planId"
                    className="w-full h-10 rounded-xl bg-secondary/50 border border-border px-3 text-xs text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Starter (Par défaut)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
                  Notes internes (Confidentiel Super Admin)
                </Label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={4}
                  placeholder="Informations commerciales ou techniques..."
                  className="w-full rounded-xl bg-secondary/50 border border-border p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 leading-relaxed"
                />
              </div>

              {createError && (
                <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-xl">
                  {createError}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border bg-card shrink-0 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary border border-border transition-colors cursor-pointer"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={createLoading}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover text-primary-foreground shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {createLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Création en cours...
                  </>
                ) : (
                  "Valider et Créer"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Tiroir Latéral (Side Sheet) : Suspension / Réactivation */}
      <Dialog
        open={!!tenantToToggle}
        onOpenChange={(open) => !open && setTenantToToggle(null)}
      >
        <DialogContent side="right" className="bg-card border-l border-border text-foreground max-w-md sm:max-w-lg lg:max-w-xl p-0 gap-0">
          <div className="flex flex-col h-full">
            <div className="flex items-start justify-between p-6 border-b border-border bg-card shrink-0">
              <div className="flex items-start gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-xs border ${
                  tenantToToggle?.status === "suspended"
                    ? "bg-primary/10 border-primary/20 text-primary"
                    : "bg-destructive/10 border-destructive/20 text-destructive"
                }`}>
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <DialogTitle className="text-lg font-bold text-foreground tracking-tight">
                    {tenantToToggle?.status === "suspended"
                      ? "Réactiver l'entreprise"
                      : "Confirmer la suspension administrative"}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    {tenantToToggle?.status === "suspended"
                      ? `Régulariser l'accès cloud de ${tenantToToggle?.name}. La réplication Desktop reprendra normalement.`
                      : `Suspendre l'accès cloud de ${tenantToToggle?.name}. Le poste Desktop sera bloqué dès sa prochaine tentative de réplication.`}
                  </DialogDescription>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 focus:outline-none">
              {tenantToToggle?.status !== "suspended" && (
                <div className="space-y-1.5">
                  <Label htmlFor="reason" className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
                    Motif impératif de suspension *
                  </Label>
                  <Input
                    id="reason"
                    value={toggleReason}
                    onChange={(e) => setToggleReason(e.target.value)}
                    placeholder="Ex: Facture d'abonnement échue non régularisée"
                    className="bg-secondary/50 border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-10"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Ce motif sera tracé de façon immuable dans les journaux d&apos;audit Super Admin.
                  </p>
                </div>
              )}

              {toggleError && (
                <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-xl">
                  {toggleError}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border bg-card shrink-0 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setTenantToToggle(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary border border-border transition-colors cursor-pointer"
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={handleToggleStatus}
                disabled={
                  toggleLoading ||
                  (tenantToToggle?.status !== "suspended" && toggleReason.trim().length < 5)
                }
                className={`px-5 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer ${
                  tenantToToggle?.status === "suspended"
                    ? "bg-primary hover:bg-primary-hover text-primary-foreground"
                    : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                }`}
              >
                {toggleLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Mise à jour...
                  </>
                ) : tenantToToggle?.status === "suspended" ? (
                  "Confirmer la Réactivation"
                ) : (
                  "Confirmer la Suspension"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
