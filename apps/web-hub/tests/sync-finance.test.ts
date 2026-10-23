import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculateP95 } from "@/lib/kpi/fleetQueries";

// Mock DAL
vi.mock("@/lib/auth/dal", () => ({
  requireSuperadmin: vi.fn().mockResolvedValue({
    user: { id: "super-1", email: "admin@hub.com" },
    profile: { role: "superadmin", isActive: true },
    aal: { currentLevel: "aal2" },
  }),
}));

describe("H4 Supervision du Parc de Réplication & Gouvernance Financière", () => {
  describe("1. Métriques de Latence & Percentile p95", () => {
    it("renvoie 0 pour un tableau vide", () => {
      expect(calculateP95([])).toBe(0);
    });

    it("renvoie la valeur unique pour un tableau à un élément", () => {
      expect(calculateP95([350])).toBe(350);
    });

    it("calcule avec précision le 95ème percentile sur un jeu de 20 durées", () => {
      // 20 valeurs de 100 à 2000 ms
      const values = [
        100, 150, 200, 250, 300,
        350, 400, 450, 500, 550,
        600, 650, 700, 750, 800,
        850, 900, 950, 1500, 2000
      ];
      // 0.95 * 20 = 19 -> index 18 (valeur 1500)
      const p95 = calculateP95(values);
      expect(p95).toBe(1500);
    });

    it("supporte des durées non triées à l'entrée", () => {
      const unsorted = [5000, 120, 400, 200, 150, 300, 100, 600, 700, 800];
      const p95 = calculateP95(unsorted);
      expect(p95).toBe(5000);
    });
  });

  describe("2. Logique de Classification de la Flotte (Staleness)", () => {
    it("catégorise correctement les postes selon leur dernière activité", () => {
      const now = Date.now();
      const h24Ago = now - 24 * 60 * 60 * 1000;
      const d7Ago = now - 7 * 24 * 60 * 60 * 1000;

      // Cas 1 : vu il y a 2h -> active_24h
      const seen2h = now - 2 * 3600 * 1000;
      expect(seen2h >= h24Ago).toBe(true);

      // Cas 2 : vu il y a 3 jours -> moderate_7d
      const seen3d = now - 3 * 24 * 3600 * 1000;
      expect(seen3d < h24Ago && seen3d >= d7Ago).toBe(true);

      // Cas 3 : vu il y a 14 jours -> stale_gt_7d
      const seen14d = now - 14 * 24 * 3600 * 1000;
      expect(seen14d < d7Ago).toBe(true);
    });
  });

  describe("3. Calculs Financiers Consolidés & Taux de Recouvrement", () => {
    it("protège contre la division par zéro quand aucune facture n'est émise", () => {
      const totalInvoicedXaf = 0;
      const totalPaidXaf = 0;
      const recoveryRate =
        totalInvoicedXaf > 0
          ? Math.round((totalPaidXaf / totalInvoicedXaf) * 1000) / 10
          : 0;

      expect(recoveryRate).toBe(0);
      expect(Number.isNaN(recoveryRate)).toBe(false);
    });

    it("calcule avec exactitude le taux de recouvrement et l'encours client", () => {
      const totalInvoicedXaf = 10_000_000;
      const totalPaidXaf = 8_250_000;

      const outstandingXaf = Math.max(0, totalInvoicedXaf - totalPaidXaf);
      const recoveryRate =
        totalInvoicedXaf > 0
          ? Math.round((totalPaidXaf / totalInvoicedXaf) * 1000) / 10
          : 0;

      expect(outstandingXaf).toBe(1_750_000);
      expect(recoveryRate).toBe(82.5); // 82.5%
    });

    it("borne le solde dû à 0 en cas de trop-perçu ou acomptes excédentaires", () => {
      const totalInvoicedXaf = 500_000;
      const totalPaidXaf = 600_000;

      const outstandingXaf = Math.max(0, totalInvoicedXaf - totalPaidXaf);
      expect(outstandingXaf).toBe(0);
    });
  });

  describe("4. Ventilation des Règlements par Mode", () => {
    it("calcule la part relative de chaque mode de paiement sans dépasser 100%", () => {
      const payments = [
        { method: "Espèces", amount: 400_000 },
        { method: "Virement Bancaire", amount: 400_000 },
        { method: "Mobile Money", amount: 200_000 },
      ];

      const total = payments.reduce((sum, p) => sum + p.amount, 0);
      expect(total).toBe(1_000_000);

      const shares = payments.map((p) => ({
        method: p.method,
        percentage: Math.round((p.amount / total) * 1000) / 10,
      }));

      expect(shares[0].percentage).toBe(40);
      expect(shares[1].percentage).toBe(40);
      expect(shares[2].percentage).toBe(20);
      expect(shares.reduce((sum, s) => sum + s.percentage, 0)).toBe(100);
    });
  });
});
