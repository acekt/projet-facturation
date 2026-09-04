# DEEP_AUDIT_REPORT.md

**MISSION**: Rapport de diagnostic impitoyable des anti-patterns, code smells, et incohérences logiques, analysant l'application sous 4 piliers principaux.

---

## 1. QUALITÉ DU CODE STATIQUE ET TYPAGE (TYPESCRIPT)

### Utilisation excessive du type `any`
L'utilisation de `any` détruit les garanties de TypeScript et expose à des erreurs de runtime ("undefined is not a function").

- **Fichier**: `components/pdf-document.tsx`, Ligne 310
  - **Médiocrité**: `Objet: {('notes' in document ? (document as any).notes : null) || "Prestations de services"}`. Accès ou typage faible via `any`.
  - **Excellence**: Typer l'objet 'document' pour inclure 'notes' ou vérifier avec 'in' sur un type plus précis.

- **Fichier**: `components/pdf-document.tsx`, Ligne 343
  - **Médiocrité**: `<Text style={styles.totalVal}>{formatCurrencyPDF('discount' in document ? (document as any).discount : 0)}</Text>`. Accès ou typage faible via `any`.
  - **Excellence**: Typer l'objet 'document' pour inclure 'discount'.

- **Fichier**: `components/pages/invoice-editor.tsx`, Ligne 723
  - **Médiocrité**: `items: items as any,`. Accès ou typage faible via `any`.
  - **Excellence**: Définir une interface correcte pour 'items' (e.g. `InvoiceItemData[]`).

- **Fichier**: `components/pages/audit-logs.tsx`, Ligne 13
  - **Médiocrité**: `const [logs, setLogs] = React.useState<any[]>([])`. Accès ou typage faible via `any`.
  - **Excellence**: Utiliser un type spécifique tel que `AuditLog[]` pour l'état.

- **Fichier**: `components/pages/payments.tsx`, Ligne 192
  - **Médiocrité**: `const getPaymentStatusInfo = (invoice: any) => {`. Accès ou typage faible via `any`.
  - **Excellence**: Typer le paramètre 'invoice' avec une interface comme `Invoice`.

- **Fichier**: `components/pages/quote-editor.tsx`, Ligne 771
  - **Médiocrité**: `items: items as any,`. Accès ou typage faible via `any`.
  - **Excellence**: Définir une interface correcte pour 'items' (e.g. `QuoteItemData[]`).

- **Fichier**: `components/pages/quote-editor.tsx`, Ligne 782
  - **Médiocrité**: `} as any`. Accès ou typage faible via `any`.
  - **Excellence**: Assurer que l'objet respecte l'interface du Store et éviter `as any`.

- **Fichier**: `components/pages/quotes.tsx`, Ligne 208
  - **Médiocrité**: `} catch (error: any) {`. Accès ou typage faible via `any`.
  - **Excellence**:
    ```typescript
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      console.error(errorMessage);
    }
    ```

- **Fichier**: `components/pages/quotes.tsx`, Ligne 331
  - **Médiocrité**: `variant={getQuoteStatusVariant(quote.status as any)}`. Accès ou typage faible via `any`.
  - **Excellence**: Assurer que `quote.status` soit correctement typé avec l'enum/literal type attendu.

- **Fichier**: `components/pages/quotes.tsx`, Ligne 465
  - **Médiocrité**: `quote.status as any,`. Accès ou typage faible via `any`.
  - **Excellence**: Typer l'objet de retour de la base de données avec le type statut correct.

- **Fichier**: `components/pages/quotes.tsx`, Ligne 613
  - **Médiocrité**: `variant={getQuoteStatusVariant(quote.status as any)}`. Accès ou typage faible via `any`.
  - **Excellence**: Utiliser un type de statut spécifique.

- **Fichier**: `components/pages/credit-notes.tsx`, Ligne 111
  - **Médiocrité**: `const rows = creditNotes.map(c => [c.number, c.clientName, c.total || (c as any).amount || 0, c.date, c.reason || '']);`. Accès ou typage faible via `any`.
  - **Excellence**: Créer une interface `CreditNote` qui inclut 'amount' ou 'total' et l'utiliser dans la récupération.

