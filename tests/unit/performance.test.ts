import { describe, it, expect } from 'vitest';
import { computeTotals } from '@/lib/math-logic';

describe('computeTotals Performance & Stress Test', () => {
  it('should process 10,000 items in less than 50ms', () => {
    // Generate 10,000 line items
    const numItems = 10000;
    const items = [];
    for (let i = 0; i < numItems; i++) {
      items.push({
        quantity: (i % 5) + 1, // Random-ish quantity between 1 and 5
        unitPrice: 1000 + (i % 1000) // Random-ish price between 1000 and 1999
      });
    }

    const rates = { tvaRate: 18, tpsRate: 9.5, cssRate: 1 };
    const discount = 15000;

    // Measure execution time
    const start = performance.now();
    const result = computeTotals(items, discount, rates);
    const end = performance.now();

    const executionTime = end - start;

    console.log(`Execution time for 10,000 items: ${executionTime.toFixed(2)}ms`);

    // The execution time must be under 50ms
    expect(executionTime).toBeLessThan(50);

    // Verify some expected data footprint based on simple calculation logic
    expect(result.subtotal).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);
  });
});
