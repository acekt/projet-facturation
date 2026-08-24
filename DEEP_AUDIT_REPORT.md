# DEEP AUDIT REPORT

## 1. QUALITÉ DU CODE STATIQUE ET TYPAGE (TYPESCRIPT)

### Utilisation de `any`, `ts-ignore`, et types implicites
- **Fichiers concernés:**
  - `app/api/setup/route.ts` (Ligne 99: `catch (txError: any)`)
  - `app/api/credit-notes/route.ts` (Ligne 92: `catch (error: any)`)
  - `app/api/users/route.ts` (Lignes 103, 124: `catch (error: any)`)
  - `app/api/invoices/route.ts` (Ligne 74: `catch (error: any)`)
  - `app/api/auth/login/route.ts` (Ligne 55: `catch (configError: any)`)
  - `app/api/quotes/convert/route.ts` (Ligne 49: `catch (error: any)`)
  - `app/api/quotes/[id]/route.ts` (Ligne 131: `const updateQuoteTx = db.transaction((quoteItems: any[]) => {`)
  - `app/api/quotes/route.ts` (Ligne 115: `const insertQuote = db.transaction((quoteItems: any[]) => {`)
  - `components/pages/invoice-editor.tsx` (Ligne 574: `items: items as any`)
  - `components/pages/audit-logs.tsx` (Ligne 13: `const [logs, setLogs] = React.useState<any[]>([])`)
  - `components/pages/quote-editor.tsx` (Lignes 591, 602: `items: items as any`)
  - `components/pages/protected-app-shell.tsx` (Ligne 30: `initialUser: any`)
  - `components/pages/quotes.tsx` (Lignes 192, 306, 395, 496)
  - `components/pages/credit-notes.tsx` (Ligne 94: `(c as any).amount`)
  - `components/fullscreen-document-viewer.tsx` (Lignes 142, 178)
  - `lib/db.ts` (Lignes 105, 125, 401)
  - `lib/services/InvoiceService.ts` (Ligne 15: `createInvoice(data: any, userId: string, role: string)`)
  - `lib/repositories/UserRepository.ts` (Ligne 38: `const values: any[] = []`)
  - `hooks/use-quotes.ts` (Lignes 44, 81)
- **Analyse:** L'utilisation de `any` désactive les vérifications statiques, ce qui peut entraîner des exceptions à l'exécution et des bugs silencieux.
- **Remédiation (Exemple pour les blocs `catch`):**
  ```typescript
  // Au lieu de:
  catch (error: any) {
  // Utiliser:
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
  }
  ```
- **Remédiation (Exemple pour les types explicites, ex: InvoiceService):**
  ```typescript
  // Au lieu de:
  createInvoice(data: any, userId: string, role: string) {
  // Utiliser l'interface correcte (ex: InvoiceData):
  createInvoice(data: InvoiceData, userId: string, role: string) {
  ```

### Code Mort (Exemple potentiel déduit)
- **Fichiers concernés:** Les imports de modules de base (ex: `import * as React from "react"` si inutilisés), ou d'anciennes constantes de test souvent trouvées dans les API. (Nécessite un balayage `tsc --noEmit` / ESLint strict).
- **Remédiation:** Supprimer tout code mort et nettoyer les imports (ex: via le plugin `eslint-plugin-unused-imports`).

### Code Dupliqué (DRY)
- **Analyse:** La génération de `csvContent` et `rows` pour l'exportation CSV est répétée à l'identique dans de multiples pages (Payments, Invoices, Services, Quotes, Clients, Credit-Notes).
  - `components/pages/payments.tsx` (Ligne 216)
  - `components/pages/invoices.tsx` (Ligne 334)
  - `components/pages/services.tsx` (Ligne 219)
  - `components/pages/quotes.tsx` (Ligne 210)
  - `components/pages/clients.tsx` (Ligne 226)
  - `components/pages/credit-notes.tsx` (Ligne 95)
- **Remédiation:** Extraire cette logique dans une fonction utilitaire centrale.
  ```typescript
  // Dans lib/utils.ts
  export function generateCSV(headers: string[], rows: any[][]): string {
    return [headers, ...rows].map(e => e.join(",")).join("\n");
  }
  // Utilisation dans composants:
  const csvContent = generateCSV(headers, rows);
  ```

## 2. LOGIQUE REACT ET ANTI-PATTERNS UI

### Hooks Dangereux (`useEffect` sans dépendances exhaustives)
- **Fichiers concernés:**
  - `components/pages/protected-app-shell.tsx` (Ligne 42) : Synchronisation des utilisateurs connectés, peut manquer `initialUser`, `user`, ou `setUser` dans certaines conditions ou référencer des props non mémorisées.
  - `components/pages/invoice-editor.tsx` (Lignes 79, 91)
