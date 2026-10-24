# DEEP_AUDIT_REPORT.md

## 1. QUALITÉ DU CODE STATIQUE ET TYPAGE (TYPESCRIPT)

**Fichier:** `lib/services/InvoiceService.ts`
**Ligne:** 16
**Problème:** Utilisation de `any` pour `data: any`.
**Pourquoi c'est médiocre:** La perte de typage annule la sécurité de TypeScript et expose à des erreurs de propriétés undefined à l'exécution, d'autant que cet objet passe par des calculs complexes et des transactions SQL vitales.
**Solution d'excellence:**
```typescript
import { InvoiceItemInput } from '@/lib/math-logic';

export interface CreateInvoiceData {
  clientId: string;
  clientName: string;
  clientEmail?: string;
  quoteId?: string;
  date: string;
  items: InvoiceItemInput[];
  discount: number;
  notes?: string;
  subject?: string;
}

export const InvoiceService = {
  createInvoice(data: CreateInvoiceData, userId: string, role: string) {
// ...
```

**Fichier:** `components/providers.tsx`
**Ligne:** 11
**Problème:** `error: any` et `(...args: any[]) => void`
**Pourquoi c'est médiocre:** Les props de `react-error-boundary` sont typées. `any` casse le typage strict du FallbackProps, autorisant un rendu non sécurisé des erreurs.
**Solution d'excellence:**
```typescript
import { FallbackProps } from "react-error-boundary";

function FallbackError({ error, resetErrorBoundary }: FallbackProps) {
// ...
```


## 2. LOGIQUE REACT ET ANTI-PATTERNS UI

**Fichier:** `components/pages/invoice-editor.tsx`
**Lignes:** 103-123
**Problème:** Remise à zéro de l'éditeur lors de l'accès au mode "Nouveau". Les dépendances de hooks contiennent des "ghost data" liées aux Settings (`settings.mentionsLegales`). L'initialisation se fait via des valeurs directes pouvant causer des conflits ou écrasements lorsque settings change asynchronement.
**Pourquoi c'est médiocre:** Un `useEffect` dépendant d'objets potentiellement mutables ou asynchrones déclenche des re-renders, écrasant ce que l'utilisateur commence à saisir.
**Solution d'excellence:**
Extraire de l'effet, ou s'assurer que `settings.mentionsLegales` n'est pas traqué si on le set en "one-off".
```typescript
  // Retirer les données tierces volatiles de l'array de dépendances et configurer statiquement l'état par défaut.
  React.useEffect(() => {
    if (isNew) {
      clearInvoiceDraft();
      setLocalDraft({
        selectedClient: null,
        items: [{ id: "1", description: "", quantity: 1, unitPrice: 0, total: 0 }],
        invoiceDate: new Date().toISOString().split("T")[0],
        discount: 0,
        notes: "", // Les mentions seront injectées au submit si vide, pas dans le hook
        subject: "",
      });
    }
    return () => {
       if (isNew) clearInvoiceDraft();
    }
  }, [isNew, clearInvoiceDraft, setLocalDraft]);
```

**Fichier:** `components/pages/settings.tsx`
**Lignes:** 86-90
**Problème:** Utilisation de propriétés non requises par Zod qui sont exclues manuellement via spread (`const { id, ...payload } = formData`) et des eslint-disable (`eslint-disable-next-line @typescript-eslint/no-unused-vars`).
**Pourquoi c'est médiocre:** Le frontend doit fournir et typifier exactement ce que l'API attend. Forcer une désactivation du linter souligne un couplage fort ou une mauvaise abstraction du State de Settings.
**Solution d'excellence:**
```typescript
    try {
      const payload = {
        companyName: formData.companyName,
        legalForm: formData.legalForm,
        nif: formData.nif,
        rccm: formData.rccm,
        // ... list explicitely the patched fields
      };
      const response = await fetch('/api/settings', {
// ...
```

## 3. ARCHITECTURE ELECTRON ET IPC

**Fichier:** `components/fullscreen-document-viewer.tsx`
**Ligne:** 151
**Problème:** `window.electron.exportPDF(htmlDoc, filename)` sans nettoyage ni délai, couplé à des fonctions IPC en clair sans wrapper local strict.
**Pourquoi c'est médiocre:** Bien que le preload soit partiellement sûr, un appel direct sans bloc `try/catch` robuste pour des événements annulés par l'utilisateur (ex: fermeture du dialog de sauvegarde système) causera des rejets Promise non-gérés (Unhandled Promise Rejection).
**Solution d'excellence:**
```typescript
      try {
        const result = await window.electron.exportPDF(htmlDoc, filename)
        if (result?.saved) {
           toast.success('Document exporté');
        }
      } catch (err) {
        if (err instanceof Error && !err.message.includes('cancel')) {
          toast.error("Erreur lors de l'export: " + err.message);
        }
      }
```

## 4. BASE DE DONNÉES ET PERFORMANCES (SQLITE)

**Fichier:** `lib/repositories/QuoteRepository.ts`
**Ligne:** 32-38
**Problème:** Mutation côté serveur en N+1 (Map Itératif post-SELECT). `quotes.map(quote => ...)` itère sur chaque devis pour réécrire dynamiquement la colonne `status = 'EXPIRED'` au moment de la lecture, en fonction de la date actuelle.
**Pourquoi c'est médiocre:** La vérification des dates d'expiration se fait logiciellement dans Node. Cela génère des incohérences si la base de données est lue par un autre module ou en direct. Le statut "EXPIRED" doit être géré en SQL.
**Solution d'excellence:**
Mettre à jour le statut expiré asynchronement (cron ou on-read trigger) mais surtout modifier la requête GET pour exposer la logique côté SQLite :
```typescript
    let sql = `
      SELECT q.*,
             CASE
                WHEN q.validUntil IS NOT NULL
                AND q.status != 'CONVERTI'
                AND q.validUntil < date('now')
                THEN 'EXPIRED'
                ELSE q.status
             END as status,
             (SELECT json_group_array(...) FROM quote_items WHERE quoteId = q.id) as items
      FROM quotes q
      WHERE q.deletedAt IS NULL
    `;
```
