import { describe, it, expect, beforeEach } from 'vitest';
import { getTestDatabase, cleanupTestDatabase } from '../helpers/db';
import { InvoiceRepository } from '@/lib/repositories/InvoiceRepository';
import { QuoteRepository } from '@/lib/repositories/QuoteRepository';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { MetricsRepository } from '@/lib/repositories/MetricsRepository';
import { CreditNoteService, CreditNoteServiceError } from '@/lib/services/CreditNoteService';
import { updateInvoiceStatus } from '@/lib/api/invoice-logic';
import { buildTenantFilter } from '@/lib/api/tenant';

describe('Étape 1.2 — Validation Multi-Tenant Exhaustive (Hub & Spoke / Local SQLite)', () => {
  beforeEach(() => {
    cleanupTestDatabase();
    const db = getTestDatabase();
    db.prepare(`
      INSERT OR REPLACE INTO settings (
        id, companyName, legalForm, nif, rccm, address, email, phone, mentionsLegales,
        bankName, bankAgency, accountNumber, swiftCode, iban,
        tvaRate, tpsRate, cssRate, sessionTimeout,
        invoicePrefix, quotePrefix, companyCode
      ) VALUES (
        1, 'Entreprise Test', 'SARL', 'NIF123', 'RCCM123', 'Libreville', 'test@test.ga', '+24101000000', 'Mentions',
        'BGFI', 'Agence', '0001', 'SWIFT', 'GA0001',
        18, 9.5, 1, 30,
        'FAC', 'DEV', 'TEST'
      )
    `).run();
  });

  it('isole strictement clients, devis, factures, paiements, avoirs et métriques entre Tenant A et Tenant B', () => {
    const db = getTestDatabase();

    // 1. Utilisateurs
    UserRepository.create({
      id: 'admin-a',
      name: 'Admin Alpha',
      email: 'alpha@corp.ga',
      username: 'alpha@corp.ga',
      password: 'pwd',
      role: 'admin',
      is_active: 1,
      tenant_id: 'tenant-a',
    });

    UserRepository.create({
      id: 'admin-b',
      name: 'Admin Beta',
      email: 'beta@corp.ga',
      username: 'beta@corp.ga',
      password: 'pwd',
      role: 'admin',
      is_active: 1,
      tenant_id: 'tenant-b',
    });

    // 2. Clients
    db.prepare(`
      INSERT INTO clients (id, name, email, status, created_by, tenant_id)
      VALUES (?, ?, ?, 'active', ?, ?)
    `).run('client-a', 'Client Alpha Entreprise', 'alpha.client@test.ga', 'admin-a', 'tenant-a');

    db.prepare(`
      INSERT INTO clients (id, name, email, status, created_by, tenant_id)
      VALUES (?, ?, ?, 'active', ?, ?)
    `).run('client-b', 'Client Beta Entreprise', 'beta.client@test.ga', 'admin-b', 'tenant-b');

    // Vérification Clients
    const tfA = buildTenantFilter('tenant-a');
    const tfB = buildTenantFilter('tenant-b');
    const clientsA = db.prepare(`SELECT * FROM clients WHERE deletedAt IS NULL${tfA.sql}`).all(...tfA.params) as any[];
    const clientsB = db.prepare(`SELECT * FROM clients WHERE deletedAt IS NULL${tfB.sql}`).all(...tfB.params) as any[];

    expect(clientsA.length).toBe(1);
    expect(clientsA[0].id).toBe('client-a');
    expect(clientsB.length).toBe(1);
    expect(clientsB[0].id).toBe('client-b');

    // 3. Services
    db.prepare(`
      INSERT INTO services (id, name, description, unitPrice, created_by, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('svc-a', 'Service Audit Alpha', 'Audit', 150000, 'admin-a', 'tenant-a');

    db.prepare(`
      INSERT INTO services (id, name, description, unitPrice, created_by, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('svc-b', 'Service Maintenance Beta', 'Maintenance', 300000, 'admin-b', 'tenant-b');

    const servicesA = db.prepare(`SELECT * FROM services WHERE deletedAt IS NULL${tfA.sql}`).all(...tfA.params) as any[];
    const servicesB = db.prepare(`SELECT * FROM services WHERE deletedAt IS NULL${tfB.sql}`).all(...tfB.params) as any[];
    expect(servicesA.map((s) => s.id)).toEqual(['svc-a']);
    expect(servicesB.map((s) => s.id)).toEqual(['svc-b']);

    // 4. Devis (Quotes)
    db.prepare(`
      INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, subtotal, discount, taxBase, tpsAmount, tvaAmount, cssAmount, total, status, created_by, tenant_id)
      VALUES (?, ?, ?, ?, ?, '2026-10-01', 100000, 0, 101000, 9595, 18180, 1000, 128775, 'EN_ATTENTE', ?, ?)
    `).run('quote-a', 'DEV-001/A/2026', 'client-a', 'Client Alpha', 'alpha@client.ga', 'admin-a', 'tenant-a');

    db.prepare(`
      INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, subtotal, discount, taxBase, tpsAmount, tvaAmount, cssAmount, total, status, created_by, tenant_id)
      VALUES (?, ?, ?, ?, ?, '2026-10-01', 200000, 0, 202000, 19190, 36360, 2000, 257550, 'EN_ATTENTE', ?, ?)
    `).run('quote-b', 'DEV-001/B/2026', 'client-b', 'Client Beta', 'beta@client.ga', 'admin-b', 'tenant-b');

    const quotesA = QuoteRepository.findAll('admin-a', 'admin', 'tenant-a');
    const quotesB = QuoteRepository.findAll('admin-b', 'admin', 'tenant-b');
    expect(quotesA.length).toBe(1);
    expect(quotesA[0].id).toBe('quote-a');
    expect(quotesB.length).toBe(1);
    expect(quotesB[0].id).toBe('quote-b');

    // Tenant B ne peut pas trouver le devis de Tenant A par findById
    expect(QuoteRepository.findById('quote-a', 'admin-b', 'admin', 'tenant-b')).toBeUndefined();

    // 5. Factures (Invoices)
    db.prepare(`
      INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tpsAmount, tvaAmount, cssAmount, total, status, created_by, tenant_id)
      VALUES (?, ?, ?, ?, ?, '2026-10-01', '2026-10-31', 100000, 0, 101000, 9595, 18180, 1000, 128775, 'UNPAID', ?, ?)
    `).run('inv-a', 'FAC-001/A/2026', 'client-a', 'Client Alpha', 'alpha@client.ga', 'admin-a', 'tenant-a');

    db.prepare(`
      INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tpsAmount, tvaAmount, cssAmount, total, status, created_by, tenant_id)
      VALUES (?, ?, ?, ?, ?, '2026-10-01', '2026-10-31', 300000, 0, 303000, 28785, 54540, 3000, 386325, 'UNPAID', ?, ?)
    `).run('inv-b', 'FAC-001/B/2026', 'client-b', 'Client Beta', 'beta@client.ga', 'admin-b', 'tenant-b');

    const invoicesA = InvoiceRepository.findAll('admin-a', 'admin', 'tenant-a');
    const invoicesB = InvoiceRepository.findAll('admin-b', 'admin', 'tenant-b');
    expect(invoicesA.length).toBe(1);
    expect(invoicesA[0].id).toBe('inv-a');
    expect(invoicesB.length).toBe(1);
    expect(invoicesB[0].id).toBe('inv-b');

    // Isolation findById
    expect(InvoiceRepository.findById('inv-a', 'admin-b', 'admin', 'tenant-b')).toBeUndefined();

    // 6. Paiements
    db.prepare(`
      INSERT INTO payments (id, invoiceId, amount, paymentMethod, date, reference, created_by, tenant_id)
      VALUES (?, ?, ?, 'Virement', '2026-10-05', 'VIR-A-1', ?, ?)
    `).run('pay-a', 'inv-a', 128775, 'admin-a', 'tenant-a');

    const statusA = updateInvoiceStatus('inv-a', 'tenant-a');
    expect(statusA).toBe('PAID');

    // Tenant B essayant d'accéder au paiement de A
    const paymentsB = db.prepare(`SELECT * FROM payments WHERE deletedAt IS NULL${tfB.sql}`).all(...tfB.params);
    expect(paymentsB.length).toBe(0);

    // Tentative de recalculer le statut de l'invoice-a avec le tenant-b -> Facture introuvable
    expect(() => updateInvoiceStatus('inv-a', 'tenant-b')).toThrow();

    // 7. Avoirs (Credit Notes)
    // Création d'un avoir sur inv-b pour tenant-b
    const creditNote = CreditNoteService.createCreditNote(
      {
        invoiceId: 'inv-b',
        reason: 'Escompte commercial',
        items: [{ description: 'Avoir partiel', quantity: 1, unitPrice: 50000 }],
      },
      'admin-b',
      'tenant-b'
    );
    expect(creditNote.id).toBeDefined();

    // Tentative frauduleuse de créer un avoir pour inv-a avec le contexte tenant-b -> 404 Invoice not found
    expect(() => {
      CreditNoteService.createCreditNote(
        {
          invoiceId: 'inv-a',
          reason: 'Piratage cross-tenant',
          items: [{ description: 'Fraude', quantity: 1, unitPrice: 10000 }],
        },
        'admin-b',
        'tenant-b'
      );
    }).toThrowError(CreditNoteServiceError);

    // 8. Métriques (Dashboard)
    const revA = MetricsRepository.getTotalRevenue('admin-a', 'admin', "p.date >= '2026-01-01'", 'tenant-a');
    const revB = MetricsRepository.getTotalRevenue('admin-b', 'admin', "p.date >= '2026-01-01'", 'tenant-b');

    // Tenant A a un paiement de 128,775 XAF sur facture PAID
    expect(revA).toBe(128775);
    // Tenant B n'a aucun paiement encaissé
    expect(revB).toBe(0);

    const pendingRevA = MetricsRepository.getPendingRevenue('admin-a', 'admin', "i.date >= '2026-01-01'", 'tenant-a');
    const pendingRevB = MetricsRepository.getPendingRevenue('admin-b', 'admin', "i.date >= '2026-01-01'", 'tenant-b');

    // Tenant A facture payée => reste à payer 0
    expect(pendingRevA).toBe(0);
    // Tenant B facture de 386,325 XAF impayée
    expect(pendingRevB).toBe(386325);
  });
});
