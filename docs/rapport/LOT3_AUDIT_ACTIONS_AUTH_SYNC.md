# RAPPORT D'AUDIT: LOT 3 - ACTIONS, AUTH, & SYNC CLOUD

Ce document fournit l'audit exhaustif des API Next.js (Server Actions), du système de sécurité (RBAC, Multi-tenant) et de la boucle de synchronisation Cloud.

## 1. Anatomie Fichier par Fichier

### 1.1 Server Actions & API
*   `apps/desktop/app/actions/audit.actions.ts` : Fetch les logs d'audit. Réservé à l'Admin.
*   `apps/desktop/app/actions/auth.actions.ts` : Gère le login, logout, récupération de session et protection Anti-BruteForce (en mémoire).
*   `apps/desktop/app/actions/client.actions.ts` : CRUD sur les Clients avec contrôles stricts de suppression si des factures impayées existent.
*   `apps/desktop/app/actions/credit-note.actions.ts` : Création et gestion des avoirs. Vérifie la licence via `assertLicenseAllowsCreation`.
*   `apps/desktop/app/actions/dashboard.actions.ts` : Construit les métriques du tableau de bord via le repository.
*   `apps/desktop/app/actions/hub.actions.ts` : Lit le cache pour afficher les annonces (Annonces & Flags).
*   `apps/desktop/app/actions/invoice.actions.ts` : CRUD des Factures. Exécute la logique de cascade (via InvoiceService) et les annulations.
*   `apps/desktop/app/actions/payment.actions.ts` : Insertion de paiements (réservé User/Admin).
*   `apps/desktop/app/actions/quote.actions.ts` : CRUD des Devis.
*   `apps/desktop/app/actions/service.actions.ts` : Catalogue de services (réservé à l'Admin).
*   `apps/desktop/app/actions/settings.actions.ts` : Mise à jour de la configuration de l'entreprise locale/tenant.
*   `apps/desktop/app/actions/setup.actions.ts` : Initialisation (First Run) de la BDD et provisioning du Cloud.
*   `apps/desktop/app/actions/sync.actions.ts` : Action manuelle déclenchant le cycle de sync `CloudSyncService.ts`.
*   `apps/desktop/app/actions/user.actions.ts` : Création de membres/opérateurs.
*   `apps/desktop/app/api/health/route.ts` : Healthcheck pour le pre-loader Electron. Doit être non-authentifié.

### 1.2 Sécurité, Auth, Licences & Validation
*   `apps/desktop/proxy.ts` : Remplace le `middleware.ts` classique. Exécute le routage et le filtrage des assets.
*   `apps/desktop/lib/api/auth.ts` : Génération et vérification des JWT de session signés via `HMAC-SHA256`.
*   `apps/desktop/lib/api/permissions.ts` : Garde simplifiée pour la vérification du propriétaire d'un document.
*   `apps/desktop/lib/api/tenant.ts` : Moteur de multi-tenant garantissant que chaque ligne lue/écrite porte le `tenant_id` actif.
*   `apps/desktop/lib/api/license.ts` : Protection de Licence. Bloque l'écriture si le statut Cloud est "expired" ou "suspended".
*   `apps/desktop/lib/api/audit.ts` : Module d'écriture des logs asynchrone (pour ne pas bloquer l'I/O).
*   `apps/desktop/lib/auth/supabaseSession.ts` : Gère l'authentification et les events Supabase côté Client.
*   `apps/desktop/lib/crypto/secretStore.ts` : Chiffre les mots de passe hors-ligne (`pending_cloud_members`) avec AES-256-GCM.
*   `apps/desktop/lib/device/deviceId.ts` : Génère un identifiant unique par appareil (Télémétrie).
*   `apps/desktop/lib/validations.ts` : Schémas Zod globaux avec validations XAF (pas de centimes, entiers uniquement).

### 1.3 Moteur de Synchronisation Cloud
*   `apps/desktop/lib/sync/CloudSyncService.ts` : Le cœur du système "Local-First". Boucle de synchronisation Push (Upsert), puis Delete (tombstones), puis Pull. Utilise `onConflict` via Supabase.
*   `apps/desktop/lib/sync/cloudMembers.ts` : File d'attente (Offline) pour synchroniser la création des Opérateurs sur Supabase Auth.
*   `apps/desktop/lib/sync/localSchema.ts` : Définit les tables à synchroniser et leurs triggers `AFTER INSERT/UPDATE/DELETE`.
*   `apps/desktop/lib/sync/TelemetryReporter.ts` : Envoie des statistiques sur le temps pris par la synchronisation et ses erreurs.

## 2. Audit des Server Actions & Typage

**Problème 1 : Typage et Validation Zod**
*   **Observation :** Les actions sont généralement bien protégées. Cependant, on trouve de nombreux `any` dans `apps/desktop/app/actions/user.actions.ts:25` (`export async function createUser(data: any)`) et `apps/desktop/app/actions/setup.actions.ts:18`.
*   **Risque :** Perte de type-safety. La validation Zod est utilisée (`userCreateSchema.safeParse(data)`), mais si une modification du schéma front passe un mauvais type, TS ne lèvera pas d'alerte lors de la refactorisation de la signature de l'action.

**Problème 2 : Utilisation silencieuse des Try/Catch**
*   **Observation :** Dans `apps/desktop/app/actions/auth.actions.ts:167`, l'appel `try { UserRepository.updateLastLogin(user.id); } catch (e) {}` avale les erreurs en silence. Pareil pour les cookies et `changeOwnPassword`.
*   **Risque :** Cela obfusque les véritables erreurs SQLite (ex: base corrompue) en production.

