import { describe, it, expect } from 'vitest';
import { ShareService } from '../../lib/services/ShareService';
import fs from 'fs';
import path from 'path';

describe('ShareService', () => {
  describe('normalizePhoneForWhatsApp & isValidWhatsAppPhone (Séparation stricte phone vs email)', () => {
    it('should strip spaces and dashes', () => {
      expect(ShareService.normalizePhoneForWhatsApp(' 077-12 34 56 ')).toBe('+241077123456');
    });

    it('should add +241 prefix for 8 digit local numbers', () => {
      expect(ShareService.normalizePhoneForWhatsApp('77123456')).toBe('+24177123456');
    });

    it('should add +241 prefix for 9 digit local numbers', () => {
      expect(ShareService.normalizePhoneForWhatsApp('077123456')).toBe('+241077123456');
    });

    it('should handle 00 prefix for international numbers', () => {
      expect(ShareService.normalizePhoneForWhatsApp('0033612345678')).toBe('+33612345678');
    });

    it('should leave international numbers with + intact', () => {
      expect(ShareService.normalizePhoneForWhatsApp('+33612345678')).toBe('+33612345678');
    });

    it('should strictly reject email addresses in phone normalization and validation', () => {
      expect(ShareService.normalizePhoneForWhatsApp('relations.entreprises@bgfi.com')).toBe('');
      expect(ShareService.normalizePhoneForWhatsApp('client12345678@domaine.ga')).toBe('');
      expect(ShareService.isValidWhatsAppPhone('relations.entreprises@bgfi.com')).toBe(false);
      expect(ShareService.isValidWhatsAppPhone('client12345678@domaine.ga')).toBe(false);
      expect(ShareService.isValidWhatsAppPhone('')).toBe(false);
      expect(ShareService.isValidWhatsAppPhone('+241')).toBe(false);
      expect(ShareService.isValidWhatsAppPhone('12345')).toBe(false);
      expect(ShareService.isValidWhatsAppPhone('+241 77 00 00 00')).toBe(true);
    });
  });

  describe('generateDocumentMessage (Formatage WhatsApp vs Email & Accord grammatical)', () => {
    const sampleInvoice: any = {
      id: 'inv-1',
      number: 'FAC-005/GM/2026',
      clientId: 'cli-1',
      clientName: 'BGFI Bank Gabon',
      date: '2026-11-04',
      dueDate: '2026-12-04',
      subtotal: 1000000,
      discount: 0,
      taxBase: 1000000,
      cssAmount: 10000,
      tpsAmount: 0,
      tvaAmount: 180000,
      total: 1190000,
      items: [],
      payments: [],
    };

    const sampleQuote: any = {
      id: 'quo-1',
      number: 'DEV-012/GM/2026',
      clientId: 'cli-1',
      clientName: 'BGFI Bank Gabon',
      date: '2026-11-04',
      validUntil: '2026-12-04',
      subtotal: 500000,
      discount: 0,
      taxBase: 500000,
      cssAmount: 5000,
      tpsAmount: 0,
      tvaAmount: 90000,
      total: 595000,
      items: [],
    };

    const sampleCreditNote: any = {
      id: 'cn-1',
      number: 'AV-001/GM/2026',
      invoiceId: 'inv-1',
      clientId: 'cli-1',
      clientName: 'BGFI Bank Gabon',
      date: '2026-11-04',
      subtotal: 200000,
      taxBase: 200000,
      cssAmount: 2000,
      tpsAmount: 0,
      tvaAmount: 36000,
      total: 238000,
      reason: 'Remise commerciale sur facture',
      items: [],
    };

    it('should use feminine agreement "Facture ... émise" and masculine "Devis ... émis" / "Avoir ... émis"', () => {
      const invMsg = ShareService.generateDocumentMessage(
        sampleInvoice,
        'invoice',
        'Global Maintenance',
        'email'
      );
      expect(invMsg).toContain('Voici votre Facture N° FAC-005/GM/2026 émise par Global Maintenance.');

      const quoMsg = ShareService.generateDocumentMessage(
        sampleQuote,
        'quote',
        'Global Maintenance',
        'email'
      );
      expect(quoMsg).toContain('Voici votre Devis N° DEV-012/GM/2026 émis par Global Maintenance.');

      const cnMsg = ShareService.generateDocumentMessage(
        sampleCreditNote,
        'credit_note',
        'Global Maintenance',
        'email'
      );
      expect(cnMsg).toContain('Voici votre Avoir N° AV-001/GM/2026 émis par Global Maintenance.');
    });

    it('should strip all asterisks (*) and underscores (_) when channel === "email"', () => {
      const emailMsg = ShareService.generateDocumentMessage(
        sampleInvoice,
        'invoice',
        'Global Maintenance',
        'email'
      );
      expect(emailMsg).not.toContain('*');
      expect(emailMsg).not.toContain('_');

      const whatsappMsg = ShareService.generateDocumentMessage(
        sampleInvoice,
        'invoice',
        'Global Maintenance',
        'whatsapp'
      );
      expect(whatsappMsg).toContain('*Client :*');
      expect(whatsappMsg).toContain('*Montant Total TTC :*');
    });

    it('should only display taxes whose amount is strictly greater than 0', () => {
      const msg = ShareService.generateDocumentMessage(
        sampleInvoice,
        'invoice',
        'Global Maintenance',
        'email'
      );
      expect(msg).toContain('CSS (1%) :');
      expect(msg).toContain('TVA (18%) :');
      expect(msg).not.toContain('TPS (9.5%)');
    });

    it('should generate a clean email subject with document number and company name', () => {
      const subject = ShareService.generateEmailSubject(
        sampleInvoice,
        'invoice',
        'Global Maintenance'
      );
      expect(subject).toBe('Facture N° FAC-005/GM/2026 — Global Maintenance');
    });
  });

  describe('generateWhatsAppLink', () => {
    it('should build correct wa.me link without +', () => {
      const link = ShareService.generateWhatsAppLink('077123456', 'Bonjour Test');
      expect(link).toBe('https://wa.me/241077123456?text=Bonjour%20Test');
    });
  });

  describe('Integration Verification', () => {
    it('should verify ShareDocumentModal exists and is integrated', () => {
      const modalPath = path.resolve(__dirname, '../../components/features/share/ShareDocumentModal.tsx');
      expect(fs.existsSync(modalPath)).toBe(true);

      const modalContent = fs.readFileSync(modalPath, 'utf8');
      expect(modalContent).toContain('const [phone, setPhone]');
      expect(modalContent).toContain('const [email, setEmail]');
      expect(modalContent).toContain('DocumentA4');

      const invoicesPath = path.resolve(__dirname, '../../components/pages/invoices/InvoiceViews.tsx');
      const invoicesContent = fs.readFileSync(invoicesPath, 'utf8');
      expect(invoicesContent).toContain('ShareDocumentModal');

      const quotesPath = path.resolve(__dirname, '../../components/pages/quotes/QuoteViews.tsx');
      const quotesContent = fs.readFileSync(quotesPath, 'utf8');
      expect(quotesContent).toContain('ShareDocumentModal');

      const fullscreenPath = path.resolve(__dirname, '../../components/fullscreen-document-viewer.tsx');
      const fullscreenContent = fs.readFileSync(fullscreenPath, 'utf8');
      expect(fullscreenContent).toContain('ShareDocumentModal');
    });
  });
});
