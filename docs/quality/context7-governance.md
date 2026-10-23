# Context7 Governance

This project uses a documentation-first rule for implementation decisions that depend on external libraries or platform behavior.

Context7 is the preferred source for versioned library documentation. If Context7 is not available in the current agent session, use the closest official/versioned source instead:

- Next.js: `node_modules/next/dist/docs/` from the installed package.
- Supabase: official Supabase docs for the installed SDK and SQL/RLS behavior.
- PowerSync: official PowerSync docs for the installed client packages.
- Electron: official Electron docs for the installed major version.
- Turborepo, Vitest, Playwright, TypeScript: official docs matching the installed major version.

## Required Rule

Before implementing a change that touches an external framework, runtime, sync engine, database platform, build tool, or security-sensitive API, create or update a decision record in `docs/decisions/`.

The decision record must state:

- the library or platform involved;
- the installed version or version range;
- the documentation source consulted;
- the implementation decision;
- the risks and verification steps.

Small changes that only touch local copy, styling, or code already covered by an existing decision record can reference the existing record in the PR instead of creating a new one.

## Pull Request Gate

Every PR must answer the Context7/official-docs checklist in `.github/pull_request_template.md`.

Run this local check before review:

```bash
npm run quality:decisions
```

This check validates that decision records keep the expected structure and do not keep template placeholders.

## Current Priority Areas

Use a decision record before changing:

- Next.js 16 App Router, Server Actions, Cache Components, Turbopack or Webpack settings.
- Electron preload, IPC, ASAR packaging, native modules, or printing/export flows.
- Supabase Auth, SSR, RLS, RPCs, migrations, or storage.
- PowerSync schemas, upload queues, conflict handling, or replication behavior.
- SQLite schema, tenant isolation, soft delete, or offline-first data flow.
