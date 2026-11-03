# ADR-0052: Desktop Server Actions Non-Async Value Exports Guard

## Status

Accepted

## Scope

- Area: `apps/desktop` Server Actions & Validation Layer
- Library or platform: Next.js 15 App Router, React 19, Zod
- Installed version: Next.js 15.2.x, React 19.0.0
- Related files: `apps/desktop/app/actions/*.ts`, `apps/desktop/lib/validations/*.ts`, `scripts/check-desktop-health.mjs`

## Documentation Source

- Context7 source: `/vercel/next.js` (Server Actions Directive Specification & Action Manifest Compilation)
- Official fallback source: `node_modules/next/dist/docs/`
- Date checked: 2026-11-03

## Context

In Next.js 15 App Router, any file marked with the module-level `"use server"` directive is treated as a Server Action endpoint collection. Next.js compiler generates an Action Manifest where each exported value is expected to be an asynchronous server-callable function.

When non-async values (such as Zod schemas: `export const ledgerEntryCreateSchema = z.object(...)`) were exported directly from a `"use server"` module (`apps/desktop/app/actions/ledger.actions.ts`), the Next.js runtime crashed during the initial page POST resolution with `POST / 500 (digest: 3428024997)`.

Because the root page crashed during server-side resolution, React never mounted in the browser/Electron renderer, and the `app:report-ready` IPC message was never transmitted. This cascaded into Electron hitting its 45-second safety splash timeout before displaying a blank/crashed window.

## Decision

1. **Extraction of Validation Schemas**: All Zod validation schemas used by Server Actions must reside in dedicated schema files under `apps/desktop/lib/validations/` (e.g. `apps/desktop/lib/validations/ledger.ts`).
2. **Type Re-exports Only**: Server Action files may only re-export TypeScript types (`export type { ... }`), which are erased at compile-time and do not generate value entries in the Next.js Action Manifest.
3. **Automated Preventive Health Guard**: Extend `scripts/check-desktop-health.mjs` to systematically inspect every file under `apps/desktop/app/actions/*.ts` containing `"use server"`. Any occurrence of `export const`, `export let`, `export var`, `export class`, or synchronous `export function` fails the check immediately.
4. **Tenant ID Narrowing**: Enforce strict early-return null-checks on `resolveActiveTenantId()` within server action handlers before delegating to repositories, preventing invalid undefined tenant lookups.

## Alternatives Considered

- *Inline schema definitions inside Server Action functions*: Rejected because client components (e.g. dialogs and forms) need to share the exact same schema for client-side form validation before submitting.
- *Relying only on runtime try/catch*: Rejected because Action Manifest generation occurs at compile-time / router initialization before action invocation, crashing Next.js internally.

## Risks

- *Developer introduces a new Server Action exporting helper utilities or constants*:
  - *Mitigation*: The static health guard in `scripts/check-desktop-health.mjs` runs on every pre-commit and CI quality check (`npm run quality:desktop-health`), preventing any non-compliant code from being committed.

## Verification

- Command: `node scripts/check-desktop-health.mjs` (confirms 100% of Server Actions obey the export rule).
- Command: `npm run typecheck` (validates TypeScript types across the entire monorepo).
- Command: `npm run quality:decisions` (validates that ADR-0052 conforms to governance guidelines).
- Test: Vitest test suite in `apps/desktop` passing.

