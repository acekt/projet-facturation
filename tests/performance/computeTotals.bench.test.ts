import { describe, it, expect } from 'vitest';
import { computeTotals } from '@/lib/math-logic';

describe('computeTotals Performance Benchmark', () => {
  it('should process 10,000 items in less than 50ms with minimal memory overhead', () => {
    // 1. Generate 10,000 items
    const items = [];
    for (let i = 0; i < 10000; i++) {
      items.push({
        quantity: Math.random() * 10,
        unitPrice: Math.random() * 5000,
      });
    }

    const discount = 500;
    const rates = { tvaRate: 18, tpsRate: 1, cssRate: 1 };

    // Record starting memory and time
    const startMemory = process.memoryUsage().heapUsed;
    const startTime = performance.now();

    // 2. Execute
    const totals = computeTotals(items, discount, rates);

    // Record ending memory and time
    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;

    const duration = endTime - startTime;
    const memoryDiffMb = (endMemory - startMemory) / 1024 / 1024;

    // 3. Assertions
    expect(totals.total).toBeGreaterThan(0); // Ensure calculation worked

    // Duration should be under 50ms
    expect(duration).toBeLessThan(50);

    // Memory overhead should be extremely minimal (under 5MB difference for this operation)
    // Garbage collection can be unpredictable, but for a pure calculation on an existing array,
    // it shouldn't allocate massive amounts of heap space.
    expect(memoryDiffMb).toBeLessThan(5);

    console.log(`computeTotals (10k items) executed in ${duration.toFixed(2)}ms, Memory overhead: ${memoryDiffMb.toFixed(2)}MB`);
  });
});
