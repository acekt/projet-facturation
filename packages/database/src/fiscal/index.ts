/**
 * @workspace/database/fiscal — Gabonese Fiscal Logic (DGI Standards 2026)
 *
 * Cascade: Net HT -> CSS (1%) -> Base Taxable (Net HT + CSS) -> TPS (9.5%) -> TVA (18%) -> TTC
 * Currency: XAF (no decimals — all amounts are rounded integers).
 */

export interface ITaxRates {
  readonly tvaRate: number;
  readonly tpsRate: number | null;
  readonly cssRate: number;
}

export const DEFAULT_GABON_TAX_RATES: ITaxRates = {
  tvaRate: 18,
  tpsRate: 9.5,
  cssRate: 1,
};

export interface IInvoiceItemInput {
  readonly quantity: number;
  readonly unitPrice: number;
}

export interface IComputedTotals {
  readonly subtotal: number;
  readonly discount: number;
  readonly netHT: number;
  readonly cssAmount: number;
  readonly taxBase: number;
  readonly tpsAmount: number;
  readonly tvaAmount: number;
  readonly total: number;
}

export interface IFiscalResult {
  subtotal: number;
  discount: number;
  netHt: number;
  cssAmount: number;
  taxBase: number;
  tpsAmount: number;
  tvaAmount: number;
  total: number;
}

export type TaxRates = ITaxRates;
export type InvoiceItemInput = IInvoiceItemInput;
export type ComputedTotals = IComputedTotals;
export type FiscalResult = IFiscalResult;

/**
 * Computes the rounded XAF total for a single line item.
 */
export function computeItemTotal(quantity: number, unitPrice: number): number {
  return Math.round((Number(quantity) || 0) * (Number(unitPrice) || 0));
}

/**
 * Pure mathematical calculation engine for invoice and quote totals.
 * Safe to import in both Client and Server environments.
 */
export function computeTotals(
  items: IInvoiceItemInput[],
  discountInput: number,
  rates: ITaxRates
): IComputedTotals {
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

  return {
    subtotal,
    discount,
    netHT: effectiveHT,
    cssAmount,
    taxBase,
    tpsAmount,
    tvaAmount,
    total,
  };
}

/**
 * Calculates the Gabonese tax cascade with absolute XAF precision (TPS included).
 */
export function calculateFiscalCascade(
  subtotal: number,
  discountAmount: number = 0,
  cssRate: number = 1,
  tvaRate: number = 18,
  tpsRate: number = 9.5
): IFiscalResult {
  const safeSubtotal = Math.round(subtotal);
  const safeDiscount = Math.round(Math.max(0, Number(discountAmount) || 0));

  const discount = safeDiscount;
  const netHt = Math.max(0, safeSubtotal - discount);
  const cssAmount = Math.round(netHt * (cssRate / 100));
  const taxBase = netHt + cssAmount;
  const tpsAmount = Math.round(taxBase * (tpsRate / 100));
  const tvaAmount = Math.round(taxBase * (tvaRate / 100));
  const total = taxBase + tpsAmount + tvaAmount;

  return {
    subtotal: safeSubtotal,
    discount,
    netHt,
    cssAmount,
    taxBase,
    tpsAmount,
    tvaAmount,
    total,
  };
}

/**
 * Format document numbering according to Gabonese standards
 * Supports:
 *   - formatDocNumber('FAC', 12, 'GM', 2026) -> 'FAC-012/GM/2026'
 *   - formatDocNumber(1, 'GM', 2026) -> '001/GM/2026'
 */
export function formatDocNumber(
  prefixOrSeq: string | number,
  seqOrCompanyCode: number | string,
  companyCodeOrYear?: string | number,
  year?: number
): string {
  if (typeof prefixOrSeq === 'string' && typeof seqOrCompanyCode === 'number') {
    const prefix = prefixOrSeq;
    const seq = String(seqOrCompanyCode).padStart(3, '0');
    const code = companyCodeOrYear || 'GEN';
    const yr = year || new Date().getFullYear();
    return `${prefix}-${seq}/${code}/${yr}`;
  } else {
    const seq = String(prefixOrSeq).padStart(3, '0');
    const code = seqOrCompanyCode;
    const yr = companyCodeOrYear;
    return `${seq}/${code}/${yr}`;
  }
}
