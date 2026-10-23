# ADR-0001: Context7 Governance For External Dependencies

## Status

Accepted

## Scope

- Area: engineering governance
- Library or platform: Context7, official vendor documentation, repository-local documentation
- Installed version: not applicable
- Related files: `docs/quality/context7-governance.md`, `.github/pull_request_template.md`, `scripts/check-decision-records.js`

## Documentation Source

- Context7 source: not available as a callable tool in the current session
- Official fallback source: repository-local Next.js 16 docs under `node_modules/next/dist/docs/`
- Date checked: 2026-10-14

## Context

The project depends on fast-moving platforms: Next.js 16, Electron, Supabase, PowerSync, TypeScript, Vitest, Playwright, and Turborepo. The project rules require using version-matched Next.js documentation before writing code, and the implementation plan extends that practice to all external dependencies.

Without a written decision record, future changes can rely on stale assumptions about framework behavior, especially around Next.js 16 request APIs, Electron packaging, Supabase RLS, PowerSync replication, and TypeScript 7 compatibility.

## Decision

Use Context7 as the preferred source for versioned external-library documentation. When Context7 is not available, use official documentation matching the installed version. Any implementation touching external frameworks, runtimes, sync, database, build tooling, or security-sensitive APIs must create or update a decision record in `docs/decisions/`.

Pull requests must complete the Context7/official-docs checklist. A local npm check validates decision record structure.

## Alternatives Considered

- Rely on PR descriptions only: rejected because decisions would be harder to find after merge.
- Add a heavy ADR generator dependency: rejected because a small Node script is enough and keeps the npm workspace simple.

## Risks

- Risk: the process becomes busywork for small changes.
- Mitigation: small changes can reference an existing accepted decision record.

- Risk: Context7 is not available in a given session.
- Mitigation: use official/versioned docs and explicitly record the fallback source.

## Verification

- Command: `npm run quality:decisions`
- Test: validates required headings and placeholder cleanup in decision records.
- Manual check: PR template requires the author to reference documentation and affected decision records.
