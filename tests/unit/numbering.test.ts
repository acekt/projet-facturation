import { describe, it, expect } from 'vitest'
import { formatDocNumber } from '../../lib/fiscal'

describe('Document Numbering - Gabon Norms', () => {
  it('should format numbers with 3 digits and company code', () => {
    expect(formatDocNumber(1, 'GM', 2026)).toBe('001/GM/2026');
  });
});
