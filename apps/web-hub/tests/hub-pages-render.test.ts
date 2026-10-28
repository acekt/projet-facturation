import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DAL requireSuperadmin
vi.mock("@/lib/auth/dal", () => ({
  requireSuperadmin: vi.fn().mockResolvedValue({
    user: { id: "superadmin-uuid-test", email: "admin@hub.com" },
    profile: { id: "superadmin-uuid-test", role: "superadmin", isActive: true },
    aal: { currentLevel: "aal2" },
  }),
  getCurrentSuperadmin: vi.fn().mockResolvedValue({
    user: { id: "superadmin-uuid-test", email: "admin@hub.com" },
    profile: { id: "superadmin-uuid-test", role: "superadmin", isActive: true },
    aal: { currentLevel: "aal2" },
  }),
}));

// Mock Audit
vi.mock("@/lib/audit", () => ({
  logHubAudit: vi.fn().mockResolvedValue("audit-log-uuid-1"),
}));

// Mock Supabase Server Client with Realistic Fixture Data
const fixtureTenants = [
  {
    id: "tenant-uuid-1",
    name: "SARL Alpha BTP",
    status: "active",
    plan_id: "plan-pro-id",
    country: "Cameroun",
    created_at: "2026-05-10T08:00:00Z",
    notes: "Client fidèle",
    plans: { id: "plan-pro-id", name: "Plan Pro PME", price_xaf: 35000 },
  },
  {
    id: "tenant-uuid-2",
    name: "ETS Beta Commerce",
    status: "trial",
    plan_id: "plan-starter-id",
    country: "Cameroun",
    created_at: "2026-10-18T10:00:00Z",
    notes: null,
    plans: { id: "plan-starter-id", name: "Plan Starter", price_xaf: 15000 },
  },
];

const fixtureDevices = [
  {
    device_id: "device-desk-01",
    tenant_id: "tenant-uuid-1",
    device_name: "Compta-Bureau-01",
    os: "Windows 11 Pro",
    app_version: "1.0.0",
    first_seen_at: "2026-05-11T09:00:00Z",
    last_seen_at: new Date().toISOString(),
    last_sync_at: new Date().toISOString(),
    last_status: "success",
    metadata: {},
    tenants: { name: "SARL Alpha BTP" },
  },
];

const fixtureSyncRuns = [
  {
    id: "run-uuid-1",
    tenant_id: "tenant-uuid-1",
    device_id: "device-desk-01",
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    duration_ms: 420,
    pushed: 3,
    pulled: 5,
    deleted: 0,
    skipped: 0,
    error_count: 0,
    errors: [],
    app_version: "1.0.0",
    os: "Windows 11 Pro",
    created_at: new Date().toISOString(),
    tenants: { name: "SARL Alpha BTP" },
  },
];

const fixtureInvoices = [
  {
    id: "inv-uuid-1",
    tenant_id: "tenant-uuid-1",
    number: "FAC-2026-0001",
    client_name: "Société Nationale d'Énergie",
    total: 2500000,
    status: "paid",
    date: "2026-10-15",
    created_at: "2026-10-15T10:00:00Z",
    deleted_at: null,
  },
  {
    id: "inv-uuid-2",
    tenant_id: "tenant-uuid-1",
    number: "FAC-2026-0002",
    client_name: "Société des Travaux Publics",
    total: 1500000,
    status: "sent",
    date: "2026-10-18",
    created_at: "2026-10-18T10:00:00Z",
    deleted_at: null,
  },
];

const fixturePayments = [
  {
    id: "pay-uuid-1",
    tenant_id: "tenant-uuid-1",
    invoice_id: "inv-uuid-1",
    amount: 2500000,
    payment_method: "Virement Bancaire",
    date: "2026-10-16",
    created_at: "2026-10-16T14:00:00Z",
    deleted_at: null,
  },
];

const fixtureQuotes = [
  {
    id: "quote-uuid-1",
    tenant_id: "tenant-uuid-1",
    total: 4800000,
    status: "sent",
    deleted_at: null,
  },
];

