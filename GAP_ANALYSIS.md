# 🔍 ANALYSE DES ÉCARTS (GAP ANALYSIS)

Ce document liste toutes les différences, recommandations non implémentées et points de friction identifiés dans les anciens rapports (`MASTER_DOCUMENTATION.md`) par rapport à l'état actuel du code.


### Trouvé dans : SPECIFICATIONS.md
Ligne 226: | **Expiré** | ⬤ Orange | Délai de validité dépassé | → Relancé (nouveau devis), → Archivé |
> | **Converti** | ⬤ Indigo | Facture générée depuis ce devis | Aucune (terminal) |
> | **Archivé** | ⬤ Gris foncé | Hors workflow actif | Aucune (lecture seule) |
> ### 4.2 Création d'un devis
> **Champs obligatoires**
> - Client : sélection depuis le référentiel clients ou saisie manuelle (Nom, Adresse, NIF, RCCM si applicable).
> - Date d'émission et date de validité (par défaut : +30 jours, configurable dans les Options).

---

### Trouvé dans : SPECIFICATIONS.md
Ligne 261: - Expiration proche : Alerte J-7 : badge orange sur les devis dont la date de validité est à moins de 7 jours.
> - Compteur dashboard : Compteur 'Devis en attente' visible sur le tableau de bord et dans la sidebar.
> - Journal de statut : Historique complet des changements de statut enregistré (qui, quand, depuis quel état, vers quel état).
> ### 4.5 Règles de suppression
> 🔒 **Règle :** Seul un devis au statut Brouillon peut être supprimé, et uniquement par un Admin.
> 🔒 **Règle :** Un devis Soumis, Accepté ou Converti est en lecture seule et non supprimable. Il peut uniquement être Archivé.

---

### Trouvé dans : SPECIFICATIONS.md
Ligne 280: | **Acompte** | ⬤ Orange | Paiement partiel enregistré | → Payée (solde), → Annulée |
> | **Payée** | ⬤ Vert | Règlement total confirmé | Aucune (terminal) |
> | **En retard** | ⬤ Rouge | Échéance dépassée, solde restant | → Acompte, → Payée, → Annulée |
> | **Annulée (Avoir)** | ⬤ Gris | Avoir émis, facture neutralisée | Aucune (terminal) |
> ### 5.3 Conversion devis → facture (Facture Miroir)
> - La conversion génère une copie intégrale et figée du devis : lignes, quantités, prix unitaires, remises, CSS, TVA.
> - Le numéro de facture est auto-généré au même format chronologique que les devis.

---

### Trouvé dans : DEEP_AUDIT_REPORT.md
Ligne 1118: ### 6.3 BASE DE DONNÉES ET PERFORMANCES (SQLITE) : Transactions Anti-Pattern et Index Manquants
> **Problème 1 : `db.prepare()` dynamique à l'intérieur d'un bloc `db.transaction()`**
> **Localisation :**
> - `app/api/quotes/route.ts` (ligne 119)
> **Pourquoi c'est médiocre :** Invoquer `db.prepare()` dynamiquement au cœur d'une transaction SQLite contraint la base de données à allouer des ressources de compilation tout en maintenant un verrou exclusif sur la base. Cela dégrade les performances lors d'insertions massives et augmente le risque d'exceptions `SQLITE_BUSY`.

---

