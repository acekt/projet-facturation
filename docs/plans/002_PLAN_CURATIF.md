# 002 - PLAN CURATIF (REFACTORING SANS RÉGRESSION)

Ce plan décrit les étapes de nettoyage structurel de l'application. Son objectif est d'éliminer la dette technique (doublons, architectures incohérentes) sans introduire de nouveaux bugs ni de régressions comportementales.

## Étape 1 : Unification de la Chaîne d'Impression (A4/PDF)

L'application maintient actuellement 3 moteurs de rendu divergents. L'objectif est d'avoir une seule source de vérité pour le rendu visuel et fiscal.

*   **Fichiers à supprimer** :
    *   `apps/desktop/components/pdf-document.tsx` (Suppression de la dépendance `@react-pdf/renderer`).
    *   `apps/desktop/components/printable-document.tsx` (Ancienne version).
*   **Action sur `invoices.tsx` et `quotes.tsx`** :
    Remplacer la génération via `<PDFDocument />` par l'appel à la fonction centralisée de `FullscreenDocumentViewer` :
    ```typescript
    // Suppression de l'import @react-pdf
    // Utilisation directe du canal IPC configuré dans document-a4
    await window.electron.exportPDF(htmlDoc, filename);
    ```
*   **Bénéfice** : L'utilisateur aura exactement le même visuel (WYSIWYG) à l'écran, à l'impression papier, et sur le PDF téléchargé. Les calculs fiscaux (Net HT, TVA) seront uniques (gérés par `A4FiscalSummary`).

## Étape 2 : Nettoyage des Doublons UI (Pages vs Features)

Plusieurs composants d'interface existent en deux versions (l'une dans `pages/`, l'autre dans `features/`), créant de la confusion pour les futures évolutions.

*   **Fichiers orphelins à supprimer (Dossier `features`)** :
    *   `apps/desktop/components/features/invoices/InvoiceDeleteDialog.tsx`
    *   `apps/desktop/components/features/invoices/InvoiceFilters.tsx`
    *   `apps/desktop/components/features/quotes/QuoteDeleteDialog.tsx`
    *   `apps/desktop/components/features/quotes/QuoteFilters.tsx`
*   **Vérification de Non-Régression** :
    S'assurer que `apps/desktop/components/pages/invoices.tsx` continue d'importer correctement la `InvoiceDeleteDialog` depuis son propre dossier `pages/invoices/`.

## Étape 3 : Centralisation du Moteur Fiscal (Math-Logic)

La logique financière est dispersée. Le backend utilise un pont déprécié, et il existe plusieurs wrappers.

*   **Fichier cible** : `packages/database/src/fiscal/index.ts`
*   **Action** :
    *   Supprimer la fonction wrapper `calculateFiscalCascade` qui n'apporte que de la confusion (Ligne 138).
    *   Mettre à jour tous les imports locaux (ex: dans `quote.actions.ts` et `invoice.actions.ts`) pour qu'ils invoquent directement `computeTotals(items, discount, rates)`.
*   **Bénéfice** : Typage strict, plus d'ambiguïté sur la gestion de l'arrondi (XAF) et de la cascade fiscale DGI (Gabon).

## Étape 4 : Éradication des Requêtes N+1 (ExportService)

Lors de l'export de données, la base SQLite est lourdement sollicitée par des boucles sur des milliers d'items.

*   **Fichier** : `apps/desktop/lib/services/ExportService.ts`
*   **Action** :
    Modifier la récupération des factures et des devis pour utiliser l'agrégation native SQLite au lieu d'une boucle `for`.
    ```sql
    -- Extraction en 1 seule requête :
    SELECT i.*,
      (SELECT json_group_array(json_object('description', it.description, 'total', it.total))
       FROM invoice_items it WHERE it.invoiceId = i.id) as items_json
    FROM invoices i;
    ```
*   **Traitement JS** : Parser `items_json` dans `ExportService.ts` avec `JSON.parse()` en une seule passe algorithmique.

## Étape 5 : Découplage de Zustand dans les Éditeurs

Actuellement, lorsqu'un devis ou une facture est sauvegardé, l'application recharge TOUT le catalogue depuis le serveur.

*   **Fichiers** : `invoice-editor.tsx` et `quote-editor.tsx`
*   **Action** :
    Au lieu d'exécuter `getInvoices()` après un `createInvoice()`, insérer directement le résultat dans l'état local Zustand.
    ```typescript
    // Remplacer :
    // const newInvoices = await getInvoices(); setInvoices(newInvoices.data);
    // Par :
    addInvoice(response.data);
    ```
*   **Bénéfice** : Sauvegarde instantanée sans "freeze" de l'interface utilisateur.

## Étape 6 : Nettoyage du Proxy/Middleware

*   **Fichier** : `apps/desktop/proxy.ts`
*   **Action** :
    Améliorer le tableau de regex (ou le block `matcher` de Next.js) pour que les requêtes vers les assets statiques (`.png`, `.svg`, `.css`, `_next/`) contournent _immédiatement_ le calcul HMAC du token de session. Cela allégera drastiquement la charge CPU du backend Next.js sur les machines peu performantes.