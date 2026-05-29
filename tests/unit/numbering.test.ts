import { describe, it, expect } from 'vitest'
import { formatDocNumber } from '../../lib/fiscal'

describe('Document Numbering - Gabon Norms', () => {
  it('should format numbers with 3 digits and company code', () => {
    expect(formatDocNumber(1, 'GM', 2026)).toBe('001/GM/2026');
  });

  it('should format large numbers exceeding 3 digits without truncating', () => {
    expect(formatDocNumber(12345, 'GM', 2026)).toBe('12345/GM/2026');
  });

  it('should handle zero sequence and pad it correctly', () => {
    expect(formatDocNumber(0, 'XYZ', 2027)).toBe('000/XYZ/2027');
  });
});
