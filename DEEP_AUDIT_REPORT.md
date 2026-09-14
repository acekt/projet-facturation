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


## 7. AUDIT PROFOND (MODULE QA BACKGROUND) - NOUVELLES DÉCOUVERTES

### 7.1 QUALITÉ DU CODE STATIQUE ET TYPAGE (TYPESCRIPT) : Contournement du Typage Strict

**Problème :** Utilisation forcée du type `any` via l'opérateur de cast `as any` ou `(document as any)` sur des structures de données complexes.
**Localisation :**
- `components/pdf-document.tsx` (Lignes 310, 343)
- `app/api/settings/route.ts` (Lignes 102, 119)
- `components/pages/invoice-editor.tsx` (Ligne 733)
- `components/pages/quote-editor.tsx` (Lignes 785, 796)
- `components/fullscreen-document-viewer.tsx` (Ligne 165)

**Pourquoi c'est médiocre :**
Dans `pdf-document.tsx`, l'utilisation de `(document as any)` pour accéder dynamiquement à des propriétés (comme `notes` ou `discount`) indique un type union mal discriminé en amont. En forçant via `any`, on désactive la vérification TypeScript.
Dans les fichiers de formulaires (`invoice-editor.tsx`, `quote-editor.tsx`), l'utilisation de `items: items as any` empêche le compilateur TypeScript de valider que les éléments envoyés correspondent au contrat attendu par l'API.
Dans les blocs catch, forcer `any` (`catch (error: any)`) masque l'obligation de vérifier la structure de l'erreur avant de lire ses propriétés (`error.message`).

**Solution d'excellence :**
Pour les objets incertains, utiliser des Type Guards (Prédicats de type) ou définir un type union discriminé explicite, puis manipuler l'objet de façon typée sans `any`. Pour les formulaires, utiliser strictement l'interface attendue (`InvoiceItem[]` ou `QuoteItem[]`). Pour les erreurs, utiliser `unknown`.

```tsx
// Exemple pour pdf-document.tsx
function hasNotes(doc: unknown): doc is { notes: string | null } {
  return typeof doc === 'object' && doc !== null && 'notes' in doc;
}
<Text>Objet: {(hasNotes(document) ? document.notes : null) || "Prestations de services"}</Text>

// Exemple pour les blocs Catch (app/api/settings/route.ts)
} catch (error: unknown) {
  let errorMessage = "Erreur inconnue";
  if (error instanceof Error) {
    errorMessage = error.message;
  }
  console.error('Erreur:', errorMessage);
}
```

### 7.2 LOGIQUE REACT ET ANTI-PATTERNS UI : Boucles useEffect et Dépendances Manquantes

**Problème :** Risque de dépendances manquantes ou de boucles dans les hooks `useEffect`.
**Localisation :**
- `components/pages/invoice-editor.tsx` (Multiples lignes, ex: 107, 132)

**Pourquoi c'est médiocre :** Les composants complexes ayant de multiples `useEffect` (parfois imbriqués ou synchronisant plusieurs états dérivés) sont propices aux bugs de synchronisation, aux "stale closures" (fermetures périmées) et aux re-rendus excessifs ("render cascades"). Ce motif est symptomatique d'une architecture React où les états dérivés ne sont pas calculés à la volée pendant le rendu.

**Solution d'excellence :**
Calculer les états dérivés directement pendant le rendu de la fonction composant plutôt que de synchroniser un état avec `useEffect`. Utiliser `useMemo` pour les calculs coûteux et s'assurer systématiquement via le linter que le tableau de dépendances `[]` est exhaustif.

### 7.3 ARCHITECTURE ELECTRON ET IPC : Nettoyage Manquant des Écouteurs

**Problème :** Risques de fuites de mémoire liées à l'absence de nettoyage des écouteurs IPC dans l'environnement Electron.
**Localisation :**
- `preload.js`
- `main.js` (Lignes 50-65 pour les événements natifs `app.on` / `process.on`)

