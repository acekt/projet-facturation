import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Sprint A UI Wiring Tests', () => {
  it('should have CreationSuccessModal in clients.tsx', () => {
    const content = fs.readFileSync(path.resolve(__dirname, '../../components/pages/clients.tsx'), 'utf8');
    expect(content).toContain('CreationSuccessModal');
    expect(content).toContain('setSuccessModalData');
  });

  it('should have CreationSuccessModal in services.tsx', () => {
    const content = fs.readFileSync(path.resolve(__dirname, '../../components/pages/services.tsx'), 'utf8');
    expect(content).toContain('CreationSuccessModal');
    expect(content).toContain('setSuccessModalData');
  });

  it('should have CreationSuccessModal in invoice-editor.tsx', () => {
    const content = fs.readFileSync(path.resolve(__dirname, '../../components/pages/invoice-editor.tsx'), 'utf8');
    expect(content).toContain('CreationSuccessModal');
    expect(content).toContain('setSuccessModalData');
  });

  it('should have CreationSuccessModal in quote-editor.tsx', () => {
    const content = fs.readFileSync(path.resolve(__dirname, '../../components/pages/quote-editor.tsx'), 'utf8');
    expect(content).toContain('CreationSuccessModal');
    expect(content).toContain('setSuccessModalData');
  });

  it('should have CreationSuccessModal in user-editor.tsx', () => {
    const content = fs.readFileSync(path.resolve(__dirname, '../../components/pages/user-editor.tsx'), 'utf8');
    expect(content).toContain('CreationSuccessModal');
    expect(content).toContain('setSuccessModalData');
  });

  it('should have + Nouveau client in DocumentCommercialHeader.tsx', () => {
    const content = fs.readFileSync(path.resolve(__dirname, '../../components/editor/DocumentCommercialHeader.tsx'), 'utf8');
    expect(content).toContain('+ Nouveau');
    expect(content).toContain('setIsClientFormOpen(true)');
    expect(content).toContain('ClientFormDialog');
  });

  it('should have + Nouveau service in EditorItemsTable.tsx', () => {
    const content = fs.readFileSync(path.resolve(__dirname, '../../components/editor/EditorItemsTable.tsx'), 'utf8');
    expect(content).toContain('+ Nouveau');
    expect(content).toContain('setIsServiceFormOpen(true)');
    expect(content).toContain('ServiceFormDialog');
  });

  it('should have getClientPaymentHistory and payments tab in ClientDetailsDialog.tsx', () => {
    const content = fs.readFileSync(path.resolve(__dirname, '../../components/pages/clients/ClientDetailsDialog.tsx'), 'utf8');
    expect(content).toContain('getClientPaymentHistory');
    expect(content).toContain('TabsTrigger value="payments"');
  });

  it('should have progress and acompte history in PaymentDialog.tsx', () => {
    const content = fs.readFileSync(path.resolve(__dirname, '../../components/pages/invoices/PaymentDialog.tsx'), 'utf8');
    expect(content).toContain('Historique des acomptes');
    expect(content).toContain('Progress');
  });

  it('should exclude EXPIRED in navigation.tsx', () => {
    const content = fs.readFileSync(path.resolve(__dirname, '../../components/layout/navigation.tsx'), 'utf8');
    expect(content).toContain('EXPIRED');
  });
});
