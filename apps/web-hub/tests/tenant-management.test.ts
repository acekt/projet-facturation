import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock DAL
vi.mock("@/lib/auth/dal", () => ({
  requireSuperadmin: vi.fn().mockResolvedValue({
    user: { id: "super-1", email: "admin@hub.com" },
    profile: { role: "superadmin", isActive: true },
    aal: { currentLevel: "aal2" },
  }),
}));

// Mock Audit
const mockLogHubAudit = vi.fn().mockResolvedValue("audit-log-uuid-1");
vi.mock("@/lib/audit", () => ({
  logHubAudit: (args: any) => mockLogHubAudit(args),
}));

// Mock Supabase Server
const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle }));
const mockEq = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn(() => ({ eq: mockEq }));
const mockInsert = vi.fn(() => ({ select: mockSelect }));
const mockFrom = vi.fn((table: string) => ({
  insert: mockInsert,
  update: mockUpdate,
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}));

describe("H3 Gestion des Tenants & Protocole de Bris de Glace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. createTenantAction refuse la création si la raison sociale est trop courte", async () => {
    const { createTenantAction } = await import("@/app/admin/tenants/actions");

    const formData = new FormData();
    formData.append("name", "A");

    const res = await createTenantAction(formData);
    expect(res.success).toBe(false);
    expect(res.error).toContain("2 car. min");
  });

  it("2. createTenantAction crée le tenant et journalise l'audit", async () => {
    const { createTenantAction } = await import("@/app/admin/tenants/actions");

    mockSingle.mockResolvedValue({
      data: { id: "new-tenant-uuid" },
      error: null,
    });

    const formData = new FormData();
    formData.append("name", "Entreprise Test SARL");
    formData.append("country", "Cameroun");

    const res = await createTenantAction(formData);

    expect(res.success).toBe(true);
    expect(res.data?.id).toBe("new-tenant-uuid");
    expect(mockLogHubAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "tenant.create",
        targetId: "new-tenant-uuid",
      })
    );
  });

  it("3. toggleTenantStatusAction refuse la suspension sans motif clair", async () => {
    const { toggleTenantStatusAction } = await import("@/app/admin/tenants/actions");

    const res = await toggleTenantStatusAction({
      tenantId: "tenant-123",
      status: "suspended",
      reason: "nope",
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("5 caractères min");
  });

  it("4. toggleTenantStatusAction suspend le tenant et trace l'opération", async () => {
    const { toggleTenantStatusAction } = await import("@/app/admin/tenants/actions");

    const res = await toggleTenantStatusAction({
      tenantId: "tenant-123",
      status: "suspended",
      reason: "Défaut de paiement constaté après relance",
    });

    expect(res.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "suspended",
        suspended_reason: "Défaut de paiement constaté après relance",
      })
    );
    expect(mockLogHubAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "tenant.suspend",
        targetId: "tenant-123",
      })
    );
  });

  it("5. breakGlassAccessAction exige un motif circonstancié et l'enregistre", async () => {
    const { breakGlassAccessAction } = await import("@/app/admin/tenants/actions");

    // Motif trop court
    const shortRes = await breakGlassAccessAction({
      tenantId: "tenant-123",
      reason: "court",
    });
    expect(shortRes.success).toBe(false);
    expect(shortRes.error).toContain("10 caractères min");

    // Motif valide
    const validRes = await breakGlassAccessAction({
      tenantId: "tenant-123",
      reason: "Ticket Support #9821 - Diagnostic urgent écriture TVA",
    });

    expect(validRes.success).toBe(true);
    expect(validRes.data?.authorizedUntil).toBeDefined();
    expect(mockLogHubAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "tenant.break_glass_access",
        targetId: "tenant-123",
        reason: "Ticket Support #9821 - Diagnostic urgent écriture TVA",
      })
    );
  });
});
