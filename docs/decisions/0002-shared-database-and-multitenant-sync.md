# ADR-0002: Shared Database Package And Local-First Multi-Tenant Sync

## Status

Accepted

## Scope

- Area: monorepo architecture, shared domain contracts, local SQLite multi-tenant isolation, and Supabase synchronization
- Library or platform: Turborepo (`v2.x`), TypeScript (`v5.x` / `v7.x`), `better-sqlite3` (`^12.10.0`), `@supabase/supabase-js` (`^2.117.3`)
- Installed version: `better-sqlite3@^12.10.0`, `@supabase/supabase-js@^2.117.3`, `next@^16.4.0`
- Related files: `packages/database/package.json`, `packages/database/src/index.ts`, `apps/desktop/lib/db.ts`, `apps/desktop/lib/sync/CloudSyncService.ts`, `apps/desktop/lib/api/auth.ts`, `supabase/migrations/20261013_desktop_sync.sql`

## Documentation Source

- Context7 source: `/vercel/turborepo` (Internal TypeScript packages and `exports` patterns)
- Official fallback source: `node_modules/next/dist/docs/` and Supabase RLS / PostgreSQL conflict handling documentation
- Date checked: 2026-10-19

## Context

The project rules (`.antigravity` §3, §4, §5) require:
1. Centralizing shared database contracts (prefixed with `I`, e.g., `IUser`, `IInvoice`, `IClient`) and Gabonese fiscal calculation logic inside `packages/database` (`@workspace/database`) so both `apps/desktop` and `apps/web-hub` consume a single source of truth.
2. Enforcing strict multi-tenant data isolation (`tenant_id`) across both remote PostgreSQL (Supabase RLS) and local SQLite (`better-sqlite3`), alongside mandatory soft deletes (`deletedAt`) and UUIDv4 primary keys.
3. Preventing synchronization failures when multiple offline Desktop stations generate document numbers (`FAC-001/CODE/2026`) concurrently within the same tenant.

## Decision

1. **Just-In-Time Internal Package (`@workspace/database`)**:
   - Configure `packages/database/package.json` using the Turborepo Just-in-Time TypeScript package pattern (`exports` pointing to `./src/*.ts`) and add `@workspace/database` to `transpilePackages` in `apps/desktop` and `apps/web-hub`.
   - Export canonical `I*` interfaces (`IUser`, `ITenant`, `IClient`, `IService`, `IQuote`, `IQuoteItem`, `IInvoice`, `IInvoiceItem`, `IPayment`, `ICreditNote`, `ICreditNoteItem`, `ISettings`, `IAuditLog`, `IDashboardMetrics`) and pure Gabonese DGI fiscal helpers (`calculateFiscalCascade`, `computeTotals`, `computeItemTotal`, `formatDocNumber`).

2. **End-to-End Local `tenant_id` Isolation**:
   - Persist `tenantId` in the signed Desktop `auth_session` cookie and resolve a deterministic fallback `tenant_id` (`default-tenant` or user's assigned `tenant_id`) when operating offline before initial Cloud provisioning.
   - Enforce `tenant_id` filtering in SQLite queries and automatically populate `tenant_id` on local inserts. When the Desktop first provisions a tenant in Supabase, migrate any local records tagged with the local pre-provisioning tenant ID to the canonical Cloud `tenant_id`.

3. **Resilient Cloud Sync & Document Numbering Conflict Resolution**:
   - Normalize timestamps to ISO-8601 UTC and ensure `dueDate` is persisted on invoice creation and quote conversion.
   - Handle PostgreSQL unique constraint violations (`23505` on `uq_quotes_tenant_number`, `uq_invoices_tenant_number`, `uq_credit_notes_tenant_number`) during `CloudSyncService.pushTable` by automatically assigning the next available document number for the tenant and recording an audit trail entry.

## Alternatives Considered

- Keep types only inside `apps/desktop/lib/types/api.ts`: rejected because `apps/web-hub` needs the same domain and fiscal contracts, and `.antigravity` mandates `packages/database`.
- Let duplicate document numbers fail the entire table sync batch: rejected because a single collision between two offline operators would block all subsequent invoices from syncing.

## Risks

- Risk: Existing unit and integration tests in `apps/desktop/tests/` seed data without a `tenant_id` or session `tenantId`.
- Mitigation: Use a unified tenant helper (`resolveActiveTenantId`) that matches either the session's `tenantId` or legacy `tenant_id IS NULL` rows belonging to the current tenant context, ensuring 100% backward compatibility with existing tests while isolating distinct tenants.

## Verification

- Command: `npm run quality:decisions`
- Test: Vitest unit and integration tests for `@workspace/database`, multi-tenant SQLite isolation, and `CloudSyncService` conflict resolution.
- Manual check: Verify `apps/desktop` and `apps/web-hub` resolve `@workspace/database` imports cleanly.
