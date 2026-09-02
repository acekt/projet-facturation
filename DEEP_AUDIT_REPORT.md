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


### 5. MODULE DEVIS & FACTURES (MOTEUR OPÉRATIONNEL)

#### 5.1 Cycle de vie et "Ghost Data" (Editeurs)
- **Fichiers :** `components/pages/quote-editor.tsx` et `components/pages/invoice-editor.tsx`
  - **Problème :** Le nettoyage des brouillons (via `clearQuoteDraft()` et `clearInvoiceDraft()`) au démontage du composant est incomplet. Bien que le `useEffect` l'appelle lors du démontage, un re-montage immédiat (ou un nettoyage imparfait dans la logique métier) peut laisser survivre des "Ghost Data", causant l'apparition de données de session précédentes lors de la création d'un "Nouveau Devis" ou d'une "Nouvelle Facture".
  - **Solution (Code de remédiation) :**
    Garantir mathématiquement que tout "Nouveau Devis" ou "Nouvelle Facture" instancie une copie propre et écrase l'état précédent dès l'initialisation.

    *Pour `quote-editor.tsx` :*
    ```tsx
    // Remplacer le useEffect existant (vers la ligne 100) par :
    React.useEffect(() => {
      // 1. Force clear on mount for NEW items explicitly
      if (isNew) {
        clearQuoteDraft();
        setLocalDraft(freshDraft);
      }

      // 2. Clear on unmount strictly
      return () => {
        if (isNew) {
          clearQuoteDraft();
        }
      };
    }, [isNew, clearQuoteDraft, freshDraft]);
    ```

    *Pour `invoice-editor.tsx` :*
    ```tsx
    React.useEffect(() => {
      if (isNew) {
        clearInvoiceDraft();
        setLocalDraft(freshDraft);
      }

      return () => {
        if (isNew) {
          clearInvoiceDraft();
        }
      };
    }, [isNew, clearInvoiceDraft, freshDraft]);
    ```

#### 5.2 Moteur de calcul réactif (Sous-total, Taxes, Total)
- **Fichiers :** `components/pages/quote-editor.tsx` et `components/pages/invoice-editor.tsx`
  - **Problème :** La logique de calcul (Sous-total, Net HT, CSS, TVA, TPS, Total) est répétée dans les composants React, incluant le parsing et l'arrondi. De plus, la fonction `updateItem` effectue des calculs de lignes (quantité * prix unitaire) en dupliquant la logique du moteur. Le risque d'incohérence d'un FCFA (±1 XAF) due aux arrondis partiels est présent.
  - **Solution (Code de remédiation) :**
    Utiliser les fonctions utilitaires pures (comme `computeTotals` de `@/lib/api/invoice-logic.ts`) qui respectent la norme DGI de calcul des taxes.

    *Pour la logique métier :*
    Ajouter l'import au sommet des fichiers :
    ```tsx
    import { computeTotals } from "@/lib/api/invoice-logic";
    ```

    *Pour `updateItem` (Dans `quote-editor.tsx` et `invoice-editor.tsx`) :*
    Remplacer la logique manuelle de calcul du total de ligne :
    ```tsx
    const updateItem = (itemId: string, field: keyof InvoiceItem, value: string | number) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id === itemId) {
            const updated = { ...item, [field]: value };
            if (field === "quantity" || field === "unitPrice") {
              if (Number(updated.unitPrice) < 0) updated.unitPrice = 0;
              // Arrondi strict sur chaque ligne individuelle
              updated.total = Math.round((Number(updated.quantity) || 0) * (Number(updated.unitPrice) || 0));
            }
            if (field === "description" && typeof value === "string") {
              const matchedService = services.find((s) => s.name.toLowerCase() === value.toLowerCase());
              if (matchedService) {
                updated.unitPrice = matchedService.unitPrice;
                updated.total = Math.round((Number(updated.quantity) || 0) * updated.unitPrice);
              }
            }
            return updated;
          }
          return item;
        }),
      );
    };
    ```

    *Pour les variables agrégées (Sous-total, Taxes, Total) :*
    Remplacer l'approche "inline" par l'appel formel :
    ```tsx
    // Remplacer :
    // const subtotal = Math.round(items.reduce(...))
    // const netHT = Math.max(0, subtotal - Math.round(discount));
    // ...
    // const total = netHT + cssAmount + tpsAmount + tvaAmount;

    // Par :
    const { subtotal, discount: computedDiscount, cssAmount, taxBase, tpsAmount, tvaAmount, total } = computeTotals(
      items.map(item => ({ quantity: item.quantity, unitPrice: item.unitPrice })),
      discount,
      {
        tvaRate: settings.tvaRate ?? 0,
        tpsRate: settings.tpsRate ?? 9.5,
        cssRate: settings.cssRate ?? 0
      }
    );
    const netHT = Math.max(0, subtotal - Math.round(discount)); // HT après remise absolue
    ```

