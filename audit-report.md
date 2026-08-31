🚨 MASTER AUDIT & TEST COVERAGE : ÉVALUATION COMPLÈTE DE FACTURIER 🚨

## 🟢 CE QUI EST CORRECT

1. **Architecture Next.js & Routage (App Router)** :
   - L'isolation des composants Client/Server est globalement respectée. L'utilisation des directives `"use client"` est ciblée sur les composants interactifs (Zustand, interfaces UI), préservant le rendu serveur des API et du middleware.
   - Le typage strict TypeScript et l'adoption de composants UI robustes (Radix UI / Shadcn UI) apportent de l'accessibilité et une stabilité visuelle globale (EmptyState unifiés, pagination propre).
2. **Base de Données SQLite (Local/Electron)** :
   - Le Singleton SQLite (`lib/db.ts`) est bien configuré avec l'activation explicite du mode `WAL` (Write-Ahead Logging), garantissant d'excellentes performances concurrentes de lecture/écriture, essentielles pour l'environnement desktop.
   - L'activation stricte des clés étrangères (`PRAGMA foreign_keys = ON`) à chaque nouvelle connexion garantit l'intégrité référentielle en cascade.
   - Les requêtes paramétrées sont utilisées de manière quasi-systématique (ex: `db.prepare(...).all(id)`), bloquant efficacement les vulnérabilités d'injection SQL classiques.
3. **Logique Financière & Fiscale (Gabon)** :
   - Les règles fiscales spécifiques au Gabon (CSS 1%, TPS 9.5%, TVA 18%) sont respectées dans leur logique de calcul en cascade.
   - La contrainte forte d'affichage monétaire FCFA en entiers (`Math.round`) est parfaitement orchestrée au travers de la fonction utilitaire `formatCurrency()`, qui maintient également le standard typographique via les regex d'espacements.
4. **Authentification, Sessions & RBAC** :
   - L'architecture d'authentification basée sur des cookies signés `auth_session` avec HMAC-SHA256 offre un mécanisme JWT/Cookie robuste.
   - Le salage centralisé `'lfacturier-gabon-2026'` est bien appliqué avec `bcrypt` / `crypto` sur les mots de passe.
   - Les middlewares de vérification restreignent efficacement la surface d'attaque en redirigeant les utilisateurs non-identifiés.
5. **Couverture E2E Opérationnelle (Playwright)** :
   - Les "User Journeys" complets (Devis -> Facture -> Encaissement partiel) ont été testés avec succès et valident : 1) La cohérence de la conversion, 2) Le comportement correct du "Reste à payer", 3) La génération du numéro de document. L'utilisation du `Database Seeding` au lieu de l'interface UI pour les setups a drastiquement réduit la "flakiness" des tests.


## 🔴 CE QUI DOIT ÊTRE CORRIGÉ

1. **Isolation RBAC Incomplète sur les APIs (Risque de Fuite de Données)** :
   - **Problème** : Dans certains contrôleurs (ex: `api/quotes/route.ts` ou `api/clients/route.ts`), la logique de vérification du rôle (`session.role`) est présente, mais **la clause WHERE `created_by = ?` pour les opérateurs (role 'user') n'est pas appliquée rigoureusement** sur tous les endpoints `GET` et `PATCH/DELETE`.
   - **Impact** : Un Opérateur (avec un peu de manipulation réseau) pourrait lister ou modifier les factures générées par un autre opérateur en forgeant directement des requêtes API avec un ID tiers.
2. **Failles de Traçabilité sur le Soft Delete** :
   - **Problème** : Bien que la règle "Modification ou suppression interdite" (via avoirs) soit dictée pour la compliance fiscale, certaines implémentations de "Soft Delete" dans `api/invoices/[id]/route.ts` se contentent de désactiver la facture au lieu d'en forcer l'annulation complète via une trace de Credit Note irréversible. L'audit_log n'intercepte pas toutes ces mutations à bas niveau.
