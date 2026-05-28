/**
 * Gabonese Fiscal Logic (DGI Standards 2026)
 * Norm: Net HT -> CSS (1%) -> Base TVA (Net HT + CSS) -> TVA (18%) -> TTC
 * Rounding: Zero decimal places (XAF)
 */

export interface FiscalResult {
    subtotal: number;
    discount: number;
    netHt: number;
    cssAmount: number;
    taxBase: number;
    tvaAmount: number;
    total: number;
}

/**
 * Calculates the Gabonese tax cascade with absolute precision
 * @param subtotal Sum of (quantity * unitPrice)
 * @param discountPercent Global discount percentage
 * @param cssRate CSS tax rate (default 1%)
 * @param tvaRate TVA tax rate (default 18%)
 */
export function calculateFiscalCascade(
    subtotal: number,
    discountPercent: number = 0,
    cssRate: number = 1,
    tvaRate: number = 18
): FiscalResult {
    // 1. All inputs are coerced to numbers and rounded as per financial safety
    const safeSubtotal = Math.round(subtotal);
    const safeDiscountPercent = Number(discountPercent) || 0;

    // 2. Net HT = Brut - Remise
    const discount = Math.round(safeSubtotal * (safeDiscountPercent / 100));
    const netHt = safeSubtotal - discount;

    // 3. CSS = 1% of Net HT
    const cssAmount = Math.round(netHt * (cssRate / 100));

    // 4. Base TVA = Net HT + CSS
    const taxBase = netHt + cssAmount;

    // 5. TVA = 18% of Base TVA
    const tvaAmount = Math.round(taxBase * (tvaRate / 100));

    // 6. Net à Payer (TTC)
    const total = netHt + cssAmount + tvaAmount;

    return {
        subtotal: safeSubtotal,
        discount,
        netHt,
        cssAmount,
        taxBase,
        tvaAmount,
        total
    };
}

/**
 * Format document numbering according to Gabonese standards
 * Format: SEQUENCE/CODE/YEAR
 */
export function formatDocNumber(sequence: number, companyCode: string, year: number): string {
    return `${String(sequence).padStart(3, '0')}/${companyCode}/${year}`;
}
