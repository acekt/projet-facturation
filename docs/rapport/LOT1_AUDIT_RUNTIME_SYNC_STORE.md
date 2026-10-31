# RAPPORT D'AUDIT: LOT 1 - RUNTIME, SYNC & STORE

Ce rapport documente l'audit exhaustif en lecture seule des processus Electron, de la boucle de synchronisation Cloud, de l'hydratation de l'état Zustand et des canaux IPC pour l'application "Facturier".

## 1. Anatomie fichier par fichier (Rôle, Dépendances, TTI & RAM)

### 1.1 Processus Electron & IPC
*   `apps/desktop/main.js` :
    *   **Rôle** : Point d'entrée principal de l'application Electron. Coordonne le cycle de vie, instancie les fenêtres et lance le serveur Next.js.
    *   **Dépendances** : `electron`, `./main/logging.js`, `./main/secrets.js`, `./main/window.js`, `./main/server.js`, `./main/ipc.js`, `./main/updater.js`, `./main/backup.js`.
    *   **Impact TTI/RAM** : Impact modéré sur le démarrage en raison de la recherche de port et de l'attente du health-check du serveur Next.js via le processus utilitaire (`utilityProcess.fork`).
*   `apps/desktop/preload.js` :
    *   **Rôle** : Script de préchargement sécurisé exposant une API `window.electron` via `contextBridge`.
    *   **Dépendances** : `electron` (`contextBridge`, `ipcRenderer`).
    *   **Impact TTI/RAM** : Très faible. Fonctions IPC non bloquantes et asynchrones.
*   `apps/desktop/main/server.js` :
    *   **Rôle** : Orchestre le démarrage (`startNextServer`), l'arrêt (`killNextProcess`) et la surveillance (health check) du serveur Next.js standalone.
    *   **Dépendances** : `http`, `path`, `fs`, `child_process.execSync`, `electron.utilityProcess`.
    *   **Impact TTI/RAM** : TTI impacté par `waitForServer` qui poll `/api/health`. Consommation mémoire isolée dans un processus fils (`nextProcess`). Risque identifié sur l'extinction forcée sous Windows (via `taskkill /pid ${pid} /T /F`).
*   `apps/desktop/main/window.js` :
    *   **Rôle** : Configure le splash screen et la `BrowserWindow` principale.
    *   **Dépendances** : `electron` (`BrowserWindow`, `app`), `path`, `fs`.
    *   **Impact TTI/RAM** : Crée la fenêtre de l'interface utilisateur. La RAM augmente à mesure du rendu des composants React.
*   `apps/desktop/main/ipc.js` :
    *   **Rôle** : Handlers IPC natifs pour l'impression, l'export PDF et la configuration de base. Sécurisé avec `validateSender`.
    *   **Dépendances** : `electron` (`app`, `ipcMain`, `BrowserWindow`, `dialog`), `path`, `fs`.
    *   **Impact TTI/RAM** : TTI bas. Cependant, générer des PDF requiert l'instanciation de fenêtres cachées (Hidden `BrowserWindow`) et des écritures synchrones, augmentant ponctuellement la RAM.
*   `apps/desktop/main/backup.js` :
    *   **Rôle** : Effectue la sauvegarde journalière de la base de données.
    *   **Impact TTI/RAM** : Non pertinent (asynchrone), dépend du volume de la BDD.
