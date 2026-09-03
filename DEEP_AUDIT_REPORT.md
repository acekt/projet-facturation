# 🚨 DEEP_AUDIT_REPORT.md — MISSION DE TEST PROFOND ET CONTINU 🚨

## RAPPORT DE DIAGNOSTIC IMPITOYABLE (LEAD QA ENGINEER)

En tant qu'Architecte Logiciel et Lead QA, j'ai audité l'intégralité du code source (Frontend, Backend, IPC Electron, et SQLite). Ce rapport expose les médiocrités, les "code smells" et les failles potentielles de résilience. Conformément aux directives strictes, **aucun fichier source n'a été modifié**. Voici les remèdes exacts exigés pour l'excellence.

---

### 1. QUALITÉ DU CODE STATIQUE ET TYPAGE (TYPESCRIPT)

L'usage du type `any` est un anti-pattern majeur en TypeScript, annulant les garanties de sécurité du compilateur. Il expose l'application à des erreurs critiques lors du runtime.

#### ❌ Anomalie : Typage explicite avec `any` (Prop Drilling & Composants)
- **Fichier** : `components/pages/protected-app-shell.tsx` (Ligne 30)
  - **Médiocrité** : `initialUser: any`. Les propriétés de l'utilisateur ne sont pas garanties.
  - **Code d'Excellence** :
    ```typescript
    import type { User } from '@/lib/types/api';
    interface ProtectedAppShellProps {
      initialUser: User | null;
    }
    ```

- **Fichier** : `components/pdf-document.tsx` (Lignes 310, 343)
  - **Médiocrité** : `(document as any).notes` et `(document as any).discount`. Forcer le type contourne la vérification des clés du document.
  - **Code d'Excellence** :
    ```typescript
    // Utiliser un type d'union discriminant ou vérifier la présence de la propriété
    <Text>Objet: {('notes' in document ? (document as Quote | Invoice).notes : null) || "Prestations de services"}</Text>
    <Text style={styles.totalVal}>{formatCurrencyPDF('discount' in document ? (document as Quote | Invoice).discount : 0)}</Text>
    ```

#### ❌ Anomalie : Typage des erreurs (Catch)
- **Fichier** : `app/api/quotes/convert/route.ts` (Ligne 49) et `components/pages/quotes.tsx` (Ligne 208)
  - **Médiocrité** : `} catch (error: any) {`. L'erreur interceptée n'est pas typée correctement, ce qui peut causer un crash lors de l'accès à `error.message`.
  - **Code d'Excellence** :
    ```typescript
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      console.error('[Erreur]', errorMessage);
      // Remonter errorMessage
    }
    ```

#### ❌ Anomalie : Typage des transactions SQLite
- **Fichier** : `app/api/quotes/[id]/route.ts` (Ligne 131)
  - **Médiocrité** : `const updateQuoteTx = db.transaction((quoteItems: any[]) => {`
  - **Code d'Excellence** :
    ```typescript
    import type { QuoteItem } from '@/lib/types/api';
    const updateQuoteTx = db.transaction((quoteItems: QuoteItem[]) => {
    ```

---

### 2. LOGIQUE REACT ET ANTI-PATTERNS UI

#### ❌ Anomalie : Effets de Bord potentiellement dangereux
- **Fichier** : `components/pages/protected-app-shell.tsx` (Ligne 54)
  - **Médiocrité** : Utilisation d'un `setTimeout` dans un `useEffect` sans dépendance complète ou isolation, qui force un re-render complet. Bien que ce composant ait ses dépendances correctes pour `initialUser` (ligne 42), le couplage Zustand/React manque parfois d'isolation.
  - **Code d'Excellence** :
    ```typescript
    React.useEffect(() => {
      if (!isDataLoaded) {
        const timer = setTimeout(() => setInitTimeout(true), 3000);
        return () => clearTimeout(timer); // Toujours clear le timer au démontage
      } else {
        setInitTimeout(false);
      }
    }, [isDataLoaded]);
    ```

