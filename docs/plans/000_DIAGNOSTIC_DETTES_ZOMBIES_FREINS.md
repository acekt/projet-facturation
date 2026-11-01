# 000 - SYNTHÈSE DIAGNOSTIC & DETTE TECHNIQUE

Ce document est la synthèse consolidée des 5 rapports d'audit (LOT 1 à 5). Il liste les points critiques qui ralentissent, bloquent ou fragilisent l'application Facturier.

## 1. Processus Zombies & Fuites Mémoire
*   **Next.js Standalone (Windows)** : Le script `apps/desktop/main/server.js` (Ligne 143) tente de tuer le processus serveur Node.js via `taskkill /pid ${pid} /T /F`. Cependant, les erreurs éventuelles générées par `execSync` ne sont pas proprement rattrapées, pouvant laisser un processus zombie occupant le port 3000 si le `kill` de l'arbre échoue.
*   **Instances BrowserWindow Cachées** : Dans `apps/desktop/main/ipc.js` (Lignes 125, 131), la génération de PDF déclenche l'écriture de fichiers temporaires (`print_temp_*.html`) et la création de `BrowserWindow` fantômes. Un délai inattendu ou un blocage de dialogue système peut conduire à l'empilement silencieux de fenêtres non détruites et saturer la RAM.
*   **Saturation RAM UI (Zustand & Hydratation)** : `apps/desktop/components/data-sync.tsx` charge **intégralement** toutes les factures, devis, clients, etc. depuis SQLite au démarrage, peuplant Zustand avec des tableaux immenses.

## 2. Goulots d'étranglement (SQLite & O(N) Array Loops)
*   **Syndrome N+1 Queries (Export Excel)** : Dans `apps/desktop/lib/services/ExportService.ts`, une boucle `for (const invoice of rawInvoices)` lance un `SELECT` sur les items à l'intérieur, causant 10 001 requêtes si la base possède 10 000 factures (Risque majeur de `SQLITE_BUSY`).
*   **Rendu du CommandMenu O(N)** : `apps/desktop/components/layout/command-menu.tsx` filtre intégralement les tableaux Zustand en O(N) au lieu de demander à la base SQLite.
*   **Calcul des Badges Sidebar** : `apps/desktop/components/layout/navigation.tsx` itère sur tous les devis et factures pour compter les impayés, ralentissant le framerate (Jank) de React au survol.
*   **Boucle CloudSync Polling** : `apps/desktop/components/cloud-sync-runner.tsx` déclenche un appel massif toutes les 60 secondes en arrière-plan sans tenir compte de l'inactivité ou des WebSockets.

## 3. Risques sur l'Intégrité Transactionnelle
*   **Conversion de Devis en Facture** : Dans `apps/desktop/lib/services/QuoteService.ts` (Ligne 201), la création de la facture et la mise à jour du statut du devis ne sont **pas encapsulées dans un `db.transaction()`**. Un crash serveur entre les deux requêtes permettrait de convertir un même devis plusieurs fois.
*   **Mutations Zustand Destructives** : `invoice-editor.tsx` écrase `settings.mentionsLegales` sur un re-render sans utiliser de `useRef`, créant une perte de données (Ghost Data) pendant l'édition de brouillons.

## 4. UI : Boutons Morts et Fichiers en Doublon
*   **Modal de Paiement Défectueuse** : Dans `apps/desktop/components/pages/invoices.tsx`, un crochet `}` orphelin (Ligne 172) casse l'exécution du handler. Les variables `paymentDate` et `paymentReference` ne sont pas injectées dans `PaymentDialog.tsx`.
*   **Fichiers Features vs Pages** :
    *   `apps/desktop/components/features/invoices/InvoiceDeleteDialog.tsx` (avec option de supprimer le devis lié) est un doublon orphelin de `apps/desktop/components/pages/invoices/InvoiceDeleteDialog.tsx` (utilisé, mais basique).
    *   Même chose pour `QuoteDeleteDialog.tsx` et les fichiers `Filters.tsx` de ces répertoires.
*   **Bouton UpdateManager** : Dans `apps/desktop/components/features/settings/UpdateManager.tsx`, le `handleInstall` masque silencieusement les erreurs d'exécution d'Elevated Privileges sous Windows.
*   **Omission Setup Legal Form** : Dans `StepIdentity.tsx`, la valeur "Autre" pour la forme juridique est effacée au niveau du root State s'il y a un changement d'onglet avant validation.
*   **Pagination Mensongère (Audit Logs)** : `apps/desktop/components/pages/audit-logs.tsx` effectue une pagination front-end sur un payload dont l'action `audit.actions.ts` limite de toute façon les résultats à `100` en dur.

## 5. Dettes de la Chaîne d'Impression
*   L'application maintient 3 moteurs de rendu divergents :
    1.  `document-a4.tsx` (Composant natif Tailwind pour le `FullScreenDocumentViewer`).
    2.  `pdf-document.tsx` (via `@react-pdf/renderer` – Calcule différemment le Net HT).
    3.  `printable-document.tsx` (Version brute archaïque).
    Cela brise la promesse WYSIWYG (What You See Is What You Get) pour l'utilisateur.