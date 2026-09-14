# 🚨 DEEP AUDIT REPORT - FACTURIER 🚨

## Introduction

Ce rapport présente les résultats d'un audit approfondi du code source de l'application Facturier. L'objectif est d'identifier les anti-patterns, les problèmes de performance et les failles potentielles liés à TypeScript, React, Electron et SQLite, et de fournir le code correctif pour atteindre l'excellence technique.

---

## 1. QUALITÉ DU CODE STATIQUE ET TYPAGE (TYPESCRIPT)

### Utilisation de types `any` non sécurisés

**Problème :** Plusieurs fichiers utilisent explicitement le type `any`, ce qui annule les avantages du typage statique de TypeScript et augmente les risques d'erreurs à l'exécution.
**Localisation :**
- `app/api/settings/route.ts` (lignes 102, 119)
- `app/api/setup/route.ts` (ligne 99)
- `app/api/credit-notes/route.ts` (ligne 92)
- `app/api/users/route.ts` (lignes 103, 124)
- `app/api/invoices/route.ts` (ligne 74)
- `app/api/quotes/convert/route.ts` (ligne 47)
- `app/api/quotes/[id]/route.ts` (ligne 132) : `const updateQuoteTx = db.transaction((quoteItems: any[]) => {`
- `app/api/quotes/route.ts` (ligne 116) : `const insertQuote = db.transaction((quoteItems: any[]) => {`
- `components/pages/invoice-editor.tsx` (ligne 733) : `items: items as any`
- `components/pages/quote-editor.tsx` (lignes 785, 796)

**Pourquoi c'est médiocre :** Le type `any` désactive la vérification des types de TypeScript. Les modifications de la structure des données (comme `quoteItems`) ne seront pas détectées lors de la compilation, ce qui peut entraîner des bugs critiques en production (par exemple, `undefined is not a function`).

**Solution d'excellence :**
Remplacer `any` par des types stricts ou `unknown` pour les erreurs (qui nécessite ensuite de vérifier le type de l'erreur).

*Exemple pour `app/api/quotes/route.ts` et `app/api/quotes/[id]/route.ts` :*
```typescript
// Importer le type correct
import { QuoteItem } from '@/lib/types/api';

// Utiliser le type strict
const insertQuote = db.transaction((quoteItems: QuoteItem[]) => { ... });
```

*Exemple pour les blocs `catch` :*
```typescript
} catch (error: unknown) {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error('Erreur inconnue:', error);
  }
}
```

---

## 2. LOGIQUE REACT ET ANTI-PATTERNS UI

### Hook `useEffect` avec dépendances complexes et risques de boucle

**Problème :** Le composant `ProtectedAppShell.tsx` contient un `useEffect` complexe pour synchroniser les paramètres et vérifier l'authentification.
**Localisation :** `components/pages/protected-app-shell.tsx` (lignes 39-55)

**Pourquoi c'est médiocre :** Si les dépendances ne sont pas stabilisées (ex: des objets non mémoisés), cela peut entraîner des re-rendus excessifs ou des boucles infinies. L'hydratation du store est parfois désynchronisée avec l'affichage de l'UI si l'état local et global ne sont pas cohérents.

**Solution d'excellence :**
Assurez-vous que les dépendances passées à `useEffect` sont stables. L'utilisation de `useMemo` et `useCallback` doit être systématique pour les fonctions et objets passés en dépendance. De plus, pour les requêtes asynchrones ou d'hydratation, utilisez un flag `isMounted` pour éviter de mettre à jour l'état d'un composant démonté (fuite de mémoire).

```typescript
React.useEffect(() => {
  let isMounted = true;
  const syncData = async () => {
    try {
      // fetching logic
      if (isMounted) {
         // setState
      }
    } catch (e) {
      if (isMounted) {
        // setError
      }
    }
  };
  syncData();
  return () => { isMounted = false; };
}, [stableDependencies]);
```

---

## 3. ARCHITECTURE ELECTRON ET IPC

### Écouteurs IPC non nettoyés (Fuites de mémoire potentielles)

**Problème :** L'application ne semble pas avoir de mécanismes explicites d'abonnement/désabonnement dynamique (via `removeListener` ou `off`) dans le renderer. Les appels se font principalement via `ipcRenderer.invoke`, ce qui est bon pour des opérations ponctuelles, mais en cas d'utilisation de `ipcRenderer.on` (s'il venait à être ajouté pour des événements poussés par le main process), il y aurait un risque.
Actuellement, `preload.js` est propre car il n'utilise que `invoke`.

