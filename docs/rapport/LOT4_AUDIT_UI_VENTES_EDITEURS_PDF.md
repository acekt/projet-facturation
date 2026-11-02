# RAPPORT D'AUDIT: LOT 4 - UI VENTES, ÉDITEURS & CHAÎNE PDF

Ce rapport documente l'audit exhaustif en lecture seule des interfaces de gestion commerciale (Factures, Devis, Avoirs), des formulaires d'édition, des composants redondants et du rendu d'impression PDF.

## 1. Inventaire des "Boutons Morts", Props ignorées & États fantômes

**Problème 1 : Modal de Paiement - Bouton de validation fantôme ou défectueux**
*   **Fichiers & Lignes** :
    *   `apps/desktop/components/pages/invoices.tsx` (Lignes 167-195 - `confirmPayment`)
    *   `apps/desktop/components/pages/invoices/PaymentDialog.tsx` (Ligne 130 - `Button onClick={onConfirm}`)
*   **Diagnostic** : Dans `invoices.tsx` (Ligne 172), il y a un crochet fermant (`}`) en trop qui casse la portée de la fonction `confirmPayment`. De plus, les états `paymentDate` et `paymentReference` sont bien déclarés dans `invoices.tsx` (Ligne 63-64), passés dans la fonction `createPayment`, mais **ne sont pas exposés ni passés en props** au composant enfant `PaymentDialog.tsx`. Par conséquent, l'utilisateur ne peut jamais saisir de date ou de référence de paiement, ils sont figés.

**Problème 2 : Actions manquantes sur l'Avoir (Credit Notes)**
*   **Fichier & Lignes** : `apps/desktop/components/pages/credit-notes.tsx` (Ligne 156 - `actions={...}`)
*   **Diagnostic** : La page liste des avoirs propose un bouton "Exporter" qui ouvre bien `DataExportModal`, mais le flux pour l'impression ou l'annulation d'un avoir existant manque de clarté par rapport aux factures et devis, et le composant `CreditNoteViews` omet potentiellement des handlers de base.

## 2. Audit des Doublons UI & Fichiers Orphelins

**Problème 3 : Les "DeleteDialogs" en Doublon (Features vs Pages)**
*   **Fichiers comparés** :
    *   `apps/desktop/components/features/invoices/InvoiceDeleteDialog.tsx` vs `apps/desktop/components/pages/invoices/InvoiceDeleteDialog.tsx`
    *   `apps/desktop/components/features/quotes/QuoteDeleteDialog.tsx` vs `apps/desktop/components/pages/quotes/QuoteDeleteDialog.tsx`
*   **Diagnostic** : L'application possède deux versions concurrentes de la même boîte de dialogue.
    *   Le dossier `pages/.../InvoiceDeleteDialog.tsx` est celui actuellement importé (Ligne 17 dans `invoices.tsx`). Il est très basique et déclenche un "Soft Delete".
    *   Le dossier `features/.../InvoiceDeleteDialog.tsx` contient une logique bien plus évoluée avec une `Checkbox` (Ligne 34) pour supprimer le devis associé, mais ce fichier est **orphelin et inutilisé**. Ironiquement, cette fonctionnalité (`deleteAssociatedQuote`) a été recodée en dur dans `InvoiceCancelDialog.tsx`.
*   **De même pour `InvoiceFilters.tsx` et `QuoteFilters.tsx`** : Ces composants situés dans `features/` sont des reliques orphelines. `invoices.tsx` utilise à la place `InvoiceFilterBar` qu'il importe depuis `pages/invoices/InvoiceFilterBar`.

**Problème 4 : Divergence totale de la Chaîne PDF/A4**
*   **Fichiers comparés** : `document-a4.tsx`, `pdf-document.tsx`, `printable-document.tsx`
*   **Diagnostic** : L'application maintient 3 moteurs de rendu pour la même facture commerciale :
    1.  `document-a4.tsx` (HTML/Tailwind imprimé via Chromium) utilisé par `FullScreenDocumentViewer`.
    2.  `pdf-document.tsx` (Utilise `@react-pdf/renderer` avec des primitives `<View>`, `<Text>`) utilisé comme Fallback dans `invoices.tsx` et `quotes.tsx`.
    3.  `printable-document.tsx` : Une ancienne version HTML basique (avec des bordures noires dures et des colonnes fixes "Brut HT", "Remise", "Net HT" codées en dur).
