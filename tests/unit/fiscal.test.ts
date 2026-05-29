import { describe, it, expect } from 'vitest'
import { calculateFiscalCascade } from '../../lib/fiscal'

describe('Fiscal Logic - Gabon (DGI Standards)', () => {
  it('should calculate correct amounts for a base of 100,000 XAF', () => {
    const result = calculateFiscalCascade(100000);
    expect(result.cssAmount).toBe(1000);
    expect(result.taxBase).toBe(101000);
    expect(result.tvaAmount).toBe(18180);
    expect(result.total).toBe(119180);
  });

  it('should round float inputs correctly to nearest integer', () => {
    const result = calculateFiscalCascade(100000.7);
    expect(result.subtotal).toBe(100001);
  });

  it('should handle zero subtotal gracefully', () => {
    const result = calculateFiscalCascade(0);
    expect(result.cssAmount).toBe(0);
    expect(result.tvaAmount).toBe(0);
    expect(result.total).toBe(0);
  });

  it('should apply discount and compute cascade on net HT', () => {
    const result = calculateFiscalCascade(100000, 10); // 10% discount
    expect(result.discount).toBe(10000);
    expect(result.netHt).toBe(90000);
    expect(result.cssAmount).toBe(900); // 1% of 90,000
    expect(result.taxBase).toBe(90900); // 90,000 + 900
    expect(result.tvaAmount).toBe(16362); // 18% of 90,900 = 16362
    expect(result.total).toBe(107262); // 90,000 + 900 + 16,362
  });

  it('should round tax amounts to nearest integer', () => {
    const result = calculateFiscalCascade(100025, 0, 1.25, 17.5);
    // netHt = 100025
    // cssAmount = 100025 * 0.0125 = 1250.3125 => rounded to 1250
    expect(result.cssAmount).toBe(1250);
    // taxBase = 100025 + 1250 = 101275
    // tvaAmount = 101275 * 0.175 = 17723.125 => rounded to 17723
    expect(result.tvaAmount).toBe(17723);
    expect(result.total).toBe(100025 + 1250 + 17723);
  });
});
