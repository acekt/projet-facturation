# 🚨 MISSION DE TEST PROFOND ET CONTINU (BACKGROUND QA AUDIT) 🚨

## RAPPORT DE DIAGNOSTIC DE L'ARCHITECTURE LOGICIELLE ("DEEP_AUDIT_REPORT")
**Statut :** INTRA-CRITIQUE (Projet "Facturier")
**Généré par :** Lead QA Engineer & Architecte Logiciel
**Date :** Analyse continue en arrière-plan

Ce rapport expose de façon stricte et sans concession les anti-patterns, les vulnérabilités de performance et les aberrations architecturales actuellement présentes dans la base de code du Facturier.

**AUCUN FICHIER SOURCE N'A ÉTÉ MODIFIÉ.** Les directives de remédiation exactes sont fournies ci-dessous.

---

## 1. QUALITÉ DU CODE STATIQUE ET TYPAGE (TYPESCRIPT)

### 1.1 Types `any` implicites et explicites
L'utilisation de `any` court-circuite complètement les bénéfices de TypeScript, exposant l'application à des erreurs critiques lors de l'exécution (runtime exceptions).

**Anomalie 1 : Typage explicite `any` lors du parsing de la session**
- **Fichier :** `app/page.tsx`
- **Ligne :** 25
- **Explication :** La récupération de l'utilisateur de la base de données est castée en `any`, ce qui empêche TypeScript de vérifier les propriétés assignées à `initialUser`.
- **Code de Remédiation :**
```typescript
<<<<<<< SEARCH
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId) as any
=======
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId) as DbUser | undefined;
>>>>>>> REPLACE
```
*(Nécessite l'import de `DbUser` depuis `@/lib/types/api`)*

**Anomalie 2 : Injection de type non-sécurisé dans les composants**
- **Fichier :** `components/pdf-document.tsx`
- **Lignes :** 310, 343
- **Explication :** L'objet `document` est casté dynamiquement en `any` (`(document as any).notes`, `(document as any).discount`) au lieu de s'appuyer sur des types de garde (type guards) ou l'interface commune existante.
- **Code de Remédiation :**
```typescript
<<<<<<< SEARCH
          <Text>Objet: {('notes' in document ? (document as any).notes : null) || "Prestations de services"}</Text>
=======
          <Text>Objet: {('notes' in document ? (document as Quote | Invoice).notes : null) || "Prestations de services"}</Text>
>>>>>>> REPLACE
```

**Anomalie 3 : Typage `any[]` dans les transactions SQLite**
- **Fichier :** `app/api/quotes/[id]/route.ts` et `app/api/quotes/route.ts`
- **Lignes :** 132 (`app/api/quotes/[id]/route.ts`), 116 (`app/api/quotes/route.ts`)
- **Explication :** Le wrapper de transaction SQLite est défini avec un paramètre `(quoteItems: any[])`, ce qui annule toute validation de type sur les articles insérés.
- **Code de Remédiation :**
```typescript
<<<<<<< SEARCH
    const updateQuoteTx = db.transaction((quoteItems: any[]) => {
=======
    const updateQuoteTx = db.transaction((quoteItems: DbQuoteItem[]) => {
>>>>>>> REPLACE
```

### 1.2 Outils statiques manquants et code mort
- **Anomalie :** Le fichier de configuration ESLint (`eslint.config.js` ou `.eslintrc.json`) est manquant. Cela empêche la détection d'anti-patterns React (comme `react-hooks/exhaustive-deps`).
- **Anomalie (Code Mort) :** Les variables non utilisées abondent (ex: `paymentId2` dans `tests/unit/updateInvoiceStatus.test.ts`, imports inutilisés dans les tests E2E `tests/e2e/auth.setup.ts`).


---

## 2. LOGIQUE REACT ET ANTI-PATTERNS UI

### 2.1 Hooks Dangereux et Gestion des Dépendances
- **Absence de règles d'exhaustivité :** L'absence de la règle `react-hooks/exhaustive-deps` (due à l'absence de configuration ESLint) expose tous les `useEffect` et `useCallback` à des comportements erratiques.

### 2.2 Gestion des erreurs API Absente (Prop-drilling et UI/UX)
Lorsqu'une réponse HTTP échoue, le composant doit intercepter l'erreur sans provoquer de crash silencieux, et en alerter l'utilisateur.

**Anomalie 1 : Requêtes muettes dans les tableaux de bord**
- **Fichiers :** `components/dashboard/user.tsx` (Lignes 93, 106), `components/dashboard/admin.tsx` (Ligne 85)
- **Explication :** Les appels réseau utilisent `await res.json().catch(() => null)` sans notifier l'utilisateur de l'échec du chargement des statistiques.
- **Code de Remédiation :**
```typescript
<<<<<<< SEARCH
        const d = await res.json().catch(() => null)
        if (d) {
          setData(d)
        }
=======
        try {
          const d = await res.json();
          setData(d);
        } catch (error) {
          toast.error("Impossible de charger les données du tableau de bord");
          setData(null);
        }
>>>>>>> REPLACE
```

**Anomalie 2 : Absence de Try/Catch autour de l'IPC Native (Anti-pattern majeur)**
- **Fichiers :** `components/pages/quotes.tsx` (Ligne 155), `components/pages/invoices.tsx` (Ligne 195)
- **Explication :** Conformément à la règle de l'architecture Electron en place dans ce projet (Mémoire), le setter de state qui déclenche le rendu du `FullScreenDocumentViewer` **ne doit pas** être encapsulé dans un `try/catch`. Cependant, *à l'intérieur* de ce viewer (`components/fullscreen-document-viewer.tsx`), l'appel effectif `await window.electron.exportPDF` n'intercepte pas correctement une exception si le processus principal plante ou est rejeté violemment. Le code actuel log l'erreur avec `console.error` mais un bloc `try/catch` robuste devrait entourer l'appel complet d'export.
- **Code de Remédiation (dans `components/fullscreen-document-viewer.tsx`) :**
```typescript
<<<<<<< SEARCH
      const result = await window.electron.exportPDF(htmlDoc, filename)

      if (result.saved) {
        toast.success('PDF enregistré avec succès !', {
          id: toastId,
          description: result.filePath
            ? `Fichier : ${result.filePath.split(/[\\/]/).pop()}`
            : undefined,
          duration: 4000,
        })
      } else {
        toast.info('Export PDF annulé ou ignoré.', { id: toastId })
      }
=======
      try {
        const result = await window.electron.exportPDF(htmlDoc, filename)

        if (result.saved) {
          toast.success('PDF enregistré avec succès !', {
            id: toastId,
            description: result.filePath
              ? `Fichier : ${result.filePath.split(/[\\/]/).pop()}`
              : undefined,
            duration: 4000,
          })
        } else {
          toast.info('Export PDF annulé.', { id: toastId })
        }
      } catch (err: any) {
        toast.error(`Échec critique de l'export: ${err.message || 'Erreur inconnue'}`, { id: toastId });
      }
>>>>>>> REPLACE
```

---

## 3. ARCHITECTURE ELECTRON ET IPC

### 3.1 Fuites de mémoire (`ipcMain.on` / `ipcRenderer.on`)
- L'audit indique qu'aucune méthode `ipcMain.on` directe causant des fuites n'est actuellement instanciée dans `main.js` (qui favorise `ipcMain.handle`). C'est un bon point.
- Le pont `preload.js` respecte la stricte isolation (`contextIsolation = true`) et ne passe pas de payload ou d'objet événement global.

### 3.2 Robustesse IPC et Fallback
Bien que l'appel `invoke` soit bien géré, la robustesse du rendu (notamment le nettoyage des fichiers HTML temporaires créés par `main.js` lors d'un crash inattendu de la fenêtre invisible Chromium) est critique. L'audit confirme que `fs.unlinkSync` est enveloppé dans des `try/catch` sécurisés.

---

## 4. BASE DE DONNÉES ET PERFORMANCES (SQLITE)

### 4.1 Anti-Pattern de Transaction et N+1 Queries
Une règle d'or pour les performances avec `better-sqlite3` et l'atomicité est de **préparer les requêtes (statements) en dehors du bloc de transaction** et en dehors des boucles.

**Anomalie 1 : `db.prepare` dans une boucle (N+1)**
- **Fichiers :** `app/api/quotes/[id]/route.ts` (Ligne 162)
- **Explication :** À l'intérieur du bloc de transaction, la méthode `db.prepare()` est invoquée, puis exécutée (`run`) pour chaque item dans une boucle `for (const item of quoteItems)`. Bien que `db.prepare()` soit techniquement hors de la boucle, elle se situe *à l'intérieur* de la closure `db.transaction`, ce qui dégrade considérablement les performances de la transaction si le cache des statements est purgé.
- **Code de Remédiation :**
```typescript
<<<<<<< SEARCH
      // Clear existing items
      db.prepare('DELETE FROM quote_items WHERE quoteId = ?').run(id);

      // Insert new items
      const insertItem = db.prepare(`
        INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const item of quoteItems) {
        insertItem.run(
=======
      // Clear existing items
      const deleteItems = db.prepare('DELETE FROM quote_items WHERE quoteId = ?');
      const insertItem = db.prepare(`
        INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      deleteItems.run(id);

      for (const item of quoteItems) {
        insertItem.run(
>>>>>>> REPLACE
```
*(Ceci doit être remonté de la même manière dans `lib/services/QuoteService.ts` et `app/api/invoices/[id]/route.ts` pour uniformiser l'architecture).*

### 4.2 L'Abomination du `SELECT *`
Le `SELECT *` charge inutilement la mémoire du processus Node.js, ce qui est extrêmement délétère pour une application packagée sous Electron (où la RAM utilisateur compte double).

**Anomalie : Sur-requêtage chronique via `SELECT *`**
- **Fichiers Affectés :**
  - `app/api/settings/route.ts` (Lignes 22, 117)
  - `app/api/services/route.ts` (Lignes 28, 94)
  - `app/api/clients/route.ts` (Lignes 28, 106)
  - `lib/repositories/QuoteRepository.ts` (Ligne 41)
- **Explication :** La base de données retourne toutes les colonnes de tables parfois massives au lieu de restreindre les résultats aux éléments utilisés (ex: `SELECT id, name, email FROM clients`).
- **Exemple de Remédiation (à appliquer universellement) :**
```typescript
<<<<<<< SEARCH
    const clients = db.prepare('SELECT * FROM clients WHERE deletedAt IS NULL ORDER BY name ASC').all() as DbClient[];
=======
    // Ne sélectionner que les colonnes nécessaires au front-end
    const clients = db.prepare('SELECT id, name, email, phone, address, created_at FROM clients WHERE deletedAt IS NULL ORDER BY name ASC').all() as Partial<DbClient>[];
>>>>>>> REPLACE
```

### 4.3 Analyse des Index (Schema `lib/db.ts`)
Les migrations (ligne ~199 de `lib/db.ts`) révèlent la présence robuste de multiples index (`CREATE INDEX IF NOT EXISTS`) sur les colonnes fréquemment cherchées (`deletedAt`, `clientId`, `invoiceId`).
**Toutefois**, l'audit remarque une absence critique :
- **Absence d'index sur les clés de login (`username`, `email`) dans la table `users`.**
  - **Fichier :** `lib/db.ts`
  - **Remédiation (à ajouter à l'initialisation DB) :**
  ```typescript
  CREATE INDEX IF NOT EXISTS idx_users_credentials ON users(username, email);
  ```

---
**FIN DU RAPPORT D'AUDIT PROFOND.**
