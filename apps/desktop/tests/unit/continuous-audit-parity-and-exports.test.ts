import { describe, it, expect } from 'vitest';
import { resolveCreditNoteInvoiceNumber } from '../../lib/utils/excel-export';
import { buildSafeCsvContent } from '../../lib/utils';
import { A4FiscalSummary } from '../../components/features/document-a4/A4FiscalSummary';

describe('Data Consistency & Excel Export Parity', () => {
  it('resolves credit note invoice number from text correctly without relying on UUID', () => {
    const note = { invoiceId: 'inv_123', invoiceNumber: 'inv_123', reason: "Avoir d'imputation sur facture FAC-003/GM/2026" };
    expect(resolveCreditNoteInvoiceNumber(note, [], null)).toBe('FAC-003/GM/2026');
  });

  it('buildSafeCsvContent strips internal newlines and includes BOM', () => {
    const headers = ['Name', 'Desc'];
    const rows = [['Item 1', 'Line 1\nLine 2\r\nLine 3']];
    const csv = buildSafeCsvContent(headers, rows);

    expect(csv).toContain('\uFEFFsep=;\r\n');
    expect(csv).toContain('"Item 1";"Line 1 - Line 2 - Line 3"');
    expect(csv).not.toContain('Line 1\nLine 2');
  });

});
