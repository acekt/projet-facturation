# DEEP AUDIT REPORT - FACTURIER QA

**MISSION**: Rapport de diagnostic impitoyable des anti-patterns, code smells, et incohérences logiques, analysant l'application sous 4 piliers principaux.

---

## 1. QUALITÉ DU CODE STATIQUE ET TYPAGE (TYPESCRIPT)

### Utilisation excessive du type `any`
L'utilisation de `any` détruit les garanties de TypeScript et expose à des erreurs de runtime ("undefined is not a function").

- **Fichier**: `app/api/settings/route.ts`, Lignes 102 & 119
  - **Médiocrité**: `} catch (error: any) {` ou `} catch (dbError: any) {`. L'accès aux propriétés de l'erreur est non sécurisé.
  - **Excellence**:
    ```typescript
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      console.error(errorMessage);
    }
    ```
- **Fichier**: `app/api/setup/route.ts`, Ligne 99
  - **Médiocrité**: `} catch (txError: any) {`
  - **Excellence**:
    ```typescript
    } catch (txError: unknown) {
      const errorMessage = txError instanceof Error ? txError.message : 'Unknown database error';
      console.error(errorMessage);
    }
    ```
- **Fichier**: `app/api/users/route.ts`, Lignes 103 & 124
  - **Médiocrité**: `} catch (error: any) {`
  - **Excellence**:
    ```typescript
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      console.error(errorMessage);
    }
    ```
- **Fichier**: `app/api/invoices/route.ts`, Ligne 74
  - **Médiocrité**: `} catch (error: any) {`
  - **Excellence**:
    ```typescript
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      console.error(errorMessage);
    }
    ```
- **Fichier**: `lib/services/InvoiceService.ts`, Ligne 15
  - **Médiocrité**: `createInvoice(data: any, userId: string, role: string) {`
  - **Excellence**:
    ```typescript
    export interface InvoiceCreateData {
      clientId: string;
      quoteId?: string;
      items: Array<{ description: string; quantity: number; unitPrice: number; total?: number }>;
      discount?: number;
      notes?: string;
      subject?: string;
    }
    createInvoice(data: InvoiceCreateData, userId: string, role: string) {
    ```
- **Fichier**: `app/api/quotes/[id]/route.ts`, Ligne 131 et `app/api/quotes/route.ts`, Ligne 115
  - **Médiocrité**: `const updateQuoteTx = db.transaction((quoteItems: any[]) => {`
  - **Excellence**:
    ```typescript
    interface QuoteItemData {
      description: string;
      quantity: number;
      unitPrice: number;
    }
    const updateQuoteTx = db.transaction((quoteItems: QuoteItemData[]) => {
    ```

---

## 2. LOGIQUE REACT ET ANTI-PATTERNS UI

### Dépendances de Hooks manquantes ou désactivées
Omettre des dépendances dans `useEffect` provoque des bugs de "stale closures" ou des cycles infinis, surtout dans le cadre d'API fetch asynchrones.

- **Fichier**: `components/pages/users.tsx`, Ligne 116-130
  - **Médiocrité**:
    ```tsx
    React.useEffect(() => { /* ... */ fetchUsers(controller.signal) }, [currentUser?.id])
    ```
    Ici, `currentUser?.role` est vérifié mais non listé dans les dépendances.
  - **Excellence**:
    ```tsx
    React.useEffect(() => {
      if (currentUser?.role !== 'admin') {
        setIsLoading(false);
        return;
      }
      const controller = new AbortController();
      fetchUsers(controller.signal);
      return () => controller.abort();
    }, [currentUser?.id, currentUser?.role, fetchUsers]);
    ```

- **Fichier**: `components/pages/invoice-editor.tsx`, Lignes 106-114
  - **Médiocrité**: ESLint désactivé intentionnellement (`// eslint-disable-next-line react-hooks/exhaustive-deps`) pour omettre les dépendances `isNew` et `clearInvoiceDraft`.
  - **Excellence**:
    ```tsx
    React.useEffect(() => {
      if (isNew) {
        clearInvoiceDraft();
      }
      return () => {
        clearInvoiceDraft();
      };
    }, [isNew, clearInvoiceDraft]);
    ```

