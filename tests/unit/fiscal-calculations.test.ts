import { describe, it, expect } from 'vitest';

// ============================================================================
// GABON FISCAL CALCULATIONS
// ============================================================================

/**
 * Gabon Tax Rates:
 * - TVA (Taxe sur la Valeur Ajoutée): 18%
 * - TPS (Taxe Proportionnelle Spéciale): 9.5%
 * - CSS (Contribution au Service de Solidarité): 1%
 * 
 * Calculation Formula (DGI Standards 2026):
 * - Net HT = Subtotal - Discount
 * - CSS Amount = Net HT * 0.01
 * - Tax Base = Net HT + CSS Amount
 * - TVA Amount = Tax Base * 0.18
 * - TPS Amount = Tax Base * 0.095
 * - Total TTC = Net HT + CSS Amount + TVA Amount + TPS Amount
 * 
 * All amounts are rounded using Math.round() for precise decimal handling
 */

const TVA_RATE = 0.18;
const TPS_RATE = 0.095;
const CSS_RATE = 0.01;

/**
 * Calculate CSS amount
 * @param {number} netHt - The net hors tax amount
 * @returns {number} CSS amount rounded
 */
function calculateCSS(netHt: number): number {
  return Math.round(netHt * CSS_RATE);
}

/**
 * Calculate tax base (Net HT + CSS)
 * @param {number} netHt - The net hors tax amount
 * @param {number} cssAmount - The CSS amount
 * @returns {number} Tax base
 */
function calculateTaxBase(netHt: number, cssAmount: number): number {
  return netHt + cssAmount;
}

/**
 * Calculate TVA amount
 * @param {number} taxBase - The tax base amount
 * @returns {number} TVA amount rounded
 */
function calculateTVA(taxBase: number): number {
  return Math.round(taxBase * TVA_RATE);
}

/**
 * Calculate TPS amount
 * @param {number} taxBase - The tax base amount
 * @returns {number} TPS amount rounded
 */
function calculateTPS(taxBase: number): number {
  return Math.round(taxBase * TPS_RATE);
}

/**
 * Calculate total TTC including all taxes
 * @param {number} netHt - The net hors tax amount
 * @param {number} cssAmount - The CSS amount
 * @param {number} tvaAmount - The TVA amount
 * @param {number} tpsAmount - The TPS amount
 * @returns {number} Total TTC rounded
 */
function calculateTotalTTC(netHt: number, cssAmount: number, tvaAmount: number, tpsAmount: number): number {
  return netHt + cssAmount + tvaAmount + tpsAmount;
}

/**
 * Calculate all fiscal amounts from subtotal and discount
 * @param {number} subtotal - The subtotal amount
 * @param {number} discount - The discount amount
 * @returns {{ netHt: number; cssAmount: number; taxBase: number; tvaAmount: number; tpsAmount: number; total: number }} All fiscal amounts
 */
