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
    expect(totals.discount).toBe(1000);
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
});