#### ❌ Anomalie : Gestion des requêtes API sans filet (Fetch sans throw)
- **Fichier** : `components/pages/quotes.tsx` (Lignes 144, 202-203)
  - **Médiocrité** : `fetch("/api/quotes").then((res) => res.json())`. L'API `fetch` natif ne déclenche pas d'erreur (throw) sur un statut `4xx` ou `5xx`. Si l'API renvoie une erreur serveur (ex: 500 HTML), le `.json()` crashera de manière imprévisible avec `Unexpected token`.
  - **Code d'Excellence** :
    ```typescript
    const res = await fetch("/api/quotes");
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erreur réseau inattendue' }));
      throw new Error(err.error || `Erreur HTTP: ${res.status}`);
    }
    const updatedQuotes = await res.json();
    ```

---

### 3. ARCHITECTURE ELECTRON ET IPC

#### ✅ / ❌ Diagnostic IPC et Fuites de Mémoire
- **Analyse IPC** : Le projet a évité l'anti-pattern majeur des fuites `ipcRenderer.on` en utilisant exclusivement le pattern de communication `ipcMain.handle` / `ipcRenderer.invoke` (ex: `main.js` Ligne 659: `// IPC HANDLERS (Tous async via ipcMain.handle, jamais sendSync)`). C'est excellent, car l'usage de Promesses élimine la nécessité de faire un `.removeListener()`.
- **Pont de sécurité (Preload)** : Le fichier `preload.js` utilise strictement `contextBridge.exposeInMainWorld` et n'expose jamais l'objet événement (`event`) global au contexte React.

- **Recommandation d'Excellence** (Pour garantir que de futurs écouteurs ne fuient pas) :
  Si l'application vient à implémenter des événements asynchrones poussés par le serveur (ex: synchronisation), il faudra ABSOLUMENT utiliser le modèle suivant :
  ```typescript
  React.useEffect(() => {
    const handler = (_event: Electron.IpcRendererEvent, data: any) => { /* action */ };
    window.electron.onUpdate(handler);
    return () => {
      window.electron.removeUpdateListener(handler); // Nettoyage strict
    };
  }, []);
  ```

---

### 4. BASE DE DONNÉES ET PERFORMANCES (SQLITE)

L'utilisation de SQLite synchrone avec un stockage local exige des stratégies agressives pour éviter le gel (freeze) de l'interface Electron.

#### ❌ Anomalie : Exécution SQL (N+1) dans une boucle
- **Fichier** : `app/api/quotes/[id]/route.ts` (Ligne 166)
  - **Médiocrité** : L'exécution de requêtes préparées `insertItem.run(...)` dans une boucle `for...of`. Bien que ce soit exécuté à l'intérieur d'un bloc `db.transaction()`, l'appel répétitif au niveau applicatif reste moins optimal qu'un `batch` ou un statement multi-valeurs pour de gros volumes.
  - **Code d'Excellence** (Approche la plus propre en SQLite JS) :
    Il est impératif de conserver la déclaration du `.prepare()` à l'extérieur (ce qui est fait), mais pour être intouchable en termes de performance lors de grosses commandes (100+ articles) :
    ```typescript
    const insertItem = db.prepare(`
      INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // La fonction de transaction est déjà présente, l'utilisation de .run en boucle
    // est optimisée par better-sqlite3 dans une transaction, mais il faut typer
    // rigoureusement quoteItems pour éviter des payloads massifs non prévus.
    ```

#### ❌ Anomalie : Indexation manquante (Ralentissement des jointures et filtres)
- **Fichier** : (À créer/ajouter dans le gestionnaire de base de données `lib/db.ts`)
  - **Médiocrité** : Les requêtes fréquentes utilisent souvent des clauses `WHERE status = ?` (ex: pour différencier les devis convertis des devis en attente) ou l'identifiant du client `clientId`. L'absence d'index sur ces colonnes provoque un `Full Table Scan`.
  - **Code d'Excellence** :
    Ajouter explicitement ces instructions DDL lors de l'initialisation de la base :
    ```sql
    -- Dans lib/db.ts lors de l'initialisation (migrations)
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);
      CREATE INDEX IF NOT EXISTS idx_quotes_clientId ON quotes(clientId);
      CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
      CREATE INDEX IF NOT EXISTS idx_invoices_clientId ON invoices(clientId);
    `);
    ```


### 5. ARCHITECTURE D'ÉTAT & INTÉGRATION ELECTRON (MODULE 5/5)

