import { describe, it, expect } from 'vitest'
import { calculateFiscalCascade } from '../../lib/fiscal'

describe('Fiscal Logic - Gabon (DGI Standards)', () => {
  it('should calculate correct amounts for a base of 100,000 XAF', () => {
    // subtotal: 100,000
    // discount: 0
    // netHt: 100,000
    // cssAmount (1%): 1,000
    // taxBase: 101,000
    // tpsAmount (9.5%): 9,595
    // tvaAmount (18%): 18,180
    // total: 100,000 + 1,000 + 9,595 + 18,180 = 128,775
    const result = calculateFiscalCascade(100000);
    expect(result.cssAmount).toBe(1000);
    expect(result.taxBase).toBe(101000);
    expect(result.tpsAmount).toBe(9595);
    expect(result.tvaAmount).toBe(18180);
    expect(result.total).toBe(128775);
  });
});
