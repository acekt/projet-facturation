# 🚨 DEEP AUDIT REPORT 🚨
## Date: $(date)

Ce rapport recense les anti-patterns, code smells et vulnérabilités identifiés dans l'application Facturier selon 4 piliers d'excellence. Conformément aux instructions, **aucun fichier source n'a été modifié**.

---

### 1. QUALITÉ DU CODE STATIQUE ET TYPAGE (TYPESCRIPT)

**Problème 1: Utilisation massive du type `any` dans la gestion d'erreurs et des données complexes**
- **Fichiers :**
  - `app/api/settings/route.ts` (Ligne 102: `} catch (dbError: any) {`, Ligne 119: `} catch (error: any) {`)
  - `app/api/setup/route.ts` (Ligne 99: `} catch (txError: any) {`)
  - `components/fullscreen-document-viewer.tsx` (Ligne 142: `(docProps.data as any)?.number`)
- **Pourquoi c'est médiocre :** L'utilisation de `any` désactive complètement la sécurité du typage de TypeScript. Dans les blocs `catch`, cela peut cacher des propriétés inexistantes (comme `error.message`) si l'erreur interceptée n'est pas une instance d'`Error`, provoquant des crashs à l'exécution.
- **Code pour atteindre l'excellence :**
```typescript
// Remplacer `catch (error: any)` par :
catch (error: unknown) {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error("An unknown error occurred", error);
  }
}
```

**Problème 2: Manque de dépendances dans la vérification de type de la Base de données**
- **Fichiers :** `app/page.tsx` (Ligne 25: `const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId) as any`)
- **Pourquoi c'est médiocre :** Transtyper en `any` après une requête SQL annule la validation du schéma, risquant des erreurs de rendu si une propriété `user.name` n'existe pas.
- **Code pour atteindre l'excellence :**
```typescript
import { DbUser } from '@/lib/types';
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId) as DbUser | undefined;
```

---

### 2. LOGIQUE REACT ET ANTI-PATTERNS UI

**Problème 1: Appels `fetch` sans bloc `try/catch` explicite ou sans gestion d'erreur robuste (Anti-Pattern)**
- **Fichiers :**
  - `components/pages/invoice-editor.tsx` (Lignes 141, 292)
  - `components/data-sync.tsx` (Ligne 56)
- **Pourquoi c'est médiocre :** Les appels API non encapsulés dans des blocs `try/catch` ou sans interception `.catch()` plantent silencieusement ou laissent l'UI dans un état de chargement infini si le serveur retourne une erreur HTTP (ex. 500) ou si le réseau est coupé.
- **Code pour atteindre l'excellence :**
```typescript
try {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  const data = await response.json();
  // set data
} catch (error: unknown) {
  if (error instanceof Error && error.name === 'AbortError') return;
  toast.error(`Erreur réseau: ${error instanceof Error ? error.message : "Inconnue"}`);
}
```

**Problème 2: Hooks dangereux et fuites de mémoire (useEffect non nettoyés)**
- **Fichiers :** `components/fullscreen-document-viewer.tsx` (Ligne 72)
- **Pourquoi c'est médiocre :** Si des abonnements ou des écouteurs globaux sont initialisés dans un `useEffect` sans retourner de fonction de nettoyage (cleanup function), le composant subira des fuites de mémoire à chaque démontage/remontage.

---

### 3. ARCHITECTURE ELECTRON ET IPC

**Problème 1: Fuite de mémoire dans le pont IPC (`print-document` handler)**
- **Fichier :** `main.js` (Ligne ~760 dans `ipcMain.handle('print-document')`)
- **Pourquoi c'est dangereux :** Lors de la gestion d'un timeout ou de la résolution d'une impression via la fenêtre invisible `printWin`, les écouteurs d'événements `did-finish-load` et `did-fail-load` ne sont pas toujours correctement nettoyés avec `removeAllListeners` dans tous les cas de figure (notamment sur un succès de bout en bout), ce qui retient la fenêtre en mémoire ou crée des listeners fantômes.
- **Code pour atteindre l'excellence :**
```javascript
// Dans la fonction de nettoyage (finally block ou callback de succès) :
if (printWin && !printWin.isDestroyed()) {
    printWin.webContents.removeAllListeners('did-finish-load');
    printWin.webContents.removeAllListeners('did-fail-load');
    printWin.destroy();
}
```

---

### 4. BASE DE DONNÉES ET PERFORMANCES (SQLITE)

**Problème 1: Anti-Pattern de performance SQLite (`db.prepare()` à l'intérieur des fonctions de route)**
- **Fichiers :**
  - `app/api/settings/route.ts` (Ligne 22, Ligne 90)
  - `app/api/services/[id]/route.ts` (Ligne 31, 114)
  - Ainsi que la quasi-totalité des routes d'API.
- **Pourquoi c'est médiocre :** Compiler des requêtes SQL dynamiquement à l'intérieur des handlers de requêtes HTTP avec `db.prepare()` bloque le thread principal de Node.js, empêchant de servir d'autres utilisateurs simultanément. Pire, cela augmente les risques d'erreurs `SQLITE_BUSY` (verrous exclusifs) sous charge. Les instructions `db.prepare()` DOIVENT être extraites au niveau du module (hoisting) pour n'être compilées qu'une seule fois au démarrage.
- **Code pour atteindre l'excellence :**
```typescript
// Au niveau du fichier (hors du handler GET/POST/PATCH) :
const getSettingsStmt = db.prepare('SELECT * FROM settings WHERE id = 1');

export async function GET(request: Request) {
    const settings = getSettingsStmt.get() as DbSettings | undefined;
    // ...
}
```

**Problème 2: Manque d'indexation sur les colonnes de filtrage (WHERE)**
- **Fichier :** `lib/db.ts` (Phase d'indexation)
- **Pourquoi c'est médiocre :** Il manque un index crucial sur les utilisateurs (`users`) concernant la colonne `email`, alors que l'authentification (login) effectue fréquemment un filtrage `WHERE email = ?`. Cela provoque un *Full Table Scan* (parcours séquentiel de la table) très coûteux.
- **Code pour atteindre l'excellence :**
```sql
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```