#### 5.1. Hydratation du Store & Squelette Applicatif (`ProtectedAppShell.tsx`)
- **Problèmes de goulots d'étranglement et de clignotement :**
  L'implémentation initiale de l'écran de chargement dans `ProtectedAppShell` utilise un `setTimeout` qui introduit une latence artificielle et risque de provoquer un "flicker" si `isDataLoaded` passe rapidement à `true`. De plus, le typage de `initialUser` est déclaré en tant que `any`, annulant le typage de sécurité.
- **Code de remédiation complet pour `components/pages/protected-app-shell.tsx` :**
  ```tsx
  "use client"

  import * as React from "react"
  import { motion, AnimatePresence } from "framer-motion"
  import { Sidebar, TopBar } from "@/components/layout/navigation"
  import { CommandMenu } from "@/components/layout/command-menu"
  import { Dashboard } from "@/components/pages/dashboard"
  import { InvoicesPage } from "@/components/pages/invoices"
  import { QuotesPage } from "@/components/pages/quotes"
  import { QuoteEditor } from "@/components/pages/quote-editor"
  import { InvoiceEditor } from "@/components/pages/invoice-editor"
  import { ClientsPage } from "@/components/pages/clients"
  import { ServicesPage } from "@/components/pages/services"
  import { PaymentsPage } from "@/components/pages/payments"
  import { SettingsPage } from "@/components/pages/settings"
  import { CreditNotesPage } from "@/components/pages/credit-notes"
  import { AuditLogsPage } from "@/components/pages/audit-logs"
  import { UsersPage } from "@/components/pages/users"
  import { UserEditor } from "@/components/pages/user-editor"
  import { useStore } from "@/lib/store"
  import { DataSync } from "@/components/data-sync"
  import type { UserResponse } from "@/lib/api/types" // S'assurer de l'import correct du type

  const pageVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  }

  interface ProtectedAppShellProps {
    initialUser: UserResponse // Remplace 'any' par le bon type
  }

  export function ProtectedAppShell({ initialUser }: ProtectedAppShellProps) {
    const user = useStore(state => state.user)
    const setUser = useStore(state => state.setUser)
    const isDataLoaded = useStore(state => state.isDataLoaded)

    // Synchronisation prioritaire :
    React.useEffect(() => {
      if (initialUser && (!user || user.id !== initialUser.id || user.role !== initialUser.role)) {
        setUser(initialUser)
      }
    }, [initialUser, user, setUser])

    const [currentPage, setCurrentPage] = React.useState("dashboard")
    const [editingId, setEditingId] = React.useState<string | null>(null)
    const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)
    const [commandOpen, setCommandOpen] = React.useState(false)

    // Raccourci clavier Cmd/Ctrl+K pour la palette de commandes
    React.useEffect(() => {
      const down = (e: KeyboardEvent) => {
        if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          setCommandOpen((open) => !open)
        }
      }
      document.addEventListener("keydown", down)
      return () => document.removeEventListener("keydown", down)
    }, [])

    const effectiveUser = initialUser || user

    const handlePageChange = React.useCallback((page: string) => {
      React.startTransition(() => {
        setCurrentPage(page)
      })
    }, [])

    const renderPage = React.useCallback(() => {
      switch (currentPage) {
        case "dashboard": return <Dashboard onNavigate={handlePageChange} />
        case "users": return <UsersPage onCreateUser={() => { setEditingId(null); setCurrentPage("new-user"); }} onEditUser={(id: string) => { setEditingId(id); setCurrentPage("edit-user"); }} />
        case "new-user": return <UserEditor onBack={() => { setEditingId(null); setCurrentPage("users"); }} editingId={null} />
        case "edit-user": return <UserEditor onBack={() => { setEditingId(null); setCurrentPage("users"); }} editingId={editingId} />
        case "quotes": return <QuotesPage onCreateQuote={(id) => { setEditingId(id || null); setCurrentPage("new-quote"); }} />
        case "new-quote": return <QuoteEditor onBack={() => { setEditingId(null); setCurrentPage("quotes"); }} editingId={editingId} />
        case "invoices": return <InvoicesPage onCreateInvoice={() => { setEditingId(null); handlePageChange("new-invoice"); }} onEditInvoice={(id) => { setEditingId(id); handlePageChange("edit-invoice"); }} />
        case "new-invoice": return <InvoiceEditor onBack={() => { setEditingId(null); handlePageChange("invoices"); }} editingId={null} />
        case "edit-invoice": return <InvoiceEditor onBack={() => { setEditingId(null); handlePageChange("invoices"); }} editingId={editingId} />
        case "clients": return <ClientsPage />
        case "services": return <ServicesPage />
        case "payments": return <PaymentsPage />
        case "credit-notes": return <CreditNotesPage />
        case "audit": return <AuditLogsPage />
        case "settings": return <SettingsPage />
        default: return <Dashboard onNavigate={handlePageChange} />
      }
    }, [currentPage, handlePageChange, editingId])

    if (!effectiveUser) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 animate-pulse" />
            <div className="w-24 h-2 bg-secondary rounded animate-pulse" />
          </div>
        </div>
      )
    }

    return (
      <div className="h-screen bg-background overflow-hidden flex flex-col">
        <DataSync />
        {/* Sidebar */}
        <Sidebar
          currentPage={currentPage}
          onPageChange={handlePageChange}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        {/* Top Bar */}
        <TopBar collapsed={sidebarCollapsed} onCommandOpen={() => setCommandOpen(true)} />
        {/* Command Menu */}
        <CommandMenu
          open={commandOpen}
          onOpenChange={setCommandOpen}
          onNavigate={handlePageChange}
        />
        {/* Main Content */}
        <motion.main
          initial={false}
          animate={{ marginLeft: sidebarCollapsed ? 72 : 260 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="h-screen pt-16 flex flex-col overflow-hidden relative"
        >
          <AnimatePresence mode="wait">
            {!isDataLoaded ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-background z-50"
              >
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="mt-4 text-sm text-muted-foreground font-medium">Initialisation des modules locaux...</p>
              </motion.div>
            ) : (
              <motion.div
                key={currentPage}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="flex-1 flex flex-col overflow-hidden px-8 py-6 h-full"
              >
                {renderPage()}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.main>
      </div>
    )
  }
  ```

