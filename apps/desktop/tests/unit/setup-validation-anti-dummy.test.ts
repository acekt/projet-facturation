import { describe, it, expect } from 'vitest';
import {
  isValidGabonNif,
  isValidGabonRccm,
  isValidIban,
} from '@/app/setup/hooks/useSetupWizard';

describe('J7 Anti-Dummy Validation Tests (P7)', () => {
  describe('NIF Validation', () => {
    it('should accept empty string as optional', () => {
      expect(isValidGabonNif('')).toBe(true);
      expect(isValidGabonNif('   ')).toBe(true);
    });

    it('should accept valid Gabon NIF formats', () => {
      expect(isValidGabonNif('1234567A')).toBe(true);
      expect(isValidGabonNif('0123456X')).toBe(true);
      expect(isValidGabonNif('849201K')).toBe(true);
    });

    it('should reject dummy and placeholder values', () => {
      expect(isValidGabonNif('TODO')).toBe(false);
      expect(isValidGabonNif('N/A')).toBe(false);
      expect(isValidGabonNif('NA')).toBe(false);
      expect(isValidGabonNif('TEST')).toBe(false);
      expect(isValidGabonNif('DUMMY')).toBe(false);
      expect(isValidGabonNif('00000000')).toBe(false);
      expect(isValidGabonNif('12345678')).toBe(false);
      expect(isValidGabonNif('NIF-123456')).toBe(false);
      expect(isValidGabonNif('EXEMPLE')).toBe(false);
    });
  });

  describe('RCCM Validation', () => {
    it('should accept empty string as optional', () => {
      expect(isValidGabonRccm('')).toBe(true);
      expect(isValidGabonRccm('   ')).toBe(true);
    });

    it('should accept valid RCCM formats', () => {
      expect(isValidGabonRccm('GA-LBV-2026-B12')).toBe(true);
      expect(isValidGabonRccm('RG/LBV/2026/B/1234')).toBe(true);
      expect(isValidGabonRccm('2026B12345')).toBe(true);
    });

    it('should reject dummy and placeholder values', () => {
      expect(isValidGabonRccm('TODO')).toBe(false);
      expect(isValidGabonRccm('N/A')).toBe(false);
      expect(isValidGabonRccm('NA')).toBe(false);
      expect(isValidGabonRccm('TEST')).toBe(false);
      expect(isValidGabonRccm('DUMMY')).toBe(false);
      expect(isValidGabonRccm('0000')).toBe(false);
      expect(isValidGabonRccm('RCCM-1234')).toBe(false);
      expect(isValidGabonRccm('EXEMPLE')).toBe(false);
    });
  });

  describe('IBAN Validation', () => {
    it('should accept empty string as optional', () => {
      expect(isValidIban('')).toBe(true);
      expect(isValidIban('   ')).toBe(true);
    });

    it('should accept valid Gabon IBAN formats', () => {
      // Gabon format: GA21 4000 1020 0012 3456 7890 125 (27 chars)
      expect(isValidIban('GA2140001020001234567890125')).toBe(true);
      expect(isValidIban('GA21 4000 1020 0012 3456 7890 125')).toBe(true);
      expect(isValidIban('FR7630006000011234567890189')).toBe(true);
    });

    it('should reject dummy and placeholder values', () => {
      expect(isValidIban('TODO')).toBe(false);
      expect(isValidIban('N/A')).toBe(false);
      expect(isValidIban('NA')).toBe(false);
      expect(isValidIban('TEST')).toBe(false);
      expect(isValidIban('DUMMY')).toBe(false);
      expect(isValidIban('123456789')).toBe(false);
      expect(isValidIban('1234')).toBe(false);
    });
  });
});