- **Fichier**: `components/pages/quote-editor.tsx`, Lignes 125-134
  - **Médiocrité**: `// eslint-disable-next-line react-hooks/exhaustive-deps` avec `isNew` et `clearQuoteDraft` manquants.
  - **Excellence**:
    ```tsx
    React.useEffect(() => {
      if (isNew) {
        clearQuoteDraft();
      }
      return () => {
        clearQuoteDraft();
      };
    }, [isNew, clearQuoteDraft]);
    ```

### Gestion des Erreurs et Appels API
- **Fichier**: `components/pages/audit-logs.tsx`, Lignes 21-38
  - **Médiocrité**: `fetch('/api/audit-logs')` utilisé sans bloc try/catch qui gère explicitement toutes les erreurs possibles du réseau.
  - **Excellence**: Ajouter un try/catch pour le fetch asynchrone lui-même et s'assurer que l'utilisateur est informé en cas d'erreur inattendue.

### Prop Drilling
- **Fichier**: `components/pages/users.tsx`, `components/pages/invoices.tsx`
  - **Médiocrité**: Des propriétés de callback comme `onBack` et `editingId` passées de la page à l'éditeur.
  - **Excellence**: Gérer la sélection du composant à l'écran via l'état dans le Store `zustand` plutôt que de passer ces arguments.

---

## 3. ARCHITECTURE ELECTRON ET IPC

### Fuite de Mémoire (Event Listeners IPC)
- **Fichier**: `main.js` (Lignes d'impression)
  - **Médiocrité**: Pas d'utilisation explicite de `.removeAllListeners` sur les événements de fin de chargement du `webContents` dans tous les cas de figure si une destruction anticipée a lieu.
  - **Excellence**:
    ```javascript
    printWin.webContents.removeAllListeners('did-finish-load');
    printWin.webContents.removeAllListeners('did-fail-load');
    printWin.destroy();
    printWin = null;
    ```

### Sécurité du Preload
- **Fichier**: `preload.js`
  - **Validation**: contextIsolation est correctement utilisé et les méthodes sont sérialisables.

---

## 4. BASE DE DONNÉES ET PERFORMANCES (SQLITE)

### Requêtes N+1 et Optimisation Transactionnelle
- **Fichier**: `lib/services/InvoiceService.ts`, Lignes 87-96
  - **Médiocrité**: Exécution de `insertItem.run()` dans une boucle sur `data.items`, hors du contexte de transaction de la création complète de la facture, ou exécutée indépendamment sans englober toute la création (transaction).
  - **Excellence**:
    ```typescript
    const createInvoiceTx = db.transaction((data, items, userId) => {
      // Insertion entête facture
      // ...
      const insertItem = db.prepare(`INSERT INTO invoice_items (id, invoiceId, description, quantity, unitPrice, total) VALUES (?, ?, ?, ?, ?, ?)`);
      for (const item of items) {
         insertItem.run(crypto.randomUUID(), data.id, item.description, item.quantity, Math.round(item.unitPrice), Math.round(item.quantity * item.unitPrice));
      }
    });
    ```

- **Fichier**: `app/api/invoices/[id]/route.ts`, Ligne 168
  - **Médiocrité**: Pour la création des `credit_note_items`, boucle `for (const item of items)` avec un appel à `insertCNItem.run` répété dans la transaction. Le `db.prepare` est correctement en dehors, mais c'est un anti-pattern potentiel sans transaction.
  - **Excellence**: (S'assurer que c'est englobé dans la fonction de transaction).

- **Fichier**: `app/api/quotes/[id]/route.ts`, Ligne 166
  - **Médiocrité**: `insertItem.run` dans la boucle pour `for (const item of quoteItems)` pour les devis.
  - **Excellence**: Inclure la préparation et la boucle à l'intérieur de la déclaration `db.transaction`.