- **Analyse:** Les `useEffect` omettant des dépendances causent des boucles infinies ou de l'état obsolète (stale closures).
- **Remédiation (Exemple pour `invoice-editor.tsx`):**
  ```typescript
  React.useEffect(() => {
    return () => {
       setInvoiceDraft(localDraft);
    };
  }, [localDraft, setInvoiceDraft]);
  ```

### Gestion des Erreurs et Fetch API
- **Fichiers concernés:**
  - `components/pages/payments.tsx` (Lignes 58-59, 168-169)
  - `components/pages/quotes.tsx` (Lignes 186-187)
  - `hooks/use-quotes.ts` (Lignes 73-74)
- **Analyse:** Des requêtes `fetch` sont lancées à la volée (`.then(res => res.json())`) sans blocs `try/catch` ni gestion du rejet de la promesse ou des erreurs HTTP (ex: 500). En cas d'échec du réseau, l'application plante silencieusement.
- **Remédiation:**
  ```typescript
  try {
    const res = await fetch('/api/payments');
    if (!res.ok) throw new Error(`Erreur réseau: ${res.status}`);
    const data = await res.json();
    setPayments(data);
  } catch (error) {
    toast.error("Impossible de charger les paiements.");
  }
  ```

### Prop Drilling
- **Fichiers concernés:** Bien que l'application utilise Zustand (`useStore`), il existe des props passées manuellement de l'AppShell vers les pages (ex: `onNavigate`, `onCreateUser`, `onEditUser`).
  - `components/pages/protected-app-shell.tsx` -> `UsersPage` -> Potentiellement enfants.
- **Remédiation:** Transférer ces fonctions d'édition/navigation vers le store global Zustand si elles dépassent 2 niveaux.

## 3. ARCHITECTURE ELECTRON ET IPC

### Fuites de mémoire (Nettoyage `ipcMain` / `ipcRenderer`)
- **Fichiers concernés:** `main.js`, `preload.js`
- **Analyse:** Bien que l'application utilise principalement `ipcRenderer.invoke` (qui résout une promesse unique sans laisser d'écouteur permanent), la documentation des règles exige de vérifier les `on`. Dans `main.js`, il y a de multiples gestionnaires d'événements persistants (`process.on`, `app.on`, `webContents.on`) qui, bien que valides à l'échelle de l'application, pourraient nécessiter des `removeListener` dans un contexte de fenêtres multiples ou de composants React (s'ils utilisaient `ipcRenderer.on`).
- **Remédiation (Exemple théorique de nettoyage IPC côté React):**
  ```javascript
  useEffect(() => {
    const handleEvent = (_event, data) => callback(data);
    window.electron.ipcRenderer.on('channel-name', handleEvent);
    return () => window.electron.ipcRenderer.removeListener('channel-name', handleEvent);
  }, []);
  ```

### Sécurité du Pont Preload
- **Fichier:** `preload.js`
- **Analyse:** L'implémentation actuelle masque `ipcRenderer` via `contextBridge` (ex: `print: () => ipcRenderer.invoke('print-to-pdf')`). Ceci est sécurisé, il ne transmet pas l'objet `event` au monde web (Renderer). Aucune faille de sécurité majeure n'est constatée sur cette abstraction.

## 4. BASE DE DONNÉES ET PERFORMANCES (SQLITE)

### Requêtes N+1 / Appels SQL dans des boucles
- **Fichiers concernés:**
  - `app/api/quotes/[id]/route.ts` (Ligne 164)
- **Analyse:** Bien qu'ils soient encapsulés dans `db.transaction`, il y a une itération où `insertItem.run()` (une instruction préparée) est exécutée de multiples fois dans une boucle `for...of`. Bien que `better-sqlite3` le supporte rapidement, il est préférable, à grande échelle, de limiter les appels isolés.
- **Remédiation (Meilleure pratique SQLite):**
  Le code actuel fait déjà `const insertItem = db.prepare(...); for(const item of quoteItems) { insertItem.run(...) }`. Ceci est en réalité l'approche optimale recommandée par `better-sqlite3` (préparer avant, exécuter dans la boucle, le tout dans une transaction). Le problème potentiel serait si `db.prepare` était DANS la boucle.

### Indexation manquante
- **Fichiers concernés:** `lib/db.ts`
- **Analyse:** Le système interroge très fréquemment `WHERE deletedAt IS NULL` ou filtre par `status`. Aucun index spécifique pour ces colonnes n'est créé dans les migrations de la base.
- **Remédiation:**
  Ajouter à la phase d'initialisation de la base :
  ```typescript
  db.prepare('CREATE INDEX IF NOT EXISTS idx_users_deletedAt ON users(deletedAt);').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_quotes_deletedAt ON quotes(deletedAt);').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_invoices_deletedAt ON invoices(deletedAt);').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);').run();
  ```
