// ============================================================================
// TAX RATE TYPES
// ============================================================================

export interface TaxRates {
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
// PURE CALCULATION FUNCTION
// ============================================================================

/**
 * Pure function for all financial calculations.
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
 */
export function computeTotals(
  items: InvoiceItemInput[],
  discountInput: number,
  rates: TaxRates
): ComputedTotals {
  const subtotal = items.reduce(
    (acc, item) => acc + Math.round(item.quantity * item.unitPrice),
    0
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
