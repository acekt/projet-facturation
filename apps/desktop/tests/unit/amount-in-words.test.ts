import { describe, it, expect } from "vitest";
import { numberToWordsFR, amountInWordsFCFA } from "@/lib/utils/amount-in-words";

describe("numberToWordsFR & amountInWordsFCFA", () => {
  it("converts 0 correctly", () => {
    expect(numberToWordsFR(0)).toBe("zéro");
    expect(amountInWordsFCFA(0)).toBe("zéro Francs CFA");
  });

  it("converts units and teens correctly", () => {
    expect(numberToWordsFR(1)).toBe("un");
    expect(numberToWordsFR(5)).toBe("cinq");
    expect(numberToWordsFR(14)).toBe("quatorze");
    expect(numberToWordsFR(19)).toBe("dix-neuf");
  });

  it("converts tens with 'et un' and hyphens correctly", () => {
    expect(numberToWordsFR(20)).toBe("vingt");
    expect(numberToWordsFR(21)).toBe("vingt et un");
    expect(numberToWordsFR(25)).toBe("vingt-cinq");
    expect(numberToWordsFR(31)).toBe("trente et un");
    expect(numberToWordsFR(61)).toBe("soixante et un");
    expect(numberToWordsFR(70)).toBe("soixante-dix");
    expect(numberToWordsFR(71)).toBe("soixante et onze");
    expect(numberToWordsFR(75)).toBe("soixante-quinze");
    expect(numberToWordsFR(80)).toBe("quatre-vingts");
    expect(numberToWordsFR(81)).toBe("quatre-vingt-un");
    expect(numberToWordsFR(90)).toBe("quatre-vingt-dix");
    expect(numberToWordsFR(91)).toBe("quatre-vingt-onze");
    expect(numberToWordsFR(99)).toBe("quatre-vingt-dix-neuf");
  });

  it("converts hundreds and accords correctly", () => {
    expect(numberToWordsFR(100)).toBe("cent");
    expect(numberToWordsFR(105)).toBe("cent cinq");
    expect(numberToWordsFR(200)).toBe("deux cents");
    expect(numberToWordsFR(201)).toBe("deux cent un");
    expect(numberToWordsFR(380)).toBe("trois cent quatre-vingts");
    expect(numberToWordsFR(385)).toBe("trois cent quatre-vingt-cinq");
  });

  it("converts thousands with invariability of mille", () => {
    expect(numberToWordsFR(1000)).toBe("mille");
    expect(numberToWordsFR(2000)).toBe("deux mille");
    expect(numberToWordsFR(2026)).toBe("deux mille vingt-six");
  });

  it("converts realistic invoice amounts from Gabon seed data", () => {
    // 714 000
    expect(amountInWordsFCFA(714000)).toBe("sept cent quatorze mille Francs CFA");
    // 1 487 500
    expect(amountInWordsFCFA(1487500)).toBe(
      "un million quatre cent quatre-vingt-sept mille cinq cents Francs CFA"
    );
    // 2 023 000
    expect(amountInWordsFCFA(2023000)).toBe("deux millions vingt-trois mille Francs CFA");
    // 2 380 000
    expect(amountInWordsFCFA(2380000)).toBe(
      "deux millions trois cent quatre-vingts mille Francs CFA"
    );
  });
});

