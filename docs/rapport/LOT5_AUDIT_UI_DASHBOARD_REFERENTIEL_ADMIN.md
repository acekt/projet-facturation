# RAPPORT D'AUDIT: LOT 5 - DASHBOARD, RÉFÉRENTIELS, ADMIN & SETUP

Ce document fournit l'audit exhaustif en lecture seule du Tableau de Bord, de la navigation globale, des référentiels (Clients/Services), de l'administration et du parcours de configuration de l'application Facturier.

## 1. Inventaire des Boutons Inactifs & Actions Fantômes

**Problème 1 : Bouton de mise à jour système inopérant post-téléchargement**
*   **Fichiers & Lignes** : `apps/desktop/components/features/settings/UpdateManager.tsx` (Lignes 146 & 259)
*   **Diagnostic** : Lorsque le statut passe à `downloaded` (Ligne 245), le bouton `Redémarrer et Installer` est affiché et déclenche `handleInstall`. Cependant, à la ligne 146, le gestionnaire `handleInstall` tente d'appeler `window.electron.updater.install()` ce qui est théoriquement correct, mais si une erreur silencieuse s'y produit (ex: droits administrateur requis sur Windows), seul `setStatus('error')` est défini sans mécanisme de retry clair.

**Problème 2 : Modale de déconnexion bloquante en erreur**
*   **Fichier & Lignes** : `apps/desktop/components/layout/navigation.tsx` (Lignes 108 & 319)
*   **Diagnostic** : Dans la `Sidebar`, si `handleConfirmLogout` lève une erreur (ex: Supabase timeout), le `catch (e)` loggue simplement un warning mais définit `setUser(null)` brutalement puis redirige via `window.location.href = '/login'`. Bien que ce soit une fallback robuste, la variable d'état `isLoggingOut` n'est jamais remise à `false`, laissant la modale (qui n'est d'ailleurs jamais fermée explicitement avec `setShowLogoutDialog(false)`) visuellement bloquée en cas de blocage navigateur.

**Problème 3 : Setup Wizard - Forme Juridique personnalisée "fantôme"**
*   **Fichier & Lignes** : `apps/desktop/app/setup/components/StepIdentity.tsx` (Ligne 139)
*   **Diagnostic** : Lors du Setup de l'Entreprise, si l'utilisateur choisit "Autre" pour la forme juridique, le state `isCustomLegalForm` passe à `true` et un `Input` apparait. Toutefois, si l'utilisateur saisit une valeur puis clique sur un autre bouton (ex: "SARL"), la valeur `legalForm` est écrasée (Ligne 271 de `useSetupWizard.ts`) mais la valeur custom précédemment saisie disparait dans les limbes de l'UI.

## 2. Impact Mémoire : `command-menu.tsx` et `navigation.tsx`

**Problème 4 : O(N) Array Mapping dans le rendu de CommandMenu**
*   **Fichier & Lignes** : `apps/desktop/components/layout/command-menu.tsx` (Lignes 58-73)
*   **Diagnostic** : Le composant récupère l'INTÉGRALITÉ des tableaux `invoices`, `clients`, et `services` depuis le store Zustand via `useStore`. Sur chaque frappe clavier (`search`), React exécute trois opérations `.filter().slice(0,5)` sur des tableaux potentiellement immenses (ex: 15 000 factures).
    *   **Impact** : Saturation RAM du processus Renderer Chromium (Memory Bloat) + Jank sévère de l'interface (perte de frames) au-delà de 2 000 entités. Ce composant devrait interroger SQLite via une Server Action paginée et indexée (`SELECT ... LIMIT 5`), avec un **debounce** de 300ms.

**Problème 5 : Calcul coûteux réactif dans la Sidebar**
*   **Fichier & Lignes** : `apps/desktop/components/layout/navigation.tsx` (Lignes 92-100)
*   **Diagnostic** : Les compteurs de badges (`unpaidCount`, `pendingQuotesCount`, `activeCreditNotesCount`) itèrent en O(N) sur l'intégralité du store Zustand à chaque re-render (lors d'un survol ou d'une navigation). Bien que protégés par `React.useMemo`, la dépendance (le tableau entier) change à chaque synchro ou modification, forçant le thread principal à bloquer.