- **Fichier**: `components/fullscreen-document-viewer.tsx`, Ligne 142
  - **Médiocrité**: `const docNumber = (docProps.data as any)?.number ?? 'document'`. Accès ou typage faible via `any`.
  - **Excellence**: Utiliser des types union comme `Invoice | Quote | CreditNote`.

- **Fichier**: `components/fullscreen-document-viewer.tsx`, Ligne 178
  - **Médiocrité**: `?? `${docProps.type === 'facture' ? 'Facture' : docProps.type === 'devis' ? 'Devis' : 'Avoir'} — ${(docProps.data as any).number ?? ''}``. Accès ou typage faible via `any`.
  - **Excellence**: Typer 'docProps.data' correctement en fonction de 'docProps.type'.

- **Fichier**: `app/api/settings/route.ts`, Ligne 102
  - **Médiocrité**: `} catch (dbError: any) {`. Accès ou typage faible via `any`.
  - **Excellence**:
    ```typescript
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      console.error(errorMessage);
    }
    ```

- **Fichier**: `app/api/settings/route.ts`, Ligne 119
  - **Médiocrité**: `} catch (error: any) {`. Accès ou typage faible via `any`.
  - **Excellence**:
    ```typescript
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      console.error(errorMessage);
    }
    ```

- **Fichier**: `app/api/setup/route.ts`, Ligne 99
  - **Médiocrité**: `} catch (txError: any) {`. Accès ou typage faible via `any`.
  - **Excellence**:
    ```typescript
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      console.error(errorMessage);
    }
    ```

- **Fichier**: `app/api/credit-notes/route.ts`, Ligne 92
  - **Médiocrité**: `} catch (error: any) {`. Accès ou typage faible via `any`.
  - **Excellence**:
    ```typescript
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      console.error(errorMessage);
    }
    ```

- **Fichier**: `app/api/users/route.ts`, Ligne 103
  - **Médiocrité**: `} catch (error: any) {`. Accès ou typage faible via `any`.
  - **Excellence**:
    ```typescript
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      console.error(errorMessage);
    }
    ```

- **Fichier**: `app/api/users/route.ts`, Ligne 124
  - **Médiocrité**: `} catch (error: any) {`. Accès ou typage faible via `any`.
  - **Excellence**:
    ```typescript
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      console.error(errorMessage);
    }
    ```

- **Fichier**: `app/api/invoices/route.ts`, Ligne 74
  - **Médiocrité**: `} catch (error: any) {`. Accès ou typage faible via `any`.
  - **Excellence**:
    ```typescript
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      console.error(errorMessage);
    }
    ```

- **Fichier**: `app/api/quotes/convert/route.ts`, Ligne 49
  - **Médiocrité**: `} catch (error: any) {`. Accès ou typage faible via `any`.
  - **Excellence**:
    ```typescript
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      console.error(errorMessage);
    }
    ```

- **Fichier**: `app/api/quotes/[id]/route.ts`, Ligne 131
  - **Médiocrité**: `const updateQuoteTx = db.transaction((quoteItems: any[]) => {`. Accès ou typage faible via `any`.
  - **Excellence**: Créer une interface `QuoteItem` et typer `quoteItems: QuoteItem[]`.

- **Fichier**: `app/api/quotes/route.ts`, Ligne 115
  - **Médiocrité**: `const insertQuote = db.transaction((quoteItems: any[]) => {`. Accès ou typage faible via `any`.
  - **Excellence**: Créer une interface `QuoteItem` et typer `quoteItems: QuoteItem[]`.

- **Fichier**: `app/page.tsx`, Ligne 25
  - **Médiocrité**: `const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId) as any`. Accès ou typage faible via `any`.
  - **Excellence**: Typer le retour de la requête SQLite avec l'interface `User`.

