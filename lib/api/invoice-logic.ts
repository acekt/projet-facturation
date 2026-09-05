import db from '@/lib/db';
import type { DbInvoice, DbTotal } from '@/lib/types/api';
import { TaxRates, InvoiceItemInput, ComputedTotals, computeTotals } from '@/lib/math-logic';

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

/**
 * Recalculates and updates invoice status based on the actual sum of payments.
 * This is the canonical function for all invoice status transitions.
 * Must be called inside a SQLite transaction for atomicity.
 *
 * Transitions:
 *   UNPAID          → totalPaid === 0
 *   PARTIALLY_PAID  → 0 < totalPaid < invoice.total
 *   PAID            → totalPaid >= invoice.total
 *
 * @throws {Error} If the invoice is not found or already soft-deleted.
 */
export function updateInvoiceStatus(
  invoiceId: string
): 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' {
  const invoice = db
    .prepare('SELECT total FROM invoices WHERE id = ? AND deletedAt IS NULL')
    .get(invoiceId) as DbInvoice | undefined;

  if (!invoice) {
    throw new Error(`Facture introuvable ou supprimée : ${invoiceId}`);
  }

  const paymentsResult = db
    .prepare(
      'SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE invoiceId = ? AND deletedAt IS NULL'
    )
    .get(invoiceId) as DbTotal;

  const totalTTC = Math.round(invoice.total);
  const totalPaid = Math.round(paymentsResult.total ?? 0);

  let newStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  if (totalPaid === 0) {
    newStatus = 'UNPAID';
  } else if (totalPaid < totalTTC) {
    newStatus = 'PARTIALLY_PAID';
  } else {
    newStatus = 'PAID';
  }

  db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(newStatus, invoiceId);
  return newStatus;
}
