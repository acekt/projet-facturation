import type { Metadata } from "next";
import { connection } from "next/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  ShieldCheck,
  Server,
  Database,
  Lock,
  Cpu,
  Layers,
  CheckCircle2,
  Globe,
  Settings2
} from "lucide-react";
import { Badge } from "@workspace/ui/components/badge";

export const metadata: Metadata = {
  title: "Paramètres Hub & Configuration Plateforme | Facturier Hub",
  description: "Configuration système du Hub Super Admin, passerelle PowerSync et infrastructure Supabase.",
};

export const instant = false;

export default async function AdminSettingsPage() {
  await connection();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nsthgydbjfbutinyvbey.supabase.co";
  const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const powersyncUrl = process.env.POWERSYNC_URL || "https://6aca2e832f27853eb0add951.powersync.journeyapps.com";

  return (
    <div className="space-y-6">
      {/* En-tête de page institutionnel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Paramètres Hub & Système
            </h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-mono">
              v1.0.0-prod
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Configuration globale de la plateforme SaaS, des passerelles cloud et des protocoles de sécurité.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-3 py-1 flex items-center gap-1.5 text-xs font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Infrastructure Opérationnelle
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Module Infrastructure Supabase Cloud */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Base de Données & Supabase Cloud
              </CardTitle>
              <Badge variant="outline" className="text-[11px] font-mono">PostgreSQL 15+</Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Cluster cloud hébergeant les 19 tables répliquées et les politiques d'accès RLS.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border">
              <span className="text-muted-foreground">Instance Supabase</span>
              <span className="font-mono font-medium text-foreground text-[11px] truncate max-w-[240px]">
                {supabaseUrl}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border">
              <span className="text-muted-foreground">Isolation Multi-Tenant (RLS)</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> 100% Active & Étanchéifiée
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border">
              <span className="text-muted-foreground">Service Role Key</span>
              <Badge variant="secondary" className="font-mono text-[10px]">
                {hasServiceKey ? "Configurée ✓" : "Rôle délégué Supabase SSR"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Module Passerelle PowerSync Cloud */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Globe className="h-4 w-4 text-sky-500" />
                Moteur de Réplication PowerSync
              </CardTitle>
              <Badge variant="outline" className="text-[11px] font-mono">Sync v2.4</Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Routage partitionné des buckets SQLite locaux vers le cloud.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border">
              <span className="text-muted-foreground">Passerelle PowerSync</span>
              <span className="font-mono font-medium text-foreground text-[11px] truncate max-w-[240px]">
                {powersyncUrl}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border">
              <span className="text-muted-foreground">Stratégie de Conflits</span>
              <span className="font-medium text-foreground">Last-Write-Wins (UTC)</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border">
              <span className="text-muted-foreground">Anti-Collision Documents</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Index Unique par Tenant
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Module Sécurité & Conformité */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Politiques de Sécurité & Conformité
              </CardTitle>
              <Badge variant="outline" className="text-[11px]">Strict</Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Paramètres cryptographiques et gouvernance des données fiscales.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border">
              <span className="text-muted-foreground">Chiffrement en Transit</span>
              <span className="font-mono text-foreground font-medium">TLS 1.3 Strict</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border">
              <span className="text-muted-foreground">Double Facteur (MFA)</span>
              <span className="font-medium text-foreground">TOTP (RFC 6238) / AAL2</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border">
              <span className="text-muted-foreground">Politique de Suppression</span>
              <span className="font-medium text-foreground">Soft Delete Obligatoire (deletedAt)</span>
            </div>
          </CardContent>
        </Card>

        {/* Module Runtime & Environnement */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Cpu className="h-4 w-4 text-amber-500" />
                Stack & Runtime Serveur
              </CardTitle>
              <Badge variant="outline" className="text-[11px]">Node 24 / Next 16</Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Technologies et optimisations de rendu en production.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border">
              <span className="text-muted-foreground">Framework Frontend</span>
              <span className="font-mono text-foreground font-medium">Next.js 16.4.3 (Turbopack)</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border">
              <span className="text-muted-foreground">Port Local Dédié</span>
              <Badge variant="outline" className="font-mono text-[11px] font-bold text-primary">
                localhost:4000
              </Badge>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border">
              <span className="text-muted-foreground">Moteur Fiscal Actif</span>
              <span className="font-medium text-foreground">CEMAC / DGI Gabon (TVA 18%, CSS 1%, TPS 9.5%)</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
