import { describe, it, expect } from 'vitest'
import { calculateFiscalCascade } from './index'

describe('Fiscal Logic v5 — discountAmount absolu XAF (DGI Standards 2026)', () => {
    it('should correctly calculate the cascade with an ABSOLUTE discount amount of 5,000 XAF', () => {
        // Base: 100,000 XAF
        // Discount: 5,000 XAF (montant absolu, pas un %)
        // Net HT: 100,000 - 5,000 = 95,000 XAF
        // CSS: 1% of 95,000 = 950 XAF
        // Base Taxable: 95,000 + 950 = 95,950 XAF
        // TPS: 9.5% of 95,950 = 9,115.25 → 9,115 XAF
        // TVA: 18% of 95,950 = 17,271 XAF
        // Total: 95,950 + 9,115 + 17,271 = 122,336 XAF

        const result = calculateFiscalCascade(100000, 5000, 1, 18, 9.5);

        expect(result.subtotal).toBe(100000);
        expect(result.discount).toBe(5000);
        expect(result.netHt).toBe(95000);
        expect(result.cssAmount).toBe(950);
        expect(result.taxBase).toBe(95950);
        expect(result.tpsAmount).toBe(9115);
        expect(result.tvaAmount).toBe(17271);
        expect(result.total).toBe(122336);
    });

    it('should calculate correctly with zero discount', () => {
        // Base: 100,000 XAF, no discount
        // CSS: 1% of 100,000 = 1,000 XAF
        // Base Taxable: 101,000 XAF
        // TPS: 9.5% of 101,000 = 9,595 XAF
        // TVA: 18% of 101,000 = 18,180 XAF
        // Total: 101,000 + 9,595 + 18,180 = 128,775 XAF

        const result = calculateFiscalCascade(100000, 0, 1, 18, 9.5);

        expect(result.discount).toBe(0);
        expect(result.netHt).toBe(100000);
        expect(result.cssAmount).toBe(1000);
        expect(result.taxBase).toBe(101000);
        expect(result.tpsAmount).toBe(9595);
        expect(result.tvaAmount).toBe(18180);
        expect(result.total).toBe(128775);
    });

    it('should not allow discount to exceed subtotal (netHt floored at 0)', () => {
        // Discount of 200,000 XAF on a 100,000 XAF subtotal must yield netHt = 0
        const result = calculateFiscalCascade(100000, 200000, 1, 18, 9.5);
        expect(result.netHt).toBe(0);
        expect(result.total).toBe(0);
    });
})