*   `apps/desktop/main/logging.js` :
    *   **Rôle** : Expose `initLogger` et `logToFile` pour garder la trace des événements (`main.log`).
    *   **Impact TTI/RAM** : Négligeable (flux d'écriture en arrière-plan).
*   `apps/desktop/main/secrets.js` :
    *   **Rôle** : Génère et stocke `SESSION_SECRET` et `PASSWORD_SALT`.
    *   **Impact TTI/RAM** : Faible, lu avec `fs.readFileSync` au démarrage une seule fois.
*   `apps/desktop/main/updater.js` :
    *   **Rôle** : Gère la mise à jour de l'application via `electron-updater`.
    *   **Impact TTI/RAM** : Démarre en fond pour pinger le serveur distant (faible empreinte).

### 1.2 Orchestrateurs d'état & Synchronisation au démarrage
*   `apps/desktop/components/data-sync.tsx` :
    *   **Rôle** : Charge massivement toutes les entités métier au démarrage depuis l'API via `Promise.allSettled`.
    *   **Dépendances** : `React`, `useStore` (Zustand), actions serveur Next.js (`getClients`, `getInvoices`, etc.).
    *   **Impact TTI/RAM** : Très lourd. Il peuple Zustand avec des tableaux complets. Si un client a des milliers de factures, le navigateur peut crasher.
*   `apps/desktop/components/cloud-sync-runner.tsx` :
    *   **Rôle** : Déclenche la synchronisation bidirectionnelle cloud/locale toutes les minutes.
    *   **Dépendances** : `supabaseSession`, action serveur `runCloudSync`, Zustand.
    *   **Impact TTI/RAM** : Impact réseau et CPU répété en arrière-plan (intervalle fixé par `setInterval`).
*   `apps/desktop/components/providers.tsx` :
    *   **Rôle** : Englobe l'application dans `ThemeProvider`, `ErrorBoundary` et signale que l'app est prête (`window.electron.reportAppReady()`).
    *   **Impact TTI/RAM** : Insignifiant.
*   `apps/desktop/components/error-boundary.tsx` :
    *   **Rôle** : Fallback UI robuste contre les crashs de rendu de React.
    *   **Impact TTI/RAM** : Insignifiant.
*   `apps/desktop/components/pages/protected-app-shell.tsx` :
    *   **Rôle** : Layout principal pour les routes protégées. Orchestre la présence de `DataSync` et `CloudSyncRunner` et l'injection du `user` initial.
    *   **Impact TTI/RAM** : Modéré (rendu du layout global avec Sidebar/Topbar).

### 1.3 Store Zustand & Slices
*   `apps/desktop/lib/store.ts` : Point d'entrée de Zustand avec le middleware `persist` (sauvegarde dans `localStorage` de `viewFormat` et des drafts).
*   `apps/desktop/lib/store/types.ts` : Déclarations de types TypeScript des données.
*   `apps/desktop/lib/store/slices/authSlice.ts` : Gère le rôle et les autorisations.
*   `apps/desktop/lib/store/slices/clientsSlice.ts` : Maintien du tableau des clients en RAM locale (via `.map` et `.filter`).
*   `apps/desktop/lib/store/slices/invoicesSlice.ts` : Maintien en mémoire RAM des factures, paiements, services.
*   `apps/desktop/lib/store/slices/quotesSlice.ts` : Maintien en mémoire RAM des devis et leur éditeur.
*   `apps/desktop/lib/store/slices/settingsSlice.ts` : Contient les paramètres généraux (TVA par défaut, nom d'entreprise...).

## 2. Diagnostic de la boucle `runCloudSync` et de l'hydratation `data-sync.tsx`

**Problème 1 : Boucle CloudSyncRunner (`apps/desktop/components/cloud-sync-runner.tsx:42`)**
Le runner déclenche le processus complet de resynchronisation périodiquement.
*   **Fichier:Ligne** : `apps/desktop/components/cloud-sync-runner.tsx` (ligne 42)
*   **Extrait de code :**
    ```typescript
    const timer = setInterval(() => sync(true), SYNC_INTERVAL_MS)
    // SYNC_INTERVAL_MS est défini en haut à 60_000 (60 secondes)
    ```
*   **Impact** : Toutes les 60 secondes, l'application sollicite le réseau et la base de données. Pire, si des données sont reçues (`r.pulled > 0`), il dispatche un évènement `facturier:data-refresh`, ce qui re-déclenche `DataSync`.

**Problème 2 : Hydratation brute sans pagination (`apps/desktop/components/data-sync.tsx:50-59`)**
Le composant charge TOUTES les données métier au login en appelant toutes les actions serveur (qui interrogent SQLite sans limite) :
*   **Fichier:Ligne** : `apps/desktop/components/data-sync.tsx` (ligne 50)
*   **Extrait de code :**
    ```typescript
    const endpoints = [
      { action: getClients,       setter: setClients },
      { action: getServices,      setter: setServices },
      // ...
      { action: getInvoices,      setter: setInvoices },
    ]
    const results = await Promise.allSettled(
      endpoints.map(ep => ep.action().then((res: any) => res?.success ? res.data : null).catch(() => null))
    )
    ```
*   **Impact** : Saturation RAM. Un client avec 10 000 factures verra le navigateur de son Electron crasher par manque de RAM locale et un "FCP" bloqué pendant des secondes.

## 3. Audit des canaux IPC & Cycle de vie Electron

**Problème 3 : Processus Zombie Next.js sous Windows (`apps/desktop/main/server.js:143`)**
Dans le code, l'application Electron tente de forcer l'arrêt du processus Next via `taskkill`. Si cette commande échoue ou que l'UID n'a pas les droits, le port 3000 reste bloqué et Next continue de tourner en fond (zombie).
*   **Fichier:Ligne** : `apps/desktop/main/server.js` (lignes 143-145)
*   **Extrait de code :**
    ```javascript
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
    }
    ```
*   **Vulnérabilité** : `execSync` peut lever des exceptions bloquantes (même enveloppé d'un try-catch, l'enfant créé via `utilityProcess.fork` pourrait ignorer le kill de l'arbre s'il est détaché de manière non standard ou spawn des forks).

**Problème 4 : Création asynchrone non-cancellable de fenêtres d'impression IPC (`apps/desktop/main/ipc.js:122-132`)**
Dans `print-document` et `export-pdf`, le processus crée une `BrowserWindow` cachée et écrit un fichier temporaire :
*   **Fichier:Ligne** : `apps/desktop/main/ipc.js` (lignes 125, 131)
*   **Extrait de code :**
    ```javascript
    const tempPath = path.join(userDataPath, `print_temp_${Date.now()}.html`);
    await fs.promises.writeFile(tempPath, htmlContent, 'utf8');
    ```
*   **Fuite mémoire** : Si la fenêtre de dialogue native de l'OS (`pdfWin.webContents.printToPDF()`) est bloquée ou très lente, l'utilisateur pourrait cliquer 10 fois, créant 10 fichiers temporaires et 10 instances `BrowserWindow` en arrière-plan sans mécanisme de nettoyage robuste au démarrage d'Electron.

## 4. Incohérences d'état Zustand

**Problème 5 : Mises à jour d'état en O(N) (`apps/desktop/lib/store/slices/invoicesSlice.ts:68`)**
Toutes les entités complexes sont gérées avec des tableaux.
*   **Fichier:Ligne** : `apps/desktop/lib/store/slices/invoicesSlice.ts` (lignes 68-71)
*   **Extrait de code :**
    ```typescript
    updateInvoice: (id, data) =>
      set((state) => ({
        invoices: state.invoices.map((i) => (i.id === id ? { ...i, ...data } : i)),
      })),
    ```
*   **Impact** : L'algorithme est en `O(N)`. Si le tableau contient 15 000 éléments (car `DataSync` charge tout), la mutation du state bloquera le main thread React (Jank) pour itérer avec `.map()`.
*   **Désynchronisation** : Les états client et SQLite ne partagent pas d'invalidation (contrairement à React Query) ; si `updateInvoice` est appelée en local mais que l'appel API échoue, le composant affichera des données corrompues (état optimiste non géré).

## 5. Feuille de route en 3 plans

### PLAN CORRECTIF (Stopper la boucle & Fuites)
*   **Désactiver / Espacer `cloud-sync-runner.tsx`** :
    Dans `apps/desktop/components/cloud-sync-runner.tsx`, remplacer le polling (`setInterval`) par des appels SSE (Server-Sent Events) ou par WebSocket depuis Supabase Realtime, ou au minimum changer l'intervalle à 15 minutes avec un bouton "Sync Now" explicite.
    *Extrait corrigé (cloud-sync-runner.tsx)* :
    ```typescript
    // Remplacer : setInterval(() => sync(true), 60_000)
    // Par un déclencheur manuel et au retour du réseau :
    window.addEventListener("online", () => sync(false))
    ```
*   **Gérer le Zombie Process et Nettoyage PDF (`apps/desktop/main/server.js`)** :
    Remplacer le `taskkill` par le mécanisme natif `utilityProcess` qui offre des garanties plus fortes d'extinction avec un timeout (`nextProcess.kill()`).
    Au démarrage d'Electron, balayer le `USER_DATA_PATH` pour purger d'anciens fichiers `print_temp_*.html` et `pdf_temp_*.html` abandonnés après un crash inopiné.

### PLAN CURATIF (Découpler DataSync)
*   **Restreindre l'hydratation de masse (`apps/desktop/components/data-sync.tsx`)** :
    Les actions Serveur comme `getInvoices` doivent implémenter la pagination (`limit: 50, offset: 0`) et `DataSync` ne doit charger que les `Metrics` ou les 50 dernières factures.
    *Extrait corrigé (data-sync.tsx)* :
    ```typescript
    // Limiter la quantité de données tirées du serveur au montage
    const recentInvoices = await getInvoices({ limit: 50 });
    ```
*   **Restructurer Zustand (`apps/desktop/lib/store/slices/*`)** :
    Ne plus stocker des objets métiers complexes dans Zustand de manière globale si ces données ont leur propre endpoint serveur. Utiliser Zustand UNIQUEMENT pour les drafts d'édition (`invoiceDraft`, `quoteDraft`).

### PLAN PRÉVENTIF (Architecture & Résilience)
*   **Passage à React Query** :
    Adopter `@tanstack/react-query` pour les entités SQLite. Cela supprimera le besoin total de `DataSync` (l'invalidation du cache remplacera `window.dispatchEvent(new Event("facturier:data-refresh"))`), garantira que seul l'écran actuellement visualisé (ex: `InvoicesPage`) charge ses données (Lazy-loading par vue) et éliminera les parcours de tableaux en O(N) inutiles dans les slices Zustand.
*   **Sécuriser le Store Persistent** :
    S'assurer que la fonction `partialize` de Zustand (`apps/desktop/lib/store.ts`) ne stocke dans le `localStorage` local (en clair) que l'UI (`viewFormat`), afin d'éviter la prolifération de données sensibles si de nouvelles propriétés y sont ajoutées par inadvertance.
