import db from '@/lib/db';
import type { DbInvoice, DbTotal } from '@/lib/types/api';
import { TaxRates, InvoiceItemInput, ComputedTotals, computeTotals } from '@/lib/math-logic';
import { buildTenantFilter } from '@/lib/api/tenant';

export { computeTotals };
export type { InvoiceItemInput, TaxRates, ComputedTotals };

/**
 * Fetches tax rates from the settings table.
 * This is the single source of truth for tax rates.
 * @throws {Error} If settings are not found in the database.
 */
export function getTaxRates(): TaxRates {
  const rates = db
    .prepare('SELECT tvaRate, tpsRate, cssRate FROM settings WHERE id = 1')
    .get() as TaxRates | undefined;

  if (!rates) {
    throw new Error('Paramètres de taux de taxes introuvables en base de données.');
  }
  return rates;
}

const getInvoiceTotalStmt = db.prepare("SELECT total FROM invoices WHERE id = ? AND (deletedAt IS NULL OR deletedAt = '')");
const getPaymentsTotalStmt = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE invoiceId = ? AND (deletedAt IS NULL OR deletedAt = '')");
const getCreditNotesTotalStmt = db.prepare("SELECT COALESCE(SUM(total), 0) as total FROM credit_notes WHERE invoiceId = ? AND (deletedAt IS NULL OR deletedAt = '')");
const updateInvoiceStatusStmt = db.prepare('UPDATE invoices SET status = ? WHERE id = ?');

/**
 * Recalculates and updates invoice status based on the actual sum of payments and credit notes.
 * Formula: reste = totalTTC - totalAvoirs - totalPaid.
 *
 * Transitions:
 *   CANCELLED       → totalAvoirs >= invoice.total (or covered with no payments)
 *   PAID            → (totalPaid + totalAvoirs) >= invoice.total AND totalPaid > 0
 *   PARTIALLY_PAID  → 0 < (totalPaid + totalAvoirs) < invoice.total
 *   UNPAID          → totalPaid === 0 AND totalAvoirs === 0
 *
 * @throws {Error} If the invoice is not found or already soft-deleted.
 */
export function updateInvoiceStatus(
  invoiceId: string,
  tenantId?: string | null
): 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED' {
  let invoice: DbInvoice | undefined;
  let totalPaid = 0;
  let totalAvoirs = 0;

  if (tenantId) {
    const tf = buildTenantFilter(tenantId);
    invoice = db.prepare(`SELECT total FROM invoices WHERE id = ? AND (deletedAt IS NULL OR deletedAt = '')${tf.sql}`).get(invoiceId, ...tf.params) as DbInvoice | undefined;
    if (!invoice) {
      throw new Error(`Facture introuvable ou supprimée : ${invoiceId}`);
    }
    const paymentsResult = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE invoiceId = ? AND (deletedAt IS NULL OR deletedAt = '')${tf.sql}`).get(invoiceId, ...tf.params) as DbTotal;
    totalPaid = Math.round(paymentsResult.total ?? 0);

    const creditNotesResult = db.prepare(`SELECT COALESCE(SUM(total), 0) as total FROM credit_notes WHERE invoiceId = ? AND (deletedAt IS NULL OR deletedAt = '')${tf.sql}`).get(invoiceId, ...tf.params) as DbTotal;
    totalAvoirs = Math.round(creditNotesResult.total ?? 0);
  } else {
    invoice = getInvoiceTotalStmt.get(invoiceId) as DbInvoice | undefined;
    if (!invoice) {
      throw new Error(`Facture introuvable ou supprimée : ${invoiceId}`);
    }
    const paymentsResult = getPaymentsTotalStmt.get(invoiceId) as DbTotal;
    totalPaid = Math.round(paymentsResult.total ?? 0);

    const creditNotesResult = getCreditNotesTotalStmt.get(invoiceId) as DbTotal;
    totalAvoirs = Math.round(creditNotesResult.total ?? 0);
  }

  const totalTTC = Math.round(invoice.total);
  const covered = totalPaid + totalAvoirs;

  let newStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';
  if (totalAvoirs >= totalTTC) {
    newStatus = 'CANCELLED';
  } else if (covered >= totalTTC) {
    newStatus = totalPaid > 0 ? 'PAID' : 'CANCELLED';
  } else if (covered > 0) {
    newStatus = 'PARTIALLY_PAID';
  } else {
    newStatus = 'UNPAID';
  }

  if (tenantId) {
    const tf = buildTenantFilter(tenantId);
    db.prepare(`UPDATE invoices SET status = ? WHERE id = ?${tf.sql}`).run(newStatus, invoiceId, ...tf.params);
  } else {
    updateInvoiceStatusStmt.run(newStatus, invoiceId);
  }

  return newStatus;
}