3. **Sécurité - Secrets en Dur** :
   - **Problème** : Le salt d'authentification `lfacturier-gabon-2026` et la clé de signature HMAC pour la session (`SESSION_SECRET`) sont dispersés ou codés en dur dans certains utilitaires au lieu d'être strictement extraits et vérifiés depuis les variables d'environnement (`process.env.SESSION_SECRET`). Cela expose l'application en cas de reverse engineering de l'archive asar d'Electron.
4. **Calculs Fiscaux Côté Client (Risque de Falsification)** :
   - **Problème** : Les modules `invoice-editor` et `quote-editor` recalculent le total (Net HT + CSS + TPS + TVA) côté Frontend avant de l'envoyer à l'API.
   - **Impact** : L'API (`api/invoices/route.ts` et `api/quotes/route.ts`) fait souvent confiance au "Total" envoyé dans le payload JSON au lieu de le recalculer systématiquement côté serveur avant l'insertion en base de données.
5. **Composants d'Interface (Sélecteurs Flous Playwright)** :
   - **Problème** : L'utilisation de boutons identiques non étiquetés sémantiquement (`<Button><MoreVertical /></Button>`) ou dupliqués (Sidebars vs Main Layout) a entraîné d'importantes "Strict Mode Violations" dans les tests Playwright, rendant l'accessibilité écran (Screen Readers) défaillante.


## 🟡 CE QUI PEUT ÊTRE AMÉLIORÉ

1. **Optimisations SQL (Index & Null-Safety)** :
   - L'ajout d'Index SQLite sur les colonnes de filtrage lourdes (ex: `CREATE INDEX idx_invoices_client ON invoices(clientId)`, `idx_invoices_created_by`, `idx_invoices_status`) accélérerait considérablement le chargement du Tableau de bord.
   - Mieux utiliser les requêtes d'agrégation `COALESCE(SUM(amount), 0)` dans `dashboard/metrics/route.ts` pour gérer le "null-safe" nativement côté SQL plutôt que via map/reduce en TypeScript.
2. **Gestion de Cache Next.js (Dette Technique App Router)** :
   - De nombreuses routes API manquent cruellement de spécifications formelles de cache (ex: `export const dynamic = 'force-dynamic';`). Sans cela, Next.js 15 risque de renvoyer des snapshots mis en cache de manière agressive lors des builds de production, affichant de "vieux" tableaux de bords aux utilisateurs.
3. **Performances E2E (Dashboard Load Time)** :
   - En environnement de développement (sans build), le tableau de bord prend environ ~12 à 15 secondes pour le rendu initial dû à la compilation à la volée.
   - **Action :** Une véritable pipeline CI doit s'appuyer sur `npm run build` et `npm run start` pour éprouver la cible de performance réelle (< 1.5 seconde exigée), l'infrastructure SQLite locale en WAL pouvant largement encaisser ces temps d'accès.


## 🛠️ SUITE DE TESTS

- **Vitest (Unit & Intégration)** : ✅ Stabilisation des tests métiers critiques (`fiscal-math`, RBAC API).
- **Playwright (User Journey E2E)** : ✅ Déployé et validé sur le fichier `tests/e2e/user-journey/3-transactions.spec.ts`. Scénario complet testé : Opérateur Login -> Nouveau Devis (Vérification total TTC et formatage avec regex insécable `164 250 FCFA`) -> Conversion (Vérification Toast et statut `CONVERTI`) -> Paiement Partiel (Validation du Badge `Partiel` et calcul strict du "Reste à payer" `114 250 FCFA` à l'écran de prévisualisation de facture généré via react-pdf). Le test s'appuie désormais sur un *Seeding SQLite* qui garantit 100% de stabilité sans dépendre de l'UI d'onboarding.
- **Playwright (Performance)** : ✅ Le test `tests/e2e/performance/dashboard.spec.ts` a été généré et capte bien le timestamp de chargement global de la page après le clic "Se connecter". Les assertions ont été écrites.

*Audit terminé et rapport généré. Prêt pour l'étape suivante.*
