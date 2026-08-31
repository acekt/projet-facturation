const fs = require('fs');

const report = `# DEEP AUDIT REPORT - Facturier

## 1. QUALITÉ DU CODE STATIQUE ET TYPAGE (TYPESCRIPT)

### Utilisation de \`any\`
Plusieurs fichiers utilisent le type \`any\`, ce qui annule les bénéfices de TypeScript.

*   **Fichier:** \`app/api/settings/route.ts\`, Lignes 100, 117
    *   **Problème:** Typage de l'erreur dans un bloc \`catch\`. C'est dangereux car on perd l'autocomplétion et la sécurité du type.
    *   **Solution:** Utiliser \`unknown\` ou \`Error\` pour les blocs catch.
    *   **Code:**
        \`\`\`typescript
        } catch (dbError: unknown) {
          const error = dbError as Error;
          // ...
        }
        \`\`\`

*   **Fichier:** \`app/api/quotes/[id]/route.ts\`, Ligne 131 et \`app/api/quotes/route.ts\`, Ligne 115
    *   **Problème:** Utilisation de \`any[]\` pour typer le paramètre de \`db.transaction\`.
    *   **Solution:** Utiliser le type approprié \`QuoteItem[]\` ou au pire \`unknown[]\`.
    *   **Code:**
        \`\`\`typescript
        const updateQuoteTx = db.transaction((quoteItems: QuoteItem[]) => {
        \`\`\`

*   **Fichier:** \`lib/db.ts\`, Lignes 105, 125, 401
    *   **Problème:** \`Map<string, any>\` pour le statement cache, et \`fatalErr: any\`.
    *   **Solution:** Utiliser le type correct de better-sqlite3 pour le cache. \`Map<string, Database.Statement>\`.
    *   **Code:**
        \`\`\`typescript
        import type { Statement } from 'better-sqlite3';
        statementCache: Map<string, Statement>;
        // ...
        } catch (fatalErr: unknown) {
          const error = fatalErr as Error;
        \`\`\`

*   **Fichier:** \`components/pages/protected-app-shell.tsx\`, Ligne 30
    *   **Problème:** \`initialUser: any\`
    *   **Solution:** Utiliser une interface pour le User.
    *   **Code:**
        \`\`\`typescript
        import { User } from '@/lib/types'; // Assumer que ce type existe
        initialUser: User | null;
        \`\`\`

*   **Fichier:** \`components/pages/audit-logs.tsx\`, Ligne 13
    *   **Problème:** \`useState<any[]>([])\`
    *   **Solution:** Utiliser le type \`AuditLog\`.
    *   **Code:**
        \`\`\`typescript
        const [logs, setLogs] = React.useState<AuditLog[]>([])
        \`\`\`

## 2. LOGIQUE REACT ET ANTI-PATTERNS UI

### useEffect dangereux (dépendances manquantes ou boucles)

Il faut inspecter minutieusement les useEffect.

*   **Fichier:** \`components/pages/protected-app-shell.tsx\`, Lignes 42, 54, 82
    *   **Problème:** Il y a beaucoup de \`useEffect\` potentiellement liés à la synchronisation. Si l'un d'eux met à jour un état qui relance le composant sans dépendances strictes, c'est une boucle.

### Gestion des erreurs (fetch/axios/IPC)

*   Partout où l'on fait des appels IPC (via \`window.electron.*\`), il manque potentiellement des blocs \`try/catch\` avec retours visuels (Toasts).

## 3. ARCHITECTURE ELECTRON ET IPC

### Fuites de mémoire (\`ipcMain.on\` / \`ipcRenderer.on\`)
Le code actuel utilise \`ipcMain.handle\` (via \`invoke\`) qui gère automatiquement les promesses, évitant les problèmes de \`on\` sans \`removeListener\`. C'est un bon point.

### Sécurité du \`preload.js\`
*   **Fichier:** \`preload.js\`
    *   **Analyse:** Le pont expose seulement des fonctions fléchées spécifiques qui appellent \`ipcRenderer.invoke\`. \`contextIsolation\` est à \`true\`. C'est globalement sécurisé. Aucun objet \`event\` global n'est passé.

## 4. BASE DE DONNÉES ET PERFORMANCES (SQLITE)

### Requêtes N+1
*   **Fichier:** \`app/api/quotes/[id]/route.ts\`
    *   **Analyse:** La boucle \`for (const item of quoteItems)\` appelle \`insertItem.run(...)\`. Bien que ce soit dans une transaction, chaque appel exécute une requête. Avec SQLite, ce n'est pas strictement un appel réseau N+1, mais cela peut être optimisé en passant un tableau de valeurs si \`better-sqlite3\` le permet nativement, ou en utilisant un \`INSERT INTO ... VALUES (...), (...)\`.

### Indexation
*   **Fichier:** \`lib/db.ts\`
    *   **Analyse:** Les index de base sont créés (\`idx_clients_deletedAt\`, etc.). Il faut vérifier s'il manque un index sur les colonnes de filtrage ou de tri fréquentes dans l'UI.