function calculateFiscalAmounts(subtotal: number, discount: number): {
  netHt: number;
  cssAmount: number;
  taxBase: number;
  tvaAmount: number;
  tpsAmount: number;
  total: number;
} {
  const netHt = Math.round(subtotal - discount);
  const cssAmount = calculateCSS(netHt);
  const taxBase = calculateTaxBase(netHt, cssAmount);
  const tvaAmount = calculateTVA(taxBase);
  const tpsAmount = calculateTPS(taxBase);
  const total = calculateTotalTTC(netHt, cssAmount, tvaAmount, tpsAmount);

  return {
    netHt,
    cssAmount,
    taxBase,
    tvaAmount,
    tpsAmount,
    total,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('Gabon Fiscal Calculations', () => {
  describe('CSS Calculation (1% of Net HT)', () => {
    it('should calculate CSS correctly for 10000 FCFA Net HT', () => {
      const netHt = 10000;
      const css = calculateCSS(netHt);
      expect(css).toBe(100);
    });

    it('should calculate CSS correctly for 50000 FCFA Net HT', () => {
      const netHt = 50000;
      const css = calculateCSS(netHt);
      expect(css).toBe(500);
    });

    it('should calculate CSS correctly for 100000 FCFA Net HT', () => {
      const netHt = 100000;
      const css = calculateCSS(netHt);
      expect(css).toBe(1000);
    });

    it('should calculate CSS correctly for 1 FCFA Net HT', () => {
      const netHt = 1;
      const css = calculateCSS(netHt);
      expect(css).toBe(0);
    });

    it('should calculate CSS correctly for 0 FCFA Net HT', () => {
      const netHt = 0;
      const css = calculateCSS(netHt);
      expect(css).toBe(0);
    });
  });

  describe('Tax Base Calculation (Net HT + CSS)', () => {
    it('should calculate tax base correctly for 10000 FCFA Net HT with 100 FCFA CSS', () => {
      const netHt = 10000;
      const cssAmount = 100;
      const taxBase = calculateTaxBase(netHt, cssAmount);
      expect(taxBase).toBe(10100);
    });

    it('should calculate tax base correctly for 50000 FCFA Net HT with 500 FCFA CSS', () => {
      const netHt = 50000;
      const cssAmount = 500;
      const taxBase = calculateTaxBase(netHt, cssAmount);
      expect(taxBase).toBe(50500);
    });
  });

  describe('TVA Calculation (18% of Tax Base)', () => {
    it('should calculate TVA correctly for 10100 FCFA tax base', () => {
      const taxBase = 10100;
      const tva = calculateTVA(taxBase);
      expect(tva).toBe(1818);
    });

    it('should calculate TVA correctly for 50500 FCFA tax base', () => {
      const taxBase = 50500;
      const tva = calculateTVA(taxBase);
      expect(tva).toBe(9090);
    });

    it('should calculate TVA correctly for 101000 FCFA tax base', () => {
      const taxBase = 101000;
      const tva = calculateTVA(taxBase);
      expect(tva).toBe(18180);
    });

    it('should calculate TVA correctly for 1 FCFA tax base', () => {
      const taxBase = 1;
      const tva = calculateTVA(taxBase);
      expect(tva).toBe(0);
    });

    it('should calculate TVA correctly for 0 FCFA tax base', () => {
      const taxBase = 0;
      const tva = calculateTVA(taxBase);
      expect(tva).toBe(0);
    });

    it('should calculate TVA correctly for decimal amounts with rounding', () => {
      const taxBase = 10100.50;
      const tva = calculateTVA(taxBase);
      expect(tva).toBe(1818); // 10100.50 * 0.18 = 1818.09 → 1818
    });
  });

  describe('TPS Calculation (9.5% of Tax Base)', () => {
    it('should calculate TPS correctly for 10100 FCFA tax base', () => {
      const taxBase = 10100;
      const tps = calculateTPS(taxBase);
      expect(tps).toBe(960);
    });

    it('should calculate TPS correctly for 50500 FCFA tax base', () => {
      const taxBase = 50500;
      const tps = calculateTPS(taxBase);
      expect(tps).toBe(4798);
    });

    it('should calculate TPS correctly for 101000 FCFA tax base', () => {
      const taxBase = 101000;
      const tps = calculateTPS(taxBase);
      expect(tps).toBe(9595);
    });

    it('should calculate TPS correctly for 1 FCFA tax base', () => {
      const taxBase = 1;
      const tps = calculateTPS(taxBase);
      expect(tps).toBe(0);
    });

    it('should calculate TPS correctly for 0 FCFA tax base', () => {
      const taxBase = 0;
      const tps = calculateTPS(taxBase);
      expect(tps).toBe(0);
    });

    it('should calculate TPS correctly for decimal amounts with rounding', () => {
      const taxBase = 10100.50;
      const tps = calculateTPS(taxBase);
      expect(tps).toBe(960); // 10100.50 * 0.095 = 959.5475 → 960
    });
  });

  describe('Total TTC Calculation', () => {
    it('should calculate total TTC correctly for 10000 FCFA Net HT', () => {
      const netHt = 10000;
      const cssAmount = 100;
      const tvaAmount = 1818;
      const tpsAmount = 960;
      const total = calculateTotalTTC(netHt, cssAmount, tvaAmount, tpsAmount);
      expect(total).toBe(12878); // 10000 + 100 + 1818 + 960 = 12878
    });

    it('should calculate total TTC correctly for 50000 FCFA Net HT', () => {
      const netHt = 50000;
      const cssAmount = 500;
      const tvaAmount = 9090;
      const tpsAmount = 4798;
      const total = calculateTotalTTC(netHt, cssAmount, tvaAmount, tpsAmount);
      expect(total).toBe(64388); // 50000 + 500 + 9090 + 4798 = 64388
    });

    it('should calculate total TTC correctly for 100000 FCFA Net HT', () => {
      const netHt = 100000;
      const cssAmount = 1000;
      const tvaAmount = 18180;
      const tpsAmount = 9595;
      const total = calculateTotalTTC(netHt, cssAmount, tvaAmount, tpsAmount);
      expect(total).toBe(128775); // 100000 + 1000 + 18180 + 9595 = 128775
    });

    it('should calculate total TTC correctly for 0 FCFA Net HT', () => {
      const netHt = 0;
      const cssAmount = 0;
      const tvaAmount = 0;
      const tpsAmount = 0;
      const total = calculateTotalTTC(netHt, cssAmount, tvaAmount, tpsAmount);
      expect(total).toBe(0);
    });

    it('should calculate total TTC correctly for 1 FCFA Net HT', () => {
      const netHt = 1;
      const cssAmount = 0;
      const tvaAmount = 0;
      const tpsAmount = 0;
      const total = calculateTotalTTC(netHt, cssAmount, tvaAmount, tpsAmount);
      expect(total).toBe(1);
    });
  });

  describe('Complete Fiscal Calculation with Discount', () => {
    it('should calculate all amounts correctly for 10000 FCFA subtotal with no discount', () => {
      const subtotal = 10000;
      const discount = 0;
      const result = calculateFiscalAmounts(subtotal, discount);

      expect(result.netHt).toBe(10000);
      expect(result.cssAmount).toBe(100);
      expect(result.taxBase).toBe(10100);
      expect(result.tvaAmount).toBe(1818);
      expect(result.tpsAmount).toBe(960);
      expect(result.total).toBe(12878);
    });

    it('should calculate all amounts correctly for 10000 FCFA subtotal with 1000 FCFA discount', () => {
      const subtotal = 10000;
      const discount = 1000;
      const result = calculateFiscalAmounts(subtotal, discount);

      expect(result.netHt).toBe(9000);
      expect(result.cssAmount).toBe(90);
      expect(result.taxBase).toBe(9090);
      expect(result.tvaAmount).toBe(1636);
      expect(result.tpsAmount).toBe(864);
      expect(result.total).toBe(11590);
    });

    it('should calculate all amounts correctly for 50000 FCFA subtotal with 5000 FCFA discount', () => {
      const subtotal = 50000;
      const discount = 5000;
      const result = calculateFiscalAmounts(subtotal, discount);

      expect(result.netHt).toBe(45000);
      expect(result.cssAmount).toBe(450);
      expect(result.taxBase).toBe(45450);
      expect(result.tvaAmount).toBe(8181);
      expect(result.tpsAmount).toBe(4318);
      expect(result.total).toBe(57949);
    });

    it('should calculate all amounts correctly for 100000 FCFA subtotal with 10000 FCFA discount', () => {
      const subtotal = 100000;
      const discount = 10000;
      const result = calculateFiscalAmounts(subtotal, discount);

      expect(result.netHt).toBe(90000);
      expect(result.cssAmount).toBe(900);
      expect(result.taxBase).toBe(90900);
      expect(result.tvaAmount).toBe(16362);
      expect(result.tpsAmount).toBe(8636);
      expect(result.total).toBe(115898);
    });

    it('should handle discount equal to subtotal correctly', () => {
      const subtotal = 10000;
      const discount = 10000;
      const result = calculateFiscalAmounts(subtotal, discount);

      expect(result.netHt).toBe(0);
      expect(result.cssAmount).toBe(0);
      expect(result.taxBase).toBe(0);
      expect(result.tvaAmount).toBe(0);
      expect(result.tpsAmount).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should handle discount greater than subtotal correctly (edge case)', () => {
      const subtotal = 10000;
      const discount = 15000;
      const result = calculateFiscalAmounts(subtotal, discount);

      expect(result.netHt).toBe(-5000);
      expect(result.cssAmount).toBe(-50);
      expect(result.taxBase).toBe(-5050);
      expect(result.tvaAmount).toBe(-909);
      expect(result.tpsAmount).toBe(-480);
      expect(result.total).toBe(-6439);
    });
  });

  describe('Rounding Behavior with Math.round()', () => {
    it('should round CSS correctly for 10000.01 FCFA Net HT', () => {
      const netHt = 10000.01;
      const css = calculateCSS(netHt);
      expect(css).toBe(100); // 10000.01 * 0.01 = 100.0001 → 100
    });

    it('should round CSS correctly for 10000.50 FCFA Net HT', () => {
      const netHt = 10000.50;
      const css = calculateCSS(netHt);
      expect(css).toBe(100); // 10000.50 * 0.01 = 100.005 → 100
    });

    it('should round TVA correctly for 10100.01 FCFA tax base', () => {
      const taxBase = 10100.01;
      const tva = calculateTVA(taxBase);
      expect(tva).toBe(1818); // 10100.01 * 0.18 = 1818.0018 → 1818
    });

    it('should round TVA correctly for 10100.50 FCFA tax base', () => {
      const taxBase = 10100.50;
      const tva = calculateTVA(taxBase);
      expect(tva).toBe(1818); // 10100.50 * 0.18 = 1818.09 → 1818
    });

    it('should round TPS correctly for 10100.01 FCFA tax base', () => {
      const taxBase = 10100.01;
      const tps = calculateTPS(taxBase);
      expect(tps).toBe(960); // 10100.01 * 0.095 = 959.50095 → 960
    });

    it('should round TPS correctly for 10100.50 FCFA tax base', () => {
      const taxBase = 10100.50;
      const tps = calculateTPS(taxBase);
      expect(tps).toBe(960); // 10100.50 * 0.095 = 959.5475 → 960
    });
  });

  describe('Real-World Scenarios', () => {
    it('should calculate correctly for a typical invoice: 50000 FCFA subtotal', () => {
      const subtotal = 50000;
      const discount = 0;
      const result = calculateFiscalAmounts(subtotal, discount);

      expect(result.netHt).toBe(50000);
      expect(result.cssAmount).toBe(500);
      expect(result.taxBase).toBe(50500);
      expect(result.tvaAmount).toBe(9090);
      expect(result.tpsAmount).toBe(4798);
      expect(result.total).toBe(64388);
    });

    it('should calculate correctly for a discounted invoice: 75000 FCFA subtotal with 5000 FCFA discount', () => {
      const subtotal = 75000;
      const discount = 5000;
      const result = calculateFiscalAmounts(subtotal, discount);

      expect(result.netHt).toBe(70000);
      expect(result.cssAmount).toBe(700);
      expect(result.taxBase).toBe(70700);
      expect(result.tvaAmount).toBe(12726);
      expect(result.tpsAmount).toBe(6717); // 70700 * 0.095 = 6716.5 → 6717
      expect(result.total).toBe(90143); // 70000 + 700 + 12726 + 6717 = 90143
    });

    it('should calculate correctly for a small invoice: 5000 FCFA subtotal', () => {
      const subtotal = 5000;
      const discount = 0;
      const result = calculateFiscalAmounts(subtotal, discount);

      expect(result.netHt).toBe(5000);
      expect(result.cssAmount).toBe(50);
      expect(result.taxBase).toBe(5050);
      expect(result.tvaAmount).toBe(909);
      expect(result.tpsAmount).toBe(480);
      expect(result.total).toBe(6439);
    });

    it('should calculate correctly for a large invoice: 500000 FCFA subtotal', () => {
      const subtotal = 500000;
      const discount = 0;
      const result = calculateFiscalAmounts(subtotal, discount);

      expect(result.netHt).toBe(500000);
      expect(result.cssAmount).toBe(5000);
      expect(result.taxBase).toBe(505000);
      expect(result.tvaAmount).toBe(90900);
      expect(result.tpsAmount).toBe(47975);
      expect(result.total).toBe(643875);
    });

    it('should calculate correctly for an invoice with 10% discount', () => {
      const subtotal = 100000;
      const discount = 10000; // 10%
      const result = calculateFiscalAmounts(subtotal, discount);

      expect(result.netHt).toBe(90000);
      expect(result.cssAmount).toBe(900);
      expect(result.taxBase).toBe(90900);
      expect(result.tvaAmount).toBe(16362);
      expect(result.tpsAmount).toBe(8636);
      expect(result.total).toBe(115898);
    });

    it('should calculate correctly for an invoice with 25% discount', () => {
      const subtotal = 100000;
      const discount = 25000; // 25%
      const result = calculateFiscalAmounts(subtotal, discount);

      expect(result.netHt).toBe(75000);
      expect(result.cssAmount).toBe(750);
      expect(result.taxBase).toBe(75750);
      expect(result.tvaAmount).toBe(13635);
      expect(result.tpsAmount).toBe(7196);
      expect(result.total).toBe(96581);
    });
  });

  describe('Precision and Accuracy', () => {
    it('should maintain precision across multiple calculations', () => {
      const subtotal = 12345.67;
      const discount = 1234.56;
      const result = calculateFiscalAmounts(subtotal, discount);

      const expectedNetHt = Math.round(12345.67 - 1234.56);
      const expectedCSS = Math.round(expectedNetHt * 0.01);
      const expectedTaxBase = expectedNetHt + expectedCSS;
      const expectedTVA = Math.round(expectedTaxBase * 0.18);
      const expectedTPS = Math.round(expectedTaxBase * 0.095);
      const expectedTotal = expectedNetHt + expectedCSS + expectedTVA + expectedTPS;

      expect(result.netHt).toBe(expectedNetHt);
      expect(result.cssAmount).toBe(expectedCSS);
      expect(result.taxBase).toBe(expectedTaxBase);
      expect(result.tvaAmount).toBe(expectedTVA);
      expect(result.tpsAmount).toBe(expectedTPS);
      expect(result.total).toBe(expectedTotal);
    });

    it('should handle very large numbers without overflow', () => {
      const subtotal = 999999999;
      const discount = 0;
      const result = calculateFiscalAmounts(subtotal, discount);

      expect(result.netHt).toBe(999999999);
      expect(result.cssAmount).toBe(10000000); // 999999999 * 0.01 = 9999999.99 → 10000000
      expect(result.taxBase).toBe(1009999999); // 999999999 + 10000000 = 1009999999
      expect(result.tvaAmount).toBe(181800000); // 1009999999 * 0.18 = 181799999.82 → 181800000
      expect(result.tpsAmount).toBe(95950000); // 1009999999 * 0.095 = 95949999.905 → 95950000
      expect(result.total).toBe(1287749999); // 999999999 + 10000000 + 181800000 + 95950000 = 1287749999
    });

    it('should handle negative tax base (edge case from excessive discount)', () => {
      const subtotal = 10000;
      const discount = 20000;
      const result = calculateFiscalAmounts(subtotal, discount);

      expect(result.netHt).toBe(-10000);
      expect(result.cssAmount).toBe(-100);
      expect(result.taxBase).toBe(-10100);
      expect(result.tvaAmount).toBe(-1818);
      expect(result.tpsAmount).toBe(-959); // -10100 * 0.095 = -959.5 → -959
      expect(result.total).toBe(-12877); // -10000 + (-100) + (-1818) + (-959) = -12877
    });
  });
});
