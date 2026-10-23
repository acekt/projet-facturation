<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Contexte du Projet Facturier (Hub & Spoke)

L'intégralité du contexte architectural et des directives strictes de développement se trouve dans le fichier `.antigravity` situé à la racine du projet. Ce projet est structuré comme un **Monorepo** avec Turborepo. 

Toutes les IA (Claude, Cursor, Antigravity) doivent obéir aux règles suivantes :
1. **Architecture** : Le projet est un monorepo contenant le client lourd (`apps/desktop`) et des paquets partagés (`packages/ui`, `packages/database`).
2. **Synchronisation** : Architecture Local-First basée sur SQLite local répliqué vers Supabase Cloud via **PowerSync**.
3. **Multi-Tenancy** : Isolation rigoureuse des données. Toutes les tables et requêtes filtrent par `tenant_id`.
4. **Offline-First** : IDs primaires en UUIDv4 et "Soft Delete" obligatoire (`deletedAt`) pour garantir la synchronisation.

Consulte le fichier `.antigravity` pour le détail de la stack technique, les normes UI/UX et la logique métier.

## Regle Context7 / Documentation Versionnee

Avant toute implementation qui touche Next.js, Electron, Supabase, PowerSync, SQLite, Turborepo, Vitest, Playwright, TypeScript ou une API sensible de securite/synchronisation, consulte Context7. Si Context7 n'est pas disponible dans la session, utilise la documentation officielle/versionnee la plus proche. Pour Next.js, utilise en priorite `node_modules/next/dist/docs/`.

Toute decision technique structurante doit creer ou mettre a jour une fiche dans `docs/decisions/` et passer `npm run quality:decisions`.
