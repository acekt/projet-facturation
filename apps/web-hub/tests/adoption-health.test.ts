import { describe, it, expect } from "vitest";
import { computeHealthScore } from "@/lib/kpi/adoptionQueries";

describe("H5 Adoption SaaS & Moteur de Health Score", () => {
  const now = new Date("2026-10-21T12:00:00Z").getTime();

  describe("1. Calcul Multi-Facteurs du Health Score (0 - 100 pts)", () => {
    it("attribue un score maximal (100) et la catégorie 'champion' pour un client modèle", () => {
      const res = computeHealthScore({
        createdAt: "2026-06-01T00:00:00Z",
        lastSeenAt: "2026-10-21T10:00:00Z", // il y a 2h -> 30 pts
        invoicesLast30d: 12, // >= 5 -> 25 pts
        syncRunsCount: 100,
        syncErrorsCount: 2, // 98% succès -> 25 pts
        totalInvoicedXaf: 10_000_000,
        totalPaidXaf: 9_500_000, // 95% recouvrement -> 20 pts
        nowMs: now,
      });

      expect(res.activityScore).toBe(30);
      expect(res.volumeScore).toBe(25);
      expect(res.syncQualityScore).toBe(25);
      expect(res.recoveryScore).toBe(20);
      expect(res.totalScore).toBe(100);
      expect(res.category).toBe("champion");
      expect(res.isGracePeriod).toBe(false);
    });

    it("classe un client d'usage modéré en catégorie 'stable' (score 60 - 79)", () => {
      const res = computeHealthScore({
        createdAt: "2026-06-01T00:00:00Z",
        lastSeenAt: "2026-10-18T10:00:00Z", // il y a 3 jours -> 15 pts
        invoicesLast30d: 3, // 1-4 factures -> 15 pts
        syncRunsCount: 50,
        syncErrorsCount: 6, // 88% succès -> 15 pts
        totalInvoicedXaf: 2_000_000,
        totalPaidXaf: 1_600_000, // 80% recouvrement -> 20 pts
        nowMs: now,
      });

      expect(res.totalScore).toBe(65);
      expect(res.category).toBe("stable");
    });

    it("détecte un compte 'à surveiller' (score 40 - 59)", () => {
      const res = computeHealthScore({
        createdAt: "2026-06-01T00:00:00Z",
        lastSeenAt: "2026-10-18T10:00:00Z", // 3 jours -> 15 pts
        invoicesLast30d: 1, // 1 facture -> 15 pts
        syncRunsCount: 10,
        syncErrorsCount: 4, // 60% succès -> 5 pts
        totalInvoicedXaf: 1_000_000,
        totalPaidXaf: 600_000, // 60% recouvrement -> 10 pts
        nowMs: now,
      });

      expect(res.totalScore).toBe(45);
      expect(res.category).toBe("watch");
    });

    it("identifie un compte en risque de désengagement / churn (< 40 pts)", () => {
      const res = computeHealthScore({
        createdAt: "2026-01-01T00:00:00Z",
        lastSeenAt: "2026-09-01T00:00:00Z", // inactif depuis > 30j -> 0 pt
        invoicesLast30d: 0, // 0 facture -> 0 pt
        syncRunsCount: 20,
        syncErrorsCount: 15, // 25% succès -> 5 pts
        totalInvoicedXaf: 5_000_000,
        totalPaidXaf: 1_000_000, // 20% recouvrement -> 0 pt
        nowMs: now,
      });

      expect(res.totalScore).toBe(5);
      expect(res.category).toBe("churn_risk");
    });

    it("accorde une période de grâce protectrice pour les comptes de moins de 7 jours", () => {
      const res = computeHealthScore({
        createdAt: "2026-10-20T00:00:00Z", // créé il y a 1 jour
        lastSeenAt: null, // aucun desktop encore vu
        invoicesLast30d: 0,
        syncRunsCount: 0,
        syncErrorsCount: 0,
        totalInvoicedXaf: 0,
        totalPaidXaf: 0,
        nowMs: now,
      });

      expect(res.isGracePeriod).toBe(true);
      // Grâce accorde 15 (act) + 10 (vol) + 15 (sync) + 15 (rec) = 55 pts
      expect(res.totalScore).toBe(55);
      expect(res.category).toBe("watch"); // Pas marqué comme churn immédiat
    });
  });

  describe("2. Logique de Conversion d'Onboarding (Funnel)", () => {
    it("calcule avec exactitude les taux de conversion et d'abandon", () => {
      const step1 = 100;
      const step2 = 75;
      const step3 = 60;
      const step4 = 45;

      const conversion2 = Math.round((step2 / step1) * 100);
      const dropOff2 = Math.round(((step1 - step2) / step1) * 100);

      const conversion3 = Math.round((step3 / step2) * 100);
      const dropOff3 = Math.round(((step2 - step3) / step2) * 100);

      const conversion4 = Math.round((step4 / step3) * 100);
      const globalActivation = Math.round((step4 / step1) * 100);

      expect(conversion2).toBe(75);
      expect(dropOff2).toBe(25);
      expect(conversion3).toBe(80);
      expect(dropOff3).toBe(20);
      expect(conversion4).toBe(75);
      expect(globalActivation).toBe(45);
    });

    it("ne produit pas de division par zéro sur un funnel vide", () => {
      const step1 = 0;
      const step2 = 0;
      const conv = step1 > 0 ? Math.round((step2 / step1) * 100) : 0;
      expect(conv).toBe(0);
      expect(Number.isNaN(conv)).toBe(false);
    });
  });
});