const fixtureAlerts = [
  {
    id: "alert-1",
    title: "Test Alert",
    message: "Alerte de test",
    severity: "warning",
    status: "open",
    created_at: new Date().toISOString(),
  },
];

const fixtureAuditLogs = [
  {
    id: "audit-log-1",
    actor_id: "user-super-1",
    actor_email: "superadmin@hub.com",
    action: "BREAK_GLASS_ACCESS",
    target_type: "tenant",
    target_id: "tenant-uuid-1",
    reason: "Assistance client urgence",
    metadata: { ip: "127.0.0.1" },
    created_at: new Date().toISOString(),
    tenants: { name: "SARL Alpha BTP" },
  },
];

const fixtureAnnouncements = [
  {
    id: "announcement-1",
    title: "Maintenance Hub Cloud",
    body: "Travaux d'optimisation prévus ce soir.",
    level: "maintenance",
    is_active: true,
    starts_at: new Date().toISOString(),
    ends_at: null,
    created_at: new Date().toISOString(),
    tenants: null,
  },
];

vi.mock("next/cache", () => ({
  unstable_cache: (fn: any) => fn,
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

const mockSupabaseQueryChain = () => ({
  from: (table: string) => {
    let chain: any = {
      select: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      is: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      or: vi.fn(() => chain),
      ilike: vi.fn(() => chain),
      single: vi.fn(() => chain),
      then: (resolve: any) => {
        if (table === "tenants") return resolve({ data: fixtureTenants, error: null });
        if (table === "sync_devices") return resolve({ data: fixtureDevices, error: null });
        if (table === "sync_runs") return resolve({ data: fixtureSyncRuns, error: null });
        if (table === "invoices") return resolve({ data: fixtureInvoices, error: null });
        if (table === "payments") return resolve({ data: fixturePayments, error: null });
        if (table === "quotes") return resolve({ data: fixtureQuotes, error: null });
        if (table === "alerts") return resolve({ data: fixtureAlerts, error: null });
        if (table === "plans") return resolve({ data: [{ id: "plan-pro-id", code: "pro", name: "Pro", price_xaf: 35000, billing_period: "monthly", max_users: 10, max_devices: 5, features: {}, is_active: true }], error: null });
        if (table === "hub_audit_logs") return resolve({ data: fixtureAuditLogs, error: null });
        if (table === "announcements") return resolve({ data: fixtureAnnouncements, error: null });
        return resolve({ data: [], error: null });
      },
    };
    return chain;
  },
});

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabaseQueryChain()),
}));

vi.mock("@/utils/supabase/admin", () => ({
  createAdminClient: vi.fn(() => mockSupabaseQueryChain()),
}));

