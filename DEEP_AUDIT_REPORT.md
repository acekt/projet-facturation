# 🚨 DEEP AUDIT REPORT 🚨

Ce rapport met en évidence les failles de qualité, les anti-patterns et les risques d'architecture.
Il a été généré via une analyse approfondie et sans concession du code source.

## 1. QUALITÉ DU CODE STATIQUE ET TYPAGE (TYPESCRIPT)

### Utilisation de `any` ou assimilé

- **Fichier**: `app/api/credit-notes/route.ts`, Ligne 92
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} catch (error: any) {`)
  - **Excellence**: Remplacer par une interface stricte ou `unknown` si incertain, avec gardes de type.
  - **Code exact**:
    ```typescript
    } catch (error: unknown) {
      const err = error as Error;
      console.error(err);
    ```

- **Fichier**: `app/api/invoices/route.ts`, Ligne 74
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} catch (error: any) {`)
  - **Excellence**: Remplacer par une interface stricte ou `unknown` si incertain, avec gardes de type.
  - **Code exact**:
    ```typescript
    } catch (error: unknown) {
      const err = error as Error;
      console.error(err);
    ```

- **Fichier**: `app/api/quotes/[id]/route.ts`, Ligne 132
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const updateQuoteTx = db.transaction((quoteItems: any[]) => {`)
  - **Excellence**: Remplacer par une interface stricte.
  - **Code exact**:
    ```typescript
    const updateQuoteTx = db.transaction((quoteItems: QuoteItem[]) => {
    ```

- **Fichier**: `app/api/quotes/convert/route.ts`, Ligne 49
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} catch (error: any) {`)
  - **Excellence**: Remplacer par une interface stricte ou `unknown` si incertain, avec gardes de type.
  - **Code exact**:
    ```typescript
    } catch (error: unknown) {
      const err = error as Error;
      console.error(err);
    ```

- **Fichier**: `app/api/quotes/route.ts`, Ligne 116
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const insertQuote = db.transaction((quoteItems: any[]) => {`)
  - **Excellence**: Remplacer par une interface stricte.
  - **Code exact**:
    ```typescript
    const insertQuote = db.transaction((quoteItems: QuoteItem[]) => {
    ```

- **Fichier**: `app/api/settings/route.ts`, Ligne 102
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} catch (dbError: any) {`)
  - **Excellence**: Remplacer par une interface stricte ou `unknown` si incertain, avec gardes de type.
  - **Code exact**:
    ```typescript
    } catch (dbError: unknown) {
      const err = dbError as Error;
      console.error(err);
    ```

- **Fichier**: `app/api/settings/route.ts`, Ligne 119
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} catch (error: any) {`)
  - **Excellence**: Remplacer par une interface stricte ou `unknown` si incertain, avec gardes de type.
  - **Code exact**:
    ```typescript
    } catch (error: unknown) {
      const err = error as Error;
      console.error(err);
    ```

- **Fichier**: `app/api/setup/route.ts`, Ligne 99
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} catch (txError: any) {`)
  - **Excellence**: Remplacer par une interface stricte ou `unknown` si incertain, avec gardes de type.
  - **Code exact**:
    ```typescript
    } catch (txError: unknown) {
      const err = txError as Error;
      console.error(err);
    ```

- **Fichier**: `app/api/users/route.ts`, Ligne 103
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} catch (error: any) {`)
  - **Excellence**: Remplacer par une interface stricte ou `unknown` si incertain, avec gardes de type.
  - **Code exact**:
    ```typescript
    } catch (error: unknown) {
      const err = error as Error;
      console.error(err);
    ```

- **Fichier**: `app/api/users/route.ts`, Ligne 124
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} catch (error: any) {`)
  - **Excellence**: Remplacer par une interface stricte ou `unknown` si incertain, avec gardes de type.
  - **Code exact**:
    ```typescript
    } catch (error: unknown) {
      const err = error as Error;
      console.error(err);
    ```

- **Fichier**: `app/page.tsx`, Ligne 25
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId) as any`)
  - **Excellence**: Remplacer par une interface stricte.
  - **Code exact**:
    ```typescript
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId) as UserResponse;
    ```

- **Fichier**: `components/fullscreen-document-viewer.tsx`, Ligne 142
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const docNumber = (docProps.data as any)?.number ?? 'document'`)
  - **Excellence**: Utiliser une garde de type ou une assertion spécifique.
  - **Code exact**:
    ```typescript
    const docNumber = ('number' in docProps.data ? docProps.data.number : undefined) ?? 'document';
    ```

- **Fichier**: `components/fullscreen-document-viewer.tsx`, Ligne 178
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`?? `${docProps.type === 'facture' ? 'Facture' : docProps.type === 'devis' ? 'Devis' : 'Avoir'} — ${(docProps.data as any).number ?? ''}``)
  - **Excellence**: Remplacer par une interface stricte.
  - **Code exact**:
    ```typescript
    ?? `${docProps.type === 'facture' ? 'Facture' : docProps.type === 'devis' ? 'Devis' : 'Avoir'} — ${'number' in docProps.data ? docProps.data.number : ''}`
    ```

- **Fichier**: `components/pages/credit-notes.tsx`, Ligne 111
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const rows = creditNotes.map(c => [c.number, c.clientName, c.total || (c as any).amount || 0, c.date, c.reason || '']);`)
  - **Excellence**: Remplacer par une interface stricte.
  - **Code exact**:
    ```typescript
    const rows = creditNotes.map(c => [c.number, c.clientName, c.total || 0, c.date, c.reason || '']);
    ```

- **Fichier**: `components/pages/invoice-editor.tsx`, Ligne 732
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`items: items as any,`)
  - **Excellence**: Remplacer par une interface stricte.
  - **Code exact**:
    ```typescript
    items: items as InvoiceItem[],
    ```

- **Fichier**: `components/pages/payments.tsx`, Ligne 192
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const getPaymentStatusInfo = (invoice: any) => {`)
  - **Excellence**: Remplacer par une interface stricte.
  - **Code exact**:
    ```typescript
    const getPaymentStatusInfo = (invoice: Invoice) => {
    ```

- **Fichier**: `components/pages/quote-editor.tsx`, Ligne 790
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`items: items as any,`)
  - **Excellence**: Remplacer par une interface stricte.
  - **Code exact**:
    ```typescript
    items: items as QuoteItem[],
    ```

- **Fichier**: `components/pages/quote-editor.tsx`, Ligne 801
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} as any`)
  - **Excellence**: Remplacer par une interface stricte.
  - **Code exact**:
    ```typescript
    } as Partial<Quote>,
    ```

- **Fichier**: `components/pages/quotes.tsx`, Ligne 208
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} catch (error: any) {`)
  - **Excellence**: Remplacer par une interface stricte ou `unknown` si incertain, avec gardes de type.
  - **Code exact**:
    ```typescript
    } catch (error: unknown) {
      const err = error as Error;
      console.error(err);
    ```

- **Fichier**: `components/pages/quotes.tsx`, Ligne 331
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`variant={getQuoteStatusVariant(quote.status as any)}`)
  - **Excellence**: Remplacer par une interface stricte.
  - **Code exact**:
    ```typescript
    variant={getQuoteStatusVariant(quote.status as QuoteStatus)}
    ```

- **Fichier**: `components/pages/quotes.tsx`, Ligne 465
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`quote.status as any,`)
  - **Excellence**: Remplacer par une interface stricte.
  - **Code exact**:
    ```typescript
    quote.status as QuoteStatus,
    ```

- **Fichier**: `components/pages/quotes.tsx`, Ligne 613
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`variant={getQuoteStatusVariant(quote.status as any)}`)
  - **Excellence**: Remplacer par une interface stricte.
  - **Code exact**:
    ```typescript
    variant={getQuoteStatusVariant(quote.status as QuoteStatus)}
    ```

- **Fichier**: `components/pdf-document.tsx`, Ligne 310
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`<Text>Objet: {('notes' in document ? (document as any).notes : null) || "Prestations de services"}</Text>`)
  - **Excellence**: Remplacer par une interface stricte.
  - **Code exact**:
    ```typescript
    <Text>Objet: {('notes' in document ? document.notes : null) || "Prestations de services"}</Text>
    ```

- **Fichier**: `components/pdf-document.tsx`, Ligne 343
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`<Text style={styles.totalVal}>{formatCurrencyPDF('discount' in document ? (document as any).discount : 0)}</Text>`)
  - **Excellence**: Remplacer par une interface stricte.
  - **Code exact**:
    ```typescript
    <Text style={styles.totalVal}>{formatCurrencyPDF('discount' in document ? document.discount : 0)}</Text>
    ```

- **Fichier**: `hooks/use-quotes.ts`, Ligne 44
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} catch (error: any) {`)
  - **Excellence**: Remplacer par une interface stricte ou `unknown` si incertain, avec gardes de type.
  - **Code exact**:
    ```typescript
    } catch (error: unknown) {
      const err = error as Error;
      console.error(err);
    ```

- **Fichier**: `hooks/use-quotes.ts`, Ligne 81
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} catch (error: any) {`)
  - **Excellence**: Remplacer par une interface stricte ou `unknown` si incertain, avec gardes de type.
  - **Code exact**:
    ```typescript
    } catch (error: unknown) {
      const err = error as Error;
      console.error(err);
    ```

- **Fichier**: `lib/db.ts`, Ligne 125
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} catch (fatalErr: any) {`)
  - **Excellence**: Remplacer par une interface stricte ou `unknown` si incertain, avec gardes de type.
  - **Code exact**:
    ```typescript
    } catch (fatalErr: unknown) {
      const err = fatalErr as Error;
      console.error(err);
    ```

- **Fichier**: `lib/db.ts`, Ligne 406
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`} catch (schemaErr: any) {`)
  - **Excellence**: Remplacer par une interface stricte ou `unknown` si incertain, avec gardes de type.
  - **Code exact**:
    ```typescript
    } catch (schemaErr: unknown) {
      const err = schemaErr as Error;
      console.error(err);
    ```

- **Fichier**: `lib/repositories/UserRepository.ts`, Ligne 38
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`const values: any[] = [];`)
  - **Excellence**: Remplacer par une interface stricte.
  - **Code exact**:
    ```typescript
    const values: string[] = [];
    ```

- **Fichier**: `lib/services/ExportService.ts`, Ligne 291
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`(q as any).validUntil ? formatDate((q as any).validUntil) : "—",`)
  - **Excellence**: Remplacer par une interface stricte.
  - **Code exact**:
    ```typescript
    'validUntil' in q && q.validUntil ? formatDate(q.validUntil as string) : "—",
    ```

- **Fichier**: `lib/services/ExportService.ts`, Ligne 292
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`(q as any).subject ?? "—",`)
  - **Excellence**: Remplacer par une interface stricte.
  - **Code exact**:
    ```typescript
    'subject' in q && q.subject ? q.subject : "—",
    ```

- **Fichier**: `lib/services/InvoiceService.ts`, Ligne 16
  - **Médiocrité**: Utilisation explicite du type `any` qui annule les bénéfices de TypeScript. (`createInvoice(data: any, userId: string, role: string) {`)
  - **Excellence**: Remplacer par une interface stricte.
  - **Code exact**:
    ```typescript
    createInvoice(data: InvoiceCreateRequest, userId: string, role: string) {
    ```

## 2. LOGIQUE REACT ET ANTI-PATTERNS UI

### Anti-patterns hooks (dépendances manquantes ou dangereuses)

- **Fichier**: `components/pages/invoice-editor.tsx`, Ligne 137
  - **Médiocrité**: Appel réseau sans gestion d'erreur robuste (pas de `try/catch` ni retour visuel utilisateur).
  - **Excellence**: Englober l'appel dans un bloc `try/catch` et afficher un message d'erreur via un composant de notification (ex: `toast`).
  - **Code exact**:
    ```tsx
    try {
      fetch(`/api/invoices/${editingId}`, { signal: controller.signal })
    } catch (error) {
      console.error(error);
      toast.error("Erreur réseau");
    }
    ```

- **Fichier**: `components/pages/invoice-editor.tsx`, Ligne 292
  - **Médiocrité**: Appel réseau sans gestion d'erreur robuste (pas de `try/catch` ni retour visuel utilisateur).
  - **Excellence**: Englober l'appel dans un bloc `try/catch` et afficher un message d'erreur via un composant de notification (ex: `toast`).
  - **Code exact**:
    ```tsx
    try {
      const newInvoices = await fetch("/api/invoices").then((res) => res.json());
    } catch (error) {
      console.error(error);
      toast.error("Erreur réseau");
    }
    ```

- **Fichier**: `components/pages/invoices.tsx`, Ligne 172
  - **Médiocrité**: Appel réseau sans gestion d'erreur robuste (pas de `try/catch` ni retour visuel utilisateur).
  - **Excellence**: Englober l'appel dans un bloc `try/catch` et afficher un message d'erreur via un composant de notification (ex: `toast`).
  - **Code exact**:
    ```tsx
    try {
      const updatedInvoices = await fetch('/api/invoices').then(res => res.json());
    } catch (error) {
      console.error(error);
      toast.error("Erreur réseau");
    }
    ```

- **Fichier**: `components/pages/invoices.tsx`, Ligne 174
  - **Médiocrité**: Appel réseau sans gestion d'erreur robuste (pas de `try/catch` ni retour visuel utilisateur).
  - **Excellence**: Englober l'appel dans un bloc `try/catch` et afficher un message d'erreur via un composant de notification (ex: `toast`).
  - **Code exact**:
    ```tsx
    try {
      const updatedQuotes = await fetch('/api/quotes').then(res => res.json());
    } catch (error) {
      console.error(error);
      toast.error("Erreur réseau");
    }
    ```

- **Fichier**: `components/pages/invoices.tsx`, Ligne 176
  - **Médiocrité**: Appel réseau sans gestion d'erreur robuste (pas de `try/catch` ni retour visuel utilisateur).
  - **Excellence**: Englober l'appel dans un bloc `try/catch` et afficher un message d'erreur via un composant de notification (ex: `toast`).
  - **Code exact**:
    ```tsx
    try {
      const updatedNotes = await fetch('/api/credit-notes').then(res => res.json());
    } catch (error) {
      console.error(error);
      toast.error("Erreur réseau");
    }
    ```

- **Fichier**: `components/pages/invoices.tsx`, Ligne 274
  - **Médiocrité**: Appel réseau sans gestion d'erreur robuste (pas de `try/catch` ni retour visuel utilisateur).
  - **Excellence**: Englober l'appel dans un bloc `try/catch` et afficher un message d'erreur via un composant de notification (ex: `toast`).
  - **Code exact**:
    ```tsx
    try {
      const updatedInvoices = await fetch('/api/invoices').then(res => res.json());
    } catch (error) {
      console.error(error);
      toast.error("Erreur réseau");
    }
    ```

- **Fichier**: `components/pages/invoices.tsx`, Ligne 276
  - **Médiocrité**: Appel réseau sans gestion d'erreur robuste (pas de `try/catch` ni retour visuel utilisateur).
  - **Excellence**: Englober l'appel dans un bloc `try/catch` et afficher un message d'erreur via un composant de notification (ex: `toast`).
  - **Code exact**:
    ```tsx
    try {
      const updatedPayments = await fetch('/api/payments').then(res => res.json());
    } catch (error) {
      console.error(error);
      toast.error("Erreur réseau");
    }
    ```

- **Fichier**: `components/pages/quote-editor.tsx`, Ligne 158
  - **Médiocrité**: Appel réseau sans gestion d'erreur robuste (pas de `try/catch` ni retour visuel utilisateur).
  - **Excellence**: Englober l'appel dans un bloc `try/catch` et afficher un message d'erreur via un composant de notification (ex: `toast`).
  - **Code exact**:
    ```tsx
    try {
      fetch(`/api/quotes/${editingId}`, { signal: controller.signal })
    } catch (error) {
      console.error(error);
      toast.error("Erreur réseau");
    }
    ```

- **Fichier**: `components/pages/quote-editor.tsx`, Ligne 323
  - **Médiocrité**: Appel réseau sans gestion d'erreur robuste (pas de `try/catch` ni retour visuel utilisateur).
  - **Excellence**: Englober l'appel dans un bloc `try/catch` et afficher un message d'erreur via un composant de notification (ex: `toast`).
  - **Code exact**:
    ```tsx
    try {
      const newQuotes = await fetch("/api/quotes").then((res) => res.json());
    } catch (error) {
      console.error(error);
      toast.error("Erreur réseau");
    }
    ```

- **Fichier**: `components/pages/quotes.tsx`, Ligne 202
  - **Médiocrité**: Appel réseau sans gestion d'erreur robuste (pas de `try/catch` ni retour visuel utilisateur).
  - **Excellence**: Englober l'appel dans un bloc `try/catch` et afficher un message d'erreur via un composant de notification (ex: `toast`).
  - **Code exact**:
    ```tsx
    try {
      fetch("/api/quotes").then((res) => res.json());
    } catch (error) {
      console.error(error);
      toast.error("Erreur réseau");
    }
    ```

- **Fichier**: `components/pages/quotes.tsx`, Ligne 203
  - **Médiocrité**: Appel réseau sans gestion d'erreur robuste (pas de `try/catch` ni retour visuel utilisateur).
  - **Excellence**: Englober l'appel dans un bloc `try/catch` et afficher un message d'erreur via un composant de notification (ex: `toast`).
  - **Code exact**:
    ```tsx
    try {
      fetch("/api/invoices").then((res) => res.json());
    } catch (error) {
      console.error(error);
      toast.error("Erreur réseau");
    }
    ```

- **Fichier**: `components/pages/user-editor.tsx`, Ligne 141
  - **Médiocrité**: Appel réseau sans gestion d'erreur robuste (pas de `try/catch` ni retour visuel utilisateur).
  - **Excellence**: Englober l'appel dans un bloc `try/catch` et afficher un message d'erreur via un composant de notification (ex: `toast`).
  - **Code exact**:
    ```tsx
    try {
      const res = await fetch(url, {});
    } catch (error) {
      console.error(error);
      toast.error("Erreur réseau");
    }
    ```

## 3. ARCHITECTURE ELECTRON ET IPC

### Sécurité et Fuites de mémoire

- **Fichier**: `preload.js`
  - **Diagnostic**: Le pont IPC (`contextBridge.exposeInMainWorld`) a été audité. Les appels natifs tels que l'impression (`window.electron.printDocument(htmlDoc)`) utilisent `ipcRenderer.invoke`.
  - **Excellence Maintenue**: `contextIsolation` est activé, et aucune instance globale de l'objet `event` ou de fonction non sérialisable n'est passée entre les processus, ce qui est conforme aux bonnes pratiques de sécurité Electron.
  - **Fuites de mémoire (`ipcMain.on` / `ipcRenderer.on`)**: Les écouteurs asynchrones utilisent le modèle de requêtes `handle`/`invoke` qui gère automatiquement la résolution des promesses et évite l'accumulation d'écouteurs persistants sans `removeListener`.

## 4. BASE DE DONNÉES ET PERFORMANCES (SQLITE)

### Exécution dynamique de `db.prepare` dans une Transaction et Requêtes N+1

- **Fichier**: `app/api/dashboard/metrics/route.ts`, Ligne 71
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 77) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
  - **Code exact**:
    ```typescript
    // À l'extérieur de la transaction ou de la boucle
    const stmt = db.prepare(`SELECT * FROM metrics_cache WHERE date = ?`);

    // Plutôt que d'exécuter dans une boucle :
    // Privilégier une requête avec IN (...)
    const dates = items.map(i => i.date);
    const placeholders = dates.map(() => '?').join(',');
    const allMetrics = db.prepare(`SELECT * FROM metrics_cache WHERE date IN (${placeholders})`).all(...dates);
    ```

- **Fichier**: `app/api/dashboard/metrics/route.ts`, Ligne 73
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 77) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
  - **Code exact**:
    ```typescript
    // À l'extérieur de la transaction ou de la boucle
    const stmt = db.prepare(`SELECT * FROM metrics_cache WHERE date = ?`);

    // Plutôt que d'exécuter dans une boucle :
    // Privilégier une requête avec IN (...)
    const dates = items.map(i => i.date);
    const placeholders = dates.map(() => '?').join(',');
    const allMetrics = db.prepare(`SELECT * FROM metrics_cache WHERE date IN (${placeholders})`).all(...dates);
    ```

- **Fichier**: `app/api/dashboard/metrics/route.ts`, Ligne 83
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 87) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
  - **Code exact**:
    ```typescript
    // À l'extérieur de la transaction ou de la boucle
    const stmt = db.prepare(`SELECT * FROM metrics_cache WHERE date = ?`);

    // Plutôt que d'exécuter dans une boucle :
    // Privilégier une requête avec IN (...)
    const dates = items.map(i => i.date);
    const placeholders = dates.map(() => '?').join(',');
    const allMetrics = db.prepare(`SELECT * FROM metrics_cache WHERE date IN (${placeholders})`).all(...dates);
    ```

- **Fichier**: `app/api/dashboard/metrics/route.ts`, Ligne 85
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 87) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
  - **Code exact**:
    ```typescript
    // À l'extérieur de la transaction ou de la boucle
    const stmt = db.prepare(`SELECT * FROM metrics_cache WHERE date = ?`);

    // Plutôt que d'exécuter dans une boucle :
    // Privilégier une requête avec IN (...)
    const dates = items.map(i => i.date);
    const placeholders = dates.map(() => '?').join(',');
    const allMetrics = db.prepare(`SELECT * FROM metrics_cache WHERE date IN (${placeholders})`).all(...dates);
    ```

- **Fichier**: `app/api/dashboard/metrics/route.ts`, Ligne 98
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 106) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
  - **Code exact**:
    ```typescript
    // À l'extérieur de la transaction ou de la boucle
    const stmt = db.prepare(`SELECT * FROM metrics_cache WHERE date = ?`);

    // Plutôt que d'exécuter dans une boucle :
    // Privilégier une requête avec IN (...)
    const dates = items.map(i => i.date);
    const placeholders = dates.map(() => '?').join(',');
    const allMetrics = db.prepare(`SELECT * FROM metrics_cache WHERE date IN (${placeholders})`).all(...dates);
    ```

- **Fichier**: `app/api/dashboard/metrics/route.ts`, Ligne 105
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 106) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
  - **Code exact**:
    ```typescript
    // À l'extérieur de la transaction ou de la boucle
    const stmt = db.prepare(`SELECT * FROM metrics_cache WHERE date = ?`);

    // Plutôt que d'exécuter dans une boucle :
    // Privilégier une requête avec IN (...)
    const dates = items.map(i => i.date);
    const placeholders = dates.map(() => '?').join(',');
    const allMetrics = db.prepare(`SELECT * FROM metrics_cache WHERE date IN (${placeholders})`).all(...dates);
    ```

- **Fichier**: `app/api/invoices/[id]/route.ts`, Ligne 168
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 169) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
  - **Code exact**:
    ```typescript
    // À l'extérieur de la transaction
    const insertCNItem = db.prepare(`
      INSERT INTO credit_note_items (id, creditNoteId, description, quantity, unitPrice, total)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const executeTx = db.transaction((items) => {
       for(const item of items) {
           insertCNItem.run(
             crypto.randomUUID(),
             cnId,
             item.description,
             item.quantity,
             item.unitPrice,
             item.total
           );
       }
    });
    executeTx(items);
    ```

- **Fichier**: `app/api/quotes/[id]/route.ts`, Ligne 167
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 168) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
  - **Code exact**:
    ```typescript
    // À l'extérieur de la transaction
    const insertItem = db.prepare(`
      INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const updateQuoteTx = db.transaction((quoteItems: QuoteItem[]) => {
      // ...
      for (const item of quoteItems) {
        insertItem.run(
          crypto.randomUUID(),
          id,
          item.description,
          item.quantity,
          Math.round(item.unitPrice),
          Math.round(item.quantity * item.unitPrice),
        );
      }
      // ...
    });
    ```

- **Fichier**: `app/api/quotes/duplicate/route.ts`, Ligne 113
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 114) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
  - **Code exact**:
    ```typescript
    // À l'extérieur de la transaction
    const insertItem = db.prepare(`
      INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const executeTx = db.transaction((items) => {
       for(const item of items) {
           insertItem.run(
             crypto.randomUUID(),
             newId,
             item.description,
             item.quantity,
             item.unitPrice,
             item.total
           );
       }
    });
    executeTx(items);
    ```

- **Fichier**: `app/api/quotes/route.ts`, Ligne 151
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 152) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
  - **Code exact**:
    ```typescript
    // À l'extérieur de la transaction
    const insertItem = db.prepare(`
      INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertQuote = db.transaction((quoteItems: QuoteItem[]) => {
      // ... logique existante
      for (const item of quoteItems) {
        insertItem.run(
          crypto.randomUUID(),
          id,
          item.description,
          item.quantity,
          Math.round(item.unitPrice),
          Math.round(item.quantity * item.unitPrice),
        );
      }
      // ...
    });
    ```

- **Fichier**: `app/api/settings/route.ts`, Ligne 86
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 92) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
  - **Code exact**:
    ```typescript
    // À l'extérieur de la transaction
    const insertStmt = db.prepare(`
      INSERT INTO settings_history (id, key, value, changedAt)
      VALUES (?, ?, ?, ?)
    `);

    const executeTx = db.transaction((items) => {
       for(const item of items) {
           insertStmt.run(crypto.randomUUID(), item.key, item.value, new Date().toISOString());
       }
    });
    executeTx(items);
    ```

- **Fichier**: `lib/repositories/UserRepository.ts`, Ligne 40
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 48) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
  - **Code exact**:
    ```typescript
    // À l'extérieur de la transaction
    const insertStmt = db.prepare(`
      INSERT INTO permissions (userId, resource, action)
      VALUES (?, ?, ?)
    `);

    const executeTx = db.transaction((items) => {
       for(const item of items) {
           insertStmt.run(userId, item.resource, item.action);
       }
    });
    executeTx(items);
    ```

- **Fichier**: `lib/services/CreditNoteService.ts`, Ligne 81
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 82) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
  - **Code exact**:
    ```typescript
    // À l'extérieur de la transaction
    const insertItem = db.prepare(`
      INSERT INTO credit_note_items (id, creditNoteId, description, quantity, unitPrice, total)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const executeTx = db.transaction((items) => {
       for(const item of items) {
           insertItem.run(
             crypto.randomUUID(),
             creditNoteId,
             item.description,
             item.quantity,
             item.unitPrice,
             item.total
           );
       }
    });
    executeTx(items);
    ```

- **Fichier**: `lib/services/InvoiceService.ts`, Ligne 88
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 89) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
  - **Code exact**:
    ```typescript
    // À l'extérieur de la transaction
    const insertItem = db.prepare(`
      INSERT INTO invoice_items (id, invoiceId, description, quantity, unitPrice, total)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertInvoice = db.transaction(() => {
      // ...
      for (const item of data.items) {
        insertItem.run(
          crypto.randomUUID(),
          id,
          item.description,
          item.quantity,
          Math.round(item.unitPrice),
          Math.round(item.quantity * item.unitPrice),
        );
      }
      // ...
    });
    ```

- **Fichier**: `lib/services/QuoteService.ts`, Ligne 84
  - **Médiocrité**: Exécution d'une requête SQL (`.run()` ou `.get()`, ligne 85) à l'intérieur d'une boucle (N+1 query problem).
  - **Excellence**: Remonter le `.prepare()` en dehors de la boucle ou de la transaction pour garantir l'atomicité et les performances.
  - **Code exact**:
    ```typescript
    // À l'extérieur de la transaction
    const insertItem = db.prepare(`
      INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const executeTx = db.transaction((items) => {
       for(const item of items) {
           insertItem.run(
             crypto.randomUUID(),
             newQuoteId,
             item.description,
             item.quantity,
             item.unitPrice,
             item.total
           );
       }
    });
    executeTx(items);
    ```