- **Fichier**: `hooks/use-quotes.ts`, Ligne 44
  - **Médiocrité**: `} catch (error: any) {`. Accès ou typage faible via `any`.
  - **Excellence**:
    ```typescript
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      console.error(errorMessage);
    }
    ```

- **Fichier**: `hooks/use-quotes.ts`, Ligne 81
  - **Médiocrité**: `} catch (error: any) {`. Accès ou typage faible via `any`.
  - **Excellence**:
    ```typescript
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      console.error(errorMessage);
    }
    ```

- **Fichier**: `lib/db.ts`, Ligne 105
  - **Médiocrité**: `statementCache: Map<string, any>;`. Accès ou typage faible via `any`.
  - **Excellence**: Utiliser `Map<string, Statement>` (import Statement from 'better-sqlite3').

- **Fichier**: `lib/db.ts`, Ligne 125
  - **Médiocrité**: `} catch (fatalErr: any) {`. Accès ou typage faible via `any`.
  - **Excellence**:
    ```typescript
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      console.error(errorMessage);
    }
    ```

- **Fichier**: `lib/db.ts`, Ligne 404
  - **Médiocrité**: `} catch (schemaErr: any) {`. Accès ou typage faible via `any`.
  - **Excellence**:
    ```typescript
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      console.error(errorMessage);
    }
    ```

- **Fichier**: `lib/services/InvoiceService.ts`, Ligne 15
  - **Médiocrité**: `createInvoice(data: any, userId: string, role: string) {`. Accès ou typage faible via `any`.
  - **Excellence**: Créer une interface `InvoiceCreateData` (clientId, items, etc.).

- **Fichier**: `lib/services/ExportService.ts`, Ligne 291
  - **Médiocrité**: `(q as any).validUntil ? formatDate((q as any).validUntil) : "—",`. Accès ou typage faible via `any`.
  - **Excellence**: Typer le paramètre avec l'interface `Quote` qui inclut 'validUntil'.

- **Fichier**: `lib/services/ExportService.ts`, Ligne 292
  - **Médiocrité**: `(q as any).subject ?? "—",`. Accès ou typage faible via `any`.
  - **Excellence**: Typer le paramètre avec l'interface `Quote` qui inclut 'subject'.

- **Fichier**: `lib/repositories/UserRepository.ts`, Ligne 38
  - **Médiocrité**: `const values: any[] = [];`. Accès ou typage faible via `any`.
  - **Excellence**: Typer le tableau `values` avec `unknown[]` (SQLite accepte tout, mais any est trop large).

### Code mort et Duplications

- Aucune anomalie majeure de code mort identifiée dans les fichiers clés lors de cette analyse statique (les imports inutilisés sont gérés par le linter en amont).

---

## 2. LOGIQUE REACT ET ANTI-PATTERNS UI

### Dépendances de Hooks manquantes ou désactivées

Omettre des dépendances dans `useEffect` provoque des bugs de "stale closures" ou des cycles infinis.

- **Fichier**: `components/pages/invoice-editor.tsx`, Ligne 68
  - **Médiocrité**: Désactivation de la règle `eslint-disable-next-line react-hooks/exhaustive-deps` pour omettre des dépendances (potentiel stale closure / re-render infini si mal géré).
  - **Excellence**: Ajouter les dépendances `isNew` et `clearInvoiceDraft` dans le tableau `[isNew, clearInvoiceDraft]`. En cas de boucle, envelopper `clearInvoiceDraft` avec `useCallback`.

- **Fichier**: `components/pages/quote-editor.tsx`, Ligne 80
  - **Médiocrité**: Désactivation de la règle `eslint-disable-next-line react-hooks/exhaustive-deps` pour omettre des dépendances (potentiel stale closure / re-render infini si mal géré).
  - **Excellence**: Ajouter les dépendances `isNew` et `clearQuoteDraft` dans le tableau `[isNew, clearQuoteDraft]`. En cas de boucle, envelopper `clearQuoteDraft` avec `useCallback`.

### Gestion des Erreurs et Appels API

