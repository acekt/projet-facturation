import { describe, it, expect } from 'vitest';
import { formatDocNumber as formatDocNumberFiscal } from '../../lib/fiscal';
import { formatDocNumber } from '@/lib/api/numbering';

describe('Document Numbering - Gabon Norms', () => {
  it('should format numbers with 3 digits and company code in fiscal engine', () => {
    expect(formatDocNumberFiscal(1, 'GM', 2026)).toBe('001/GM/2026');
    expect(formatDocNumberFiscal('FAC', 1, 'GM', 2026)).toBe('FAC-001/GM/2026');
  });

  it('should format document numbers according to Gabonese standards (ADR-0018)', () => {
    expect(formatDocNumber('DEV', 'GM', 2026, 1)).toBe('DEV-001/GM/2026');
    expect(formatDocNumber('FAC', 'GM', 2026, 42)).toBe('FAC-042/GM/2026');
    expect(formatDocNumber('AV', 'GAB', 2026, 100)).toBe('AV-100/GAB/2026');
  });

  it('should support device prefix for multi-caisses according to ADR-0036', () => {
    expect(formatDocNumber('FAC', 'GM', 2026, 1, 'P1')).toBe('FAC-P1-001/GM/2026');
    expect(formatDocNumber('DEV', 'GM', 2026, 5, 'POS2')).toBe('DEV-POS2-005/GM/2026');
  });

  it('should default to GAB when companyCode is empty or null', () => {
    expect(formatDocNumber('FAC', null, 2026, 1)).toBe('FAC-001/GAB/2026');
    expect(formatDocNumber('FAC', '', 2026, 1)).toBe('FAC-001/GAB/2026');
  });
});