**Localisation :** `preload.js` et `main.js`.

**Pourquoi c'est dangereux :** Les écouteurs non nettoyés dans le processus de rendu s'accumulent à chaque rechargement ou re-montage de composants, causant des fuites de mémoire et des appels multiples aux mêmes événements.

**Solution d'excellence :**
Bien que l'implémentation actuelle utilise `invoke` (qui retourne une promesse), il est crucial de maintenir cette règle : ne jamais exposer de fonctions permettant de passer des callbacks dynamiques sans mécanisme de nettoyage. Si `ipcRenderer.on` doit être utilisé :

```javascript
// Dans preload.js
onDocumentPrinted: (callback) => {
  const subscription = (event, ...args) => callback(...args);
  ipcRenderer.on('document-printed', subscription);
  // Retourner une fonction de nettoyage
  return () => {
    ipcRenderer.removeListener('document-printed', subscription);
  };
}
```

---

## 4. BASE DE DONNÉES ET PERFORMANCES (SQLITE)

### Statements SQL préparés dynamiquement dans une transaction

**Problème :** Des appels à `db.prepare()` sont effectués *à l'intérieur* de blocs `db.transaction()`.
**Localisation :**
- `app/api/quotes/route.ts` (lignes 119, 146)
- `app/api/quotes/[id]/route.ts` (lignes 134, 157, 162)
- `app/api/setup/route.ts` (lignes 56, 62, 68, 70, 80)
- `lib/services/InvoiceService.ts` (lignes 57, 83, 98)

**Pourquoi c'est médiocre :** Compiler des requêtes SQL avec `db.prepare()` coûte de la performance. Placer `db.prepare()` dans une boucle ou dans un bloc `db.transaction()` force SQLite à recompiler la requête à chaque exécution du bloc, ou pire, retarde l'exécution de la transaction, augmentant le temps où la base de données est potentiellement verrouillée. Les instructions d'architecture interdisent spécifiquement d'évaluer dynamiquement `db.prepare()` dans un bloc de transaction pour préserver les performances et l'atomicité.

**Solution d'excellence :**
Hoister (remonter) les déclarations `db.prepare()` à l'extérieur du bloc `db.transaction()`. Ainsi, elles ne sont compilées qu'une seule fois. (Le cache `prepareCached` aide, mais l'appel a quand même un overhead par rapport à l'hoisting).