*   **Divergence Fiscale** : `printable-document.tsx` affiche le Net HT comme `taxBase - cssAmount` (Ligne 81) et gère très mal le multi-régime (GOODS vs SERVICES), tandis que `document-a4.tsx` délègue les calculs avancés à `A4FiscalSummary`. L'export `@react-pdf/renderer` (`pdf-document.tsx`) calcule `netHT` comme `(document.taxBase ?? document.subtotal) - (document.cssAmount ?? 0)` (Ligne 50). L'expérience utilisateur (ce qu'il voit à l'écran vs ce qui est téléchargé) est donc brisée.

## 3. Audit des Éditeurs (Facture & Devis)

**Problème 5 : Ré-hydratation conditionnelle et Brouillons (Ghost Data)**
*   **Fichier & Lignes** : `apps/desktop/components/pages/invoice-editor.tsx` (Ligne 87-101 - `useEffect` initialisation).
*   **Diagnostic** : Le composant utilise un objet `blankDraft` pour initialiser l'état. Cependant, l'éditeur de devis (`quote-editor.tsx`, Ligne 77-79) stocke judicieusement les `settings.mentionsLegales` dans un `useRef` pour éviter de re-déclencher un clear du brouillon à chaque fois que le context global `settings` change. `invoice-editor.tsx` omet cette protection (Ligne 101 met `settings.mentionsLegales` en dépendance), ce qui écrase sauvagement la saisie en cours si le store Zustand s'hydrate tardivement.

**Problème 6 : Mutation brutale et Re-renders (Zustand)**
*   Dans `invoice-editor.tsx` et `quote-editor.tsx`, après `handleSave()`, l'éditeur exécute :
    ```typescript
    const newInvoices = await getInvoices();
    if (newInvoices.success && newInvoices.data) {
      setInvoices(newInvoices.data);
    }
    ```
*   **Diagnostic** : Un rechargement complet de toutes les factures depuis le serveur via API pour chaque création d'une seule ligne est une hérésie de performance (N+1 UI Rendering). L'action devrait retourner la facture créée et le store devrait simplement faire un `addInvoice(response.data)`.

## 4. Feuille de route en 3 plans

### PLAN CORRECTIF (Bugs Bloquants)
*   **Réparer la modale de paiement** :
    Dans `invoices.tsx`, retirer l'accolade orpheline qui casse `confirmPayment`.
    Dans `PaymentDialog.tsx`, ajouter les champs natifs `Date du paiement` (type="date") et `Référence` (type="text") et les lier aux props `onPaymentDateChange` et `onPaymentReferenceChange` pour débloquer l'enregistrement complet de l'acte.
*   **Réparer le brouillon de Facture** :
    Dans `invoice-editor.tsx`, encapsuler `settings.mentionsLegales` dans un `useRef` au premier rendu pour stopper la perte de données (ghosting) de l'utilisateur.

### PLAN CURATIF (Nettoyage & Unification A4/PDF)
*   **Supprimer les doublons Orphelins** :
    Supprimer purement et simplement les fichiers `QuoteDeleteDialog.tsx`, `InvoiceDeleteDialog.tsx`, `InvoiceFilters.tsx` et `QuoteFilters.tsx` du dossier `features/` qui créent de la confusion et de la dette technique.
*   **Standardiser l'export PDF (Drop `@react-pdf`)** :
    Supprimer `pdf-document.tsx` et `printable-document.tsx`. La fonction `handleDownloadPDF` (dans `invoices.tsx` et `quotes.tsx`) doit UNIQUEMENT appeler `window.electron.exportPDF(htmlDoc, filename)` généré via `document-a4.tsx` et `buildPrintHtml()`. Cela garantit que le rendu écran et le PDF téléchargé sont au pixel près identiques.
*   **Optimiser Zustand State** :
    Remplacer les `await getInvoices()` post-save par l'appel synchrone `addInvoice(result)`.

### PLAN PRÉVENTIF (Composants Standardisés)
*   **Mutualisation de `InvoiceViews` et `QuoteViews`** :
    Créer un composant générique `<DataTableBusinessEntity>` qui gère la pagination, le tri, la recherche locale, et les vues "Grille / Ligne", limitant ainsi la duplication de code entre les 3 modules de ventes.