#### 5.3 Conversion Devis -> Facture (Transactionnalité et Données Orphelines)
- **Fichier :** `lib/services/QuoteService.ts`
  - **Problème :** Bien que la conversion s'exécute dans un bloc `db.transaction`, si un crash ou un redémarrage sauvage survient juste au niveau du backend Node (et non au niveau DB) ou si la validation de la logique métier lève une exception inattendue après une insertion sans rollback adéquat, des factures orphelines (sans items ou non reliées) pourraient apparaître. La boucle `for...of` effectuant des `insertItem.run` un par un peut aussi être un goulot d'étranglement ou générer des soucis d'atomicité dans certains cas extrêmes de SQLite synchrones sur des systèmes lents (Problème N+1).
  - **Solution (Code de remédiation) :**
    Utiliser un batch d'insertion ou sécuriser formellement la validation préalable, et garantir l'utilisation d'une transaction bloquante stricte (`IMMEDIATE` ou `EXCLUSIVE`) qui annule tout si une seule ligne échoue.

    *Code de remédiation pour `convertToInvoice` :*
    ```typescript
    // Remplacer l'insertion boucle (vers la ligne 71) par une approche préparée :
    const insertInvoice = db.prepare(`
      INSERT INTO invoices (
        id, number, quoteId, clientId, clientName, clientEmail, date,
        subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, notes, subject, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertItem = db.prepare(`
      INSERT INTO invoice_items (id, invoiceId, description, quantity, unitPrice, total)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const updateQuoteStatus = db.prepare(`UPDATE quotes SET status = ? WHERE id = ?`);

    // Déclaration transactionnelle stricte pour éviter les orphelins :
    const convert = db.transaction(() => {
      const number = getNextNumber('invoice');

      insertInvoice.run(
        invoiceId, number, quoteId, quote.clientId, quote.clientName, quote.clientEmail,
        new Date().toISOString().split('T')[0],
        Math.round(quote.subtotal), Math.round(quote.discount), Math.round(quote.taxBase),
        Math.round(quote.tvaAmount), Math.round(quote.tpsAmount || 0), Math.round(quote.cssAmount),
        Math.round(quote.total), INVOICE_STATUS.UNPAID, quote.notes, quote.subject ?? null, userId
      );

      // Insertion sécurisée en transaction
      for (const item of items) {
        insertItem.run(
          crypto.randomUUID(), invoiceId, item.description, item.quantity,
          Math.round(item.unitPrice), Math.round(item.total)
        );
      }

      // Mise à jour finale
      updateQuoteStatus.run(QUOTE_STATUS.CONVERTI, quoteId);

      return { invoiceId, invoiceNumber: number, quoteId };
    });

    // Exécuter
    return convert();
    ```

#### 5.4 UI/UX Premium (Feedback & Alignements)
- **Fichiers :** `components/pages/quote-editor.tsx` et `components/pages/invoice-editor.tsx`
  - **Problème :** Les tableaux d'articles manquent d'alignement strict à droite pour les montants (les entêtes et les cellules ne sont pas toujours parfaitement alignés pour les montants monétaires). Le bouton de soumission ne verrouille pas visuellement l'UI de manière claire lors de l'enregistrement asynchrone (`isSubmitting` n'est pas appliqué sur certains éléments, ou le style reste actif). L'espacement peut être amélioré pour un style "B2B moderne".
  - **Solution (Code de remédiation) :**
    Appliquer des classes Tailwind spécifiques pour aligner les montants (`text-right`), espacer les éléments formellement et verrouiller les champs.

    *Classes pour le Header du Tableau :*
    ```tsx
    // Remplacer :
    <div className="grid grid-cols-12 gap-2 md:gap-4 px-3 pb-2 text-sm font-medium text-muted-foreground">
      <div className="col-span-12 md:col-span-6">Description / Service</div>
      <div className="col-span-2 text-right">Qté</div>
      <div className="col-span-2 text-right">Prix Unitaire</div>
      <div className="col-span-2 text-right">Total HT</div>
    </div>

    // Par un espacement aéré B2B :
    <div className="grid grid-cols-12 gap-2 md:gap-4 px-4 py-3 bg-secondary/20 rounded-t-lg text-sm font-semibold text-muted-foreground border-b border-border">
      <div className="col-span-12 md:col-span-6">Description / Service</div>
      <div className="col-span-4 md:col-span-2 text-right">Qté</div>
      <div className="col-span-4 md:col-span-2 text-right">Prix U. (XAF)</div>
      <div className="col-span-3 md:col-span-2 text-right pr-2">Total HT</div>
    </div>
    ```

    *Verrouillage pendant soumission (`isSubmitting`) :*
    ```tsx
    // Bouton Enregistrer :
    <Button
      onClick={() => handleSave("EN_ATTENTE")}
      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 transition-all"
      disabled={isSubmitting || status === "CONVERTI"}
    >
      {isSubmitting ? (
        <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Save className="w-4 h-4 mr-2" />
      )}
      {status === "CONVERTI"
        ? "Devis Converti (Lecture seule)"
        : (isSubmitting ? "Enregistrement..." : "Enregistrer le Devis")}
    </Button>

    // Tous les inputs critiques doivent inclure :
    disabled={isSubmitting || status === "CONVERTI"}
    ```

#### 5.5 Régressions des Tests et Schémas de Base de Données
- **Problème :** En exécutant `npx vitest run`, les tests (`contract-invoices.test.ts`, `financial-flow.test.ts`, `quotes-rbac.test.ts`) échouent avec l'erreur `SqliteError: table invoices has no column named subject`. La base de données SQLite attend ou omet des colonnes comme `subject` qui sont manipulées dans le code applicatif (`InvoiceService.ts`, etc.).
- **Solution :** Il faut s'assurer que la migration ou la création de table (ex. `reset-db.ts` ou la commande de bootstrap) inclut bien la colonne `subject` pour la table `invoices` (et optionnellement `quotes`).
