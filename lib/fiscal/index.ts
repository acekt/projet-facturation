/**
 * Gabonese Fiscal Logic (DGI Standards 2026)
 *
 * Cascade: Net HT → CSS (1%) → Base TVA (Net HT + CSS) → TPS (9.5%) → TVA (18%) → TTC
 * Currency: XAF (no decimals — all amounts are integers).
 *
 * DISCOUNT RULE (harmonized with computeTotals):
 *   The `discountAmount` parameter is an ABSOLUTE AMOUNT in XAF subtracted from the
 *   brut subtotal. It is NOT a percentage. This matches the server-side computeTotals
 *   signature and the front-end editors (invoice-editor.tsx, quote-editor.tsx) which
 *   store a flat XAF amount in `draft.discount`.
 *
 *   Example: subtotal = 100,000 XAF, discountAmount = 5,000 XAF
 *            → netHt = 95,000 XAF
 */

export interface FiscalResult {
    subtotal: number;
    discount: number;
    netHt: number;
    cssAmount: number;
    taxBase: number;
    tpsAmount: number;
    tvaAmount: number;
    total: number;
}

/**
 * Calculates the Gabonese tax cascade with absolute XAF precision (TPS included).
 * Norm: Net HT → CSS (1%) → Base Taxable → TPS (9.5%) → TVA (18%) → TTC
 *
 * @param subtotal        Sum of rounded line totals Σ(Math.round(qty × unitPrice)) in XAF
 * @param discountAmount  ABSOLUTE discount amount in XAF (NOT a percentage). Default: 0.
 * @param cssRate         CSS tax rate as a percentage integer. Default: 1 (= 1%).
 * @param tvaRate         TVA tax rate as a percentage integer. Default: 18 (= 18%).
 * @param tpsRate         TPS tax rate as a percentage value. Default: 9.5 (= 9.5%).
 */
export function calculateFiscalCascade(
    subtotal: number,
    discountAmount: number = 0,
    cssRate: number = 1,
    tvaRate: number = 18,
    tpsRate: number = 9.5
): FiscalResult {
    // 1. All inputs coerced to safe integers (XAF has no decimals)
    const safeSubtotal = Math.round(subtotal);
    const safeDiscount = Math.round(Math.max(0, Number(discountAmount) || 0));

    // 2. Net HT = Brut − Remise (remise en XAF absolu)
    const discount = safeDiscount;
    const netHt = Math.max(0, safeSubtotal - discount);

    // 3. CSS = cssRate% of Net HT
    const cssAmount = Math.round(netHt * (cssRate / 100));

    // 4. Base Taxable = Net HT + CSS
    const taxBase = netHt + cssAmount;

    // 5. TPS = tpsRate% of Base Taxable
    const tpsAmount = Math.round(taxBase * (tpsRate / 100));

    // 6. TVA = tvaRate% of Base Taxable (parallel to TPS, both on Net HT + CSS)
    const tvaAmount = Math.round(taxBase * (tvaRate / 100));

    // 7. Net à Payer TTC = taxBase + TPS + TVA
    const total = taxBase + tpsAmount + tvaAmount;

    return {
        subtotal: safeSubtotal,
        discount,
        netHt,
        cssAmount,
        taxBase,
        tpsAmount,
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
