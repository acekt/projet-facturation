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
 * Computes all document totals from raw items and a discount ABSOLUTE AMOUNT in XAF.
 *
 * Formula (Gabon DGI fiscal rules 2026):
 *  lineTotal   = Math.round(qty × unitPrice)  [integer per line — XAF has no decimals]
 *  subtotal    = Σ(lineTotal)                 [exact sum of integer line totals]
 *  effectiveHT = max(0, subtotal − discount)  [HT après remise absolue en XAF]
 *  cssAmount   = effectiveHT × cssRate        [Contribution Sectorielle Spécifique]
 *  taxBase     = effectiveHT + cssAmount      [Base imposable TVA & TPS]
 *  tvaAmount   = taxBase × tvaRate            [TVA]
 *  tpsAmount   = taxBase × tpsRate            [Taxe sur les Produits et Services]
 *  total       = taxBase + tvaAmount + tpsAmount [TTC final]
 *
 * ROUNDING RULE: Each line total is rounded to the nearest integer BEFORE summation.
 * This guarantees perfect arithmetic consistency between the stored line items and the
 * invoice subtotal: the value written in `invoice_items.total` equals the value used here.
 * Never round the aggregate sum of already-rounded integers.
 *
 * DISCOUNT RULE: `discountInput` is an ABSOLUTE AMOUNT in XAF (not a percentage).
 * Example: discount = 5000 means "subtract 5,000 XAF from the HT brut".
 */
export function computeTotals(
  items: InvoiceItemInput[],
  discountInput: number,
  rates: TaxRates
): ComputedTotals {
  // CRITICAL XAF FIX: round each line individually, then sum integers.
  // DO NOT do Math.round(Σ qty*price) — that risks a ±1 XAF discrepancy
  // between what is stored per line in invoice_items and the header subtotal.
  const subtotal = items.reduce(
    (acc, item) => acc + Math.round(item.quantity * item.unitPrice),
    0
  );

  // Discount is a flat absolute amount in XAF (not a percentage).
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
