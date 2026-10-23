import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/navigation
const mockRedirect = vi.fn();
const mockForbidden = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  forbidden: () => {
    mockForbidden();
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;403");
  },
}));

// Mock @/utils/supabase/server
const mockGetUser = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockGetAAL = vi.fn();

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
      mfa: {
        getAuthenticatorAssuranceLevel: mockGetAAL,
      },
    },
    from: mockFrom,
  })),
}));

describe("H0 Sécurité : requireSuperadmin DAL & Contrôle Multi-Tenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAAL.mockResolvedValue({
      data: {
        currentLevel: "aal2",
        nextLevel: "aal2",
        currentAuthenticationMethods: ["totp"],
      },
    });
  });

  it("1. Redirige vers /login si aucun utilisateur n'est authentifié", async () => {
    const { requireSuperadmin } = await import("@/lib/auth/dal");

    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("No session"),
    });

    await expect(requireSuperadmin()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("2. Déclenche forbidden() (403) si l'utilisateur a le rôle 'user'", async () => {
    const { requireSuperadmin } = await import("@/lib/auth/dal");

    mockGetUser.mockResolvedValue({
      data: {
        user: { id: "user-123", email: "user@tenant.com", app_metadata: {} },
      },
      error: null,
    });

    mockSingle.mockResolvedValue({
      data: {
        id: "user-123",
        role: "user",
        is_active: true,
        full_name: "Tenant User",
        email: "user@tenant.com",
        tenant_id: "tenant-aaa",
      },
      error: null,
    });

    await expect(requireSuperadmin()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;403");
    expect(mockForbidden).toHaveBeenCalled();
  });

  it("3. Déclenche forbidden() (403) si l'utilisateur a le rôle 'admin' (admin local de tenant)", async () => {
    const { requireSuperadmin } = await import("@/lib/auth/dal");

    mockGetUser.mockResolvedValue({
      data: {
        user: { id: "admin-456", email: "admin@client.com", app_metadata: {} },
      },
      error: null,
    });

    mockSingle.mockResolvedValue({
      data: {
        id: "admin-456",
        role: "admin",
        is_active: true,
        full_name: "Tenant Admin",
        email: "admin@client.com",
        tenant_id: "tenant-bbb",
      },
      error: null,
    });

    await expect(requireSuperadmin()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;403");
    expect(mockForbidden).toHaveBeenCalled();
  });

  it("4. Déclenche forbidden() (403) si le compte Superadmin est désactivé (is_active = false)", async () => {
    const { requireSuperadmin } = await import("@/lib/auth/dal");

    mockGetUser.mockResolvedValue({
      data: {
        user: { id: "super-disabled", email: "super@hub.com", app_metadata: {} },
      },
      error: null,
    });

    mockSingle.mockResolvedValue({
      data: {
        id: "super-disabled",
        role: "superadmin",
        is_active: false,
        full_name: "Revoked Super",
        email: "super@hub.com",
        tenant_id: null,
      },
      error: null,
    });

    await expect(requireSuperadmin()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;403");
    expect(mockForbidden).toHaveBeenCalled();
  });

  it("5. Redirige vers /mfa/verify si le Superadmin a un facteur TOTP non vérifié (aal1 vs nextLevel aal2)", async () => {
    const { requireSuperadmin } = await import("@/lib/auth/dal");

    mockGetUser.mockResolvedValue({
      data: {
        user: { id: "super-valid", email: "super@hub.com", app_metadata: {} },
      },
      error: null,
    });

    mockSingle.mockResolvedValue({
      data: {
        id: "super-valid",
        role: "superadmin",
        is_active: true,
        full_name: "Active Superadmin",
        email: "super@hub.com",
        tenant_id: null,
      },
      error: null,
    });

    // AAL1 alors que AAL2 est attendu
    mockGetAAL.mockResolvedValue({
      data: {
        currentLevel: "aal1",
        nextLevel: "aal2",
        currentAuthenticationMethods: ["password"],
      },
    });

    await expect(requireSuperadmin()).rejects.toThrow("NEXT_REDIRECT:/mfa/verify");
    expect(mockRedirect).toHaveBeenCalledWith("/mfa/verify");
  });

  it("6. Autorise l'accès et retourne la session complète pour un Superadmin en AAL2", async () => {
    const { requireSuperadmin } = await import("@/lib/auth/dal");

    mockGetUser.mockResolvedValue({
      data: {
        user: { id: "super-valid", email: "super@hub.com", app_metadata: { user_role: "superadmin" } },
      },
      error: null,
    });

    mockSingle.mockResolvedValue({
      data: {
        id: "super-valid",
        role: "superadmin",
        is_active: true,
        full_name: "Active Superadmin",
        email: "super@hub.com",
        tenant_id: null,
      },
      error: null,
    });

    mockGetAAL.mockResolvedValue({
      data: {
        currentLevel: "aal2",
        nextLevel: "aal2",
        currentAuthenticationMethods: ["password", "totp"],
      },
    });

    const session = await requireSuperadmin();

    expect(session.user.id).toBe("super-valid");
    expect(session.profile.role).toBe("superadmin");
    expect(session.profile.isActive).toBe(true);
    expect(session.aal?.currentLevel).toBe("aal2");
    expect(mockForbidden).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