#### 5.2. Optimisation Zustand (`lib/store.ts`)
- **Problèmes identifiés :**
  - Manque de JSDoc.
  - La persistance inclut `settings` dans `partialize`, ce qui peut provoquer des désynchronisations au chargement (on doit laisser `DataSync` écraser l'état au démarrage avec les infos de la DB).
- **Code de remédiation complet pour `lib/store.ts` (extrait/modification ciblée) :**
  ```typescript
  // À la fin du fichier store.ts, dans la configuration du persist :
  export const useStore = create<AppState>()(
    persist(
      (set) => ({
        // ... (états initiaux et actions inchangés mais avec commentaires JSDoc)

        /**
         * @function setUser
         * @description Met à jour l'utilisateur connecté et ses permissions associées.
         */
        setUser: (user) => {
          const permissions = user
            ? user.role === "admin"
              ? ADMIN_PERMISSIONS
              : USER_PERMISSIONS
            : null;
          set({ user, permissions, isAuthenticated: !!user });
        },

        // ... (autres actions)
      }),
      {
        name: 'facturier-storage',
        storage: createJSONStorage(() => sessionStorage),
        // OPTIMISATION : Ne pas persister `settings` pour forcer le chargement frais via SQLite (DataSync)
        partialize: (state) => ({
          user: state.user,
          permissions: state.permissions,
          isAuthenticated: state.isAuthenticated,
          viewFormat: state.viewFormat,
        }),
      }
    )
  );
  ```

#### 5.3. Synergie Electron (IPC)
- **Problèmes identifiés :**
  - Pas de bloc `try/catch` avec retour utilisateur (`toast.error`) systématique dans certaines fonctions d'appel natif.
  - Dans `fullscreen-document-viewer.tsx`, l'export PDF possède bien un `try/catch`, mais on peut sécuriser l'IPC pour d'autres appels.
- **Code de remédiation :**
  Pour tout appel à des méthodes comme `window.electron.exportPDF`, s'assurer de capturer les erreurs. (Déjà correct dans `fullscreen-document-viewer.tsx` : `catch (err) { toast.error(...) }`).
  Pour s'assurer d'éviter les fuites mémoires, lorsqu'on utilise `ipcRenderer.on` dans le futur, il faudra l'encapsuler comme suit dans les `useEffect` React :
  ```tsx
  React.useEffect(() => {
    if (!window.electron) return;

    // Exemple de structure sécurisée
    const handleEvent = (event: any, data: any) => {
      console.log(data);
    };

    // Assumons que ipcRenderer expose une méthode pour écouter
    // window.electron.on('mon-evenement', handleEvent)


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
