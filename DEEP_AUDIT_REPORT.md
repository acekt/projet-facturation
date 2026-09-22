# DEEP_AUDIT_REPORT

## 1. QUALITÉ DU CODE STATIQUE ET TYPAGE (TYPESCRIPT)

### Utilisation de types `any`
- **Fichier:** `components/pdf-document.tsx`
  - **Lignes:** 310, 343
  - **Problème:** Utilisation de `any` pour échapper au contrôle de type de l'objet `document`.
  - **Remédiation:** Créer une interface unifiée (ex: `DocumentProps`) ou utiliser des gardes de type (`in`) de manière sécurisée sans cast forcé vers `any`.
  - **Code:**
    ```tsx
    // Au lieu de: ('notes' in document ? (document as any).notes : null)
    // Utiliser:
    type DocumentType = { notes?: string | null; discount?: number; };
    const doc = document as DocumentType;
    <Text>Objet: {doc.notes || "Prestations de services"}</Text>
    <Text style={styles.totalVal}>{formatCurrencyPDF(doc.discount || 0)}</Text>
    ```

- **Fichier:** `components/pages/payments.tsx`
  - **Ligne:** 192
  - **Problème:** `const getPaymentStatusInfo = (invoice: any) => {`
  - **Remédiation:** Utiliser le type `InvoiceResponse` de `@/lib/types/api`.
  - **Code:** `const getPaymentStatusInfo = (invoice: InvoiceResponse) => {`

- **Fichier:** `components/pages/quotes.tsx`
  - **Lignes:** 332, 466, 614
  - **Problème:** `quote.status as any` contourne le système de type strict pour le statut des devis.
  - **Remédiation:** Typage fort de la propriété status dans l'interface correspondante ou conversion sécurisée vers le type attendu (ex: `QuoteStatus`).

- **Fichier:** `components/providers.tsx`
  - **Ligne:** 11
  - **Problème:** Typage `any` pour les propriétés `error` et `resetErrorBoundary`.
  - **Remédiation:** Utiliser `unknown` ou typages stricts selon la documentation de react-error-boundary (`FallbackProps`).
  - **Code:** `function FallbackError({ error, resetErrorBoundary }: { error: unknown; resetErrorBoundary: (...args: unknown[]) => void }) {`

- **Fichier:** `components/fullscreen-document-viewer.tsx`
  - **Lignes:** 142, 165, 183
  - **Problème:** Casting forcé en `any` pour contourner le manque de type commun, et typage `any` pour `err`.
  - **Remédiation:** Typage structuré pour `docProps.data` (ex: `{ number?: string }`), et `unknown` pour l'erreur interceptée.

- **Fichier:** `app/api/settings/route.ts`
  - **Lignes:** 102, 119
  - **Problème:** Catch `error: any`
  - **Remédiation:** Toujours utiliser `error: unknown` et vérifier `error instanceof Error`.
  - **Code:**
    ```typescript
    catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erreur inconnue";
    }
    ```

- **Fichier:** `app/page.tsx`
  - **Ligne:** 25
  - **Problème:** Casting du retour de la requête SQLite en `any`.
  - **Remédiation:** Utiliser une interface métier, comme `DbUser`.
  - **Code:** `const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId) as DbUser;`

- **Fichier:** `lib/services/InvoiceService.ts`
  - **Ligne:** 16
  - **Problème:** Paramètre `data: any`
  - **Remédiation:** Importer et utiliser le type adéquat validé par Zod, par exemple `z.infer<typeof invoiceSchema>`.

## 2. LOGIQUE REACT ET ANTI-PATTERNS UI

### Mauvaise gestion des effets (`useEffect`) et états
- **Fichiers Multiples (`components/pages/invoice-editor.tsx`, `components/pages/quote-editor.tsx`)**
  - **Problème:** Utilisation fréquente de `useEffect` pour synchroniser des props ou réinitialiser le store de l'éditeur lors du montage, entraînant des re-renders superflus et des risques de clignotement (flickering).
  - **Remédiation:** Gérer l'initialisation du store en dehors de la boucle de rendu React, soit au niveau du shell d'application, soit en utilisant `queueMicrotask` lors de la phase de chargement initial.

### Manque de feedback utilisateur (`try/catch`)
- **Fichier:** `app/login/login-client.tsx`
  - **Ligne:** 116
  - **Problème:** Le catch actuel gère l'erreur, mais ne donne pas de retour suffisamment précis selon l'instance d'erreur du serveur.
  - **Remédiation:** Extraire le message spécifique du serveur si disponible, ou afficher un fallback toast générique via `sonner`.

## 3. ARCHITECTURE ELECTRON ET IPC

### Gestion des Erreurs et de l'Expérience Utilisateur
- **Fichier:** `components/fullscreen-document-viewer.tsx`
  - **Lignes:** 163-172
  - **Problème:** L'erreur générique lors de l'export PDF (ex: `window.electron.exportPDF`) ne filtre pas l'annulation de la boîte de dialogue système ("cancel", "annul"). L'utilisateur voit donc une erreur (toast rouge) quand il annule sciemment l'enregistrement du PDF.
  - **Remédiation:** Filtrer explicitement les messages d'erreur bénins pour éviter les faux positifs.
  - **Code:**
    ```typescript
    } catch (err: unknown) {
      console.error('[FullScreenViewer] IPC exportPDF error:', err);
      const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      if (!msg.includes('cancel') && !msg.includes('annul')) {
        toast.error(`Échec de l'export: ${err instanceof Error ? err.message : 'Erreur inconnue'}`, { id: toastId });
      } else {
         toast.dismiss(toastId);
      }
    }
    ```

## 4. BASE DE DONNÉES ET PERFORMANCES (SQLITE)

### Requêtes N+1 et Statements non-préparés
- **Fichier:** `app/api/invoices/[id]/route.ts` (Et autres routes API similaires)
  - **Problème:** Préparation dynamique de requêtes SQL (ex: `db.prepare('SELECT...').get(id)`) à l'intérieur de la fonction de traitement (request handler).
  - **Remédiation:** Les instructions (statements) doivent être "hoisted" (hissées) au niveau du module pour être compilées une seule fois lors du chargement, ce qui améliore drastiquement les performances et réduit la contention des verrous SQLite (SQLITE_BUSY).
  - **Code:**
    ```typescript
    // Au niveau du module (en dehors de GET/POST)
    const getInvoiceItemsStmt = db.prepare('SELECT * FROM invoice_items WHERE invoiceId = ?');

    // Dans la fonction:
    const items = getInvoiceItemsStmt.all(id) as DbInvoiceItem[];
    ```

### Transactions pour les conversions
- **Fichier:** `app/api/quotes/convert/route.ts`
  - **Problème:** Bien que l'insertion d'une nouvelle facture se fasse via `InvoiceService`, l'historisation de la conversion (et la récupération potentielle d'éléments) doit être garantie de manière atomique.
  - **Remédiation:** Englober toutes les opérations d'écriture imbriquées ou dépendantes (ex: mise à jour du devis à CONVERTI et création de la facture) dans un seul et même bloc `db.transaction()`.

---
*Ce rapport a été généré automatiquement dans le cadre de l'audit d'assurance qualité en tâche de fond. Aucune modification de source n'a été effectuée, préservant ainsi l'intégrité de l'environnement de production.*