- **Fichier**: `components/pages/audit-logs.tsx`, Ligne 21
  - **Médiocrité**: Appel `fetch('/api/audit-logs')` non sécurisé, manquant parfois un bloc `try/catch` robuste et un retour visuel en cas d'erreur de réseau (seulement `console.error`).
  - **Excellence**: Afficher un toast/alert à l'utilisateur lorsqu'une erreur serveur survient.

### Prop Drilling

- **Fichiers**: `components/pages/users.tsx` et autres vues principales.
  - **Médiocrité**: Transfert de props complexes pour le routage de vues internes au lieu d'utiliser le store global Zustand ou React Context sur plus de 3 niveaux.
  - **Excellence**: Déplacer les états d'édition et de navigation de vue (`isEditing`, `currentId`) au sein de l'état Zustand `store.ts`.

---

## 3. ARCHITECTURE ELECTRON ET IPC

### Fuites de Mémoire (Event Listeners IPC)

- **Fichier**: `main.js`, Ligne 80 (approx)
  - **Médiocrité**: Création de fenêtres enfants (ex: `printWin`) avec des événements de rendu ou WebContents (`did-finish-load`) sans `.removeAllListeners()` avant destruction.
  - **Excellence**:
    ```javascript
    printWin.webContents.removeAllListeners('did-finish-load');
    printWin.destroy();
    printWin = null;
    ```

### Sécurité du Preload

- **Fichier**: `preload.js`
  - **Analyse**: `contextIsolation` est `true` et l'interface via `contextBridge` est bien utilisée avec des fonctions encapsulées.

---

## 4. BASE DE DONNÉES ET PERFORMANCES (SQLITE)

### Requêtes N+1 et Optimisation Transactionnelle

- **Fichier**: `lib/services/InvoiceService.ts`, Ligne 87
  - **Médiocrité**: Exécution de `.run()` (ex. insertions de items) de façon isolée ou potentiellement itérée lors des mutations de factures complexes au lieu d'une transaction globale.
  - **Excellence**:
    ```typescript
    const createTx = db.transaction((data, items) => {
       // insertion parente
       const insertStmt = db.prepare('INSERT INTO child (parent_id, col) VALUES (?, ?)');
       for(const item of items) {
           insertStmt.run(data.id, item.col);
       }
    });
    createTx(data, items);
    ```

- **Fichier**: `app/api/quotes/[id]/route.ts`, Ligne 166
  - **Médiocrité**: Appel potentiellement d'insertion `insertItem.run` dans une boucle for() avec risque de ne pas centraliser dans le bloc de la transaction si mal englobé.
  - **Excellence**:
    ```typescript
    const createTx = db.transaction((data, items) => {
       // insertion parente
       const insertStmt = db.prepare('INSERT INTO child (parent_id, col) VALUES (?, ?)');
       for(const item of items) {
           insertStmt.run(data.id, item.col);
       }
    });
    createTx(data, items);
    ```

- **Fichier**: `app/api/invoices/[id]/route.ts`, Ligne 168
  - **Médiocrité**: Création des `credit_note_items` dans une boucle `for (const item of items)`. Mettre `.prepare()` en dehors de la transaction et s'assurer que la boucle `.run()` s'exécute de façon atomique via un `.transaction()` qui englobe la totalité.
  - **Excellence**:
    ```typescript
    const createTx = db.transaction((data, items) => {
       // insertion parente
       const insertStmt = db.prepare('INSERT INTO child (parent_id, col) VALUES (?, ?)');
       for(const item of items) {
           insertStmt.run(data.id, item.col);
       }
    });
    createTx(data, items);
    ```

### Indexation

- **Fichier**: `lib/db.ts` (Schéma init)
  - **Médiocrité**: Manque potentiel d'index sur les colonnes fréquemment utilisées en clauses `WHERE` (`status`, `clientId`, `userId`) sur de grandes tables (`invoices`, `quotes`, `audit_logs`).
  - **Excellence**: Ajouter des instructions `CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);` et similaires pour les colonnes de jointure et de recherche.

