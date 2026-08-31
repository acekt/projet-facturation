# DEEP_AUDIT_REPORT.md

## RAPPORT D'AUDIT COMPLET ET INTRANSIGEANT

Ce rapport détaille les anomalies trouvées dans le code, en se concentrant sur la qualité du typage (TypeScript), la logique React et les anti-patterns UI, l'architecture Electron et IPC, ainsi que les problèmes de base de données (SQLite) et performances.

### 1. QUALITÉ DU CODE STATIQUE ET TYPAGE (TYPESCRIPT)

#### Utilisation de `any`
- **Fichier :** `components/pdf-document.tsx` (Ligne 310)
  - **Code :** `<Text>Objet: {('notes' in document ? (document as any).notes : null) || "Prestations de services"}</Text>`
  - **Problème :** Utilisation du type `any` qui annule les bénéfices du typage strict de TypeScript et expose à des erreurs au runtime.
  - **Solution :**
    ```typescript
    <Text>Objet: {('notes' in document ? (document as DocumentWithNotes).notes : null) || "Prestations de services"}</Text>
    ```

- **Fichier :** `components/pages/invoice-editor.tsx` (Ligne 574)
  - **Code :** `items: items as any,`
  - **Problème :** Utilisation du type `any` qui annule les bénéfices du typage strict de TypeScript et expose à des erreurs au runtime.
  - **Solution :**
    ```typescript
    items: items as InvoiceItem[],
    ```

- **Fichier :** `components/pages/audit-logs.tsx` (Ligne 13)
  - **Code :** `const [logs, setLogs] = React.useState<any[]>([])`
  - **Problème :** Utilisation du type `any` qui annule les bénéfices du typage strict de TypeScript et expose à des erreurs au runtime.
  - **Solution :**
    ```typescript
    const [logs, setLogs] = React.useState<AuditLog[]>([])
    ```

- **Fichier :** `components/pages/protected-app-shell.tsx` (Ligne 30)
  - **Code :** `initialUser: any`
  - **Problème :** Utilisation du type `any` qui annule les bénéfices du typage strict de TypeScript et expose à des erreurs au runtime.
  - **Solution :**
    ```typescript
    initialUser: User
    ```

- **Fichier :** `components/pages/quotes.tsx` (Ligne 192)
  - **Code :** `} catch (error: any) {`
  - **Problème :** Utilisation du type `any` qui annule les bénéfices du typage strict de TypeScript et expose à des erreurs au runtime.
  - **Solution :**
    ```typescript
    } catch (error: unknown) {
  if (error instanceof Error) {
    // ...
  }
}
    ```

- **Fichier :** `app/api/quotes/[id]/route.ts` (Ligne 131)
  - **Code :** `const updateQuoteTx = db.transaction((quoteItems: any[]) => {`
  - **Problème :** Utilisation du type `any` qui annule les bénéfices du typage strict de TypeScript et expose à des erreurs au runtime.
  - **Solution :**
    ```typescript
    const updateQuoteTx = db.transaction((quoteItems: QuoteItem[]) => {
    ```

#### Code mort et duplication (DRY)
- **Fichier :** Global (à surveiller)
  - **Problème :** Certains imports ne sont plus utilisés, et des fonctions utilitaires se répètent entre `quotes.tsx` et `invoices.tsx`.
  - **Solution :** Mettre en place `eslint-plugin-unused-imports` et extraire la logique commune de pagination et de filtrage dans des hooks partagés (ex: `usePagination.ts`).

### 2. LOGIQUE REACT ET ANTI-PATTERNS UI

#### Anti-patterns (useEffect)
- **Fichier :** `components/pages/protected-app-shell.tsx` (Lignes 42, 54, 82)
  - **Problème :** `useEffect` sans dépendances exhaustives ou potentiellement complexes causant des appels redondants.
  - **Solution :**
    ```typescript
    React.useEffect(() => {
      // logique
    }, [dep1, dep2]); // Ajouter toutes les dépendances
    ```


#### Appels API / IPC sans gestion d'erreur robuste
- **Fichier :** `components/pages/quotes.tsx` (Lignes multiples)
  - **Problème :** Absence de blocs `try/catch` complets avec feedback visuel UI pour les requêtes `fetch` ou appels IPC.
  - **Solution :**
    ```typescript
    try {
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error('API Error');
    } catch (error: unknown) {
      toast({ title: 'Erreur', description: 'Une erreur est survenue' });
    }
    ```


#### Prop Drilling
- **Fichier :** Composants de formulaires complexes (ex: `QuoteEditor`, `InvoiceEditor`)
  - **Problème :** Le passage de props liées à l'état de validation ou à la sélection de clients sur plus de 3 niveaux fragilise l'arbre de rendu.
  - **Solution :** Centraliser l'état dans le Store (Zustand) existant ou utiliser le React Context pour les formulaires globaux.


### 3. ARCHITECTURE ELECTRON ET IPC

#### Fuites de mémoire IPC (Absence de removeListener)
- **Fichier :** Composants UI utilisant `ipcRenderer.on` de façon générale.
  - **Problème :** Il faut s'assurer qu'aucun écouteur d'évènement n'est mal géré s'il y a de nouveaux développements, vérifiez que `removeListener` est bien appliqué.
  - **Solution :**
    ```typescript
    React.useEffect(() => {
      const handler = (event, data) => { /* ... */ };
      ipcRenderer.on('channel', handler);
      return () => {
        ipcRenderer.removeListener('channel', handler);
      };
    }, []);
    ```


#### Sécurité Preload (Exposition d'objets globaux)
- **Fichier :** `preload.js`
  - **Problème :** S'assurer que le pont `contextBridge` ne passe pas `event` au `Renderer` ou des fonctions non sérialisables.
  - **Solution :**
    ```javascript
    contextBridge.exposeInMainWorld('electron', {
      safeMethod: (arg) => ipcRenderer.invoke('channel', arg) // Ne jamais passer 'event'
    });
    ```


### 4. BASE DE DONNÉES ET PERFORMANCES (SQLITE)

#### Requêtes N+1 (Exécution SQL dans une boucle)
- **Fichier :** `app/api/quotes/[id]/route.ts` (Ligne 164)
  - **Problème :** `insertItem.run` est exécuté à l'intérieur d'une boucle `for...of` (sur `quoteItems`).
  - **Solution :** Utiliser des insertions batch ou exploiter au mieux la transaction SQLite existante, par exemple en préparant la requête hors boucle puis en l'exécutant. Le code actuel est acceptable dans une transaction (`db.transaction`), mais voici l'approche optimale :
    ```typescript
    const insertItem = db.prepare(`INSERT INTO quote_items (...) VALUES (...)`);
    // SQLite optimize le for..of dans le bloc db.transaction
    for (const item of quoteItems) {
      insertItem.run(...);
    }
    ```


#### Indexation manquante
- **Fichier :** Les fichiers de création/migration SQL (ex: `data/database.sqlite` setup)
  - **Problème :** Les colonnes fréquemment filtrées comme `status` dans les tables `invoices` et `quotes` manquent d'index dédiés, ralentissant les recherches.
  - **Solution :**
    ```sql
    CREATE INDEX idx_invoices_status ON invoices(status);
    CREATE INDEX idx_quotes_status ON quotes(status);
    ```

