import type { Invoice, Quote, CreditNote, Client, Service } from "@/lib/store";

/**
 * Prédicat canonique : Facture en attente de paiement (à encaisser)
 * Règle : Non supprimée, statut hors DRAFT/CANCELLED/PAID, et reste à payer net d'avoirs > 0.
 */
export function isInvoicePendingPayment(invoice: Invoice, creditNotes: CreditNote[] = []): boolean {
  if (invoice.deletedAt) return false;
  const status = (invoice.status || "").toUpperCase();
  if (["DRAFT", "BROUILLON", "CANCELLED", "ANNULEE", "PAID", "PAYEE"].includes(status)) {
    return false;
  }

  const paid = (invoice.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  const credited = creditNotes
    .filter((c) => c.invoiceId === invoice.id && !c.deletedAt && (c.status || "").toLowerCase() !== "cancelled")
    .reduce((sum, c) => sum + (c.total || 0), 0);

  const netRemaining = Math.max(0, (invoice.total || 0) - paid - credited);
  return netRemaining > 0;
}

/**
 * Calcul du reste à payer net d'une facture
 */
export function getInvoiceNetRemaining(invoice: Invoice | null, creditNotes: CreditNote[] = []): number {
  if (!invoice || invoice.deletedAt) return 0;
  const status = (invoice.status || "").toUpperCase();
  if (["CANCELLED", "ANNULEE"].includes(status)) return 0;

  const paid = (invoice.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  const credited = creditNotes
    .filter((c) => c.invoiceId === invoice.id && !c.deletedAt && (c.status || "").toLowerCase() !== "cancelled")
    .reduce((sum, c) => sum + (c.total || 0), 0);

  return Math.max(0, (invoice.total || 0) - paid - credited);
}

/**
 * Nombre de factures à encaisser (utilisé par Sidebar, Onglet Invoices, Dashboard)
 */
export function getUnpaidInvoicesCount(invoices: Invoice[] = [], creditNotes: CreditNote[] = []): number {
  return invoices.filter((inv) => isInvoicePendingPayment(inv, creditNotes)).length;
}

/**
 * Total des factures actives (hors soft-delete)
 */
export function getActiveInvoicesCount(invoices: Invoice[] = []): number {
  return invoices.filter((i) => !i.deletedAt).length;
}

/**
 * Prédicat canonique : Devis en attente de validation / conversion
 * Règle : Non supprimé, statut hors DRAFT/CONVERTI/REFUSE/EXPIRE/CANCELLED, et validUntil >= today (ou non spécifié)
 */
export function isPendingQuote(quote: Quote, todayStr?: string): boolean {
  if (quote.deletedAt) return false;
  const status = (quote.status || "").toUpperCase();
  if (
    [
      "DRAFT",
      "BROUILLON",
      "CONVERTI",
      "REFUSE",
      "EXPIRE",
      "EXPIRED",
      "REJECTED",
      "INVOICED",
      "ARCHIVED",
      "CANCELLED",
    ].includes(status)
  ) {
    return false;
  }

  const today = todayStr || new Date().toISOString().split("T")[0];
  if (quote.validUntil && quote.validUntil < today) {
    return false;
  }

  return true;
}

/**
 * Nombre de devis en attente
 */
export function getPendingQuotesCount(quotes: Quote[] = [], todayStr?: string): number {
  return quotes.filter((q) => isPendingQuote(q, todayStr)).length;
}

/**
 * Total des devis actifs
 */
export function getActiveQuotesCount(quotes: Quote[] = []): number {
  return quotes.filter((q) => !q.deletedAt).length;
}

/**
 * Total des avoirs actifs
 */
export function getActiveCreditNotesCount(creditNotes: CreditNote[] = []): number {
  return creditNotes.filter((c) => !c.deletedAt).length;
}

/**
 * Total des clients actifs
 */
export function getActiveClientsCount(clients: Client[] = []): number {
  return clients.filter((c) => !c.deletedAt).length;
}

/**
 * Total des services actifs
 */
export function getActiveServicesCount(services: Service[] = []): number {
  return services.filter((s) => !(s as any).deletedAt).length;
}

/**
 * Total des références suivies en stock
 */
export function getActiveStockCatalogCount(catalog: any[] = [], services: Service[] = []): number {
  if (catalog && catalog.length > 0) return catalog.length;
  return services.filter((s) => Boolean(s.trackStock) && !(s as any).deletedAt).length;
}

