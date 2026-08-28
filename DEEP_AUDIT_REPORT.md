# 🚨 DEEP AUDIT REPORT 🚨

> *Diagnostic approfondi et impitoyable du code source (Mise à jour).*

## 1. QUALITÉ DU CODE STATIQUE ET TYPAGE (TYPESCRIPT)

### 🔴 Utilisation abusive de `any`, `as any` (Anti-pattern TypeScript)

**Fichier :** `./components/pdf-document.tsx`
**Ligne :** 310
**Danger :** Le cast silencieux avec `as any` désactive la vérification de type.
**Code Médiocre :**
```typescript
<Text>Objet: {('notes' in document ? (document as any).notes : null) || "Prestations de services"}</Text>
```
**Remédiation Exacte :**
```typescript
// Utiliser un garde de type (Type Guard)
<Text>Objet: {('notes' in document && typeof document.notes === 'string' ? document.notes : null) || "Prestations de services"}</Text>
```

**Fichier :** `./components/pages/invoice-editor.tsx`
**Ligne :** 574
**Danger :** Ignorer le type d'un tableau d'items annule l'auto-complétion et masque des erreurs.
**Code Médiocre :**
```typescript
items: items as any,
```
**Remédiation Exacte :**
```typescript
// Caster vers le type attendu, par exemple InvoiceItem[]
items: items as InvoiceItem[],
```

### 🔴 Catch de `error: any`
**Fichier :** `./components/pages/quotes.tsx`
**Ligne :** 192
**Danger :** Typer une erreur capturée avec `any` est une très mauvaise pratique. Les erreurs en JS sont de type `unknown` ou instances de `Error`.
**Code Médiocre :**
```typescript
} catch (error: any) {
```
**Remédiation Exacte :**
```typescript
} catch (error: unknown) {
  if (error instanceof Error) {
    console.error(error.message);
  }
}
```

### 🔴 Code Mort (Variables orphelines)
**Fichier :** `./components/dashboard/admin.tsx`
**Ligne :** 271
**Danger :** Des variables non utilisées alourdissent le bundle et le contexte.
**Code Médiocre :**
```typescript
{data.paymentMethodData.map((_entry, index: number) => (
```
**Remédiation Exacte :**
```typescript
// Retirer les arguments non utilisés ou les configurer avec ESLint pour avertir (_entry -> ignorer).
// Mais idéalement, ne pas déclarer l'index si non utilisé ou utiliser l'élément.
{data.paymentMethodData.map((entry, index: number) => (
```

### 🔴 Violation du principe DRY
**Fichier :** `./components/pdf-document.tsx`
**Ligne :** 343
**Danger :** On duplique un cast risqué pour vérifier `discount`.
**Code Médiocre :**
```typescript
<Text style={styles.totalVal}>{formatCurrencyPDF('discount' in document ? (document as any).discount : 0)}</Text>
```
**Remédiation Exacte :**
```typescript
<Text style={styles.totalVal}>{formatCurrencyPDF('discount' in document && typeof document.discount === 'number' ? document.discount : 0)}</Text>
```

## 2. LOGIQUE REACT ET ANTI-PATTERNS UI

### 🔴 Dépendances manquantes dans les Hooks et Fuites de Mémoire

**Fichier :** `./components/dashboard/user.tsx`
**Lignes :** ~70-90
**Danger :** Les requêtes API (fetch) à l'intérieur des `useEffect` sans annulation (`AbortController`) causent des fuites de mémoire (memory leaks) si le composant est démonté avant la fin de la requête.
**Code Médiocre :**
```typescript
useEffect(() => {
  const fetchMetrics = async () => {
    const res = await fetch('/api/dashboard/metrics');
    // ...
  };
  fetchMetrics();
}, []); // Aucune annulation prévue.
```
**Remédiation Exacte :**
```typescript
useEffect(() => {
  const abortController = new AbortController();
  const fetchMetrics = async () => {
    try {
      const res = await fetch('/api/dashboard/metrics', { signal: abortController.signal });
      if (!res.ok) throw new Error('Erreur API');
      const data = await res.json();
      setMetrics(data);
    } catch (error: unknown) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error(error.message);
      }
    }
  };
  fetchMetrics();
  return () => abortController.abort();
}, []);
```

### 🔴 Prop Drilling
**Fichier :** `./components/pages/protected-app-shell.tsx`
**Ligne :** 30
**Danger :** Transmettre le `initialUser` (ou toute autre prop) excessivement en profondeur au lieu d'utiliser Zustand.
**Code Médiocre :**
```typescript
initialUser: any
```
**Remédiation Exacte :**
```typescript
// Définir UserSession au lieu de any et stocker immédiatement l'état global.
initialUser: UserSession
```

## 3. ARCHITECTURE ELECTRON ET IPC

### 🔴 Sécurité IPC et Isolation de Contexte

**Fichier :** `./preload.js`
**Danger :** Bien que `contextIsolation: true` et `nodeIntegration: false` soient configurés, il faut s'assurer de ne jamais exposer d'événements globaux ou de méthodes non sérialisables (`ipcRenderer.on` mal nettoyé) au contexte du moteur de rendu, au risque de créer des failles de sécurité majeures.
**Remédiation Exacte :**
```javascript
// S'assurer de toujours nettoyer l'événement :
onPrintResult: (callback) => {
  const handler = (_event, arg) => callback(arg);
  ipcRenderer.on('print-result', handler);
  return () => ipcRenderer.removeListener('print-result', handler);
}
// Préférer systématiquement ipcRenderer.invoke pour éviter ces fuites, ce qui est déjà fait pour 'export-pdf'.
```

## 4. BASE DE DONNÉES ET PERFORMANCES (SQLITE)

### 🔴 Requêtes N+1 et boucles synchrones (Goulot d'étranglement SQLite)

**Fichier :** `app/api/quotes/[id]/route.ts`
**Danger :** L'exécution de requêtes préparées (`insertItem.run(...)`) à l'intérieur d'une boucle `for...of` entraîne un problème de performance grave de type N+1. Chaque itération effectue une transaction disque/mémoire individuelle.
**Code Médiocre :**
```typescript
      const insertItem = db.prepare(`
        INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const item of quoteItems) {
        insertItem.run(
          crypto.randomUUID(),
          id,
          item.description,
          item.quantity,
          Math.round(item.unitPrice),
          Math.round(item.quantity * item.unitPrice)
        );
```
**Remédiation Exacte :**
```typescript
const insertItem = db.prepare(`
  INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const insertManyItems = db.transaction((items) => {
  for (const item of items) {
    insertItem.run(
      crypto.randomUUID(),
      id,
      item.description,
      item.quantity,
      item.unitPrice,
      item.quantity * item.unitPrice
    );
  }
});

insertManyItems(quoteItems);
```

### 🔴 Indexation manquante
**Fichier :** `./lib/db/schema.ts` (Schéma de la BDD local)
**Danger :** Les colonnes fréquemment recherchées, comme `status` dans `quotes` ou `invoices`, nécessitent un index. L'absence ralentit considérablement la recherche `WHERE status = ?`.
**Remédiation Exacte :**
```sql
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes (status);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (status);
```
