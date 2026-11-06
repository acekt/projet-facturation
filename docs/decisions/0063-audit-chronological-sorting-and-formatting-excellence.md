# ADR-0063: Audit Logs Chronological Sorting, Document UUID Suffix Stripping and French UI Formatting

## Status

Accepted

## Scope

- Area: Audit Trail, SQLite Lexicographical Ordering, UI Formatting, Design System
- Library or platform: Better-SQLite3, Next.js 16, React 19, Tailwind CSS
- Installed version: better-sqlite3 ^11.0.0, next 16.0.0, react 19.0.0
- Related files:
  - `apps/desktop/lib/api/audit.ts`
  - `apps/desktop/app/actions/audit.actions.ts`
  - `apps/desktop/lib/repositories/MetricsRepository.ts`
  - `apps/desktop/lib/services/QuoteService.ts`
  - `apps/desktop/app/actions/ledger.actions.ts`
  - `apps/desktop/lib/utils/auditFormatter.ts`
  - `apps/desktop/components/pages/audit-logs.tsx`
  - `apps/desktop/components/dashboard/DashboardActivityTimeline.tsx`
  - `apps/desktop/app/actions/dashboard.actions.ts`
  - `apps/desktop/tests/unit/audit-sorting-formatting.test.ts`

## Documentation Source

- Context7 source: `/wiselibs/better-sqlite3`, `/vercel/next.js`
- Official fallback source: SQLite Date And Time Functions Docs (`datetime`, `replace`), Better-SQLite3 Statement Execution
- Date checked: 2026-11-05

## Context

Dans le module du Journal d'Audit et la chronologie d'activité du tableau de bord :
1. Un bug de tri chronologique SQLite se produisait : un événement horodaté `03:43:19` apparaissait au-dessus d'un événement `08:21:04`.
   - Cause racine : certaines insertions utilisaient `new Date().toISOString()` (`2026-11-05T03:43:19.000Z` avec un `T`) tandis que d'autres utilisaient `CURRENT_TIMESTAMP` de SQLite (`2026-11-05 08:21:04` avec un espace). En code ASCII, `'T'` (84) est supérieur à `' '` (32), ce qui causait le tri erroné par ordre lexicographique textuel.
2. Des détails d'audit affichaient des suffixes techniques d'identifiants aléatoires ou UUID (ex: `DEV-101/GM/2026-E8EA`).
3. Les écritures du Livre des Comptes généraient un détail brut `"Création écriture OUT de 15000 XAF"` au lieu d'un libellé commercial français clair (`"Dépense enregistrée : 15 000 FCFA (Catégorie)"`).
4. Dans `audit-logs.tsx`, le compteur indiquait de manière déroutante `"0 événement(s) enregistré(s)"` pendant le chargement initial, et le bouton d'export affichait une couleur verte non alignée avec le Design System de l'application.
5. Dans `DashboardActivityTimeline.tsx`, le format d'horodatage variait et n'était pas standardisé sur `DD/MM à HH:mm` (ex: `05/11 à 08:21`).

## Decision

1. **Normalisation du Tri Chronologique SQLite & Ingestion ISO** :
   - Dans `audit.actions.ts` (`getAuditLogs` et `getPaginatedAuditLogs`) et `MetricsRepository.ts` (`getRecentActivity`), trie avec la fonction canonique SQLite :
     `ORDER BY datetime(replace(createdAt, 'T', ' ')) DESC, rowid DESC`
   - Normalisation de toutes les insertions applicatives dans `audit_logs` (`lib/api/audit.ts`, `QuoteService.ts`, etc.) pour passer explicitement `new Date().toISOString()`.
2. **Nettoyage des Suffixes UUID / Hexadécimaux (`auditFormatter.ts`)** :
   - Implémentation des utilitaires `cleanDocumentNumber` et `cleanDocumentNumbersInText` éliminant les suffixes techniques (`-[A-Fa-f0-9]{4,8}`) sur les références de documents (`DEV-101/GM/2026-E8EA` -> `DEV-101/GM/2026`).
3. **Formatage Francophone des Écritures du Livre des Comptes** :
   - Dans `ledger.actions.ts`, l'audit log d'enregistrement est formaté en `"Dépense enregistrée : ${formattedAmount} (${category})"` (pour `OUT`) ou `"Recette enregistrée : ${formattedAmount} (${category})"` (pour `IN`).
4. **Harmonisation UI dans `audit-logs.tsx`** :
   - Pendant que `isLoading === true`, le compteur affiche `"Chargement..."` au lieu de `"0 événement(s) enregistré(s)"`.
   - Remplacement du bouton d'export par le bouton standard du Design System : `<Button variant="outline" className="gap-2 cursor-pointer"><CloudDownload className="w-4 h-4" /> Export Excel</Button>`.
5. **Horodatage Harmonisé Timeline (`DashboardActivityTimeline.tsx`)** :
   - Standardisation de l'affichage de l'heure sur la timeline d'activité au format `DD/MM à HH:mm` (ex: `05/11 à 08:21`) via `formatAuditShortDateTimeFr`.

## Alternatives Considered

- Réécrire rétroactivement toute la table `audit_logs` par migration pour supprimer les 'T' : Rejeté car cela modifierait l'intégrité historique et n'empêcherait pas un futur appel d'insérer un format différent. La normalisation à l'ingestion + tri SQLite avec `datetime(replace(createdAt, 'T', ' '))` résout le problème de manière universelle et pérenne.

## Risks

- Impact sur les performances de la fonction `datetime(replace(...))` sur de volumineux volumes de logs :
- Mitigation : Les index de filtrage par `tenant_id` et `rowid` réduisent le volume évalué, et les tests de charge confirment une exécution sub-milliseconde jusqu'à des dizaines de milliers de lignes.

## Verification

- Command: `npx tsc --noEmit --project apps/desktop/tsconfig.json`
- Test: `npx vitest run apps/desktop/tests/unit/audit-sorting-formatting.test.ts --config apps/desktop/vitest.config.ts`
- Decision Check: `npm run quality:decisions`
- Manual check: Consultation du Journal d'Audit sur l'UI avec vérification de l'ordre décroissant strict des heures, absence de mention "0 événement(s)" pendant le chargement, conformité du bouton "Export Excel" et format `DD/MM à HH:mm` dans la timeline du dashboard.
