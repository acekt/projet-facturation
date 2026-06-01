import { describe, it, expect } from 'vitest'
import { calculateFiscalCascade } from './index'

describe('Fiscal Logic v4 (with TPS 9.5%)', () => {
    it('should correctly calculate the Gabonese tax cascade including TPS', () => {
        // Base: 100,000 XAF
        // Discount: 5% -> 95,000 XAF
        // CSS: 1% of 95,000 -> 950 XAF
        // Base Taxable: 95,000 + 950 -> 95,950 XAF
        // TPS: 9.5% of 95,950 -> 9,115.25 -> 9,115 XAF
        // TVA: 18% of 95,950 -> 17,271 XAF
        // Total: 95,000 + 950 + 9,115 + 17,271 -> 122,336 XAF

        const result = calculateFiscalCascade(100000, 5, 1, 18, 9.5);

        expect(result.netHt).toBe(95000);
        expect(result.cssAmount).toBe(950);
        expect(result.taxBase).toBe(95950);
        expect(result.tpsAmount).toBe(9115);
        expect(result.tvaAmount).toBe(17271);
        expect(result.total).toBe(122336);
    })
})