**Pourquoi c'est médiocre :** Si des écouteurs `ipcRenderer.on` ou `window.electron.on` sont souscrits dans des composants React (qui se montent et démontent fréquemment) sans être explicitement désenregistrés via `removeListener` dans la fonction de nettoyage du `useEffect`, cela entraîne des fuites de mémoire. Chaque nouveau montage ajoute un écouteur dupliqué. Le code existant privilégie `ipcMain.handle` (Promesses unilatérales), ce qui est bien, mais toute méthode `.on()` asynchrone continue doit être isolée.

**Solution d'excellence :**
Toujours retourner une fonction de désinscription dans les hooks d'abonnement.
```javascript
useEffect(() => {
  const unlisten = window.electron.on('update-status', (status) => setStatus(status));
  // Le retour nettoie l'écouteur au démontage
  return () => unlisten();
}, []);
```

### 7.4 BASE DE DONNÉES ET PERFORMANCES (SQLITE) : Requêtes N+1 et Appels db.prepare() Dynamiques

**Problème 1 :** L'approche N+1 dans l'itération des listes (potentiel structurel).
**Localisation :**
- Les routes d'API qui itèrent sur des listes (ex: `app/api/services/route.ts`, `app/api/payments/route.ts`).

**Pourquoi c'est médiocre :** Bien que l'application gère cela plutôt correctement via `json_group_array` actuellement, la création de boucles `map` côté serveur contenant une requête SQL (par exemple pour aller chercher les items d'une facture un à un) est l'anti-pattern absolu en termes de performance I/O.

**Solution d'excellence :** Toujours privilégier les clauses JOIN ou l'agrégation SQL (JSON) pour résoudre les relations N+1 en une seule passe côté base de données, comme c'est le cas dans la route `credit-notes`.

**Problème 2 :** Utilisation de `db.prepare()` à l'intérieur d'un bloc `db.transaction()`.
**Localisation :**
- `lib/services/InvoiceService.ts` (Ligne 57)
- `lib/services/QuoteService.ts` (Ligne 45)

**Pourquoi c'est médiocre :** Tel que défini dans les principes du projet (Pillar 4), évaluer dynamiquement `db.prepare()` à l'intérieur du bloc de transaction retarde la complétion de la transaction et augmente la probabilité de lock "DB BUSY".

**Solution d'excellence :**
Hoister la préparation du statement en dehors de la méthode ou du bloc de transaction.
```typescript
const insertInvoiceStmt = db.prepare('INSERT INTO invoices ...');
const convert = db.transaction((...) => {
    insertInvoiceStmt.run(...);
});
```
# DIAGNOSTIC & REFACTORING REPORT: SÉCURITÉ & AUTHENTIFICATION (MODULE 1/5)

Ce document présente l'audit approfondi et les correctifs proposés pour le système d'authentification et de sécurité du projet "Facturier". Conformément à la directive système, aucun code source n'a été directement modifié, les propositions de remédiation sont fournies ci-dessous.

## 1. Analyse du Middleware (`middleware.ts`)

### ⚠️ Faille et Limites Identifiées :
- **Protection des routes RBAC par `startsWith`** : La vérification `pathname.startsWith('/api/users')` est vulnérable à des contournements. Si un utilisateur accède à `/api/users-public` ou `app/api/users123`, le middleware bloquerait la requête de façon non intentionnelle. Idéalement il faut tester l'exactitude de la route ou utiliser une regex plus stricte.
- **Gestion des extensions de fichiers statiques** : Bien que corrigé partiellement avec une regex pour bypasser l'authentification sur les assets statiques, il faut s'assurer que les requêtes vers d'autres endpoints API ne peuvent pas simuler une extension (ex: `/api/users/1.json`). La vérification `pathname.startsWith('/api')` doit avoir la priorité sur la vérification des assets statiques.
- **Lisibilité et maintenabilité** : La logique du middleware est monolithique. L'utilisation d'un objet de configuration avec des tableaux pour définir les routes publiques et protégées permettrait de simplifier la maintenance.
- **Vérification du secret** : L'utilisation de `try/catch` de base est fonctionnelle mais l'ensemble du middleware pourrait retourner une erreur plus générique en 500 si la vérification échoue de façon non prévue.

### ✅ Code Refactorisé (`middleware.ts`) :

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Récupère le secret de session depuis les variables d'environnement.
 */
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (secret && secret.length >= 32) {
    return secret
  }
  if (process.env.NODE_ENV === 'development' || (!process.env.NODE_ENV && process.env.VITEST !== 'true')) {
    return 'facturier-gabon-2026-fallback-dev-secret-key-32chars!!'
  }
  throw new Error(
    '[SECURITY] SESSION_SECRET environment variable is missing or too short (minimum 32 characters).'
  )
}

