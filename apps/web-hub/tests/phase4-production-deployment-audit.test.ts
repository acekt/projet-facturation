import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Phase 4 : Déploiement en Production du Hub Cloud & Consolidation Supabase", () => {
  const rootDir = path.resolve(__dirname, "../../..");
  const webHubRoot = path.resolve(__dirname, "..");
  const supabaseDir = path.join(rootDir, "supabase");
  const archiveDir = path.join(rootDir, "docs", "archive");

  // ---------------------------------------------------------------------------
  // 1. AUDIT ET CONSOLIDATION DES MIGRATIONS SUPABASE (Tâche 4.1)
  // ---------------------------------------------------------------------------
  describe("Audit et Intégrité des Migrations Supabase", () => {
    it("1.1 Le bundle consolidé deploy_all_migrations.sql doit exister et être non vide", () => {
      const deployScript = path.join(supabaseDir, "deploy_all_migrations.sql");
      expect(fs.existsSync(deployScript)).toBe(true);

      const content = fs.readFileSync(deployScript, "utf8");
      expect(content.length).toBeGreaterThan(1000);
      expect(content).toContain("SECTION 1 : Tables fondamentales Multi-Tenant");
      expect(content).toContain("SECTION 4 : Tables Métier Synchronisées");
      expect(content).toContain("SECTION 5 : Sécurité Super Admin");
      expect(content).toContain("SECTION 6 : Modèles SaaS, Flotte Desktop");
    });

    it("1.2 Les 19 tables de production doivent être déclarées avec IF NOT EXISTS", () => {
      const deployScript = path.join(supabaseDir, "deploy_all_migrations.sql");
      const content = fs.readFileSync(deployScript, "utf8");

      const expectedTables = [
        "tenants",
        "profiles",
        "clients",
        "services",
        "quotes",
        "quote_items",
        "invoices",
        "invoice_items",
        "payments",
        "credit_notes",
        "credit_note_items",
        "audit_logs",
        "tenant_settings",
        "announcements",
        "plans",
        "sync_devices",
        "sync_runs",
        "hub_audit_logs",
        "kpi_tenant_daily",
      ];

      for (const table of expectedTables) {
        expect(content).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`, "i"));
      }
    });

    it("1.3 Les fonctions critiques de sécurité et triggers de réplication doivent être déclarés", () => {
      const deployScript = path.join(supabaseDir, "deploy_all_migrations.sql");
      const content = fs.readFileSync(deployScript, "utf8");

      expect(content).toContain("FUNCTION public.current_tenant_id()");
      expect(content).toContain("FUNCTION public.is_superadmin()");
      expect(content).toContain("FUNCTION public.is_superadmin_aal2()");
      expect(content).toContain("FUNCTION public.custom_access_token_hook(event jsonb)");
      expect(content).toContain("FUNCTION public.attach_member(");
      expect(content).toContain("FUNCTION public.touch_server_updated_at()");
    });

    it("1.4 Les index d'unicité anti-collision séquentielle doivent être présents", () => {
      const deployScript = path.join(supabaseDir, "deploy_all_migrations.sql");
      const content = fs.readFileSync(deployScript, "utf8");

      expect(content).toContain("uq_quotes_tenant_number");
      expect(content).toContain("uq_invoices_tenant_number");
      expect(content).toContain("uq_credit_notes_tenant_number");
    });

    it("1.5 Les 4 fichiers de migration unitaires historiques doivent tous être présents", () => {
      const migrationsDir = path.join(supabaseDir, "migrations");
      const files = fs.readdirSync(migrationsDir);

      expect(files).toContain("20261013_attach_member.sql");
      expect(files).toContain("20261013_desktop_sync.sql");
      expect(files).toContain("20261020_hub_security.sql");
      expect(files).toContain("20261021_hub_telemetry_kpis.sql");
    });
  });

  // ---------------------------------------------------------------------------
  // 2. CONFIGURATION ET RÉSILIENCE PRODUCTION DE L'APP WEB-HUB (Tâche 4.2)
  // ---------------------------------------------------------------------------
  describe("Configuration et Prêt-à-Déployer Web-Hub", () => {
    it("2.1 Le template .env.example doit déclarer toutes les clés de production requises", () => {
      const envExamplePath = path.join(webHubRoot, ".env.example");
      expect(fs.existsSync(envExamplePath)).toBe(true);

      const content = fs.readFileSync(envExamplePath, "utf8");
      expect(content).toContain("NEXT_PUBLIC_SUPABASE_URL");
      expect(content).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
      expect(content).toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(content).toContain("SESSION_SECRET");
      expect(content).toContain("POWERSYNC_URL");
      expect(content).toContain("HTTPS");
    });

    it("2.2 Les pages serveur dynamiques doivent exporter instant = false pour Next.js 16", () => {
      const serverPages = [
        path.join(webHubRoot, "src/app/login/page.tsx"),
        path.join(webHubRoot, "src/app/mfa/page.tsx"),
        path.join(webHubRoot, "src/app/admin/page.tsx"),
        path.join(webHubRoot, "src/app/admin/sync/page.tsx"),
        path.join(webHubRoot, "src/app/admin/tenants/page.tsx"),
        path.join(webHubRoot, "src/app/admin/security/page.tsx"),
        path.join(webHubRoot, "src/app/admin/finance/page.tsx"),
        path.join(webHubRoot, "src/app/admin/licences/page.tsx"),
        path.join(webHubRoot, "src/app/admin/announcements/page.tsx"),
        path.join(webHubRoot, "src/app/admin/adoption/page.tsx"),
      ];

      for (const filePath of serverPages) {
        expect(fs.existsSync(filePath), `Fichier manquant: ${filePath}`).toBe(true);
        const fileContent = fs.readFileSync(filePath, "utf8");
        expect(fileContent, `Page sans instant = false: ${filePath}`).toContain("export const instant = false;");
      }
    });

    it("2.3 Le layout admin doit contraindre strictement la session et l'accès AAL2", () => {
      const layoutPath = path.join(webHubRoot, "src/app/admin/layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf8");

      expect(content).toContain("requireSuperadmin");
      expect(content).toContain("AdminShell");
      expect(content).toContain("ToastProvider");
    });
  });

  // ---------------------------------------------------------------------------
  // 3. SYNCHRONISATION ARCHIVÉE & CONGRUENCE DES SCHÉMAS (ADR-0038)
  // ---------------------------------------------------------------------------
  describe("Congruence Règles Synchronisation & Supabase (ADR-0038)", () => {
    it("3.1 Le fichier sync_rules.yaml archivé (ADR-0038) doit définir les 3 buckets essentiels", () => {
      const syncRulesPath = path.join(archiveDir, "sync_rules.yaml");
      expect(fs.existsSync(syncRulesPath)).toBe(true);

      const content = fs.readFileSync(syncRulesPath, "utf8");
      expect(content).toContain("tenant_data:");
      expect(content).toContain("user_profile:");
      expect(content).toContain("announcements:");
    });

    it("3.2 Le bucket tenant_data doit filtrer les 13 tables synchronisées par bucket.tenant_id", () => {
      const syncRulesPath = path.join(archiveDir, "sync_rules.yaml");
      const content = fs.readFileSync(syncRulesPath, "utf8");

      const replicatedTenantTables = [
        "public.tenants",
        "public.profiles",
        "public.clients",
        "public.services",
        "public.quotes",
        "public.quote_items",
        "public.invoices",
        "public.invoice_items",
        "public.payments",
        "public.credit_notes",
        "public.credit_note_items",
        "public.audit_logs",
        "public.tenant_settings",
      ];

      for (const table of replicatedTenantTables) {
        expect(content).toContain(`FROM ${table}`);
      }
    });
  });
});