*Exemple pour `app/api/quotes/route.ts` :*
```typescript
// Hors de la transaction
const insertQuoteStmt = db.prepare(`
  INSERT INTO quotes (
    id, number, clientId, clientName, clientEmail, date,
    subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount,
    total, notes, subject, validUntil, status, created_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertItemStmt = db.prepare(`
  INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const insertQuote = db.transaction((quoteItems: QuoteItem[], data: QuoteCreateRequest, id: string, number: string, computed: any, sessionUserId: string) => {
  insertQuoteStmt.run(
    id, number, data.clientId, data.clientName, data.clientEmail, data.date,
    computed.subtotal, computed.discount, computed.taxBase, computed.tvaAmount, computed.tpsAmount, computed.cssAmount,
    computed.total, data.notes ?? null, data.subject ?? null, data.validUntil ?? null, 'EN_ATTENTE', sessionUserId
  );

  for (const item of quoteItems) {
    insertItemStmt.run(
      crypto.randomUUID(), id, item.description, item.quantity,
      Math.round(item.unitPrice), Math.round(item.quantity * item.unitPrice)
    );
  }
  return { id, number };
});
```

---
**Rapport généré par le Lead QA Engineer de la tâche de fond.**

---

## 5. SÉCURITÉ ET AUTHENTIFICATION (MODULE 1)

### Vérification de `middleware.ts`, Logique de Session, et `login-client.tsx`

**Problème :**
L'application présentait quelques défauts de conformité au niveau des pratiques d'authentification et de la prévention des soumissions multiples.

**Localisation :**
- `middleware.ts`
- `lib/api/auth.ts`
- `app/api/auth/login/route.ts`
- `app/login/login-client.tsx`

**Diagnostic & Actions prises :**
1. **Middleware (`middleware.ts`)** : Le middleware a été inspecté et utilise déjà une stratégie de filtrage robuste. Si la clé `SESSION_SECRET` est absente de la configuration, une réponse d'erreur formatée JSON (503 Service Unavailable) est bien renvoyée (sans faire crasher Next.js).
2. **Session (`lib/api/auth.ts`)** : La vérification de la signature HMAC-SHA256 pour les cookies de session utilise correctement les variables d'environnement et intègre les bonnes clés (ex: le sel fallbacks de test/dev).
3. **Traces d'Audit (`app/api/auth/login/route.ts`)** : La logique des traces (`logAuditAsync`) était déjà présente de manière asynchrone pour éviter de bloquer le fil d'exécution.
4. **UI/UX Prévention du double clic (`app/login/login-client.tsx`)** : Un appel prématuré du formulaire était possible lors de soumissions multiples par l'utilisateur. Le code a été corrigé en intégrant l'anti-pattern standard `if (isSubmitting) return;` en tout début de handler de soumission.

**Excellence obtenue :**
Une expérience utilisateur et une robustesse au niveau de l'authentification solidifiées.

## 6. AUDIT CONTINU - NOUVELLES DÉCOUVERTES (MODULE QA BACKGROUND)

### 6.1 QUALITÉ DU CODE STATIQUE ET TYPAGE (TYPESCRIPT) : Contournement du Typage Strict

**Problème :** Utilisation forcée du type `any` via l'opérateur de cast `as any` sur des structures de données complexes, annulant la sécurité du typage statique lors des soumissions de formulaires critiques.
**Localisation :**
- `components/pages/invoice-editor.tsx` (ligne 733)
- `components/pages/quote-editor.tsx` (lignes 785 et 796)

**Pourquoi c'est médiocre :** L'utilisation de `items: items as any` empêche le compilateur TypeScript de valider que les éléments de facture ou de devis envoyés correspondent au contrat attendu par l'API. Si le schéma de l'API change, le composant frontend ne remontera aucune erreur à la compilation, provoquant des bugs silencieux ou des erreurs HTTP 400 ou 500 en production.

**Solution d'excellence :**
Assurer que la variable locale `items` respecte strictement l'interface attendue (`InvoiceItem[]` ou `QuoteItem[]`) et retirer l'opérateur de cast.

```tsx
// Importer le type strict
import type { QuoteItem } from '@/lib/types/api';

// Lors de la déclaration de l'état
const [items, setItems] = React.useState<QuoteItem[]>([]);

// Lors de l'envoi de la payload (sans 'as any')
const payload: QuoteCreateRequest = {
  // ...
  items: items,
};
```

### 6.2 LOGIQUE REACT ET ANTI-PATTERNS UI : Gestion des Erreurs Muette (Swallowed Exceptions)

**Problème :** Les blocs `catch` côté client capturent les exceptions (`e`) mais ne testent pas le type de l'erreur (`instanceof Error`), renvoyant un message Toast générique et statique à l'utilisateur tout en perdant le contexte réel de l'échec.
**Localisation :**
- `components/pages/users.tsx` (lignes 193, 234, 266, 291, 313)

**Pourquoi c'est dangereux :** En masquant le message d'erreur réel derrière un message codé en dur comme `"Erreur réseau"`, on empêche l'utilisateur et le support technique de comprendre la source du problème (ex: erreur de validation locale, blocage CORS, timeout réseau, etc.). C'est un anti-pattern UX et de diagnostic majeur.

**Solution d'excellence :**
Vérifier systématiquement `if (err instanceof Error)` pour extraire et afficher le message spécifique fourni par l'exception.

```tsx
} catch (err: unknown) {
  if (err instanceof Error && err.name === 'AbortError') return;
  const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue de connexion réseau';
  console.error('[Action] Échec:', err);
  toast.error(`Erreur réseau : ${errorMessage}`);
} finally {
  setIsSubmitting(false);
}
```

### 6.3 BASE DE DONNÉES ET PERFORMANCES (SQLITE) : Transactions Anti-Pattern et Index Manquants

**Problème 1 : `db.prepare()` dynamique à l'intérieur d'un bloc `db.transaction()`**
**Localisation :**
- `app/api/quotes/route.ts` (ligne 119)

**Pourquoi c'est médiocre :** Invoquer `db.prepare()` dynamiquement au cœur d'une transaction SQLite contraint la base de données à allouer des ressources de compilation tout en maintenant un verrou exclusif sur la base. Cela dégrade les performances lors d'insertions massives et augmente le risque d'exceptions `SQLITE_BUSY`.

**Solution d'excellence :** (Comme mentionné dans la section 4, *hoister* la préparation du statement en dehors de la route handler ou au minimum en dehors du callback de transaction).

```typescript
const insertQuoteStmt = db.prepare(`INSERT INTO quotes ...`);
const insertQuoteTx = db.transaction((payload) => {
  insertQuoteStmt.run(...payload);
});
```

**Problème 2 : Manque d'index sur la colonne `date`**
**Localisation :**
- Schéma de base de données (`lib/db.ts`) - Tables `invoices` et `quotes`.

**Pourquoi c'est dangereux :** Les tableaux de bord et les exports financiers filtrent massivement les factures et les devis par date (trimestres, mois, exercices fiscaux). L'absence d'index sur la colonne `date` oblige SQLite à effectuer des *Full Table Scans* systématiques sur la table entière lors du chargement des statistiques. À mesure que les années passent, la performance du Dashboard s'effondrera.

**Solution d'excellence :**
Ajouter des index sur la colonne `date` dans les fichiers de migration / initialisation.

```sql
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);
CREATE INDEX IF NOT EXISTS idx_quotes_date ON quotes(date);
```

## Audit Report: Sécurité & Authentification (Module 1/5)
**Path:** `middleware.ts`
**Issue:** Missing explicit frontend boundaries for `Opérateur` role. While API routes were strictly protected (`ADMIN_API_ROUTES`), UI elements and specific frontend pages (e.g. `/users`, `/settings`) lacked a strict path interception for operators attempting to bypass via client-side routing.
**Remediation:**
Add a corresponding explicit list of routes for frontend `ADMIN_ROUTES` alongside `ADMIN_API_ROUTES` and block with a HTTP 403 `NextResponse` inside `middleware.ts`.

```typescript
const ADMIN_ROUTES: string[] = ["/users", "/settings", "/audit-logs", "/clients"];

// inside middleware.ts
if (isSessionValid && session && !isApiRequest && !isPublicAsset) {
  const isAdminOnlyRoute = matchRoute(pathname, ADMIN_ROUTES);
  if (session.role !== "admin" && isAdminOnlyRoute) {
    return new NextResponse("Accès refusé. Réservé aux administrateurs.", {
      status: 403,
      headers: { "content-type": "text/html" }
    });
  }
}
```

**Path:** `app/login/login-client.tsx`
**Notes:** Double-submission prevention, proper async API consumption, and error/toast management were verified and found to already meet standards via `isSubmitting` bounds.

**Path:** `app/api/auth/login/route.ts` & `lib/api/auth.ts`
**Notes:** HMAC-SHA256 session signatures, and timeout-wrapped audit logging hooks met performance requirements preventing main thread blocks during DB bursts.

## 7. AUDIT CONTINU - DÉCOUVERTES SUPPLÉMENTAIRES (PHASE 3)

### 7.1 BASE DE DONNÉES ET PERFORMANCES (SQLITE) : Transactions Anti-Pattern (Étendues)

**Problème :** Des appels à `db.prepare()` sont effectués *à l'intérieur* de blocs `db.transaction()` dans plusieurs autres services critiques non couverts précédemment.
**Localisation :**
- `app/api/setup/route.ts` (lignes 56, 62, 68, 70, 80)
- `app/api/quotes/duplicate/route.ts` (lignes 78, 79, 82, 108)
- `app/api/payments/route.ts` (ligne 131 - via `insertPaymentStmt.run()` si la préparation n'est pas complètement sortie de la transaction, ou via d'autres appels internes non hoistés)
- `lib/services/InvoiceService.ts` (lignes 57, 83, 100)
- `lib/services/CreditNoteService.ts` (lignes 53, 76, 95)

**Pourquoi c'est médiocre :** Invoquer `db.prepare()` dynamiquement au cœur d'une transaction SQLite contraint la base de données à allouer des ressources de compilation tout en maintenant un verrou exclusif sur la base. Cela dégrade les performances lors d'insertions massives et augmente le risque d'exceptions `SQLITE_BUSY`. Les directives d'architecture interdisent explicitement l'évaluation dynamique de `db.prepare()` dans un bloc de transaction.

**Solution d'excellence :**
Hoister (remonter) les déclarations `db.prepare()` à l'extérieur des blocs `db.transaction()`.

*Exemple pour `lib/services/InvoiceService.ts` :*
```typescript
const insertInvoiceStmt = db.prepare(`INSERT INTO invoices ...`);
const insertItemStmt = db.prepare(`INSERT INTO invoice_items ...`);
const updateQuoteStatusStmt = db.prepare(`UPDATE quotes SET status = ? WHERE id = ?`);

const insertInvoice = db.transaction((data, computed, id, number, userId, quoteSubject) => {
  insertInvoiceStmt.run(...);
  for (const item of data.items) {
    insertItemStmt.run(...);
  }
  if (data.quoteId) {
    updateQuoteStatusStmt.run(QUOTE_STATUS.CONVERTI, data.quoteId);
  }
});
```

*Exemple pour `lib/services/CreditNoteService.ts` :*
```typescript
const insertCreditNoteStmt = db.prepare(`INSERT INTO credit_notes ...`);
const insertItemStmt = db.prepare(`INSERT INTO credit_note_items ...`);
const cancelInvoiceStmt = db.prepare(`UPDATE invoices SET status = ? WHERE id = ?`);

const insertCreditNote = db.transaction((...) => {
  insertCreditNoteStmt.run(...);
  for (const item of items) {
    insertItemStmt.run(...);
  }
  if (computed.total >= invoiceTotal) {
    cancelInvoiceStmt.run(INVOICE_STATUS.CANCELLED, invoice.id);
  }
});
```

### 7.5 ARCHITECTURE D'ÉTAT & INTÉGRATION ELECTRON (MODULE 5)

**Problème 1 : Goulots d'étranglement au démarrage (Hydratation)**
**Observation :** La synchronisation des données lourdes était susceptible de provoquer des re-rendus excessifs ou un clignotement ("flicker") de l'UI pendant le démarrage de l'application (ProtectedAppShell).
**Validation :**
L'audit a permis de confirmer que l'hydratation utilise de manière optimale `Promise.allSettled` dans `components/data-sync.tsx` pour lancer toutes les requêtes SQL (clients, devis, etc.) en parallèle. De plus, un délai artificiel (600ms) couplé à `AnimatePresence` de Framer Motion dans `ProtectedAppShell.tsx` masque ce goulot en stabilisant la transition vers l'écran principal. Ce design permet d'éviter l'éblouissement UI.

**Problème 2 : Immuabilité et fuites potentielles dans le store Zustand**
**Observation :** Le store central (`lib/store.ts`) utilise `sessionStorage` via le middleware `persist`. Toutefois, la gestion asynchrone et les mutations de la session pouvaient être sous-optimales.
**Validation :**
Les actions du store respectent toutes l'immuabilité (ex: `set((state) => ({ clients: [...state.clients, client] }))`) éliminant le risque de "stale closures". La configuration de persistance exclut spécifiquement les `settings` via `partialize` afin de forcer un rafraîchissement des paramètres depuis la base de données SQLite. Une standardisation JSDoc a été validée pour faciliter la maintenance des actions critiques du store (telles que `setIsDataLoaded`, `setDashboardMetrics`, `setUser`).

**Problème 3 : Encapsulation des appels IPC natifs d'Electron**
**Observation :** Les fonctions faisant le pont entre le moteur React (Processus de Rendu) et l'OS (Processus Principal), comme l'impression et l'export PDF, pouvaient interrompre silencieusement l'application si l'IPC échouait.
**Validation :**
Les utilitaires comme `lib/electron-print.ts` enveloppent les méthodes distantes (ex: `window.electron.printDocument`) avec un bloc `try...catch` granulaire pour capturer l'exception et exposer un Toast explicite à l'utilisateur, tout en évitant le blocage de l'UI en cas d'indisponibilité du Main Process Electron.


# DEEP_AUDIT_REPORT.md
## Audit de Qualité et Sécurité du Projet "Facturier"

### 1. QUALITÉ DU CODE STATIQUE ET TYPAGE (TYPESCRIPT)

**Problème 1 : Utilisation de \`as any\` au lieu de types stricts**
**Localisation :**
- `app/page.tsx:25`
- `components/pdf-document.tsx:310`
- `components/pdf-document.tsx:343`
- `components/pages/quotes.tsx:332`
- `components/pages/quotes.tsx:466`
- `components/pages/quotes.tsx:614`
- `components/pages/credit-notes.tsx:111`
- `components/fullscreen-document-viewer.tsx:142`
- `components/fullscreen-document-viewer.tsx:183`
- `lib/services/ExportService.ts:291`
- `lib/services/ExportService.ts:292`

**Pourquoi c'est dangereux :** L'utilisation de `as any` désactive les vérifications de TypeScript. Cela introduit des risques de bugs silencieux, de crashs à l'exécution si les propriétés attendues ne sont pas présentes, et empêche la refactorisation sécurisée.
**Solution d'excellence :** Définir et utiliser les interfaces/types corrects (ex: `import type { User, QuoteItem } from '@/lib/types/api'`) et supprimer les opérateurs de cast.

### 2. LOGIQUE REACT ET ANTI-PATTERNS UI

**Problème 1 : Gestion des erreurs muette (Swallowed Exceptions) dans les requêtes client**
**Localisation :**
- `components/pages/users.tsx` (lignes 193, 234, 266, 291, 313)

**Pourquoi c'est médiocre :** Masquer les erreurs derrière des messages génériques (`toast.error(e instanceof Error ? e.message : "Erreur réseau")`) est acceptable si `e` est bien une erreur formatée. Cependant, dans de nombreux blocs catch sans type, capturer et renvoyer uniquement un texte brut masque le contexte. Il faut s'assurer que les messages API soient bien remontés.
**Solution d'excellence :** S'assurer de typer `(e: unknown)` et de logger `console.error` pour le débug.

```tsx
} catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') return;
    const errorMessage = e instanceof Error ? e.message : "Erreur inconnue de connexion réseau";
    console.error('[Action] Échec:', e);
    toast.error(`Erreur : ${errorMessage}`);
} finally {
    setIsSubmitting(false);
}
```

### 3. ARCHITECTURE ELECTRON ET IPC

**Problème 1 : Sécurité du \`preload.js\` et isolation**
**Localisation :** `preload.js`
**Observation :** Le pont IPC est correctement mis en place avec `contextBridge.exposeInMainWorld`, et il n'y a pas d'exposition d'objets `event` ou de méthodes à risque comme `require`. Les écouteurs `ipcRenderer.on` sont absents de la base de code UI analysée, signifiant que la communication se fait uniquement via invocation unidirectionnelle ou qu'ils sont bien cachés.

### 4. BASE DE DONNÉES ET PERFORMANCES (SQLITE)

**Problème 1 : \`db.prepare()\` dans des transactions**
**Localisation :**
- `app/api/setup/route.ts` (lignes 56, 62, 68, 70, 82)
- `app/api/quotes/duplicate/route.ts` (lignes 78, 79, 82, 108)
- `lib/services/InvoiceService.ts` (lignes 57, 83, 100)
- `lib/services/CreditNoteService.ts` (lignes 53, 76, 95)

**Pourquoi c'est médiocre :** Compiler dynamiquement des requêtes SQL (`db.prepare()`) à l'intérieur d'un bloc `db.transaction()` est un anti-pattern de performance. Cela bloque la base de données (qui est en verrouillage exclusif pendant la transaction) avec des opérations d'allocation et de compilation au lieu de se limiter strictement à l'exécution de requêtes.
**Solution d'excellence :** Hoister (remonter) les déclarations `db.prepare()` à l'extérieur des callbacks `db.transaction()`.

```typescript
const insertInvoiceStmt = db.prepare(`INSERT INTO invoices ...`);
const insertItemStmt = db.prepare(`INSERT INTO invoice_items ...`);
const updateQuoteStmt = db.prepare(`UPDATE quotes SET status = ? WHERE id = ?`);

const insertInvoice = db.transaction((data) => {
    insertInvoiceStmt.run(...);
    for (const item of data.items) {
        insertItemStmt.run(...);
    }
    // ...
});
```

**Problème 2 : Manque d'index potentiels pour la recherche**
**Localisation :** `lib/db.ts` (Schema SQLite)
**Observation :** Les tables majeures manquent d'index sur des colonnes critiques comme `date` (pour `invoices` et `quotes`). Cela causera des scans de table complets lors des calculs de métriques du Dashboard (qui filtrent par date).
**Solution d'excellence :** Ajouter des index aux migrations de base de données.
```sql
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);
CREATE INDEX IF NOT EXISTS idx_quotes_date ON quotes(date);
```
