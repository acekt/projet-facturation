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

import type { TaxRegime } from '../types/index';
export type { TaxRegime };

export interface IInvoiceItemInput {
  readonly quantity: number;
  readonly unitPrice: number;
  readonly taxRegime?: TaxRegime;
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

export interface IRegimeTotals extends IComputedTotals {
  readonly goodsHT: number;
  readonly servicesHT: number;
  readonly exemptHT: number;
}

export interface IFiscalResult {
  subtotal: number;
  discount: number;
  /**
   * @deprecated Préférer netHT pour l'uniformité du modèle fiscal.
   */
  netHt: number;
  netHT: number;
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
 *
 * Gabonese Fiscal Logic (DGI Standards 2026):
 * Cascade: Net HT -> CSS (1%) -> Base Taxable (Net HT + CSS) -> TPS (9.5%) -> TVA (18%) -> TTC
 * Currency: XAF (no decimals — all amounts are rounded integers >= 0).
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

  const discount = Math.round(Math.max(0, Number(discountInput) || 0));
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
 * Advanced multi-regime fiscal calculation (Tax Model v2).
 * Note: Subject to final written sign-off by accountant per Plan Curatif (Lot L1).
 * Separates bases:
 * - GOODS: subject to CSS and TVA (exempt from TPS)
 * - SERVICES: subject to CSS, TPS and/or TVA
 * - EXEMPT: exempt from TVA and TPS
 */
export function computeTotalsByRegime(
  items: IInvoiceItemInput[],
  discountInput: number,
  rates: ITaxRates
): IRegimeTotals {
  let goodsHT = 0;
  let servicesHT = 0;
  let exemptHT = 0;

  for (const item of items) {
    const lineTotal = Math.round((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0));
    const regime = item.taxRegime || 'SERVICES';
    if (regime === 'GOODS') {
      goodsHT += lineTotal;
    } else if (regime === 'EXEMPT') {
      exemptHT += lineTotal;
    } else {
      servicesHT += lineTotal;
    }
  }

  const subtotal = goodsHT + servicesHT + exemptHT;
  const discount = Math.round(Math.max(0, Number(discountInput) || 0));
  const effectiveHT = Math.max(0, subtotal - discount);

  const discountRatio = subtotal > 0 ? (subtotal - discount) / subtotal : 1;
  const netGoodsHT = Math.round(goodsHT * discountRatio);
  const netServicesHT = Math.round(servicesHT * discountRatio);
  const netExemptHT = Math.max(0, effectiveHT - netGoodsHT - netServicesHT);

  const cssAmount = Math.round(effectiveHT * (rates.cssRate / 100));
  const taxableGoodsBase = netGoodsHT + Math.round(netGoodsHT * (rates.cssRate / 100));
  const taxableServicesBase = netServicesHT + Math.round(netServicesHT * (rates.cssRate / 100));

  const tpsAmount = Math.round(taxableServicesBase * ((rates.tpsRate ?? 0) / 100));
  const tvaAmount = Math.round((taxableGoodsBase + taxableServicesBase) * (rates.tvaRate / 100));
  const taxBase = effectiveHT + cssAmount;
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
    goodsHT: netGoodsHT,
    servicesHT: netServicesHT,
    exemptHT: netExemptHT,
  };
}

/**
 * @deprecated Utilisez `computeTotals` directement.
 * Wrapper de transition appelant l'unique moteur `computeTotals` (P2).
 */
export function calculateFiscalCascade(
  subtotal: number,
  discountAmount: number = 0,
  cssRate: number = 1,
  tvaRate: number = 18,
  tpsRate: number = 9.5
): IFiscalResult {
  const safeSubtotal = Math.round(Number(subtotal) || 0);
  const totals = computeTotals(
    [{ quantity: 1, unitPrice: safeSubtotal }],
    discountAmount,
    { cssRate, tvaRate, tpsRate }
  );

  return {
    subtotal: totals.subtotal,
    discount: totals.discount,
    netHt: totals.netHT,
    netHT: totals.netHT,
    cssAmount: totals.cssAmount,
    taxBase: totals.taxBase,
    tpsAmount: totals.tpsAmount,
    tvaAmount: totals.tvaAmount,
    total: totals.total,
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
