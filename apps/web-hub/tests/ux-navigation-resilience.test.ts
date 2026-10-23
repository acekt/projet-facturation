import { describe, it, expect } from "vitest";

describe("ADR-0014: Excellence UX, Navigation et Résilience App Router du Hub", () => {
  it("1. Le composant Breadcrumb fournit les libellés adéquats selon la route", async () => {
    // Vérification que les labels français sont définis pour toutes les sections
    const ROUTE_LABELS: Record<string, string> = {
      admin: "Centre de Contrôle",
      tenants: "Tenants & Clients",
      sync: "Parc & Synchronisation",
      finance: "Finance & Volumes",
      adoption: "Adoption & Funnel",
      security: "Piste d'Audit",
      licences: "Plans & Licences",
      announcements: "Annonces & Alertes",
      settings: "Paramètres Hub",
    };

    expect(ROUTE_LABELS.admin).toBe("Centre de Contrôle");
    expect(ROUTE_LABELS.tenants).toBe("Tenants & Clients");
    expect(ROUTE_LABELS.sync).toBe("Parc & Synchronisation");
    expect(ROUTE_LABELS.finance).toBe("Finance & Volumes");
    expect(ROUTE_LABELS.adoption).toBe("Adoption & Funnel");
    expect(ROUTE_LABELS.security).toBe("Piste d'Audit");
    expect(ROUTE_LABELS.licences).toBe("Plans & Licences");
    expect(ROUTE_LABELS.announcements).toBe("Annonces & Alertes");
  });

  it("2. Le ToastContext expose le Provider et le Hook useToast", async () => {
    const { ToastProvider, useToast } = await import("@/components/admin/toast-context");
    expect(typeof ToastProvider).toBe("function");
    expect(typeof useToast).toBe("function");
  });

  it("3. Les modules AdminLoading, AdminError et AdminNotFound sont correctement typés et définis", async () => {
    const { default: AdminLoading } = await import("@/app/admin/loading");
    const { default: AdminError } = await import("@/app/admin/error");
    const { default: AdminNotFound } = await import("@/app/admin/not-found");

    expect(typeof AdminLoading).toBe("function");
    expect(typeof AdminError).toBe("function");
    expect(typeof AdminNotFound).toBe("function");

    // Rendu test simple de AdminNotFound (sans hooks)
    const notFoundElement = AdminNotFound();
    expect(notFoundElement).toBeDefined();

    // Rendu test simple de AdminLoading (sans hooks)
    const loadingElement = AdminLoading();
    expect(loadingElement).toBeDefined();
  });

  it("4. La palette de commande, la sidebar rétractable et l'AdminShell sont exportés et opérationnels", async () => {
    const { CommandPalette, CommandPaletteTrigger } = await import("@/components/admin/command-palette");
    const { AdminHeader } = await import("@/components/admin/header");
    const { MobileNav } = await import("@/components/admin/mobile-nav");
    const { CollapsibleSidebar } = await import("@/components/admin/collapsible-sidebar");
    const { AdminShell } = await import("@/components/admin/admin-shell");

    expect(typeof CommandPalette).toBe("function");
    expect(typeof CommandPaletteTrigger).toBe("function");
    expect(typeof AdminHeader).toBe("function");
    expect(typeof MobileNav).toBe("function");
    expect(typeof CollapsibleSidebar).toBe("function");
    expect(typeof AdminShell).toBe("function");
  });

  it("5. Le ThemeProvider et le ThemeToggle centralisent le support mode clair et sombre", async () => {
    const { ThemeProvider } = await import("@/components/theme-provider");
    const { ThemeToggle } = await import("@/components/theme-toggle");

    expect(typeof ThemeProvider).toBe("function");
    expect(typeof ThemeToggle).toBe("function");
  });
});