### Trouvé dans : DEEP_AUDIT_REPORT.md
Ligne 1384: **Problème 1 : Nettoyage manquant des écouteurs IPC dans le renderer (`ipcRenderer.on`)**
> **Localisation :** Si des écouteurs IPC sont ajoutés (théoriquement ou dans de futurs développements), le manque de `removeListener` est fatal.
> **Pourquoi c'est médiocre :** Accumulation d'écouteurs à chaque rendu d'un composant React lié à un événement du processus principal, conduisant à des fuites de mémoire sévères et des exécutions multiples (effet "fantôme").
> **Solution d'excellence :**
> ```javascript
> // Dans la définition Preload (si ajouté)
> onInvoiceGenerated: (callback) => {
> const listener = (event, data) => callback(data);

---

### Trouvé dans : DEPLOYMENT_READINESS_REPORT.md
Ligne 1883: ## 3. Recommandations Finales
> - Exécutez localement `npm run test:e2e:report` pour valider l'interface graphique via Chromium (Playwright) et obtenir le rapport HTML contenant les captures d'écran avant l'empaquetage final.
> - Le projet a mon FEU VERT technique 🟢 pour générer les installeurs via `npm run dist`.
> # ==========================================

---

### Trouvé dans : audit-report.md
Ligne 1935: ## 🔴 CE QUI DOIT ÊTRE CORRIGÉ
> 1. **Isolation RBAC Incomplète sur les APIs (Risque de Fuite de Données)** :
> - **Problème** : Dans certains contrôleurs (ex: `api/quotes/route.ts` ou `api/clients/route.ts`), la logique de vérification du rôle (`session.role`) est présente, mais **la clause WHERE `created_by = ?` pour les opérateurs (role 'user') n'est pas appliquée rigoureusement** sur tous les endpoints `GET` et `PATCH/DELETE`.
> - **Impact** : Un Opérateur (avec un peu de manipulation réseau) pourrait lister ou modifier les factures générées par un autre opérateur en forgeant directement des requêtes API avec un ID tiers.
> 2. **Failles de Traçabilité sur le Soft Delete** :
> - **Problème** : Bien que la règle "Modification ou suppression interdite" (via avoirs) soit dictée pour la compliance fiscale, certaines implémentations de "Soft Delete" dans `api/invoices/[id]/route.ts` se contentent de désactiver la facture au lieu d'en forcer l'annulation complète via une trace de Credit Note irréversible. L'audit_log n'intercepte pas toutes ces mutations à bas niveau.
> 3. **Sécurité - Secrets en Dur** :

---

### Trouvé dans : audit-report.md
Ligne 1956: 2. **Gestion de Cache Next.js (Dette Technique App Router)** :
> - De nombreuses routes API manquent cruellement de spécifications formelles de cache (ex: `export const dynamic = 'force-dynamic';`). Sans cela, Next.js 15 risque de renvoyer des snapshots mis en cache de manière agressive lors des builds de production, affichant de "vieux" tableaux de bords aux utilisateurs.
> 3. **Performances E2E (Dashboard Load Time)** :
> - En environnement de développement (sans build), le tableau de bord prend environ ~12 à 15 secondes pour le rendu initial dû à la compilation à la volée.
> - **Action :** Une véritable pipeline CI doit s'appuyer sur `npm run build` et `npm run start` pour éprouver la cible de performance réelle (< 1.5 seconde exigée), l'infrastructure SQLite locale en WAL pouvant largement encaisser ces temps d'accès.
> ## 🛠️ SUITE DE TESTS

---

### Trouvé dans : report_setup.md
Ligne 2066: 🔴 **Fuite Logique (Vérification dans les Pages React)** : L'application détecte si la base de données est vierge en effectuant des requêtes SQL (`db.prepare('SELECT COUNT(*) FROM users')`) **directement à l'intérieur des composants de rendu** Server-Side (`app/setup/page.tsx` et `app/login/page.tsx`).
> 🔴 **Middleware Incomplet** : Le `middleware.ts` tolère un accès libre à `/setup` (via la ligne `if (isLoginPage || isSetupPage) { ... return NextResponse.next() }`) sans vérifier si l'application est déjà configurée. C'est l'UI côté serveur qui force la redirection, ce qui n'est pas optimal pour la sécurité globale.
> 🟢 **Protection de la Route API** : La route `/api/setup` commence par une vérification (bien qu'en SQL brut) pour s'assurer qu'aucun utilisateur n'existe déjà. Si l'application est configurée, elle renvoie fermement une erreur HTTP 403, empêchant un attaquant d'écraser la base de données (Protection "Fail-Fast" existante).
> #### PHASE 2 : AUDIT ARCHITECTURAL (N-TIER COMPLIANCE)
> 🔴 **Violation de l'Architecture N-Tier (Controllers)** : Le fichier `app/api/setup/route.ts` est un désastre architectural vis-à-vis de nos nouveaux standards. Il importe directement `lib/db.ts` et orchestre lui-même un enchevêtrement massif de requêtes SQL :
> - `db.prepare('SELECT COUNT...')`
> - `db.transaction()`

---

### Trouvé dans : report_setup.md
Ligne 2067: 🔴 **Middleware Incomplet** : Le `middleware.ts` tolère un accès libre à `/setup` (via la ligne `if (isLoginPage || isSetupPage) { ... return NextResponse.next() }`) sans vérifier si l'application est déjà configurée. C'est l'UI côté serveur qui force la redirection, ce qui n'est pas optimal pour la sécurité globale.
> 🟢 **Protection de la Route API** : La route `/api/setup` commence par une vérification (bien qu'en SQL brut) pour s'assurer qu'aucun utilisateur n'existe déjà. Si l'application est configurée, elle renvoie fermement une erreur HTTP 403, empêchant un attaquant d'écraser la base de données (Protection "Fail-Fast" existante).
> #### PHASE 2 : AUDIT ARCHITECTURAL (N-TIER COMPLIANCE)
> 🔴 **Violation de l'Architecture N-Tier (Controllers)** : Le fichier `app/api/setup/route.ts` est un désastre architectural vis-à-vis de nos nouveaux standards. Il importe directement `lib/db.ts` et orchestre lui-même un enchevêtrement massif de requêtes SQL :
> - `db.prepare('SELECT COUNT...')`
> - `db.transaction()`
> - `db.prepare('INSERT INTO users...')`

---

### Trouvé dans : report_setup.md
Ligne 2071: 🔴 **Violation de l'Architecture N-Tier (Controllers)** : Le fichier `app/api/setup/route.ts` est un désastre architectural vis-à-vis de nos nouveaux standards. Il importe directement `lib/db.ts` et orchestre lui-même un enchevêtrement massif de requêtes SQL :
> - `db.prepare('SELECT COUNT...')`
> - `db.transaction()`
> - `db.prepare('INSERT INTO users...')`
> - `db.prepare('INSERT INTO settings...')`
> 🔴 **Absence de Service et Repository** : Les opérations ne sont déléguées à aucun `UserRepository` ni `SettingsRepository`. L'orchestration lourde (hachage du mot de passe + insertion user + insertion config) aurait dû se trouver dans une classe `SetupService.ts`.
> #### PHASE 3 : SÉCURITÉ ET INTÉGRITÉ DES DONNÉES

---

### Trouvé dans : report_setup.md
Ligne 2076: 🔴 **Absence de Service et Repository** : Les opérations ne sont déléguées à aucun `UserRepository` ni `SettingsRepository`. L'orchestration lourde (hachage du mot de passe + insertion user + insertion config) aurait dû se trouver dans une classe `SetupService.ts`.
> #### PHASE 3 : SÉCURITÉ ET INTÉGRITÉ DES DONNÉES
> 🟢 **Mot de Passe Sécurisé** : L'implémentation est correcte. Le mot de passe est robustement haché côté backend en utilisant `bcryptjs` avec 10 `SALT_ROUNDS` avant d'être sauvegardé.
> 🔴 **Magic Strings persistantes** : Le rôle de l'utilisateur est injecté en dur `role: 'admin'` et la création de l'audit utilise `entityType: 'user'`. Nos nouvelles constantes `ROLES.ADMIN` n'ont pas été appliquées dans la transaction SQL !
> 🟢 **Intégrité (Zod)** : Les données provenant de l'UI sont strictement validées en entrée de la requête via `setupSchema.safeParse(body)`, garantissant qu'aucune donnée malveillante n'atteigne le système de base de données.
> #### PHASE 4 : UX ET GESTION D'ÉTAT (FRONTEND)

---

### Trouvé dans : report_setup.md
Ligne 2080: 🔴 **Magic Strings persistantes** : Le rôle de l'utilisateur est injecté en dur `role: 'admin'` et la création de l'audit utilise `entityType: 'user'`. Nos nouvelles constantes `ROLES.ADMIN` n'ont pas été appliquées dans la transaction SQL !
> 🟢 **Intégrité (Zod)** : Les données provenant de l'UI sont strictement validées en entrée de la requête via `setupSchema.safeParse(body)`, garantissant qu'aucune donnée malveillante n'atteigne le système de base de données.
> #### PHASE 4 : UX ET GESTION D'ÉTAT (FRONTEND)
> 🔴 **Composant Monolithique (UI/Fetch couplés)** : Le composant `app/setup/setup-client.tsx` gère l'état complet du formulaire, l'affichage (JSX), et encapsule un appel asynchrone direct (`fetch('/api/setup')`). Il manque l'extraction dans un Custom Hook (ex: `use-setup.ts`).
> 🟢 **Expérience Fluide** : Le Setup envoie le même cookie HMAC sécurisé que l'API de Login. Suite au succès de l'initialisation, le client est redirigé vers le `/dashboard` nativement, sans forcer l'utilisateur à se reconnecter manuellement.

---

### Trouvé dans : report_setup.md
Ligne 2084: 🔴 **Composant Monolithique (UI/Fetch couplés)** : Le composant `app/setup/setup-client.tsx` gère l'état complet du formulaire, l'affichage (JSX), et encapsule un appel asynchrone direct (`fetch('/api/setup')`). Il manque l'extraction dans un Custom Hook (ex: `use-setup.ts`).
> 🟢 **Expérience Fluide** : Le Setup envoie le même cookie HMAC sécurisé que l'API de Login. Suite au succès de l'initialisation, le client est redirigé vers le `/dashboard` nativement, sans forcer l'utilisateur à se reconnecter manuellement.

---

### Trouvé dans : report_setup.md
Ligne 2089: ### PLAN D'ACTION (SUGGESTION DE REFACTORING)
> Si nous souhaitons finaliser l'excellence de cette architecture :
> 1. **Extraction N-Tier Backend** : Extraire la logique SQL lourde de `app/api/setup/route.ts` vers un nouveau `lib/services/SetupService.ts` et potentiellement créer `SettingsRepository.ts`.
> 2. **Éradication des Magic Strings** : Remplacer `'admin'` par `ROLES.ADMIN` dans la transaction Setup.
> 3. **Extraction N-Tier Frontend** : Créer un Custom Hook `hooks/use-setup.ts` pour vider le composant UI `setup-client.tsx` de ses requêtes `fetch`.

---