## 3. Audit du Dashboard, Clients/Services et Admin

**Problème 6 : Incohérences Dashboard Admin vs Opérateur**
*   **Fichiers comparés** : `admin.tsx` (Lignes 211-253) vs `user.tsx` (Lignes 182-212)
*   **Diagnostic** : Le dashboard Admin (`admin.tsx`) propose 3 options temporelles ("30 jours", "Trimestre", "Année") pour observer le Chiffre d'Affaires. Le dashboard Opérateur (`user.tsx`) appelle en dur `getDashboardMetrics('month')` au montage (Ligne 69) et ne propose aucun sélecteur pour changer la vue, ce qui frustre l'utilisateur (le composant graphique attend pourtant la props, mais les filtres n'existent pas).

**Problème 7 : Validation défaillante dans le référentiel Services**
*   **Fichier & Lignes** : `apps/desktop/components/pages/services.tsx` (Lignes 111-125)
*   **Diagnostic** : Bien que `isSubmitting` bloque un double-clic, la validation de `formData.unitPrice < 0` est faite en front. Or, `unitPrice` peut être passé comme texte vide (`""` implicite via Input s'il n'est pas typé text avec fallback). Le schéma Zod (`serviceUpdateSchema`) réclame un entier, mais l'erreur est écrasée localement.

**Problème 8 : Pagination Audit Logs Trompeuse**
*   **Fichier & Lignes** : `apps/desktop/components/pages/audit-logs.tsx` (Lignes 22 & 66)
*   **Diagnostic** : L'action API renvoie `LIMIT 100` en dur (Ligne 13 dans `audit.actions.ts`). La page gère une pagination front-end sur ces 100 éléments. Si l'application a 50 000 logs, l'utilisateur ne verra jamais la page 11 (logs au-delà des 100 premiers). La pagination devrait être gérée côté serveur avec `LIMIT` et `OFFSET`.

## 4. Feuille de route en 3 plans

### PLAN CORRECTIF (Bugs fonctionnels)
*   **Réparer la déconnexion** : Dans `navigation.tsx`, ajouter un bloc `finally { setIsLoggingOut(false); setShowLogoutDialog(false); }` pour libérer l'UI en cas d'échec réseau Supabase.
*   **Corriger les filtres Dashboard User** : Aligner l'interface de `user.tsx` sur `admin.tsx` en ajoutant le composant de sélection temporelle (`setPeriod`), et passer cet argument dynamiquement à `fetchMetrics(period)`.

### PLAN CURATIF (UX et Gouvernance RAM)
*   **Corriger la pagination de l'Audit Log** :
    Modifier `getAuditLogs` dans `audit.actions.ts` pour accepter les paramètres `(page: number, limit: number, search: string)`.
    Modifier `audit-logs.tsx` pour faire des appels API ciblés et injecter une barre de chargement sans monter toute la base en mémoire frontale.
*   **Cohérence des Modales CRUD** :
    Remplacer l'état d'édition direct dans `services.tsx` par l'utilisation de variables formelles dans un Form natif (react-hook-form ou Server Actions natives).

### PLAN PRÉVENTIF (Architecture Command-Menu & Zustand)
*   **Délestage du `CommandMenu` (Anti-Bloat)** :
    Retirer l'import massif depuis `useStore`.
    Créer une Server Action dédiée `searchOmnibar(query: string)` avec une clause SQLite unifiée (ex: `SELECT * FROM (SELECT id, number, 'invoice' as type FROM invoices UNION ... ) WHERE text LIKE '%query%' LIMIT 5`).
    Dans `command-menu.tsx`, utiliser un debounce (ex: 300ms via `use-debounce`) pour appeler cette Server Action.
*   **Délestage de `Navigation`** :
    Calculer les compteurs "Non Payés" et "Devis En Attente" au niveau de la requête API `getDashboardMetrics` et les stocker dans le profil utilisateur, ou via une sous-requête dédiée, plutôt que d'itérer en O(N) sur l'état Zustand global dans le Hook de rendu de la barre latérale.