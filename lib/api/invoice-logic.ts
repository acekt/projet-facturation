import db from '@/lib/db';
import type { DbInvoice, DbTotal } from '@/lib/types/api';

// ============================================================================
// TAX RATE TYPES
// ============================================================================

interface TaxRates {
  readonly tvaRate: number;
  readonly tpsRate: number | null;
  readonly cssRate: number;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface InvoiceItemInput {
  readonly quantity: number;
  readonly unitPrice: number;
}

// ============================================================================
// OUTPUT TYPES
// ============================================================================

export interface ComputedTotals {
  readonly subtotal: number;
  readonly discount: number;
  readonly cssAmount: number;
  readonly taxBase: number;
  readonly tpsAmount: number;
  readonly tvaAmount: number;
  readonly total: number;
}

// ============================================================================
// HELPERS
// ============================================================================

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
 * SERVER-SIDE single source of truth for all financial calculations.
 * Computes all document totals from raw items and a discount amount.
 *
 * Formula (Gabon fiscal rules):
 *  subtotal    = Σ(qty × unitPrice)           [HT brut]
 *  effectiveHT = max(0, subtotal − discount)  [HT après remise]
 *  cssAmount   = effectiveHT × cssRate        [Contribution Sectorielle Spécifique]
 *  taxBase     = effectiveHT + cssAmount      [Base imposable TVA & TPS]
 *  tvaAmount   = taxBase × tvaRate            [TVA]
 *  tpsAmount   = taxBase × tpsRate            [Taxe sur les Produits et Services]
 *  total       = taxBase + tvaAmount + tpsAmount [TTC final]
 *
 * All amounts are rounded to the nearest integer (XAF has no decimals).
 */
export function computeTotals(
  items: InvoiceItemInput[],
  discountInput: number,
  rates: TaxRates
): ComputedTotals {
  const subtotal = Math.round(
    items.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0)
  );
  const discount = Math.round(Math.max(0, discountInput));
  const effectiveHT = Math.max(0, subtotal - discount);
  const cssAmount = Math.round(effectiveHT * (rates.cssRate / 100));
  const taxBase = effectiveHT + cssAmount;
  const tpsAmount = Math.round(taxBase * ((rates.tpsRate ?? 0) / 100));
  const tvaAmount = Math.round(taxBase * (rates.tvaRate / 100));
  const total = taxBase + tpsAmount + tvaAmount;

  return { subtotal, discount, cssAmount, taxBase, tpsAmount, tvaAmount, total };
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
