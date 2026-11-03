import { describe, it, expect, vi } from 'vitest';
import { ShareService } from '../../lib/services/ShareService';
import fs from 'fs';
import path from 'path';

describe('ShareService', () => {
  describe('normalizePhoneForWhatsApp', () => {
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