**Problème 3 : Accès direct Repository vs Session dans Dashboard**
*   **Observation :** `dashboard.actions.ts:40`
    `const totalRevenue = MetricsRepository.getTotalRevenue(session.userId, session.role, pDateFilter, activeTenantId);`
*   **Détail :** Le `pDateFilter` injecte un fragment SQL de façon purement textuelle (`"strftime('%Y-%m', p.date) = strftime('%Y-%m', 'now')"`). Bien qu'il soit contrôlé par Zod localement (`validatedRange`), passer des strings SQL raw depuis le contrôleur jusqu'au DAL est une violation de la sécurité (SQL Injection Pattern) si jamais l'enum venait à être étendu sans vigilance.

## 3. Audit du Doublon `middleware.ts` vs `proxy.ts`

*   **Diagnostic du doublon :** Il n'y a pas de duplication réelle. Le fichier `apps/desktop/middleware.ts` a été supprimé ou renommé. À la place, il existe `apps/desktop/proxy.ts` qui se termine par `export const middleware = proxy;`.
*   **Latence de sécurité :** Le proxy de Next.js exécute `getSession(sessionCookie.value, SESSION_SECRET)` sur *toutes* les requêtes (API et UI). La vérification HMAC de la session (opérations cryptographiques `crypto.subtle.verify`) induit un overhead CPU léger sur chaque action. De plus, il intercepte les routes avec des strings en dur (`matchRoute`).
*   **Ciblage :** Il utilise un RegExp `STATIC_ASSET_REGEX` pour exclure certains assets, mais c'est moins performant que d'utiliser massivement le système de `matcher` natif Next.js (`config = { matcher: [...] }`).

## 4. Audit de CloudSyncService.ts (Latence et Conflits)

**Problème 4 : Exécution séquentielle bloquante (5-8 secondes)**
*   **Fichier:Ligne :** `apps/desktop/lib/sync/CloudSyncService.ts` (Ligne 466)
    ```typescript
    for (const cfg of SYNC_TABLES) {
      await pushTable(sb, cfg, ctx.tenantId, report);
    }
    // Suivi d'un autre for loop similaire pour le pull
    ```
*   **Impact Perf :** L'action parcourt itérativement les 11 tables pour le *Push*, puis itérativement pour le *Pull*. Si la latence de base de Supabase est de 200ms, `11 tables * 2 passes * 200ms = 4.4 secondes` de temps d'attente réseau inévitable, et ceci sans compter les timeouts. Cela explique la latence élevée.
*   **Risque LWW / Conflit :** La logique LWW (Last-Write-Wins) se base sur `updated_at > synced_at`. S'il y a un décalage d'horloge serveur (`measureClockDrift`), il affiche un avertissement, mais n'ajuste pas les horodatages lors du `INSERT ON CONFLICT`, ce qui peut causer l'écrasement de données récentes par des données plus vieilles d'un autre poste.

**Gestion des Suppressions Logiques :**
*   L'action utilise `sync_tombstones`. Lorsqu'une suppression *physique* est faite localement (ce qui arrive rarement car l'app privilégie le soft-delete `deletedAt`), un trigger sqlite ajoute le rowId aux tombstones, qui lance un `DELETE` asynchrone sur Supabase (Ligne 319 : `await sb.from(cfg.remote).delete()`). C'est propre, mais sujet aux conflits si le distant a été modifié entre temps.

## 5. Feuille de Route en 3 Plans

### PLAN CORRECTIF (Bugs & Failles)
*   **Action : Types stricts et Injection SQL (Dashboard)**
    Remplacer les `any` dans `user.actions.ts` et `setup.actions.ts` par les types Zod extraits (`z.infer<typeof userCreateSchema>`).
    Dans `dashboard.actions.ts`, au lieu de construire des chaînes SQL, le `MetricsRepository` doit accepter un Enum `enum Range { MONTH, QUARTER, YEAR }` et construire le paramétrage de façon interne et sécurisée (Prepared Statements strictes).

### PLAN CURATIF (Middleware & Architecture)
*   **Action : Optimiser `proxy.ts` (Middleware)**
    Améliorer le paramètre `matcher` dans `proxy.ts` pour exclure totalement les images et les polices depuis l'infrastructure Edge (ex: `matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']`), afin d'éviter le parse HMAC du JWT pour des requêtes statiques (allégeant le Main Thread de l'App Router).

### PLAN PRÉVENTIF (Synchronisation Non-Bloquante)
*   **Action : Sync Parallèle et Websockets**
    Modifier `CloudSyncService.ts` pour traiter les tables sans relation de clé étrangère (ex: `clients`, `services`, `settings`) en `Promise.all()` (parallélisation), réduisant le temps total par le facteur de parallélisme.
    *Extrait conceptuel (CloudSyncService)* :
    ```typescript
    // Grouper les tables sans dépendance
    const parallelTables = SYNC_TABLES.filter(c => !c.local.includes('items'));
    await Promise.all(parallelTables.map(cfg => pushTable(sb, cfg, ctx.tenantId, report)));
    // Ensuite les items
    ```
    Ne plus utiliser un `setInterval` agressif dans l'UI (comme vu dans le lot 1), mais utiliser le service Realtime de Supabase (Websocket) pour déclencher la fonction Server Action de Push/Pull de façon sélective uniquement lorsqu'un évènement de mise à jour l'exige.