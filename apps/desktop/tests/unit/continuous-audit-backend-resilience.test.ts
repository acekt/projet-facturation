import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InvoiceService } from '@/lib/services/InvoiceService';
import { CreditNoteService } from '@/lib/services/CreditNoteService';
import { PaymentRepository } from '@/lib/repositories/PaymentRepository';
import { StockRepository } from '@/lib/repositories/StockRepository';
import { LedgerRepository } from '@/lib/repositories/LedgerRepository';
import { updateInvoiceStatus } from '@/lib/api/invoice-logic';
import db from '@/lib/db';
import crypto from 'crypto';

describe('Audit Backend Resilience (DGI/OHADA Standards)', () => {
    let testTenantId1: string;
    let testTenantId2: string;
    let clientId1: string;
    let clientId2: string;
    let serviceId1: string;
    let serviceId2: string;
    let adminUserId: string;

    beforeEach(() => {
        testTenantId1 = crypto.randomUUID();
        testTenantId2 = crypto.randomUUID();
        adminUserId = crypto.randomUUID();
        clientId1 = crypto.randomUUID();
        clientId2 = crypto.randomUUID();
        serviceId1 = crypto.randomUUID();
        serviceId2 = crypto.randomUUID();

        // Setup initial DB state for test
        db.exec(`
            INSERT INTO settings (id, companyName, companyCode, invoicePrefix, quotePrefix, tvaRate, tpsRate, cssRate)
            VALUES (1, 'Test Company', 'TC', 'FAC', 'DEV', 18, 9.5, 1)
            ON CONFLICT(id) DO UPDATE SET tvaRate=18, tpsRate=9.5, cssRate=1;

            INSERT INTO users (id, name, username, password, email, role, is_active, tenant_id)
            VALUES ('${adminUserId}', 'Admin', 'admin', 'password', 'admin@example.com', 'admin', 1, '${testTenantId1}');

            INSERT INTO clients (id, name, tenant_id) VALUES ('${clientId1}', 'Client 1', '${testTenantId1}');
            INSERT INTO clients (id, name, tenant_id) VALUES ('${clientId2}', 'Client 2', '${testTenantId2}');

            INSERT INTO services (id, name, unitPrice, trackStock, stockQuantity, minStockAlert, tenant_id)
            VALUES ('${serviceId1}', 'Service 1', 1000, 1, 10000, 10, '${testTenantId1}');

            INSERT INTO services (id, name, unitPrice, trackStock, stockQuantity, minStockAlert, tenant_id)
            VALUES ('${serviceId2}', 'Service 2', 2000, 1, 50, 5, '${testTenantId2}');
        `);
    });

    afterEach(() => {
        // Cleanup DB
        db.exec(`
            DELETE FROM ledger_entries;
            DELETE FROM credit_note_items;
            DELETE FROM credit_notes;
            DELETE FROM payments;
            DELETE FROM invoice_items;
            DELETE FROM invoices;
            DELETE FROM stock_movements;
            DELETE FROM services;
            DELETE FROM clients;
            DELETE FROM users;
        `);
    });

    it('1. Foreign Key Resilience - Handles invalid external IDs gracefully', () => {
        // Attempt to create invoice with invalid serviceId and external userId
        const invoiceData = {
            clientId: clientId1,
            date: new Date().toISOString(),
            dueDate: new Date().toISOString(),
            items: [
                { serviceId: "", description: "Empty Service ID", quantity: 1, unitPrice: 1000 },
                { serviceId: "non-existent-id", description: "Invalid Service ID", quantity: 1, unitPrice: 1000 }
            ],
            applyCss: true,
            applyTps: false,
            applyTva: true
        };

        // Should not throw SQL constraint error, should fallback gracefully
        const result = InvoiceService.createInvoice(invoiceData, "external-supabase-uuid", "admin", testTenantId1);
        expect(result).toHaveProperty('id');

        const dbInvoice = db.prepare('SELECT created_by FROM invoices WHERE id = ?').get(result.id) as any;
        expect(dbInvoice.created_by).toBe(adminUserId); // Fell back to admin

        const dbItems = db.prepare('SELECT serviceId FROM invoice_items WHERE invoiceId = ?').all(result.id) as any[];
        expect(dbItems.every(i => i.serviceId === null)).toBe(true); // Invalid IDs became null
    });

    it('2. Exactitude Fiscale Dynamique & Plafonnement des Avoirs - Stress Test (50 Factures)', () => {
         // Create 50 invoices with different combinations
         const invoices = [];

         for(let i = 0; i < 50; i++) {
             const applyCss = i % 2 === 0;
             const applyTps = i % 3 === 0;
             const applyTva = i % 4 !== 0;

             const invoiceData = {
                clientId: clientId1,
                date: new Date().toISOString(),
                dueDate: new Date().toISOString(),
                items: [{ description: "Test", quantity: 1, unitPrice: 20000 }], // HT = 20000
                applyCss,
                applyTps,
                applyTva
             };

             const invoice = InvoiceService.createInvoice(invoiceData, adminUserId, "admin", testTenantId1);
             invoices.push(invoice);
         }

         // Pick one for specific validation
         const testInvoice = invoices[0];
         const dbInvoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(testInvoice.id) as any;

         // 20000 + 200 (CSS) + 1919 (TPS) = 22119
         expect(dbInvoice.total).toBe(22119);
         expect(dbInvoice.cssAmount).toBe(200);
         expect(dbInvoice.tpsAmount).toBe(1919);
         expect(dbInvoice.tvaAmount).toBe(0);

         // Partial Payment
         db.exec(`INSERT INTO payments (id, invoiceId, amount, paymentMethod, date, tenant_id)
            VALUES ('${crypto.randomUUID()}', '${testInvoice.id}', 10000, 'CASH', '${new Date().toISOString()}', '${testTenantId1}')`);
         updateInvoiceStatus(testInvoice.id, testTenantId1);
         const statusAfterPayment = db.prepare('SELECT status FROM invoices WHERE id = ?').get(testInvoice.id) as any;
         expect(statusAfterPayment.status).toBe('PARTIALLY_PAID');

         // Create partial credit note
         CreditNoteService.createCreditNote({
             invoiceId: testInvoice.id,
             reason: "Refund 1",
             items: [{ description: "Refund 1", quantity: 1, unitPrice: 5000 }],
             applyCss: true,
             applyTps: true,
             applyTva: true
         }, adminUserId, testTenantId1);
         updateInvoiceStatus(testInvoice.id, testTenantId1);

         // Attempt to credit more than remaining
         expect(() => {
             CreditNoteService.createCreditNote({
                 invoiceId: testInvoice.id,
                 reason: "Refund 2 (too much)",
                 items: [{ description: "Refund 2", quantity: 1, unitPrice: 15000 }], // 5000 + 15000 = 20000 HT > 20000 HT total => TTC overflow
                 applyCss: true,
                 applyTps: true,
                 applyTva: true
             }, adminUserId, testTenantId1);
         }).toThrow(/dépasse le montant total de la facture/);
    });

    it('3. Traçabilité Stock & Brouillons', () => {
        // Draft invoice - should not deduct stock
        const draftInvoice = InvoiceService.createInvoice({
            clientId: clientId1,
            date: new Date().toISOString(),
            dueDate: new Date().toISOString(),
            status: 'DRAFT',
            items: [{ serviceId: serviceId1, description: "Item", quantity: 5, unitPrice: 1000 }]
        }, adminUserId, "admin", testTenantId1);

        let stock = db.prepare('SELECT stockQuantity FROM services WHERE id = ?').get(serviceId1) as any;
        expect(stock.stockQuantity).toBe(10000);

        // Valid invoice - should deduct stock
        const validInvoice = InvoiceService.createInvoice({
            clientId: clientId1,
            date: new Date().toISOString(),
            dueDate: new Date().toISOString(),
            status: 'UNPAID',
            items: [{ serviceId: serviceId1, description: "Item", quantity: 10, unitPrice: 1000 }]
        }, adminUserId, "admin", testTenantId1);

        stock = db.prepare('SELECT stockQuantity FROM services WHERE id = ?').get(serviceId1) as any;
        expect(stock.stockQuantity).toBe(9990);

        // Credit note - should restock
        CreditNoteService.createCreditNote({
            invoiceId: validInvoice.id,
            reason: "Cancel",
            items: [{ serviceId: serviceId1, description: "Item", quantity: 10, unitPrice: 1000 }]
        }, adminUserId, testTenantId1);

        stock = db.prepare('SELECT stockQuantity FROM services WHERE id = ?').get(serviceId1) as any;
        expect(stock.stockQuantity).toBe(10000);
    });

    it('4. Isolation Multi-Tenant', () => {
        // Tenant 1 Invoice
        const inv1 = InvoiceService.createInvoice({
            clientId: clientId1,
            date: new Date().toISOString(),
            dueDate: new Date().toISOString(),
            items: [{ description: "Item", quantity: 1, unitPrice: 1000 }]
        }, adminUserId, "admin", testTenantId1);

        // Tenant 2 trying to access Tenant 1 data (should fail or return empty/null)
        // Ensure Ledger, Payments, Stock isolation is respected

        const t2Payments = PaymentRepository.findPaymentsByInvoiceId(inv1.id, testTenantId2);
        expect(t2Payments.length).toBe(0);

        const t2Ledger = LedgerRepository.findAll({ tenantId: testTenantId2 });
        expect(t2Ledger.length).toBe(0);
    });
});
