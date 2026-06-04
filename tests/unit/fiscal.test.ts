import { describe, it, expect } from 'vitest'
import { calculateFiscalCascade } from '../../lib/fiscal'

describe('Fiscal Logic - Gabon (DGI Standards)', () => {
  it('should calculate correct amounts for a base of 100,000 XAF', () => {
    const result = calculateFiscalCascade(100000);
    expect(result.cssAmount).toBe(1000);
    expect(result.taxBase).toBe(101000);
    expect(result.tpsAmount).toBe(9595);
    expect(result.tvaAmount).toBe(18180);
    expect(result.total).toBe(128775); // 101000 + 9595 + 18180 = 128775
  });
});
