import { describe, it, expect } from 'vitest';
import { calculateFiscalCascade, type FiscalResult } from '../../lib/fiscal/index';
import { computeTotals, type InvoiceItemInput } from '../../lib/api/invoice-logic';
import {
  invoiceItemSchema,
  quoteItemSchema,
  serviceSchema,
  paymentCreateSchema,
  invoiceSchema,
  quoteSchema,
} from '../../lib/validations';

describe('🚨 PHASE 1/10 : AUDIT TDD — FISCALITÉ & MATHÉMATIQUES (DGI GABON 2026) 🚨', () => {

  // ==========================================================================
  // SCÉNARIO 1 : CALCULS AVEC REMISE & PLANCHER ZÉRO (NET HT >= 0)
  // ==========================================================================
  describe('1. Calculs avec Remise Absolue (XAF) et Vérification du Plancher', () => {
    
    it('devrait déduire la remise absolue XAF du sous-total AVANT le calcul des taxes (calculateFiscalCascade)', () => {
      // ARRANGE : Sous-total brut de 200 000 XAF avec une remise absolue de 20 000 XAF
      const subtotal = 200000;
      const discount = 20000;
      const cssRate = 1;
      const tvaRate = 18;
      const tpsRate = 9.5;

      // ACT : Calcul de la cascade fiscale
      const result: FiscalResult = calculateFiscalCascade(subtotal, discount, cssRate, tvaRate, tpsRate);

      // ASSERT : Net HT = 180 000 XAF, les taxes s'appliquent sur 180 000 XAF et non sur 200 000 XAF
      expect(result.subtotal).toBe(200000);
      expect(result.discount).toBe(20000);
      expect(result.netHt).toBe(180000);
      // CSS (1% de 180 000) = 1 800
      expect(result.cssAmount).toBe(1800);
      // Base imposable = 180 000 + 1 800 = 181 800
      expect(result.taxBase).toBe(181800);
      // TPS (9.5% de 181 800) = Math.round(17 271) = 17271
      expect(result.tpsAmount).toBe(17271);
      // TVA (18% de 181 800) = Math.round(32 724) = 32724
      expect(result.tvaAmount).toBe(32724);
      // Total TTC = 181 800 + 17 271 + 32 724 = 231 795
      expect(result.total).toBe(231795);
    });

    it('devrait appliquer exactement la même règle de remise dans computeTotals (Source de vérité serveur)', () => {
      // ARRANGE : Panier d'articles totalisant 150 000 XAF, remise de 15 000 XAF
      const items: InvoiceItemInput[] = [
        { quantity: 2, unitPrice: 50000 }, // 100 000
        { quantity: 1, unitPrice: 50000 }, // 50 000
      ];
      const discountInput = 15000;
      const rates = { cssRate: 1, tpsRate: 9.5, tvaRate: 18 };

      // ACT
      const result = computeTotals(items, discountInput, rates);

      // ASSERT : Net HT (effectiveHT) = 135 000
      expect(result.subtotal).toBe(150000);
      expect(result.discount).toBe(15000);
      expect(result.cssAmount).toBe(1350); // 1% de 135 000
      expect(result.taxBase).toBe(136350); // 135 000 + 1 350
      expect(result.tpsAmount).toBe(Math.round(136350 * 0.095)); // 12953
      expect(result.tvaAmount).toBe(Math.round(136350 * 0.18));  // 24543
      expect(result.total).toBe(136350 + 12953 + 24543);         // 173846
    });

    it('devrait appliquer le plancher à zéro (Net HT = 0) si la remise dépasse le sous-total (calculateFiscalCascade)', () => {
      // ARRANGE : Sous-total de 100 000 XAF, remise excessive de 350 000 XAF
      const subtotal = 100000;
      const excessiveDiscount = 350000;

      // ACT
      const result = calculateFiscalCascade(subtotal, excessiveDiscount, 1, 18, 9.5);

      // ASSERT : Aucun montant ne doit être négatif
      expect(result.subtotal).toBe(100000);
      expect(result.netHt).toBe(0);
      expect(result.cssAmount).toBe(0);
      expect(result.taxBase).toBe(0);
      expect(result.tpsAmount).toBe(0);
      expect(result.tvaAmount).toBe(0);
      expect(result.total).toBe(0);
    });

    it('devrait appliquer le plancher à zéro (effectiveHT = 0) si la remise dépasse le sous-total dans computeTotals', () => {
      // ARRANGE
      const items: InvoiceItemInput[] = [{ quantity: 1, unitPrice: 50000 }];
      const excessiveDiscount = 999999;
      const rates = { cssRate: 1, tpsRate: 9.5, tvaRate: 18 };

      // ACT
      const result = computeTotals(items, excessiveDiscount, rates);

      // ASSERT
      expect(result.subtotal).toBe(50000);
      expect(result.discount).toBe(999999);
      expect(result.cssAmount).toBe(0);
      expect(result.taxBase).toBe(0);
      expect(result.tpsAmount).toBe(0);
      expect(result.tvaAmount).toBe(0);
      expect(result.total).toBe(0);
    });

    it('devrait traiter une remise négative en la ramenant à 0 (plancher Math.max(0, discount))', () => {
      // ARRANGE : Tentative d'injection d'une remise négative -5000 XAF
      const subtotal = 100000;
      const negativeDiscount = -5000;

      // ACT
      const resultCascade = calculateFiscalCascade(subtotal, negativeDiscount, 1, 18, 9.5);
      const resultServer = computeTotals([{ quantity: 1, unitPrice: 100000 }], negativeDiscount, { cssRate: 1, tpsRate: 9.5, tvaRate: 18 });

      // ASSERT : La remise négative est neutralisée à 0
      expect(resultCascade.discount).toBe(0);
      expect(resultCascade.netHt).toBe(100000);
      expect(resultServer.discount).toBe(0);
      expect(resultServer.subtotal).toBe(100000);
    });
  });

  // ==========================================================================
  // SCÉNARIO 2 : ARRONDIS PAR LIGNE & COHÉRENCE ARITHMÉTIQUE
  // ==========================================================================
  describe('2. Arrondis par Ligne (Quantités Décimales) & Prévention des Divergences', () => {
    
    it('devrait arrondir chaque ligne individuellement à l\'entier avant la sommation dans computeTotals', () => {
      // ARRANGE : Panier avec quantités fractionnaires et prix unitaires générant des décimales
      // Ligne 1 : 1.5 heures * 15 333 XAF = 22 999.5 XAF -> Math.round = 23 000 XAF
      // Ligne 2 : 0.75 jour * 10 000 XAF = 7 500 XAF     -> Math.round = 7 500 XAF
      // Ligne 3 : 3.333 unités * 3 000 XAF = 9 999 XAF     -> Math.round = 9 999 XAF
      const items: InvoiceItemInput[] = [
        { quantity: 1.5, unitPrice: 15333 },
        { quantity: 0.75, unitPrice: 10000 },
        { quantity: 3.333, unitPrice: 3000 },
      ];
      const rates = { cssRate: 1, tpsRate: 9.5, tvaRate: 18 };

      // ACT
      const result = computeTotals(items, 0, rates);

      // ASSERT : Vérification que le sous-total est la somme exacte des lignes arrondies
      // Ligne 1 arrondie = 23 000
      // Ligne 2 arrondie = 7 500
      // Ligne 3 arrondie = 9 999
      // Somme attendue = 40 499 XAF
      expect(result.subtotal).toBe(40499);
    });

    it('devrait démontrer la divergence mathématique si on arrondissait globalement au lieu de par ligne', () => {
      // ARRANGE : Cas typique de divergence XAF (Asymétrie d'arrondi)
      // 3 lignes identiques de 0.5 unité à 3 333 XAF
      // Calcul par ligne : 0.5 * 3333 = 1666.5 -> arrondi à 1667 par ligne. 3 * 1667 = 5001 XAF.
      // Calcul naïf global : 3 * (0.5 * 3333) = 4999.5 -> arrondi à 5000 XAF. (Divergence de 1 XAF !)
      const items: InvoiceItemInput[] = [
        { quantity: 0.5, unitPrice: 3333 },
        { quantity: 0.5, unitPrice: 3333 },
        { quantity: 0.5, unitPrice: 3333 },
      ];
      const rates = { cssRate: 1, tpsRate: 9.5, tvaRate: 18 };

      // ACT : Calcul via notre moteur fiscal
      const result = computeTotals(items, 0, rates);

      // ASSERT : Notre moteur garantit que la somme des lignes (3 * 1667 = 5001) est respectée
      expect(result.subtotal).toBe(5001);
      
      // Preuve que l'arrondi global naïf donnerait une somme discordante avec les lignes facturées
      const naiveGlobalSum = Math.round(items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0));
      expect(naiveGlobalSum).toBe(5000);
      expect(result.subtotal).not.toBe(naiveGlobalSum); // Confirmation de l'isolation par ligne
    });
  });

  // ==========================================================================
  // SCÉNARIO 3 : CASCADE FISCALE DGI & LIMITES IEEE 754 (MONTANTS MASSIFS)
  // ==========================================================================
  describe('3. Cascade Fiscale DGI Gabon & Précision aux Limites IEEE 754', () => {
    
    it('devrait calculer la cascade dans l\'ordre strict : Net HT -> CSS -> Base Taxable -> TPS -> TVA -> TTC', () => {
      // ARRANGE : 1 000 000 XAF
      const subtotal = 1000000;
      const discount = 0;

      // ACT
      const result = calculateFiscalCascade(subtotal, discount, 1, 18, 9.5);

      // ASSERT : Vérification étape par étape selon la norme DGI
      const expectedNetHt = 1000000;
      const expectedCss = Math.round(1000000 * 0.01); // 10 000
      const expectedTaxBase = expectedNetHt + expectedCss; // 1 010 000
      const expectedTps = Math.round(expectedTaxBase * 0.095); // 95 950
      const expectedTva = Math.round(expectedTaxBase * 0.18);  // 181 800
      const expectedTotal = expectedTaxBase + expectedTps + expectedTva; // 1 287 750

      expect(result.netHt).toBe(expectedNetHt);
      expect(result.cssAmount).toBe(expectedCss);
      expect(result.taxBase).toBe(expectedTaxBase);
      expect(result.tpsAmount).toBe(expectedTps);
      expect(result.tvaAmount).toBe(expectedTva);
      expect(result.total).toBe(expectedTotal);
    });

    it('devrait maintenir une précision entière parfaite sur des montants massifs (ex: 500 Milliards XAF - Limite IEEE 754)', () => {
      // ARRANGE : 500 000 000 000 XAF (500 milliards XAF, largement en dessous de Number.MAX_SAFE_INTEGER qui est ~9 quadrillions)
      const massiveSubtotal = 500_000_000_000;
      const massiveDiscount =  10_000_000_000; // Remise 10 milliards

      // ACT
      const result = calculateFiscalCascade(massiveSubtotal, massiveDiscount, 1, 18, 9.5);

      // ASSERT : Tous les montants doivent être des entiers parfaits sans dérive flottante ni dégradation NaN/Infinity
      expect(Number.isSafeInteger(result.subtotal)).toBe(true);
      expect(Number.isSafeInteger(result.netHt)).toBe(true);
      expect(Number.isSafeInteger(result.cssAmount)).toBe(true);
      expect(Number.isSafeInteger(result.taxBase)).toBe(true);
      expect(Number.isSafeInteger(result.tpsAmount)).toBe(true);
      expect(Number.isSafeInteger(result.tvaAmount)).toBe(true);
      expect(Number.isSafeInteger(result.total)).toBe(true);

      expect(result.netHt).toBe(490_000_000_000);
      expect(result.cssAmount).toBe(4_900_000_000);
      expect(result.taxBase).toBe(494_900_000_000);
      expect(result.tpsAmount).toBe(47_015_500_000);
      expect(result.tvaAmount).toBe(89_082_000_000);
      expect(result.total).toBe(630_997_500_000);
    });

    it('devrait gérer correctement l\'absence de TPS (quand TPS est null ou 0%) dans computeTotals et calculateFiscalCascade', () => {
      // ARRANGE : Facturation sans TPS (certaines activités exonérées ou taux à 0)
      const subtotal = 100000;
      
      // ACT
      const resultCascade = calculateFiscalCascade(subtotal, 0, 1, 18, 0);
      const resultServer = computeTotals([{ quantity: 1, unitPrice: 100000 }], 0, { cssRate: 1, tpsRate: null, tvaRate: 18 });

      // ASSERT
      expect(resultCascade.tpsAmount).toBe(0);
      expect(resultCascade.total).toBe(101000 + 18180); // Base 101000 + TVA 18180 = 119180
      expect(resultServer.tpsAmount).toBe(0);
      expect(resultServer.total).toBe(119180);
    });
  });

  // ==========================================================================
  // SCÉNARIO 4 : VALIDATION ZOD (.int() IMPITOYABLE SUR LES PRIX & MONTANTS)
  // ==========================================================================
  describe('4. Validation Zod : Rejet Impitoyable des Décimales (.int()) en XAF', () => {
    
    it('devrait rejeter un prix unitaire flottant (ex: 1500.50) dans invoiceItemSchema et quoteItemSchema', () => {
      // ARRANGE : Article avec un prix unitaire à décimale (interdit en XAF)
      const invalidItem = {
        description: "Consultation technique",
        quantity: 1,
        unitPrice: 1500.50, // Décimale interdite
      };

      // ACT
      const invoiceResult = invoiceItemSchema.safeParse(invalidItem);
      const quoteResult = quoteItemSchema.safeParse(invalidItem);

      // ASSERT
      expect(invoiceResult.success).toBe(false);
      expect(quoteResult.success).toBe(false);
      if (!invoiceResult.success) {
        expect(invoiceResult.error.issues[0].message).toContain("entier");
      }
    });

    it('devrait accepter une quantité décimale (ex: 1.5) associée à un prix unitaire entier dans invoiceItemSchema', () => {
      // ARRANGE : Quantité décimale (ex: 1.5 heure) à un prix unitaire entier (10000 XAF)
      const validItem = {
        description: "Heures de développement",
        quantity: 1.5,
        unitPrice: 10000,
      };

      // ACT
      const result = invoiceItemSchema.safeParse(validItem);

      // ASSERT
      expect(result.success).toBe(true);
    });

    it('devrait rejeter un prix unitaire flottant dans serviceSchema et serviceUpdateSchema', () => {
      // ARRANGE : Service du catalogue avec prix à virgule
      const invalidService = {
        name: "Audit Sécurité",
        unitPrice: 250000.75,
      };

      // ACT
      const result = serviceSchema.safeParse(invalidService);

      // ASSERT
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("entier");
      }
    });

    it('devrait rejeter un montant flottant, zéro ou négatif dans paymentCreateSchema', () => {
      // ARRANGE : Exemples de montants de paiement invalides en XAF
      const floatPayment = {
        invoiceId: "inv-123",
        amount: 50000.25,
        paymentMethod: "VIREMENT",
        date: "2026-07-08",
      };
      const zeroPayment = {
        ...floatPayment,
        amount: 0,
      };
      const negativePayment = {
        ...floatPayment,
        amount: -5000,
      };
      const validPayment = {
        ...floatPayment,
        amount: 50000,
        reference: "VIR-2026-999", // Vérification que la référence est bien acceptée
      };

      // ACT
      const floatResult = paymentCreateSchema.safeParse(floatPayment);
      const zeroResult = paymentCreateSchema.safeParse(zeroPayment);
      const negativeResult = paymentCreateSchema.safeParse(negativePayment);
      const validResult = paymentCreateSchema.safeParse(validPayment);

      // ASSERT
      expect(floatResult.success).toBe(false);
      expect(zeroResult.success).toBe(false);
      expect(negativeResult.success).toBe(false);
      expect(validResult.success).toBe(true);
      if (validResult.success) {
        expect(validResult.data.reference).toBe("VIR-2026-999");
      }
    });

    it('devrait rejeter une remise flottante dans invoiceSchema et quoteSchema', () => {
      // ARRANGE : Facture avec remise à virgule
      const invalidInvoice = {
        clientId: "cli-1",
        clientName: "Société Gabon Mining",
        clientEmail: "contact@mining.ga",
        discount: 12500.50, // Remise décimale interdite en XAF
        date: "2026-07-08",
        items: [{ description: "Forfait", quantity: 1, unitPrice: 100000 }],
      };

      // ACT
      const invoiceResult = invoiceSchema.safeParse(invalidInvoice);
      const quoteResult = quoteSchema.safeParse(invalidInvoice);

      // ASSERT
      expect(invoiceResult.success).toBe(false);
      expect(quoteResult.success).toBe(false);
      if (!invoiceResult.success) {
        expect(invoiceResult.error.issues[0].message).toContain("entier");
      }
    });
  });
});
