# Summary

Describe the change and the user-visible behavior.

## Context7 / Official Docs

- [ ] This change does not touch external libraries, runtimes, sync, database, build tooling, or security-sensitive APIs.
- [ ] This change touches one of those areas, and I consulted Context7 or the official/versioned fallback docs.

Documentation source:

Decision record:

## Tenant, Offline, And Sync Safety

- [ ] All local and remote data access remains scoped by `tenant_id`.
- [ ] No production runtime hard delete was introduced.
- [ ] UUID client-side IDs remain preserved for offline-first records.
- [ ] Sync or schema changes include a verification path.

## Verification

Commands run:

- [ ] `npm run quality:decisions`
- [ ] Typecheck
- [ ] Tests
- [ ] Build, when relevant

Notes:
