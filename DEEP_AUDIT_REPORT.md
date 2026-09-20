# DEEP_AUDIT_REPORT

## 1. QUALITÉ DU CODE STATIQUE ET TYPAGE (TYPESCRIPT)

**Fichier**: `app/api/invoices/route.ts`
**Ligne**: 55
**Problème**: Utilisation du type `any` dans la capture d'erreur (`catch (error: any)`).
**Explication**: L'utilisation de `any` dans le bloc catch est un anti-pattern qui désactive la vérification des types de TypeScript. Cela peut masquer des erreurs à l'exécution si les propriétés de l'objet d'erreur ne sont pas celles attendues.
**Code Recommandé**:
```typescript
    } catch (error: unknown) {
      if (error instanceof InvoiceServiceError) {
        return NextResponse.json({ error: error.message } as ErrorResponse, { status: error.status });
      }
      throw error;
    }
```

**Fichier**: `hooks/use-quotes.ts`
**Lignes**: 33, 62
**Problème**: Utilisation de `any` dans le bloc `catch (error: any)`.
**Explication**: Masque la véritable structure de l'erreur. L'utilisation de `unknown` force le développeur à effectuer un contrôle de type (`instanceof Error`) avant d'accéder à `error.message`.
**Code Recommandé**:
```typescript
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message || "Erreur lors de l'opération");
      } else {
        toast.error("Erreur lors de l'opération");
      }
      return false;
    }
```

**Fichier**: `lib/services/InvoiceService.ts`
**Ligne**: 14
**Problème**: Paramètre `data: any` dans la fonction `createInvoice`.
**Explication**: L'absence de typage strict sur l'objet `data` entrant expose la base de données et la logique métier à des données inattendues et empêche l'auto-complétion, augmentant le risque de bugs silencieux.
**Code Recommandé**:
```typescript
import { z } from 'zod';
import { invoiceSchema } from '@/lib/validations';
type InvoiceData = z.infer<typeof invoiceSchema>;

export const InvoiceService = {
  createInvoice(data: InvoiceData, userId: string, role: string) {
    // ...
```

## 2. LOGIQUE REACT ET ANTI-PATTERNS UI

**Fichier**: `components/pages/invoice-editor.tsx`
**Ligne**: (Multiple, gestion de `useEffect` pour les brouillons)
**Problème**: Dépendances asynchrones causant des "Ghost Data" (réinitialisations intempestives).
**Explication**: Le nettoyage et l'initialisation des brouillons (`draft`) dépendent d'objets générés dynamiquement (comme `freshDraft` mémorisé ou `settings.mentionsLegales`). Cela peut provoquer un effacement des données saisies par l'utilisateur lors du montage tardif des paramètres.
**Code Recommandé**:
```typescript
  useEffect(() => {
    if (mode === 'new') {
      // Ne pas utiliser structuredClone(freshDraft) avec dépendances externes
      setLocalDraft({
        id: "draft",
        number: "BROUILLON",
        clientId: "",
        clientName: "",
        clientEmail: "",
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        items: [{ id: "item-1", description: "", quantity: 1, unitPrice: 0, total: 0 }],
        subtotal: 0,
        discount: 0,
        taxBase: 0,
        tpsAmount: 0,
        tvaAmount: 0,
        cssAmount: 0,
        total: 0,
        notes: "",
        status: "draft",
        payments: []
      });
    }
  }, [mode]); // Exclure strictement les dépendances asynchrones
```

## 3. ARCHITECTURE ELECTRON ET IPC

**Fichier**: `components/pages/invoice-editor.tsx` (ou tout composant appellant `window.electron`)
**Ligne**: Appels `window.electron.exportPDF` / `printDocument`
**Problème**: Appels IPC non protégés contre les annulations utilisateur.
**Explication**: Les appels natifs Desktop via IPC peuvent rejeter des promesses si l'utilisateur annule une boîte de dialogue système (ex: sauvegarde de fichier). Sans `try/catch` avec filtrage spécifique, l'interface affichera des erreurs faussement positives à l'utilisateur.
**Code Recommandé**:
```typescript
try {
  const result = await window.electron.exportPDF(htmlContent, "facture.pdf");
  if (result.saved) {
    toast.success("PDF enregistré avec succès");
  }
} catch (error: unknown) {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // Ne pas afficher d'erreur si l'utilisateur a juste annulé la boîte de dialogue
    if (!msg.includes('cancel') && !msg.includes('annul')) {
      toast.error(`Erreur d'export: ${error.message}`);
    }
  } else {
    toast.error("Erreur inconnue lors de l'export PDF");
  }
}
```

## 4. BASE DE DONNÉES ET PERFORMANCES (SQLITE)

**Fichier**: `lib/services/InvoiceService.ts`
**Lignes**: 61-70
**Problème**: Recompilation dynamique des requêtes `db.prepare()` à l'intérieur d'une boucle et d'une transaction.
**Explication**: Appeler `db.prepare()` pendant l'exécution d'une fonction, surtout dans une transaction SQLite, dégrade fortement les performances et maintient les verrous exclusifs plus longtemps, augmentant le risque d'erreurs `SQLITE_BUSY` (SQLite Performance Anti-Pattern). Les requêtes doivent être hissées au niveau du module.
**Code Recommandé**:
```typescript
// Au niveau du module (à l'extérieur de InvoiceService)
const insertInvoiceStmt = db.prepare(`
  INSERT INTO invoices (
    id, number, quoteId, clientId, clientName, clientEmail, date,
    subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total, status, notes, subject, created_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertItemStmt = db.prepare(`
  INSERT INTO invoice_items (id, invoiceId, description, quantity, unitPrice, total)
  VALUES (?, ?, ?, ?, ?, ?)
`);

// ... à l'intérieur de InvoiceService.createInvoice()
const insertInvoice = db.transaction(() => {
    // ...
    insertInvoiceStmt.run(
      id, number, data.quoteId ?? null, data.clientId, data.clientName, data.clientEmail,
      data.date, computed.subtotal, computed.discount, computed.taxBase, computed.tvaAmount,
      computed.tpsAmount, computed.cssAmount, computed.total, INVOICE_STATUS.UNPAID,
      data.notes ?? null, data.subject ?? quoteSubject, userId
    );

    for (const item of data.items) {
      insertItemStmt.run(
        crypto.randomUUID(), id, item.description, item.quantity,
        Math.round(item.unitPrice), Math.round(item.quantity * item.unitPrice)
      );
    }
    // ...
});
```
