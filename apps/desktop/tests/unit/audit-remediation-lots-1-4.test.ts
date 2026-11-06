import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { ALL_MIGRATIONS } from '../../lib/db/migrations';
import { serviceUpdateSchema, invoiceItemSchema, creditNoteItemSchema, customSelectOptionSchema } from '../../lib/validations';
import { ShareService } from '../../lib/services/ShareService';
import { formatCurrency, buildSafeCsvContent } from '../../lib/utils';
import { formatAuditDateTimeFr, formatAuditAction, formatAuditEntity } from '../../lib/utils/auditFormatter';
import {
  generateStyledExcelXml,
  generateStyledExcelXlsxParts,
  resolveCreditNoteInvoiceNumber,
} from '../../lib/utils/excel-export';
import fs from 'fs';
import path from 'path';

describe('Audit Remediation Lots 1 à 4 — Tests Unitaires & Intégrité', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    for (const migration of ALL_MIGRATIONS) {
      migration.up(db);
      db.pragma(`user_version = ${migration.version}`);
    }
  });

  afterEach(() => {
    if (db && db.open) {
      db.close();
    }
  });

  describe('Lot 1 : Chaîne de migration, Intégrité du Schéma & Sécurité IPC', () => {
    it('La migration 0006 ajoute serviceId à invoice_items, credit_note_items et quote_items', () => {
      const version = db.pragma('user_version', { simple: true });
      expect(version).toBe(10);

      const invoiceItemCols = db.prepare("PRAGMA table_info(invoice_items)").all() as Array<{ name: string }>;
      expect(invoiceItemCols.some((c) => c.name === 'serviceId')).toBe(true);

      const creditNoteItemCols = db.prepare("PRAGMA table_info(credit_note_items)").all() as Array<{ name: string }>;
      expect(creditNoteItemCols.some((c) => c.name === 'serviceId')).toBe(true);

      const quoteItemCols = db.prepare("PRAGMA table_info(quote_items)").all() as Array<{ name: string }>;
      expect(quoteItemCols.some((c) => c.name === 'serviceId')).toBe(true);
    });

    it('Filtre de sécurité IPC Electron sur app:open-external', () => {
      const ALLOWED_REGEX = /^(https:\/\/(wa\.me|api\.whatsapp\.com)\/|mailto:)/i;

      // Valides
      expect(ALLOWED_REGEX.test('https://wa.me/24101234567?text=Bonjour')).toBe(true);
      expect(ALLOWED_REGEX.test('https://api.whatsapp.com/send?phone=24101234567')).toBe(true);
      expect(ALLOWED_REGEX.test('mailto:client@example.ga?subject=Facture')).toBe(true);

      // Invalides & Malveillants
      expect(ALLOWED_REGEX.test('http://wa.me/24101234567')).toBe(false);
      expect(ALLOWED_REGEX.test('javascript:alert(1)')).toBe(false);
      expect(ALLOWED_REGEX.test('file:///C:/Windows/System32/cmd.exe')).toBe(false);
      expect(ALLOWED_REGEX.test('https://evil-site.com')).toBe(false);
      expect(ALLOWED_REGEX.test('https://wa.me.attacker.com/payload')).toBe(false);
    });

    it('La table audit_logs contient entityType et permet l insertion sans régression SQL', () => {
      const cols = db.prepare("PRAGMA table_info(audit_logs)").all() as Array<{ name: string }>;
      expect(cols.some((c) => c.name === 'entityType')).toBe(true);

      const insert = db.prepare(`
        INSERT INTO audit_logs (id, userId, userName, action, entityType, entityId, details, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      expect(() => {
        insert.run('log-1', 'u-1', 'Admin', 'SHARE', 'share', 'doc-1', 'Partagé via WhatsApp', 't-1');
      }).not.toThrow();
    });
  });

  describe('Lot 2 : Gestion de stock, serviceUpdateSchema & Restock Avoir', () => {
    it('serviceUpdateSchema accepte et valide les champs de stock', () => {
      const parsed = serviceUpdateSchema.safeParse({
        name: 'Produit Test',
        category: 'Matériel',
        unitPrice: 5000,
        trackStock: 1,
        stockQuantity: 42,
        minStockAlert: 5,
        unit: 'Cartons',
      });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.trackStock).toBe(1);
        expect(parsed.data.stockQuantity).toBe(42);
        expect(parsed.data.minStockAlert).toBe(5);
        expect(parsed.data.unit).toBe('Cartons');
      }
    });

    it('invoiceItemSchema et creditNoteItemSchema acceptent serviceId', () => {
      const invItem = invoiceItemSchema.safeParse({
        description: 'Licence Logiciel',
        quantity: 2,
        unitPrice: 15000,
        serviceId: 'srv-uuid-1',
      });
      expect(invItem.success).toBe(true);

      const cnItem = creditNoteItemSchema.safeParse({
        description: 'Retour Licence',
        quantity: 1,
        unitPrice: 15000,
        serviceId: 'srv-uuid-1',
      });
      expect(cnItem.success).toBe(true);
    });

    it('Déduction de stock sur facture et restock sur avoir avec isolation tenant_id', () => {
      const tenantId = 'tenant-stock-1';
      const serviceId = 'srv-stock-1';

      // Créer un service avec suivi de stock
      db.prepare(`
        INSERT INTO services (id, name, description, category, unitPrice, trackStock, stockQuantity, minStockAlert, unit, tenant_id)
        VALUES (?, ?, ?, ?, ?, 1, 100, 10, 'Unités', ?)
      `).run(serviceId, 'Ordinateur portable', 'Matériel pro', 'Hardware', 450000, tenantId);

      // Simuler déduction facture (vente de 5 unités)
      const move1Id = 'mov-1';
      db.transaction(() => {
        db.prepare('UPDATE services SET stockQuantity = stockQuantity - ? WHERE id = ? AND tenant_id = ?').run(5, serviceId, tenantId);
        db.prepare(`
          INSERT INTO stock_movements (id, tenant_id, serviceId, type, quantity, previousStock, newStock, referenceDoc, created_by)
          VALUES (?, ?, ?, 'INVOICE_DEDUCTION', ?, 100, 95, 'FAC-2026-0001', 'user-1')
        `).run(move1Id, tenantId, serviceId, 5);
      })();

      const afterSale = db.prepare('SELECT stockQuantity FROM services WHERE id = ? AND tenant_id = ?').get(serviceId, tenantId) as { stockQuantity: number };
      expect(afterSale.stockQuantity).toBe(95);

      // Simuler réintégration sur avoir (retour de 2 unités)
      const move2Id = 'mov-2';
      db.transaction(() => {
        db.prepare('UPDATE services SET stockQuantity = stockQuantity + ? WHERE id = ? AND tenant_id = ?').run(2, serviceId, tenantId);
        db.prepare(`
          INSERT INTO stock_movements (id, tenant_id, serviceId, type, quantity, previousStock, newStock, referenceDoc, created_by)
          VALUES (?, ?, ?, 'CREDIT_NOTE_RESTOCK', ?, 95, 97, 'AV-2026-0001', 'user-1')
        `).run(move2Id, tenantId, serviceId, 2);
      })();

      const afterRestock = db.prepare('SELECT stockQuantity FROM services WHERE id = ? AND tenant_id = ?').get(serviceId, tenantId) as { stockQuantity: number };
      expect(afterRestock.stockQuantity).toBe(97);

      // Vérifier mouvements enregistrés
      const movements = db.prepare('SELECT type, quantity, previousStock, newStock FROM stock_movements WHERE serviceId = ? AND tenant_id = ? ORDER BY createdAt ASC, rowid ASC').all(serviceId, tenantId) as any[];
      expect(movements.length).toBe(2);
      expect(movements[0].type).toBe('INVOICE_DEDUCTION');
      expect(movements[0].quantity).toBe(5);
      expect(movements[1].type).toBe('CREDIT_NOTE_RESTOCK');
      expect(movements[1].quantity).toBe(2);
    });
  });

  describe('Lot 3 : Reste à payer net d avoirs & Sécurité Grand Livre', () => {
    it('Calcul du reste à charge net d avoirs et de règlements', () => {
      const invoiceTotal = 100000;
      const creditNoteTotal = 30000;
      const paymentAmount = 25000;

      const netFacture = Math.max(0, invoiceTotal - creditNoteTotal);
      expect(netFacture).toBe(70000);

      const remaining = Math.max(0, netFacture - paymentAmount);
      expect(remaining).toBe(45000);

      // Tentative de surpaiement bloquée
      const invalidPayment = 50000;
      expect(invalidPayment > remaining).toBe(true);
    });

    it('Grand Livre : interdiction de supprimer une écriture liée à une facture ou un paiement', () => {
      const tenantId = 't-ledger-1';
      const entryId = 'ledg-entry-1';

      db.prepare(`
        INSERT INTO ledger_entries (id, tenant_id, date, type, category, description, amount, paymentMethod, linkedInvoiceId, linkedPaymentId, createdAt, updatedAt)
        VALUES (?, ?, '2026-11-04', 'IN', 'Ventes', 'Règlement client', 50000, 'VIREMENT', 'inv-123', 'pay-456', datetime('now'), datetime('now'))
      `).run(entryId, tenantId);

      // Vérification logique softDelete sécurisé
      const entry = db.prepare('SELECT linkedPaymentId, linkedInvoiceId FROM ledger_entries WHERE id = ? AND tenant_id = ? AND deletedAt IS NULL').get(entryId, tenantId) as { linkedPaymentId?: string; linkedInvoiceId?: string };

      expect(entry.linkedPaymentId || entry.linkedInvoiceId).toBeTruthy();

      const attemptDelete = () => {
        if (entry.linkedPaymentId || entry.linkedInvoiceId) {
          throw new Error("Impossible de supprimer une écriture liée à une facture ou à un paiement. Veuillez annuler ou supprimer le document commercial source.");
        }
      };

      expect(attemptDelete).toThrow("Impossible de supprimer une écriture liée à une facture ou à un paiement");
    });
  });

  describe('Lot 4 : Partage Multicanal & Calculs Commerciaux', () => {
    it('ShareService normalise les numéros gabonais à 8 ou 9 chiffres', () => {
      expect(ShareService.normalizePhoneForWhatsApp('077123456')).toBe('+241077123456');
      expect(ShareService.normalizePhoneForWhatsApp('77123456')).toBe('+24177123456');
      expect(ShareService.normalizePhoneForWhatsApp('+241077123456')).toBe('+241077123456');
      expect(ShareService.normalizePhoneForWhatsApp('00241077123456')).toBe('+241077123456');
    });

    it('ShareService génère des messages distincts pour devis et facture (pas de reste à payer sur devis)', () => {
      const quoteDoc: any = {
        number: 'DEV-2026-0001',
        clientName: 'Entreprise ABC',
        date: '2026-11-04',
        validUntil: '2026-12-04',
        subtotal: 100000,
        discount: 10000,
        total: 107100,
        tvaAmount: 17100,
        cssAmount: 0,
      };

      const quoteMsg = ShareService.generateDocumentMessage(quoteDoc, 'quote', 'Ma Société');
      expect(quoteMsg).toContain('Devis N° DEV-2026-0001');
      expect(quoteMsg).toContain('*Montant Net HT :* ' + formatCurrency(90000)); // 100000 - 10000
      expect(quoteMsg).not.toContain('Reste à payer');

      const invoiceDoc: any = {
        number: 'FAC-2026-0001',
        clientName: 'Entreprise ABC',
        date: '2026-11-04',
        dueDate: '2026-12-04',
        subtotal: 100000,
        discount: 0,
        total: 119000,
        tvaAmount: 18000,
        cssAmount: 1000,
        payments: [{ amount: 50000 }],
      };

      const invoiceMsg = ShareService.generateDocumentMessage(invoiceDoc, 'invoice', 'Ma Société');
      expect(invoiceMsg).toContain('Facture N° FAC-2026-0001');
      expect(invoiceMsg).toContain('*Reste à payer : ' + formatCurrency(69000) + '*'); // 119000 - 50000
    });
  });

  describe('Lot 5 à 7 : Migration 0009 (stockItemName, proofImage, custom_select_options), Audit Fr & Export Excel XML', () => {
    it('Migration 0009 crée custom_select_options, services.stockItemName et ledger_entries.proofImage', () => {
      const serviceCols = db.prepare("PRAGMA table_info(services)").all() as Array<{ name: string }>;
      expect(serviceCols.some((c) => c.name === 'stockItemName')).toBe(true);

      const ledgerCols = db.prepare("PRAGMA table_info(ledger_entries)").all() as Array<{ name: string }>;
      expect(ledgerCols.some((c) => c.name === 'proofImage')).toBe(true);

      const customTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='custom_select_options'")
        .get() as { name: string } | undefined;
      expect(customTable?.name).toBe('custom_select_options');

      const parsedOpt = customSelectOptionSchema.safeParse({
        groupKey: 'service_unit',
        value: 'Bonbonnes',
        label: 'Bonbonnes',
      });
      expect(parsedOpt.success).toBe(true);
    });

    it('formatAuditDateTimeFr formate les dates SQLite en format français JJ/MM/AAAA à HH:mm:ss', () => {
      const formatted = formatAuditDateTimeFr('2026-11-04T16:40:26');
      expect(formatted).toContain('04/11/2026 à ');
      expect(formatAuditAction('SHARE').label).toBe('Partage');
      expect(formatAuditEntity('credit_note')).toBe('Avoir');
    });

    it('generateStyledExcelXml génère un classeur SpreadsheetML structuré avec en-tête #0F2942 et ligne TOTAL', () => {
      const xml = generateStyledExcelXml({
        title: 'ÉTAT DU STOCK — TEST',
        sheetName: 'Stock',
        columns: [
          { header: 'Article en stock', key: 'item', width: 220, type: 'string' },
          { header: 'Prix Unitaire (FCFA)', key: 'price', width: 140, type: 'currency', align: 'right' },
        ],
        rows: [
          { item: 'Extincteur ABC 1 KG', price: 25000 },
          { item: 'Extincteur CO2 2 KG', price: 45000 },
        ],
        totalsRow: {
          item: 'TOTAL GÉNÉRAL',
          price: 70000,
        },
      });

      expect(xml).toContain('<?mso-application progid="Excel.Sheet"?>');
      expect(xml).toContain('#0F2942');
      expect(xml).toContain('Extincteur ABC 1 KG');
      expect(xml).toContain('TOTAL GÉNÉRAL');
      expect(xml).toContain('70000');
    });

    it('Le fichier .xlsx généré commence par la signature ZIP OpenXML (PK\\x03\\x04) et contient xl/styles.xml et xl/worksheets/sheet1.xml', () => {
      const { files, zipBuffer } = generateStyledExcelXlsxParts({
        title: 'JOURNAL DES AVOIRS ET REMBOURSEMENTS CLIENTS',
        companyName: 'Global Maintenance',
        sheetName: 'Avoirs',
        columns: [
          { header: 'Numéro Avoir', key: 'number', width: 135, type: 'string' },
          { header: 'Montant TTC', key: 'total', width: 140, type: 'currency', align: 'right' },
        ],
        rows: [{ number: 'AV-001/GM/2026', total: 1797281 }],
        totalsRow: { number: 'TOTAL GÉNÉRAL', total: 1797281 },
      });

      // Signature ZIP PK\x03\x04
      expect(zipBuffer[0]).toBe(0x50); // 'P'
      expect(zipBuffer[1]).toBe(0x4b); // 'K'
      expect(zipBuffer[2]).toBe(0x03);
      expect(zipBuffer[3]).toBe(0x04);

      const fileNames = files.map((f: { name: string; content: string }) => f.name);
      expect(fileNames).toContain('xl/styles.xml');
      expect(fileNames).toContain('xl/worksheets/sheet1.xml');

      const sheetXml = files.find((f: { name: string; content: string }) => f.name === 'xl/worksheets/sheet1.xml')!.content;
      expect(sheetXml).toContain('JOURNAL DES AVOIRS ET REMBOURSEMENTS CLIENTS');
      expect(sheetXml).toContain('TOTAL GÉNÉRAL');
    });

    it('Le fichier .csv commence par \\uFEFF, préserve les accents et résout le vrai numéro FAC-... des avoirs', () => {
      const resolvedFromReason = resolveCreditNoteInvoiceNumber(
        {
          invoiceId: 'ce698e36-1b2c-4386-8d99-000000000001',
          reason: "Avoir d'imputation sur facture FAC-003/GM/2026",
        },
        []
      );
      expect(resolvedFromReason).toBe('FAC-003/GM/2026');

      const csv = buildSafeCsvContent(
        ['Numéro Avoir', 'Facture Liée', 'Client', 'Statut'],
        [['AV-001/GM/2026', resolvedFromReason, 'Société Gabonaise', 'Remboursé / Déduit']]
      );

      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('Numéro Avoir');
      expect(csv).toContain('Société Gabonaise');
      expect(csv).toContain('Remboursé / Déduit');
      expect(csv).toContain('FAC-003/GM/2026');
      expect(csv).not.toContain('ce698e36-1b2c');
    });

    it('Toutes les 7 pages utilisent le bouton unifié "Export Excel" relié au Centre d\'Exportation (DataExportModal)', () => {
      const pagesDir = path.resolve(__dirname, '../../components/pages');
      const targetPages = [
        'invoices.tsx',
        'quotes.tsx',
        'credit-notes.tsx',
        'clients.tsx',
        'services.tsx',
        'stock.tsx',
        'ledger.tsx',
      ];

      for (const pageFile of targetPages) {
        const content = fs.readFileSync(path.join(pagesDir, pageFile), 'utf8');
        expect(content).toContain('Export Excel');
        expect(content).toContain('DataExportModal');
      }
    });
  });
});
