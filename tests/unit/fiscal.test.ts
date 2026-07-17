import { describe, it, expect } from 'vitest'
import { calculateFiscalCascade } from '../../lib/fiscal'

describe('Fiscal Logic — Gabon (DGI Standards 2026) — discountAmount absolu XAF', () => {
  it('should calculate correct amounts for a base of 100,000 XAF with no discount', () => {
    // Base: 100,000 XAF, discountAmount = 0 (default)
    // CSS: 1% of 100,000 = 1,000 XAF
    // Base Taxable: 101,000 XAF
    // TPS: 9.5% of 101,000 = 9,595 XAF
    // TVA: 18% of 101,000 = 18,180 XAF
    // Total: 101,000 + 9,595 + 18,180 = 128,775 XAF
    const result = calculateFiscalCascade(100000);
    expect(result.cssAmount).toBe(1000);
    expect(result.taxBase).toBe(101000);
    expect(result.tpsAmount).toBe(9595);
    expect(result.tvaAmount).toBe(18180);
    expect(result.total).toBe(128775); // 101000 + 9595 + 18180 = 128775
  });

  it('should apply an absolute XAF discount amount correctly', () => {
    // Base: 100,000 XAF, discountAmount = 5,000 XAF
    // Net HT: 95,000 XAF
    // CSS: 1% of 95,000 = 950 XAF
    // Base Taxable: 95,950 XAF
    // TPS: 9.5% of 95,950 = 9,115 XAF
    // TVA: 18% of 95,950 = 17,271 XAF
    // Total: 95,950 + 9,115 + 17,271 = 122,336 XAF
    const result = calculateFiscalCascade(100000, 5000);
    expect(result.netHt).toBe(95000);
    expect(result.cssAmount).toBe(950);
    expect(result.taxBase).toBe(95950);
    expect(result.tpsAmount).toBe(9115);  // uses default 9.5%
    expect(result.tvaAmount).toBe(17271);
    expect(result.total).toBe(122336); // 95950 + 9115 + 17271 = 122336
  });
});
