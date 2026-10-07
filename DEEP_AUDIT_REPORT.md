# 🚨 DEEP AUDIT REPORT 🚨

## Date: $(date)

Ce rapport recense les anti-patterns, code smells et vulnérabilités identifiés dans l'application Facturier selon 4 piliers d'excellence. Conformément aux instructions, **aucun fichier source n'a été modifié**.

---

### 1. QUALITÉ DU CODE STATIQUE ET TYPAGE (TYPESCRIPT)

**Problème 1: Utilisation massive du type `any` dans la gestion d'erreurs et des données complexes**
- **Fichiers :**
  - `app/api/settings/route.ts` (Ligne 102: `} catch (dbError: any) {`, Ligne 119: `} catch (error: any) {`)
  - `components/fullscreen-document-viewer.tsx` (Ligne 142: `(docProps.data as any)?.number`, Ligne 165: `} catch (err: any) {`, Ligne 183: `(docProps.data as any).number`)
- **Pourquoi c'est médiocre :** L'utilisation de `any` désactive complètement la sécurité du typage de TypeScript. Dans les blocs `catch`, cela peut cacher des propriétés inexistantes (comme `error.message`) si l'erreur interceptée n'est pas une instance d'`Error`, provoquant des crashs à l'exécution. Sur les objets complexes (comme `docProps.data`), cela court-circuite la validation de la structure de l'objet.
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
// Utiliser les vrais types comme Invoice ou Quote pour docProps.data au lieu de any.
```

**Problème 2: Transtypage en `any` après requête Base de données**
- **Fichiers :** `app/page.tsx` (Ligne 25: `const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId) as any`)
- **Pourquoi c'est médiocre :** Transtyper en `any` après une requête SQL annule la validation du schéma, risquant des erreurs de rendu ou d'accès si l'objet ne possède pas les bonnes propriétés.
- **Code pour atteindre l'excellence :**
```typescript
import { DbUser } from '@/lib/types/api';
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId) as DbUser | undefined;
```

---

### 2. LOGIQUE REACT ET ANTI-PATTERNS UI

**Problème 1: Appels `fetch` sans bloc `try/catch` explicite ou avec gestion basique**
- **Fichiers :**
  - `components/pages/invoice-editor.tsx` (Lignes 141, 274, 292)
  - `components/data-sync.tsx` (Ligne 56)
- **Pourquoi c'est médiocre :** Les appels API non encapsulés dans des blocs `try/catch` et qui s'en remettent à un `.catch()` minimal peuvent laisser l'UI dans un état incohérent ou de chargement infini si le serveur plante. Les rejets non gérés de promesses masquent des erreurs réseau critiques (comme la perte de connexion). Ligne 292 dans invoice-editor: le second fetch n'est pas protégé par un catch local si la requête rate, bien qu'il soit dans un bloc parent.
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

**Problème 2: Hooks dangereux (useEffect manquant de nettoyage systématique ou de dépendances exhaustives)**
- **Fichiers :** `components/fullscreen-document-viewer.tsx` (Ligne 72)
- **Pourquoi c'est médiocre :** Si des abonnements ou des observateurs comme `ResizeObserver` (ligne 87-88) sont déclarés sans être parfaitement isolés ou sans nettoyer correctement leurs dépendances selon l'état React, cela peut provoquer des pertes de performance par de multiples recalculs inutiles (bien que ce fichier possède un `.disconnect()` à la ligne 89, l'absence de dépendances exhaustives dans d'autres `useEffect` similaires est dangereuse).

---

### 3. ARCHITECTURE ELECTRON ET IPC

**Problème 1: Fuite de mémoire dans le pont IPC (`print-document` handler)**
- **Fichier :** `main.js` (Ligne 788)
- **Pourquoi c'est dangereux :** Lors de la résolution d'une impression via la fenêtre invisible `printWin`, les écouteurs d'événements `did-finish-load` et `did-fail-load` ne sont pas explicitement nettoyés avec `removeAllListeners` sur succès, comme ils le sont dans le timeout (ligne 761). Si l'objet n'est pas garbage collecté immédiatement, des listeners fantômes persistent en mémoire.
- **Code pour atteindre l'excellence :**
```javascript
// Dans la fonction de nettoyage (finally block ou callback de succès) avant printWin.destroy() :
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
  - `app/api/settings/route.ts` (Ligne 22, Ligne 90, Ligne 117)
  - `app/api/services/[id]/route.ts` (Lignes 31, 76, 114, 118, 156, 172)
- **Pourquoi c'est médiocre :** Compiler des requêtes SQL dynamiquement à l'intérieur des handlers de requêtes HTTP bloque le thread principal de Node.js, ce qui empêche d'autres utilisateurs d'être servis simultanément et multiplie la recompilation de requêtes statiques (créant des risques de `SQLITE_BUSY`). Les instructions `db.prepare()` DOIVENT être "hoisted" au niveau du module.
- **Code pour atteindre l'excellence :**
```typescript
// Au niveau du fichier, en dehors du handler (hoisting) :
const getSettingsStmt = db.prepare('SELECT * FROM settings WHERE id = 1');

export async function GET(request: Request) {
    const settings = getSettingsStmt.get() as DbSettings | undefined;
    // ...
}
```

**Problème 2: Manque d'indexation sur la colonne `email` lors des requêtes d'authentification**
- **Fichier :** `lib/db.ts` (Ligne 559), et `lib/repositories/UserRepository.ts` (Ligne 60)
- **Pourquoi c'est médiocre :** Bien qu'un index `idx_users_email` ait été ajouté en Phase 2 (Ligne 559 de `lib/db.ts`), il est essentiel de s'assurer qu'aucun autre accès direct de type `WHERE email = ?` n'échappe à l'indexation. Une absence d'index sur des champs de filtre fréquents provoque un *Full Table Scan* (parcours séquentiel de la table), ce qui est désastreux avec l'augmentation du volume de données.
- **Code pour atteindre l'excellence :**
Vérifier l'index au lancement ou forcer sa création explicite en amont de toute exécution :
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
```
