import { describe, it, expect } from 'vitest';
import { settingsSchema } from '../../lib/validations';

describe('Settings Schema Validation', () => {
  const validSettings = {
    companyName: "Facturier Inc",
    legalForm: "SARL",
    nif: "123456789",
    rccm: "RC-123",
    address: "123 Rue de la Paix",
    email: "contact@facturier.com",
    phone: "+123456789",
    bankName: "Banque Centrale",
    bankAgency: "Paris",
    accountNumber: "000123",
    swiftCode: "SWIFT123",
    iban: "FR761234",
    tvaRate: 18,
    tpsRate: 9.5,
    cssRate: 1,
    sessionTimeout: 60,
    invoicePrefix: "FAC",
    quotePrefix: "DEV",
    companyCode: "GAB"
  };

  it('1. should pass with completely valid data', () => {
    const result = settingsSchema.safeParse(validSettings);
    expect(result.success).toBe(true);
  });

  it('2. should fail if required fields are missing or empty', () => {
    const result = settingsSchema.safeParse({ ...validSettings, companyName: "", legalForm: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.companyName).toContain("Le nom de l'entreprise est requis");
      expect(result.error.flatten().fieldErrors.legalForm).toContain("La forme juridique est requise");
    }
  });

  it('3. should fail if email format is invalid', () => {
    const result = settingsSchema.safeParse({ ...validSettings, email: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email).toContain("Adresse email invalide");
    }
  });

  it('4. should fail if string fields exceed maximum length', () => {
    const tooLongStr = "a".repeat(256);
    const result = settingsSchema.safeParse({ ...validSettings, phone: tooLongStr, nif: tooLongStr });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.phone).toContain("Le téléphone ne peut pas dépasser 255 caractères");
      expect(result.error.flatten().fieldErrors.nif).toContain("Le NIF ne peut pas dépasser 255 caractères");
    }
  });

  it('5. should fail if numerical rates are negative', () => {
    const result = settingsSchema.safeParse({ ...validSettings, tvaRate: -1, cssRate: -5 });
    expect(result.success).toBe(false);
  });

  it('6. should fail if sessionTimeout is less than 1', () => {
    const result = settingsSchema.safeParse({ ...validSettings, sessionTimeout: 0 });
    expect(result.success).toBe(false);
  });

  it('7. should pass if TPS is missing or null', () => {
    const { tpsRate, ...withoutTps } = validSettings;
    const result = settingsSchema.safeParse(withoutTps);
    expect(result.success).toBe(true);
  });

  it('8. should fail if logo exceeds 2MB', () => {
    const hugeLogo = "a".repeat((2 * 1024 * 1024) + 1);
    const result = settingsSchema.safeParse({ ...validSettings, logo: hugeLogo });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.logo).toContain("Le logo est trop volumineux (max 2 Mo encodé)");
    }
  });
});