describe("Test d'Intégration Global de Tous les Modules du Hub Super Admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. [H2] Module Centre de Contrôle (/admin) : getHubOverview génère toutes les métriques", async () => {
    const { getHubOverview } = await import("@/lib/kpi/queries");
    const overview = await getHubOverview();

    expect(overview.tenants.total).toBe(2);
    expect(overview.tenants.active).toBe(1);
    expect(overview.tenants.trial).toBe(1);
    expect(overview.mrrEstimateXaf).toBe(35000);
    expect(overview.fleet.totalDevices).toBe(1);
    expect(overview.fleet.activeLast24h).toBe(1);
  });

  it("2. [H3] Module Tenants (/admin/tenants) : getTenantsList structure les fiches clients", async () => {
    const { getTenantsList } = await import("@/lib/kpi/tenant360");
    const tenants = await getTenantsList();

    expect(tenants.length).toBe(2);
    expect(tenants[0].name).toBe("SARL Alpha BTP");
    expect(tenants[0].planName).toBe("Plan Pro PME");
    expect(tenants[0].priceXaf).toBe(35000);
  });

  it("3. [H4] Module Parc & Synchro (/admin/sync) : getDetailedSyncFleet calcule le SLA p95", async () => {
    const { getDetailedSyncFleet } = await import("@/lib/kpi/fleetQueries");
    const fleet = await getDetailedSyncFleet();

    expect(fleet.summary.totalDevices).toBe(1);
    expect(fleet.summary.activeLast24h).toBe(1);
    expect(fleet.summary.p95DurationMs).toBe(420);
    expect(fleet.summary.successRate24h).toBe(100);
    expect(fleet.devices[0].deviceName).toBe("Compta-Bureau-01");
  });

  it("4. [H4] Module Finance & Volumes (/admin/finance) : getFinancialOverview agrège le CA et l'encaissement", async () => {
    const { getFinancialOverview } = await import("@/lib/kpi/financeQueries");
    const finance = await getFinancialOverview();

    expect(finance.summary.totalInvoicedXaf).toBe(4000000); // 2.5M + 1.5M
    expect(finance.summary.totalPaidXaf).toBe(2500000); // 2.5M
    expect(finance.summary.outstandingXaf).toBe(1500000); // 1.5M restant
    expect(finance.summary.recoveryRate).toBe(62.5); // 62.5%
    expect(finance.summary.totalQuotesXaf).toBe(4800000);
    expect(finance.topTenants.length).toBe(1);
    expect(finance.topTenants[0].tenantName).toBe("SARL Alpha BTP");
  });

  it("5. [H5] Module Adoption & Funnel (/admin/adoption) : getAdoptionFunnelData calcule l'onboarding et le Health Score", async () => {
    const { getAdoptionFunnelData } = await import("@/lib/kpi/adoptionQueries");
    const adoption = await getAdoptionFunnelData();

    expect(adoption.summary.totalTenants).toBe(2);
    expect(adoption.funnelSteps.length).toBe(4);
    expect(adoption.funnelSteps[0].count).toBe(2); // 2 inscrits
    expect(adoption.funnelSteps[1].count).toBe(1); // 1 desktop connecté
    expect(adoption.funnelSteps[2].count).toBe(1); // 1 avec factures
    expect(adoption.funnelSteps[3].count).toBe(1); // 1 avec paiement
    expect(adoption.summary.globalActivationRate).toBe(50); // 1 / 2 = 50%
    expect(adoption.allTenantsHealth.length).toBe(2);
  });

  it("6. [H6] Module Audit & Sécurité (/admin/security) : getSecurityAuditLogs extrait et filtre les logs infalsifiables", async () => {
    const { getSecurityAuditLogs } = await import("@/lib/kpi/securityQueries");
    const security = await getSecurityAuditLogs();

    expect(security.summary.totalLogs).toBe(1);
    expect(security.summary.breakGlassCount).toBe(1);
    expect(security.logs.length).toBe(1);
    expect(security.logs[0].action).toBe("BREAK_GLASS_ACCESS");
    expect(security.logs[0].actorEmail).toBe("superadmin@hub.com");
  });

  it("7. [H6] Module Plans & Licences (/admin/licences) : getPlansAndLicences calcule les souscriptions et revenus", async () => {
    const { getPlansAndLicences } = await import("@/lib/kpi/licenceActions");
    const licences = await getPlansAndLicences();

    expect(licences.summary.totalPlans).toBe(1);
    expect(licences.summary.activeSubscribers).toBe(2);
    expect(licences.plans.length).toBe(1);
    expect(licences.plans[0].code).toBe("pro");
    expect(licences.plans[0].subscribersCount).toBe(1);
  });

  it("8. [H6] Module Annonces & Alertes (/admin/announcements) : getAnnouncementsAndAlerts consolide le flux opérationnel", async () => {
    const { getAnnouncementsAndAlerts } = await import("@/lib/kpi/announcementActions");
    const comms = await getAnnouncementsAndAlerts();

    expect(comms.summary.activeAnnouncements).toBe(1);
    expect(comms.summary.openAlerts).toBe(1);
    expect(comms.announcements.length).toBe(1);
    expect(comms.announcements[0].title).toBe("Maintenance Hub Cloud");
    expect(comms.alerts.length).toBe(1);
    expect(comms.alerts[0].title).toBe("Test Alert");
  });
});