function str2ab(str: string) {
  const encoder = new TextEncoder()
  return encoder.encode(str)
}

function base64ToUint8Array(base64: string) {
  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(base64, 'base64'))
  }
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

async function verifySignature(data: string, signature: string, secret: string) {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      str2ab(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sigBuf = base64ToUint8Array(signature);
    const dataBuf = str2ab(data);
    return await crypto.subtle.verify('HMAC', key, sigBuf, dataBuf);
  } catch (e) {
    return false;
  }
}

async function getSession(cookieValue: string, secret: string) {
  const [data, signature] = cookieValue.split('.')
  if (!data || !signature) return null

  const isValid = await verifySignature(data, signature, secret)
  if (!isValid) return null

  try {
    const decoded = atob(data)
    return JSON.parse(decoded)
  } catch (e) {
    return null
  }
}

// Configuration des routes
const PUBLIC_ROUTES = ['/login', '/setup']
const PUBLIC_API_ROUTES = ['/api/auth', '/api/setup', '/api/health']
const ADMIN_API_ROUTES = ['/api/audit-logs', '/api/users', '/api/clients']
const ADMIN_FRONTEND_ROUTES = ['/audit', '/users', '/clients', '/services', '/customers']
const STATIC_ASSET_REGEX = /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff|woff2|ttf|otf|map)$/i

