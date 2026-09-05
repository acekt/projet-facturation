import { describe, it, expect } from 'vitest';
import { computeTotals } from '@/lib/api/invoice-logic';

describe('computeTotals', () => {
  const rates = { tvaRate: 18, tpsRate: 9.5, cssRate: 1 };

  it('should compute totals correctly with no discount', () => {
    const items = [
      { quantity: 2, unitPrice: 5000 },
      { quantity: 1, unitPrice: 15000 }
    ];
    // subtotal = 10000 + 15000 = 25000
    // discount = 0
    // effectiveHT = 25000
    // cssAmount = 25000 * 0.01 = 250
    // taxBase = 25250
    // tpsAmount = Math.round(25250 * 0.095) = Math.round(2398.75) = 2399
    // tvaAmount = Math.round(25250 * 0.18) = Math.round(4545) = 4545
    // total = 25250 + 2399 + 4545 = 32194
    const result = computeTotals(items, 0, rates);
    expect(result.subtotal).toBe(25000);
    expect(result.discount).toBe(0);
    expect(result.cssAmount).toBe(250);
    expect(result.taxBase).toBe(25250);
    expect(result.tpsAmount).toBe(2399);
    expect(result.tvaAmount).toBe(4545);
    expect(result.total).toBe(32194);
  });

  it('should floor the discount to 0 if negative, but allow huge discounts capped at subtotal', () => {
    const items = [{ quantity: 1, unitPrice: 10000 }];
    const resultNeg = computeTotals(items, -500, rates);
    expect(resultNeg.discount).toBe(0);
    expect(resultNeg.subtotal).toBe(10000);

    // discount exceeds subtotal
    const resultHuge = computeTotals(items, 15000, rates);
    expect(resultHuge.discount).toBe(15000);
    // the logic enforces effectiveHT = max(0, subtotal - discount)
    expect(resultHuge.cssAmount).toBe(0);
    expect(resultHuge.taxBase).toBe(0);
    expect(resultHuge.total).toBe(0);
  });

  it('should apply fractional quantities but round unit totals before summing', () => {
    const items = [
      { quantity: 1.5, unitPrice: 1500 }, // 2250
      { quantity: 2, unitPrice: 3333.33 } // 6666.66 -> 6667
    ];
    // sum = 2250 + 6667 = 8917
    const result = computeTotals(items, 0, rates);
    expect(result.subtotal).toBe(8917);
  });

  it('should allow null tpsRate', () => {
    const items = [{ quantity: 1, unitPrice: 10000 }];
    const ratesNoTPS = { tvaRate: 18, tpsRate: null, cssRate: 1 };
    const result = computeTotals(items, 0, ratesNoTPS);
    expect(result.tpsAmount).toBe(0);
    expect(result.cssAmount).toBe(100);
    expect(result.taxBase).toBe(10100);
    expect(result.tvaAmount).toBe(1818);
    expect(result.total).toBe(11918); // taxBase (10100) + tpsAmount (0) + tvaAmount (1818) = 11918
  });
  it('should strictly apply Math.round on floating point amounts and complex rates', () => {
    const items = [
      { quantity: 1.33, unitPrice: 777.77 }, // 1034.4341 -> 1034
      { quantity: 0.5, unitPrice: 999.99 }   // 499.995 -> 500
    ];
    // subtotal = 1034 + 500 = 1534

    // discount = 33.33 -> 33

    // effectiveHT = 1534 - 33 = 1501

    // cssAmount = 1501 * 0.01 = 15.01 -> 15
    // taxBase = 1501 + 15 = 1516

    // tpsAmount = 1516 * 0.095 = 144.02 -> 144
    // tvaAmount = 1516 * 0.18 = 272.88 -> 273

    // total = 1516 + 144 + 273 = 1933
    const complexRates = { tvaRate: 18, tpsRate: 9.5, cssRate: 1 };

    const result = computeTotals(items, 33.33, complexRates);

    expect(result.subtotal).toBe(1534);
    expect(result.discount).toBe(33);
    expect(result.cssAmount).toBe(15);
    expect(result.taxBase).toBe(1516);
    expect(result.tpsAmount).toBe(144);
    expect(result.tvaAmount).toBe(273);
    expect(result.total).toBe(1933);
  });

  it('should handle massive discounts and ensure limits', () => {
    const items = [
      { quantity: 1, unitPrice: 5000000000.5 } // 5000000001
    ];
    // subtotal = 5000000001

    const rates = { tvaRate: 18, tpsRate: 9.5, cssRate: 1 };

    const result = computeTotals(items, 6000000000.75, rates);
    // discount -> 6000000001
    expect(result.subtotal).toBe(5000000001);
    expect(result.discount).toBe(6000000001); // Discount can be mathematically larger than subtotal in raw calculation

    // effectiveHT = Max(0, 5000000001 - 6000000001) = 0
    expect(result.taxBase).toBe(0);
    expect(result.cssAmount).toBe(0);
    expect(result.tpsAmount).toBe(0);
    expect(result.tvaAmount).toBe(0);
    expect(result.total).toBe(0);
  });
});
