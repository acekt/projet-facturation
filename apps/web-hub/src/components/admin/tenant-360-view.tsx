"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tenant360Data } from "@/lib/kpi/tenant360";
import {
  toggleTenantStatusAction,
  updateTenantNotesAction,
  breakGlassAccessAction,
} from "@/app/admin/tenants/actions";
import {
  Building2,
  ArrowLeft,
  Laptop,
  Users,
  ShieldCheck,
  ShieldAlert,
  Clock,
  KeyRound,
  DollarSign,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Save,
  Loader2,
  Calendar,
} from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Badge } from "@workspace/ui/components/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Label } from "@workspace/ui/components/label";
import { Input } from "@workspace/ui/components/input";

export function Tenant360View({ data }: { data: Tenant360Data }) {
  const router = useRouter();
  const { tenant, plan, users, devices, recentSyncRuns, finance, auditLogs } = data;

  const [activeTab, setActiveTab] = useState("overview");

  // Notes internes
  const [notes, setNotes] = useState(tenant.notes || "");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesMessage, setNotesMessage] = useState<string | null>(null);

  // Modal Bris de Glace
  const [isBreakGlassOpen, setIsBreakGlassOpen] = useState(false);
  const [breakGlassReason, setBreakGlassReason] = useState("");
  const [breakGlassLoading, setBreakGlassLoading] = useState(false);
  const [breakGlassError, setBreakGlassError] = useState<string | null>(null);
  const [breakGlassActiveUntil, setBreakGlassActiveUntil] = useState<string | null>(null);

  // Modal Suspension / Activation
  const [isToggleOpen, setIsToggleOpen] = useState(false);
  const [toggleReason, setToggleReason] = useState("");
  const [toggleLoading, setToggleLoading] = useState(false);

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    setNotesMessage(null);
    const res = await updateTenantNotesAction({ tenantId: tenant.id, notes });
    if (res.success) {
      setNotesMessage("Notes enregistrées avec succès.");
      setTimeout(() => setNotesMessage(null), 3000);
    }
    setIsSavingNotes(false);
  };

  const handleBreakGlass = async (e: React.FormEvent) => {
    e.preventDefault();
    setBreakGlassLoading(true);
    setBreakGlassError(null);

    const res = await breakGlassAccessAction({
      tenantId: tenant.id,
      reason: breakGlassReason,
    });

    if (res.success && res.data) {
      setBreakGlassActiveUntil(res.data.authorizedUntil);
      setIsBreakGlassOpen(false);
      router.refresh();
    } else {
      setBreakGlassError(res.error || "Échec de l'autorisation de bris de glace");
    }
    setBreakGlassLoading(false);
  };

  const handleToggleStatus = async () => {
    setToggleLoading(true);
    const nextStatus = tenant.status === "suspended" ? "active" : "suspended";
    const res = await toggleTenantStatusAction({
      tenantId: tenant.id,
      status: nextStatus,
      reason: toggleReason,
    });
    if (res.success) {
      setIsToggleOpen(false);
      router.refresh();
    }
    setToggleLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Barre de retour et En-tête de fiche harmonisé */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-xs">
        <div className="space-y-1">
          <Link
            href="/admin/tenants"
            className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Retour à la liste des tenants
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              <Building2 className="h-7 w-7 text-primary" />
              {tenant.name}
            </h1>

            {tenant.status === "active" && (
              <Badge className="bg-primary/10 border-primary/20 text-primary text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Compte Actif
              </Badge>
            )}
            {tenant.status === "suspended" && (
              <Badge className="bg-destructive/10 border-destructive/20 text-destructive text-xs">
                <XCircle className="h-3.5 w-3.5 mr-1" />
                Compte Suspendu
              </Badge>
            )}
            {tenant.status === "trial" && (
              <Badge className="bg-primary/10 border-primary/20 text-primary text-xs">
                Essai Évaluation
              </Badge>
            )}

            <Badge variant="outline" className="border-primary/20 text-primary bg-primary/5 font-mono text-xs">
              Plan : {plan?.name || "Starter"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            Tenant ID : {tenant.id} • {tenant.country}
          </p>
        </div>

        {/* Boutons d'actions stratégiques */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setIsToggleOpen(true);
              setToggleReason("");
            }}
            className={`text-xs border cursor-pointer ${
              tenant.status === "suspended"
                ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                : "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
            }`}
          >
            {tenant.status === "suspended" ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                Réactiver le Tenant
              </>
            ) : (
              <>
                <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
                Suspendre le Tenant
              </>
            )}
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setIsBreakGlassOpen(true);
              setBreakGlassReason("");
              setBreakGlassError(null);
            }}
            className="text-xs bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-xs cursor-pointer"
          >
            <KeyRound className="h-3.5 w-3.5 mr-1.5" />
            Bris de Glace (D9)
          </Button>
        </div>
      </div>

      {/* Bannière de Suspension si le tenant est bloqué */}
      {tenant.status === "suspended" && (
        <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-4 flex items-start gap-3 text-destructive text-xs shadow-xs">
          <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-destructive">
              Synchronisation Desktop bloquée administrativement
            </span>
            <p className="text-destructive/80 text-xs">
              Motif de suspension : &laquo; {tenant.suspendedReason || "Non précisé"} &raquo;
              {tenant.suspendedAt && ` (le ${new Date(tenant.suspendedAt).toLocaleString("fr-FR")})`}.
              Toute tentative de réplication locale est immédiatement rejetée à la source.
            </p>
          </div>
        </div>
      )}

      {/* Bannière d'accès Bris de Glace actif */}
      {breakGlassActiveUntil && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 flex items-center justify-between text-xs text-amber-600 dark:text-amber-400">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 animate-pulse" />
            <span>
              Mode <strong>Bris de Glace Actif</strong> : Accès de support autorisé en lecture seule jusqu&apos;à{" "}
              {new Date(breakGlassActiveUntil).toLocaleTimeString("fr-FR")}.
            </span>
          </div>
          <span className="font-mono text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            TRACÉ DANS hub_audit_logs
          </span>
        </div>
      )}

      {/* Navigation par Onglets de la Vue 360° */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-secondary/50 border border-border p-1 rounded-xl">
          <TabsTrigger value="overview" className="text-xs data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs text-muted-foreground hover:text-foreground">
            Vue d&apos;ensemble
          </TabsTrigger>
          <TabsTrigger value="users" className="text-xs data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs text-muted-foreground hover:text-foreground">
            Utilisateurs ({users.length})
          </TabsTrigger>
          <TabsTrigger value="fleet" className="text-xs data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs text-muted-foreground hover:text-foreground">
            Flotte & Synchro ({devices.length})
          </TabsTrigger>
          <TabsTrigger value="finance" className="text-xs data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs text-muted-foreground hover:text-foreground">
            Finance & Volumes
          </TabsTrigger>
          <TabsTrigger value="audit" className="text-xs data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs text-muted-foreground hover:text-foreground">
            Audit Trail ({auditLogs.length})
          </TabsTrigger>
        </TabsList>

        {/* 1. Onglet Vue d'ensemble */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-card border-border md:col-span-2 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-foreground">Identité & Paramètres SaaS</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Caractéristiques contractuelles et limites de l&apos;organisation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Raison sociale :</span>
                    <div className="font-medium text-foreground">{tenant.name}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Pays d&apos;implantation :</span>
                    <div className="font-medium text-foreground">{tenant.country}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Formule souscrite :</span>
                    <div className="font-medium text-primary font-mono">
                      {plan?.name} ({plan?.priceXaf.toLocaleString("fr-FR")} XAF/{plan?.billingPeriod === "monthly" ? "mois" : "an"})
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Quotas autorisés :</span>
                    <div className="font-medium text-foreground">
                      {plan?.maxUsers} utilisateurs max • {plan?.maxDevices} postes max
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Création du compte :</span>
                    <div className="font-medium text-foreground">
                      {new Date(tenant.createdAt).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Échéance de licence :</span>
                    <div className="font-medium text-foreground">
                      {tenant.licenseExpiresAt
                        ? new Date(tenant.licenseExpiresAt).toLocaleDateString("fr-FR")
                        : "Sans échéance (illimitée)"}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes internes confidentielles */}
            <Card className="bg-card border-border shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-foreground">Notes Internes</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Historique commercial ou consigne technique (Superadmin)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <textarea
                  rows={6}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ajouter des notes internes sur ce client..."
                  className="w-full rounded-xl bg-secondary/50 border border-border p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />

                {notesMessage && (
                  <div className="text-[11px] text-accent font-medium">
                    {notesMessage}
                  </div>
                )}

                <Button
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes}
                  className="w-full text-xs bg-secondary/60 hover:bg-secondary text-foreground border border-border cursor-pointer"
                >
                  {isSavingNotes ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Sauvegarder les notes
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 2. Onglet Utilisateurs */}
        <TabsContent value="users">
          <Card className="bg-card border-border shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-foreground">Comptes Utilisateurs Rattachés</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Liste des profils autorisés sur ce tenant
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground font-semibold bg-muted/40">
                      <th className="py-2.5 px-3">Nom Complet</th>
                      <th className="py-2.5 px-3">Email</th>
                      <th className="py-2.5 px-3">Rôle</th>
                      <th className="py-2.5 px-3">Statut</th>
                      <th className="py-2.5 px-3 text-right">Date de création</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 px-3 font-medium text-foreground">{u.fullName || "Utilisateur"}</td>
                        <td className="py-3 px-3 font-mono text-muted-foreground">{u.email}</td>
                        <td className="py-3 px-3">
                          <Badge variant="outline" className="border-border bg-secondary text-[10px] uppercase">
                            {u.role}
                          </Badge>
                        </td>
                        <td className="py-3 px-3">
                          {u.isActive ? (
                            <span className="text-accent flex items-center gap-1 font-medium">
                              <CheckCircle2 className="h-3 w-3" /> Actif
                            </span>
                          ) : (
                            <span className="text-destructive flex items-center gap-1 font-medium">
                              <XCircle className="h-3 w-3" /> Inactif
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right text-muted-foreground font-mono">
                          {new Date(u.createdAt).toLocaleDateString("fr-FR")}
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-muted-foreground">
                          Aucun utilisateur enregistré pour ce tenant.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. Onglet Flotte & Synchro */}
        <TabsContent value="fleet" className="space-y-6">
          <Card className="bg-card border-border shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-foreground">Terminaux Desktop Connectés</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Postes physiques exécutant l&apos;application Facturier
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground font-semibold bg-muted/40">
                      <th className="py-2.5 px-3">Poste / Machine</th>
                      <th className="py-2.5 px-3">Système d&apos;exploitation</th>
                      <th className="py-2.5 px-3">Version App</th>
                      <th className="py-2.5 px-3">Dernière Connexion</th>
                      <th className="py-2.5 px-3 text-right">Statut Réplication</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {devices.map((d) => (
                      <tr key={d.deviceId} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 px-3 font-medium text-foreground flex items-center gap-2">
                          <Laptop className="h-4 w-4 text-primary" />
                          <span>{d.deviceName || d.deviceId.slice(0, 14)}</span>
                        </td>
                        <td className="py-3 px-3 text-foreground">{d.os || "Non détecté"}</td>
                        <td className="py-3 px-3 font-mono text-primary text-[11px]">v{d.appVersion || "1.0.0"}</td>
                        <td className="py-3 px-3 text-muted-foreground">
                          {new Date(d.lastSeenAt).toLocaleString("fr-FR")}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {d.lastStatus === "success" ? (
                            <span className="text-accent font-medium">OK</span>
                          ) : (
                            <span className="text-destructive font-medium">Erreur</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {devices.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-muted-foreground">
                          Aucun poste synchronisé à ce jour.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. Onglet Finance & Volumes */}
        <TabsContent value="finance" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card border-border p-4 shadow-xs">
              <span className="text-xs text-muted-foreground">Volume Facturé</span>
              <div className="text-2xl font-bold font-mono text-primary mt-1">
                {finance.totalRevenueXaf.toLocaleString("fr-FR")} XAF
              </div>
              <span className="text-[11px] text-muted-foreground mt-1 block">
                {finance.invoicesCount} facture(s) émise(s)
              </span>
            </Card>

            <Card className="bg-card border-border p-4 shadow-xs">
              <span className="text-xs text-muted-foreground">Règlements Encaissés</span>
              <div className="text-2xl font-bold font-mono text-accent mt-1">
                {finance.totalPaidXaf.toLocaleString("fr-FR")} XAF
              </div>
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Règlements reçus
              </span>
            </Card>

            <Card className="bg-card border-border p-4 shadow-xs">
              <span className="text-xs text-muted-foreground">Impayés Restants</span>
              <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                {finance.pendingXaf.toLocaleString("fr-FR")} XAF
              </div>
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Créances clients en cours
              </span>
            </Card>

            <Card className="bg-card border-border p-4 shadow-xs">
              <span className="text-xs text-muted-foreground">Devis Émis</span>
              <div className="text-2xl font-bold font-mono text-foreground mt-1">
                {finance.quotesCount}
              </div>
              <span className="text-[11px] text-muted-foreground mt-1 block">
                Propositions commerciales
              </span>
            </Card>
          </div>
        </TabsContent>

        {/* 5. Onglet Audit Trail */}
        <TabsContent value="audit" className="space-y-6">
          <Card className="bg-card border-border shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-foreground">Journal d&apos;Audit du Tenant</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Opérations administratives sensibles tracées dans hub_audit_logs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-secondary/40 border border-border text-xs gap-2"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-primary font-semibold">{log.action}</span>
                        <span className="text-muted-foreground">par {log.actorEmail}</span>
                      </div>
                      {log.reason && (
                        <p className="text-muted-foreground italic">
                          Motif : &laquo; {log.reason} &raquo;
                        </p>
                      )}
                    </div>
                    <div className="text-muted-foreground font-mono text-[11px] shrink-0">
                      {new Date(log.createdAt).toLocaleString("fr-FR")}
                    </div>
                  </div>
                ))}

                {auditLogs.length === 0 && (
                  <div className="py-6 text-center text-muted-foreground text-xs">
                    Aucun événement d&apos;audit enregistré sur cette organisation.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Tiroir Latéral (Side Sheet) : Bris de Glace (D9) */}
      <Dialog open={isBreakGlassOpen} onOpenChange={setIsBreakGlassOpen}>
        <DialogContent side="right" className="bg-card border-l border-border text-foreground max-w-md sm:max-w-lg lg:max-w-xl p-0 gap-0">
          <form onSubmit={handleBreakGlass} className="flex flex-col h-full">
            <div className="flex items-start justify-between p-6 border-b border-border bg-card shrink-0">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <DialogTitle className="text-lg font-bold text-foreground tracking-tight">
                    Protocole de Bris de Glace — Support
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    L&apos;accès aux données métier de ce tenant est exceptionnel et soumis au secret des affaires.
                  </DialogDescription>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 focus:outline-none">
              <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-xs text-amber-600 dark:text-amber-400 space-y-1">
                <span className="font-semibold block">⚠️ Avertissement d&apos;Audit Immuable</span>
                <p>
                  Toute consultation dans ce mode est <strong>strictement tracée</strong> dans <code className="font-mono font-bold">hub_audit_logs</code> avec votre identifiant Super Admin, adresse IP et horodatage.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bg-reason" className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
                  Motif circonstancié (Réf. Ticket de support, Incident n°) *
                </Label>
                <Input
                  id="bg-reason"
                  required
                  placeholder="Ex: Demande client #9281 - Diagnostic anomalie TVA"
                  value={breakGlassReason}
                  onChange={(e) => setBreakGlassReason(e.target.value)}
                  className="bg-secondary/50 border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-10"
                />
              </div>

              {breakGlassError && (
                <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-xl">
                  {breakGlassError}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border bg-card shrink-0 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsBreakGlassOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary border border-border transition-colors cursor-pointer"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={breakGlassLoading || breakGlassReason.trim().length < 10}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {breakGlassLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Validation...
                  </>
                ) : (
                  "Confirmer le Bris de Glace"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Tiroir Latéral (Side Sheet) : Suspension / Réactivation du Tenant */}
      <Dialog open={isToggleOpen} onOpenChange={setIsToggleOpen}>
        <DialogContent side="right" className="bg-card border-l border-border text-foreground max-w-md sm:max-w-lg lg:max-w-xl p-0 gap-0">
          <div className="flex flex-col h-full">
            <div className="flex items-start justify-between p-6 border-b border-border bg-card shrink-0">
              <div className="flex items-start gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-xs border ${
                  tenant.status === "suspended"
                    ? "bg-primary/10 border-primary/20 text-primary"
                    : "bg-destructive/10 border-destructive/20 text-destructive"
                }`}>
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <DialogTitle className="text-lg font-bold text-foreground tracking-tight">
                    {tenant.status === "suspended" ? "Réactiver l'organisation" : "Suspendre l'organisation"}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    {tenant.status === "suspended"
                      ? `Rétablir l'accès cloud complet pour ${tenant.name}. La synchronisation reprendra immédiatement.`
                      : `Bloquer l'accès cloud pour ${tenant.name}. Le terminal Desktop sera rejeté dès la prochaine synchro.`}
                  </DialogDescription>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 focus:outline-none">
              {tenant.status !== "suspended" && (
                <div className="space-y-1.5">
                  <Label htmlFor="toggle-reason" className="text-[11px] font-bold text-foreground uppercase tracking-wider block">
                    Motif impératif de suspension *
                  </Label>
                  <Input
                    id="toggle-reason"
                    value={toggleReason}
                    onChange={(e) => setToggleReason(e.target.value)}
                    placeholder="Ex: Facture échue non honorée / Demande d'interruption"
                    className="bg-secondary/50 border-border rounded-xl text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-primary h-10"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Action tracée de façon permanente dans la piste d&apos;audit Super Admin.
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border bg-card shrink-0 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsToggleOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary border border-border transition-colors cursor-pointer"
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={handleToggleStatus}
                disabled={toggleLoading || (tenant.status !== "suspended" && toggleReason.trim().length < 5)}
                className={`px-5 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer ${
                  tenant.status === "suspended"
                    ? "bg-primary hover:bg-primary-hover text-primary-foreground"
                    : "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                }`}
              >
                {toggleLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Mise à jour...
                  </>
                ) : tenant.status === "suspended" ? (
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