export async function middleware(request: NextRequest) {
  let SESSION_SECRET: string
  try {
    SESSION_SECRET = getSessionSecret()
  } catch (e) {
    return new NextResponse(
      JSON.stringify({ error: 'Configuration serveur invalide. Contactez l\'administrateur.' }),
      { status: 503, headers: { 'content-type': 'application/json' } }
    )
  }

  const { pathname } = request.nextUrl
  const sessionCookie = request.cookies.get('auth_session')

  // Helpers pour les routes
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))
  const isPublicApi = PUBLIC_API_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))
  const isPublicAsset = pathname.startsWith('/_next') || (STATIC_ASSET_REGEX.test(pathname) && !pathname.startsWith('/api'))

  // Validation de la session
  const session = sessionCookie ? await getSession(sessionCookie.value, SESSION_SECRET) : null
  const isSessionValid = Boolean(session && session.exp >= Date.now())

  // Gestion des routes publiques
  if (isPublicRoute) {
    if (sessionCookie && !isSessionValid) {
      const response = NextResponse.next()
      response.cookies.delete('auth_session')
      return response
    }
    return NextResponse.next()
  }

  // Redirection si non authentifié sur une route protégée
  if (!isSessionValid && !isPublicApi && !isPublicAsset) {
    if (pathname.startsWith('/api')) {
      return new NextResponse(JSON.stringify({ error: 'Unauthorized: Session invalid or expired' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      })
    }
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('auth_session')
    return response
  }

  // Contrôle RBAC (Role-Based Access Control)
  if (isSessionValid && session) {
    const role = session.role
    const isApiRequest = pathname.startsWith('/api')

    const isAdminOnlyRoute = ADMIN_FRONTEND_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))
    const isAdminOnlyApi = ADMIN_API_ROUTES.some(api => pathname === api || pathname.startsWith(api + '/'))

    if (role === 'user' || role === 'operator') {
      if (isAdminOnlyRoute) {
         return NextResponse.redirect(new URL('/?error=user_restricted', request.url))
      }
      if (isAdminOnlyApi) {
        return new NextResponse(JSON.stringify({ error: 'Accès réservé aux administrateurs' }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        })
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

## 2. Logique de Session & API d'authentification (`app/api/auth/login/route.ts`)

### ⚠️ Faille et Limites Identifiées :
- **Traces d'Audit (Performance)** : L'utilisation de `setTimeout(() => { logAudit(...) }, 0)` pour éviter de bloquer le thread principal est une bonne pratique, mais les exceptions `try/catch` encapsulées manquent parfois de typage explicite et d'un traitement d'erreur standardisé.
- **Vérification de mot de passe (Fail-back Legacy)** : Si le mot de passe correspond à un hachage SHA-256 legacy, il devrait idéalement être ré-haché en bcrypt à la volée. Bien que ce soit une évolution fonctionnelle, le fallback actuel fait le job mais devrait être documenté comme "A REMPLACER" à terme.
- **Réponse HTTP en dur** : Les données retournées sont adéquates, mais les imports et types pourraient être mieux groupés.

### ✅ Code Refactorisé (`app/api/auth/login/route.ts`) :

```typescript
import { NextResponse } from 'next/server';
import { UserRepository } from '@/lib/repositories/UserRepository';
import db from '@/lib/db';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { loginSchema } from '@/lib/validations';
import type { LoginRequest, SessionResponse, ErrorResponse, DbUser } from '@/lib/types/api';
import { logAudit } from '@/lib/api/audit';
import bcrypt from 'bcryptjs';

/**
 * Assure la présence et la longueur minimale d'une variable d'environnement critique.
 */
function getRequiredEnv(varName: string, minLength: number = 16): string {
  const value = process.env[varName];
  if (!value || value.length < minLength) {
    throw new Error(
      `[SECURITY] Environment variable '${varName}' is missing or too short (minimum ${minLength} characters).`
    );
  }
  return value;
}

function hashPassword(password: string): string {
  const salt = getRequiredEnv('PASSWORD_SALT', 16);
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

async function signSession(data: string): Promise<string> {
  const secret = getRequiredEnv('SESSION_SECRET', 32);
  const key = await crypto.webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.webcrypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(data)
  );

  const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return `${data}.${base64Signature}`;
}

/**
 * Helper asynchrone pour les logs d'audit non-bloquants
 */
const logAuditAsync = (action: string, entityType: string, entityId: string | null, details: string, userId: string | null, userName?: string | null) => {
  setTimeout(() => {
    try {
      logAudit(action, entityType, entityId, details, userId, userName);
    } catch (e) {
      console.error('[Audit Log Error]', e);
    }
  }, 0);
};

export async function POST(request: Request) {
  try {
    try {
      getRequiredEnv('PASSWORD_SALT', 16);
      getRequiredEnv('SESSION_SECRET', 32);
    } catch (configError) {
      return NextResponse.json({ error: "Configuration serveur invalide. Contactez l'administrateur." } as ErrorResponse, { status: 503 });
    }

    const body: unknown = await request.json();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        error: 'Données de connexion invalides',
        details: { fieldErrors: validation.error.flatten().fieldErrors },
      } as ErrorResponse, { status: 400 });
    }

    const { username, password }: LoginRequest = validation.data;
    const cleanUsername = username.toLowerCase().trim();

    const user = db.prepare(`
      SELECT id, name, email, username, password, role, is_active, force_password_change, created_at, last_login_at, phone
      FROM users
      WHERE (LOWER(username) = ? OR LOWER(email) = ?) AND deletedAt IS NULL
    `).get(cleanUsername, cleanUsername) as DbUser | undefined;

    if (!user) {
      logAuditAsync('LOGIN_FAILED', 'user', null, 'Tentative de connexion échouée avec: ' + cleanUsername, null);
      return NextResponse.json({ error: 'Identifiants invalides' } as ErrorResponse, { status: 401 });
    }

    let isPasswordValid = false;
    try {
      isPasswordValid = await bcrypt.compare(password, user.password);
    } catch (e) {
      isPasswordValid = false;
    }

    // Fallback legacy SHA-256
    if (!isPasswordValid && user.password) {
      const legacyHash = hashPassword(password);
      isPasswordValid = user.password === legacyHash;

      // OPTIONAL: Update to bcrypt here seamlessly if successful
    }

    if (!isPasswordValid) {
      logAuditAsync('LOGIN_FAILED', 'user', user.id, 'Tentative de connexion échouée (mauvais mot de passe) pour: ' + cleanUsername, user.id, user.name);
      return NextResponse.json({ error: 'Identifiants invalides' } as ErrorResponse, { status: 401 });
    }

    if (user.is_active === 0) {
      return NextResponse.json({ error: 'Compte inactif. Veuillez contacter votre administrateur.' } as ErrorResponse, { status: 403 });
    }

    try {
      UserRepository.updateLastLogin(user.id);
    } catch (e) {
      console.error('[Login] Failed to update last_login_at:', e);
    }

    const sessionData = JSON.stringify({
      userId: user.id,
      name: user.name,
      role: user.role,
      exp: Date.now() + (24 * 60 * 60 * 1000)
    });

    const base64Data = Buffer.from(sessionData).toString('base64');
    const signedSession = await signSession(base64Data);

    const sessionPayload: SessionResponse = {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at,
        last_login_at: user.last_login_at,
        phone: user.phone,
      },
    };

    logAuditAsync('LOGIN_SUCCESS', 'user', user.id, 'Connexion réussie', user.id, user.name);

    const response = NextResponse.json(sessionPayload);

    // Cookie NextResponse
    response.cookies.set('auth_session', signedSession, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    // Cookie next/headers for RSC context
    try {
      (await cookies()).set('auth_session', signedSession, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24,
        path: '/',
      });
    } catch (e) {
      // Ignore outside request scope
    }

    return response;
  } catch (error) {
    console.error('[Login] Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' } as ErrorResponse, { status: 500 });
  }
}
```

## 3. UI/UX: Layout Racine (`app/layout.tsx`) et Client Login (`app/login/login-client.tsx`)

### ⚠️ Observations :
- Le layout `app/layout.tsx` est déjà très bien optimisé pour une app Electron (suppression d'analytics, typographie hors-ligne). La logique de thème via le script injecté prévient efficacement le FOUC (Flash of Unstyled Content).
- La page `login-client.tsx` gère proprement les états de chargement (`disabled={loading}`) avec des spinners clairs et un feedback utilisateur (Toasts), ainsi que la gestion de session (redirection rapide après authentification).
- Le design utilisant Tailwind est premium et intègre de bons contrastes, mais assurez-vous que les icônes (ex. `Loader2`) viennent d'une source packagée (`lucide-react`) plutôt que via un CDN pour garantir un fonctionnement hors-ligne.

### ✅ Amélioration UX globale (Aucun changement majeur de code requis) :
L'interface de la page de login gère déjà parfaitement :
- L'état `loading` pendant la résolution réseau (`fetch`).
- Le masquage/affichage du mot de passe en un clic.
- La remontée de messages d'erreur depuis l'API.

Toutefois, lors du rendu du composant, il faut s'assurer que si le cookie expire et redirige, le paramètre `?error=` de l'URL est intercepté et affiché via un `toast.error` au montage (ex: `useEffect` dans `login-client.tsx`).
