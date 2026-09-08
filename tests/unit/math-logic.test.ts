import { describe, it, expect } from 'vitest';
import { computeTotals } from '@/lib/math-logic';

describe('computeTotals', () => {
  it('should correctly calculate totals for basic inputs without taxes or discounts', () => {
    const items = [
      { quantity: 2, unitPrice: 100 },
      { quantity: 1, unitPrice: 50 },
    ];
    const discount = 0;
    const rates = { tvaRate: 0, tpsRate: 0, cssRate: 0 };

    const totals = computeTotals(items, discount, rates);

    expect(totals.subtotal).toBe(250); // 2*100 + 1*50
    expect(totals.discount).toBe(0);
    expect(totals.cssAmount).toBe(0);
    expect(totals.taxBase).toBe(250);
    expect(totals.tpsAmount).toBe(0);
    expect(totals.tvaAmount).toBe(0);
    expect(totals.total).toBe(250);
  });

  it('should correctly apply a standard discount', () => {
    const items = [{ quantity: 1, unitPrice: 1000 }];
    const discount = 200;
    const rates = { tvaRate: 0, tpsRate: 0, cssRate: 0 };

    const totals = computeTotals(items, discount, rates);

    expect(totals.subtotal).toBe(1000);
    expect(totals.discount).toBe(200);
    expect(totals.taxBase).toBe(800);
    expect(totals.total).toBe(800);
  });

  it('should not allow negative discounts, acting as zero discount', () => {
    const items = [{ quantity: 1, unitPrice: 1000 }];
    const discount = -500;
    const rates = { tvaRate: 0, tpsRate: 0, cssRate: 0 };

    const totals = computeTotals(items, discount, rates);

    expect(totals.subtotal).toBe(1000);
    expect(totals.discount).toBe(0);
    expect(totals.taxBase).toBe(1000);
    expect(totals.total).toBe(1000);
  });

  it('should not allow effectiveHT to be negative with massive discount', () => {
    const items = [{ quantity: 1, unitPrice: 500 }];
    const discount = 1000;
    const rates = { tvaRate: 18, tpsRate: null, cssRate: 1 };

    const totals = computeTotals(items, discount, rates);

    expect(totals.subtotal).toBe(500);
    expect(totals.discount).toBe(1000); // the discount itself can be 1000
    // Effective HT = max(0, 500 - 1000) = 0
    expect(totals.cssAmount).toBe(0);
    expect(totals.taxBase).toBe(0);
    expect(totals.tvaAmount).toBe(0);
    expect(totals.tpsAmount).toBe(0);
    expect(totals.total).toBe(0);
  });

  it('should correctly calculate taxes (TVA and CSS)', () => {
    const items = [{ quantity: 1, unitPrice: 10000 }]; // Subtotal: 10000
    const discount = 0;
    const rates = { tvaRate: 18, tpsRate: null, cssRate: 1 };

    const totals = computeTotals(items, discount, rates);

    expect(totals.subtotal).toBe(10000);
    expect(totals.discount).toBe(0);
    // CSS = 10000 * 1% = 100
    expect(totals.cssAmount).toBe(100);
    // TaxBase = 10000 + 100 = 10100
    expect(totals.taxBase).toBe(10100);
    // TVA = 10100 * 18% = 1818
    expect(totals.tvaAmount).toBe(1818);
    expect(totals.tpsAmount).toBe(0); // tpsRate is null
    // Total = 10100 + 1818 = 11918
    expect(totals.total).toBe(11918);
  });

  it('should correctly calculate taxes with TPS included', () => {
    const items = [{ quantity: 1, unitPrice: 10000 }];
    const discount = 0;
    const rates = { tvaRate: 18, tpsRate: 1, cssRate: 1 };

    const totals = computeTotals(items, discount, rates);

    expect(totals.cssAmount).toBe(100);
    expect(totals.taxBase).toBe(10100);
    expect(totals.tpsAmount).toBe(101); // 10100 * 1% = 101
    expect(totals.tvaAmount).toBe(1818); // 10100 * 18% = 1818
    expect(totals.total).toBe(10100 + 101 + 1818); // 12019
  });

  it('should handle floating point amounts with strict Math.round() at each step', () => {
    // We want a floating point result on an item
    const items = [
      { quantity: 1.5, unitPrice: 33.33 }, // 1.5 * 33.33 = 49.995 -> round -> 50
    ];
    const discount = 5.5; // round -> 6
    const rates = { tvaRate: 18.5, tpsRate: 1.1, cssRate: 1.5 };

    const totals = computeTotals(items, discount, rates);

    expect(totals.subtotal).toBe(50);
    expect(totals.discount).toBe(6);
    // Effective HT = 50 - 6 = 44
    // CSS = 44 * 1.5% = 0.66 -> round -> 1
    expect(totals.cssAmount).toBe(1);
    // TaxBase = 44 + 1 = 45
    expect(totals.taxBase).toBe(45);
    // TPS = 45 * 1.1% = 0.495 -> round -> 0
    expect(totals.tpsAmount).toBe(0);
    // TVA = 45 * 18.5% = 8.325 -> round -> 8
    expect(totals.tvaAmount).toBe(8);
    // Total = 45 + 0 + 8 = 53
    expect(totals.total).toBe(53);
  });

  it('should apply fractional quantities but round unit totals before summing', () => {
    const items = [
      { quantity: 1.5, unitPrice: 1500 }, // 2250
      { quantity: 2, unitPrice: 3333.33 } // 6666.66 -> 6667
    ];
    // sum = 2250 + 6667 = 8917
    const result = computeTotals(items, 0, { tvaRate: 18, tpsRate: null, cssRate: 1 });
    expect(result.subtotal).toBe(8917);
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
