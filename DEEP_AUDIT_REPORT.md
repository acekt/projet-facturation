# DEEP AUDIT REPORT

## 1. QUALITÉ DU CODE STATIQUE ET TYPAGE (TYPESCRIPT)

### Utilisation de `any`, `ts-ignore`, et types implicites
- **Fichiers concernés et remédiations :**
  - `app/api/setup/route.ts` (Ligne 99)
    - *Anti-pattern:* `catch (txError: any)`
    - *Remédiation:* `catch (txError: unknown) { const errorMessage = txError instanceof Error ? txError.message : String(txError); }`
  - `app/api/credit-notes/route.ts` (Ligne 92)
    - *Anti-pattern:* `catch (error: any)`
    - *Remédiation:* `catch (error: unknown) { const errorMessage = error instanceof Error ? error.message : "Erreur lors du traitement"; }`
  - `app/api/users/route.ts` (Lignes 103, 124)
    - *Anti-pattern:* `catch (error: any)`
    - *Remédiation:* `catch (error: unknown) { return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur interne" }, { status: 500 }); }`
  - `app/api/invoices/route.ts` (Ligne 74)
    - *Anti-pattern:* `catch (error: any)`
    - *Remédiation:* `catch (error: unknown) { const err = error instanceof Error ? error.message : "Erreur inconnue"; }`
  - `app/api/auth/login/route.ts` (Ligne 55)
    - *Anti-pattern:* `catch (configError: any)`
    - *Remédiation:* `catch (configError: unknown) { console.error("...", configError instanceof Error ? configError.message : String(configError)); }`
  - `app/api/quotes/convert/route.ts` (Ligne 49)
    - *Anti-pattern:* `catch (error: any)`
    - *Remédiation:* `catch (error: unknown) { const msg = error instanceof Error ? error.message : "Unknown error"; }`
  - `app/api/quotes/[id]/route.ts` (Ligne 131)
    - *Anti-pattern:* `db.transaction((quoteItems: any[]) => {`
    - *Remédiation:* `db.transaction((quoteItems: { description: string; quantity: number; unitPrice: number; }[]) => {`
  - `app/api/quotes/route.ts` (Ligne 115)
    - *Anti-pattern:* `db.transaction((quoteItems: any[]) => {`
    - *Remédiation:* `db.transaction((quoteItems: { description: string; quantity: number; unitPrice: number; }[]) => {`
  - `components/pages/invoice-editor.tsx` (Ligne 574)
    - *Anti-pattern:* `items: items as any,`
    - *Remédiation:* `items: items,` (ou utiliser le type `InvoiceItem[]` si nécessaire)
  - `components/pages/audit-logs.tsx` (Ligne 13)
    - *Anti-pattern:* `const [logs, setLogs] = React.useState<any[]>([])`
    - *Remédiation:* `const [logs, setLogs] = React.useState<AuditLog[]>([])` (en important/définissant `AuditLog`)
  - `components/pages/quote-editor.tsx` (Lignes 591, 602)
    - *Anti-pattern:* `items: items as any,`
    - *Remédiation:* `items: items,`
  - `components/pages/protected-app-shell.tsx` (Ligne 30)
    - *Anti-pattern:* `initialUser: any`
    - *Remédiation:* `initialUser: User | null` (avec `import { User } from '@/lib/store'`)
  - `components/pages/quotes.tsx` (Lignes 192, 306, 395, 496)
    - *Anti-pattern:* `catch (error: any)` et `getQuoteStatusVariant(quote.status as any)`
    - *Remédiation:* `catch (error: unknown) { ... }` et utiliser un type strict `QuoteStatus` pour `quote.status`.
  - `components/pages/credit-notes.tsx` (Ligne 94)
    - *Anti-pattern:* `(c as any).amount`
    - *Remédiation:* Mettre à jour le type de `c` ou utiliser `c.totalAmount` en l'ajoutant à l'interface.
  - `components/fullscreen-document-viewer.tsx` (Lignes 142, 178)
    - *Anti-pattern:* `(docProps.data as any)?.number`
    - *Remédiation:* Définir une interface commune pour `docProps.data` (ex: `{ number?: string; ... }`).
  - `lib/db.ts` (Lignes 105, 125, 401)
    - *Anti-pattern:* `statementCache: Map<string, any>;` et `catch (err: any)`
    - *Remédiation:* `statementCache: Map<string, Statement>;` et `catch (err: unknown)`.
  - `lib/services/InvoiceService.ts` (Ligne 15)
    - *Anti-pattern:* `createInvoice(data: any, userId: string, role: string)`
    - *Remédiation:* `createInvoice(data: InvoiceData, userId: string, role: string)` (avec l'interface `InvoiceData` appropriée).
  - `lib/repositories/UserRepository.ts` (Ligne 38)
    - *Anti-pattern:* `const values: any[] = [];`
    - *Remédiation:* `const values: (string | number | boolean | null)[] = [];`
  - `hooks/use-quotes.ts` (Lignes 44, 81)
    - *Anti-pattern:* `catch (error: any)`
    - *Remédiation:* `catch (error: unknown) { toast.error(error instanceof Error ? error.message : "Erreur"); }`

- **Analyse:** L'utilisation de `any` désactive les vérifications statiques, ce qui peut entraîner des exceptions à l'exécution et des bugs silencieux.

### Code Mort
- **Fichiers concernés:** Les imports de modules de base non utilisés.
- **Analyse:** Augmente la taille des bundles et complexifie la lecture.
- **Remédiation:** Un nettoyage via `eslint-plugin-unused-imports` ou un balayage tsc strict est requis (bien que hors du scope de modification de fichiers source pour le moment).

### Code Dupliqué (DRY)
- **Analyse:** La génération de contenu CSV (`csvContent` et `rows`) est dupliquée dans les pages Payments, Invoices, Services, Quotes, Clients, et Credit-Notes.
- **Fichiers concernés:**
  - `components/pages/payments.tsx` (Ligne 216)
  - `components/pages/invoices.tsx` (Ligne 334)
  - `components/pages/services.tsx` (Ligne 219)
  - `components/pages/quotes.tsx` (Ligne 210)
  - `components/pages/clients.tsx` (Ligne 226)
  - `components/pages/credit-notes.tsx` (Ligne 95)
- **Remédiation:** Créer une fonction utilitaire centrale.
  ```typescript
  // Dans lib/utils.ts
  export function generateCSV(headers: string[], rows: (string | number)[][]): string {
    return [headers, ...rows].map(e => e.join(",")).join("\n");
  }
  ```

## 2. LOGIQUE REACT ET ANTI-PATTERNS UI

### Hooks Dangereux (`useEffect` sans dépendances exhaustives)
- **Fichiers concernés:**
  - `components/pages/protected-app-shell.tsx` (Ligne 42)
    - *Problème:* Synchronisation des utilisateurs manquant de sécurité contre les `stale closures`.
    - *Remédiation:*
      ```typescript
      React.useEffect(() => {
        if (initialUser && (!user || user.id !== initialUser.id || user.role !== initialUser.role)) {
          setUser(initialUser)
        }
      }, [initialUser, user?.id, user?.role, setUser])
      ```
  - `components/pages/invoice-editor.tsx` (Lignes 79, 91)
    - *Problème:* Le retour de nettoyage référence `localDraft` potentiellement obsolète, et le chargement via `editingId` omet la gestion correcte de `controller.abort()` au démontage.
    - *Remédiation (Ligne 79):*
      ```typescript
      React.useEffect(() => {
        return () => {
           setInvoiceDraft(localDraft);
        };
      }, [localDraft, setInvoiceDraft]);
      ```
    - *Remédiation (Ligne 91):* Ajouter `return () => controller.abort();` à la fin du `useEffect`.

### Gestion des Erreurs et Fetch API
- **Fichiers concernés:**
  - `components/pages/payments.tsx` (Lignes 58-59, 168-169)
  - `components/pages/quotes.tsx` (Lignes 186-187)
  - `hooks/use-quotes.ts` (Lignes 73-74)
- **Analyse:** Appels à `fetch(...).then(res => res.json())` sans `try/catch` ou vérification de `res.ok`.
- **Remédiation:**
  ```typescript
  // Au lieu de: fetch('/api/invoices').then(res => res.json())
  // Utiliser:
  try {
    const res = await fetch('/api/invoices');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Failed to fetch:", err);
    throw err;
  }
  ```

### Prop Drilling
- **Fichiers concernés:** `components/pages/protected-app-shell.tsx` -> `Dashboard` / `UsersPage` (ex: `onNavigate`).
- **Analyse:** Passage manuel de propriétés sur plusieurs niveaux au lieu d'utiliser le store Zustand existant.
- **Remédiation:** Placer `onNavigate` dans le store Zustand (`useStore(state => state.navigate)`) pour un accès direct depuis n'importe quel composant enfant.

## 3. ARCHITECTURE ELECTRON ET IPC

### Fuites de mémoire (Nettoyage `ipcMain` / `ipcRenderer`)
- **Fichiers concernés:** `main.js`, `preload.js`
- **Analyse:** Utilisation correcte de `ipcRenderer.invoke` qui ne laisse pas de listeners orphelins. Cependant, vérifier s'il existe des écoutes actives avec `ipcRenderer.on` qui ne sont pas nettoyées.
- **Remédiation:** Pour tout `ipcRenderer.on` côté client React, toujours retourner une fonction de nettoyage.
  ```javascript
  useEffect(() => {
    const handler = (_event, data) => console.log(data);
    window.electron.ipcRenderer.on('event', handler);
    return () => window.electron.ipcRenderer.removeListener('event', handler);
  }, []);
  ```

### Sécurité du Pont Preload
- **Fichier:** `preload.js`
- **Analyse:** Le `contextBridge` masque l'objet `ipcRenderer` correctement. L'implémentation est sûre (aucune exposition de variables globales `process` ou `event`).
- **Remédiation:** Aucune action corrective requise, l'architecture respecte les standards de sécurité Electron.

## 4. BASE DE DONNÉES ET PERFORMANCES (SQLITE)

### Requêtes N+1 / Appels SQL dans des boucles
- **Fichiers concernés:**
  - `app/api/quotes/[id]/route.ts` (Ligne 164)
- **Analyse:** `insertItem.run()` est exécuté dans une boucle. `better-sqlite3` le gère bien car il est préparé en amont et englobé dans une transaction (`db.transaction`), cependant cela pourrait être optimisé pour de grandes insertions massives en utilisant une syntaxe d'insertion par lots si `better-sqlite3` le permet, bien que l'approche actuelle soit standard pour ce driver.
- **Remédiation:** L'approche actuelle est valide. Pas de changement majeur requis si c'est encapsulé dans une transaction et que le statement est préparé en dehors de la boucle (ce qui est le cas).

### Indexation manquante
- **Fichiers concernés:** `lib/db.ts`
- **Analyse:** Pas d'index sur les colonnes souvent filtrées comme `deletedAt` et `status`.
- **Remédiation:** Ajouter la création d'index à l'initialisation de la base (par exemple vers la ligne 580 de `lib/db.ts`).
  ```typescript
  // À ajouter dans la phase d'initialisation de lib/db.ts:
  try {
    db.prepare('CREATE INDEX IF NOT EXISTS idx_users_deletedAt ON users(deletedAt);').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_quotes_deletedAt ON quotes(deletedAt);').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_invoices_deletedAt ON invoices(deletedAt);').run();
    db.prepare('CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);').run();
  } catch (e) {
    console.error("Erreur lors de la création des index:", e);
  }
  ```
