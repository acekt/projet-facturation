import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock DAL
vi.mock("@/lib/auth/dal", () => ({
  requireSuperadmin: vi.fn().mockResolvedValue({
    user: { id: "super-admin-uuid", email: "admin@hub.com" },
    profile: { role: "superadmin", isActive: true },
    aal: { currentLevel: "aal2" },
  }),
}));

// Mock Audit
const mockLogHubAudit = vi.fn().mockResolvedValue("audit-log-uuid-99");
vi.mock("@/lib/audit", () => ({
  logHubAudit: (args: any) => mockLogHubAudit(args),
}));

// Mock Supabase Server
const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({
  order: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: mockSingle,
}));
const mockEq = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn(() => ({ eq: mockEq }));
const mockInsert = vi.fn(() => ({
  select: vi.fn(() => ({
    single: mockSingle,
  })),
}));

const mockFrom = vi.fn((table: string) => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

describe("H6 Sécurité & Audit Avancé, Gestion des Licences & Annonces Globales", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Gestion des Licences et Quotas SaaS", () => {
    it("extendLicenseAction rejette une prolongation sans motif valable", async () => {
      const { extendLicenseAction } = await import("@/lib/kpi/licenceActions");
      const res = await extendLicenseAction("tenant-1", 30, "ok"); // moins de 5 caractères
      expect(res.success).toBe(false);
      expect(res.error).toContain("au moins 5 caractères");
    });

    it("extendLicenseAction rejette un nombre de jours négatif ou nul", async () => {
      const { extendLicenseAction } = await import("@/lib/kpi/licenceActions");
      const res = await extendLicenseAction("tenant-1", 0, "Renouvellement annuel");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Nombre de jours invalide");
    });

    it("extendLicenseAction prolonge avec succès et trace l'audit immuable", async () => {
      const { extendLicenseAction } = await import("@/lib/kpi/licenceActions");

      mockSingle.mockResolvedValueOnce({
        data: {
          id: "tenant-1",
          name: "Cabinet Test",
          license_expires_at: "2026-11-01T00:00:00.000Z",
          status: "active",
        },
        error: null,
      });

      const res = await extendLicenseAction("tenant-1", 30, "Renouvellement accordé par direction");
      expect(res.success).toBe(true);

      // Vérifie l'insertion dans hub_audit_logs
      expect(mockLogHubAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "LICENSE_EXTEND",
          targetType: "tenant",
          targetId: "tenant-1",
          reason: "Renouvellement accordé par direction",
        })
      );
    });

    it("createPlanAction valide le code et le nom du plan", async () => {
      const { createPlanAction } = await import("@/lib/kpi/licenceActions");

      const formBad = new FormData();
      formBad.append("code", "a");
      formBad.append("name", "Plan Invalide");

      const resBad = await createPlanAction(formBad);
      expect(resBad.success).toBe(false);
      expect(resBad.error).toContain("Code plan invalide");

      const formGood = new FormData();
      formGood.append("code", "starter_v2");
      formGood.append("name", "Starter V2 Pro");
      formGood.append("priceXaf", "25000");

      const resGood = await createPlanAction(formGood);
      expect(resGood.success).toBe(true);
      expect(mockLogHubAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "PLAN_CREATE",
          targetType: "system",
        })
      );
    });
  });

  describe("2. Annonces Broadcast et Résolution d'Alertes", () => {
    it("createAnnouncementAction valide les champs obligatoires", async () => {
      const { createAnnouncementAction } = await import("@/lib/kpi/announcementActions");

      const formBad = new FormData();
      formBad.append("title", "No");
      formBad.append("body", "Test");

      const resBad = await createAnnouncementAction(formBad);
      expect(resBad.success).toBe(false);
      expect(resBad.error).toContain("Titre requis");
    });

    it("createAnnouncementAction insère l'annonce et consigne l'audit", async () => {
      const { createAnnouncementAction } = await import("@/lib/kpi/announcementActions");

      mockSingle.mockResolvedValueOnce({
        data: { id: "announcement-new-uuid" },
        error: null,
      });

      const formGood = new FormData();
      formGood.append("title", "Maintenance Cloud programmée");
      formGood.append("body", "Le hub passera en lecture seule pendant 30 minutes ce vendredi.");
      formGood.append("level", "maintenance");

      const resGood = await createAnnouncementAction(formGood);
      expect(resGood.success).toBe(true);
      expect(mockLogHubAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ANNOUNCEMENT_CREATE",
          targetType: "system",
          targetId: "announcement-new-uuid",
        })
      );
    });

    it("toggleAnnouncementAction active/désactive et journalise l'audit", async () => {
      const { toggleAnnouncementAction } = await import("@/lib/kpi/announcementActions");

      const res = await toggleAnnouncementAction("announcement-1", false);
      expect(res.success).toBe(true);
      expect(mockLogHubAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ANNOUNCEMENT_DEACTIVATE",
          targetType: "system",
          targetId: "announcement-1",
        })
      );
    });

    it("resolveAlertAction clôture une alerte avec horodatage de résolution", async () => {
      const { resolveAlertAction } = await import("@/lib/kpi/announcementActions");

      const res = await resolveAlertAction("alert-uuid-1", "resolved");
      expect(res.success).toBe(true);
      expect(mockLogHubAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ALERT_RESOLVED",
          targetType: "system",
          targetId: "alert-uuid-1",
        })
      );
    });
  });
});
