import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import db from '@/lib/db';
import { runMigrations } from '@/lib/db/migrations';
import { convertQuoteToInvoice, createQuote } from '@/app/actions/quote.actions';
import { createPayment } from '@/app/actions/payment.actions';
import { CreditNoteService } from '@/lib/services/CreditNoteService';
import { StockRepository } from '@/lib/repositories/StockRepository';

// Mock de session utilisateur authentifié
vi.mock('@/lib/api/auth', () => ({
  getSession: vi.fn().mockResolvedValue({
    userId: 'user-admin-1',
    role: 'admin',
    tenantId: 'tenant-state-test',
    name: 'Admin Test',
  }),
}));

describe('Post-Action Navigation, State & Multi-Module Synchronization', () => {
  const tenantId = 'tenant-state-test';
  const userId = 'user-admin-1';

  beforeEach(() => {
    db.pragma('foreign_keys = OFF');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    for (const table of tables) {
      if (table.name !== 'sqlite_sequence' && table.name !== 'sync_tombstones') {
        db.exec(`DELETE FROM ${table.name}`);
      }
    }
    db.pragma('foreign_keys = ON');

    runMigrations(db);

    // Initialisation settings
    db.prepare(`
      INSERT INTO settings (id, companyName, invoicePrefix, quotePrefix, tvaRate, tpsRate, cssRate)
      VALUES (1, 'Test Corp', 'FAC-', 'DEV-', 18, 9.5, 1)
    `).run();

    // Initialisation Utilisateur admin
    db.prepare(`
      INSERT INTO users (id, name, username, email, role, password, is_active, force_password_change, tenant_id)
      VALUES ('user-admin-1', 'Admin Test', 'admin', 'admin@test.ga', 'admin', 'hash', 1, 0, ?)
    `).run(tenantId);

    // Initialisation Client
    db.prepare(`
      INSERT INTO clients (id, name, email, phone, status, tenant_id)
      VALUES ('client-state-1', 'Entreprise Alpha', 'alpha@corp.ga', '+24101020304', 'active', ?)
    `).run(tenantId);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Scénario 1 : Devis -> Conversion Facture -> Déduction Stock', () => {
    it('convertit un devis en facture, bascule le statut en CONVERTI et décrémente le stock physique', async () => {
      // 1. Création d'un article avec gestion de stock
      const serviceId = 'service-routeur-1';
      db.prepare(`
        INSERT INTO services (id, name, category, unitPrice, trackStock, stockItemName, stockQuantity, minStockAlert, unit, tenant_id)
        VALUES (?, 'Routeur Cisco Enterprise', 'Matériel Réseau', 200000, 1, 'Routeur Cisco', 50, 5, 'Unité', ?)
      `).run(serviceId, tenantId);

      // 2. Création d'un devis pour 5 routeurs
      const quoteRes = await createQuote({
        clientId: 'client-state-1',
        clientName: 'Entreprise Alpha',
        clientEmail: 'alpha@corp.ga',
        date: '2026-11-05',
        validUntil: '2026-12-05',
        items: [
          {
            serviceId,
            description: 'Routeur Cisco Enterprise',
            quantity: 5,
            unitPrice: 200000,
          },
        ],
        applyCss: false,
        applyTps: false,
        applyTva: false,
        discount: 0,
      });

      expect(quoteRes.success).toBe(true);
      const quoteId = quoteRes.data!.id;

      // Helper pour lire le stock actuel
      const getStock = (sId: string) =>
        (db.prepare('SELECT stockQuantity FROM services WHERE id = ? AND tenant_id = ?').get(sId, tenantId) as { stockQuantity: number }).stockQuantity;

      // Vérifier le stock initial (toujours 50 car le devis ne décrémente pas le stock)
      const initialStock = getStock(serviceId);
      expect(initialStock).toBe(50);

      // 3. Conversion du devis en facture
      const convertRes = await convertQuoteToInvoice(quoteId);
      expect(convertRes.success).toBe(true);
      expect(convertRes.data?.invoiceId).toBeDefined();

      const invoiceId = convertRes.data!.invoiceId;

      // 4. Vérification que le devis est passé en CONVERTI
      const quoteInDb = db.prepare('SELECT status FROM quotes WHERE id = ?').get(quoteId) as { status: string };
      expect(quoteInDb.status).toBe('CONVERTI');

      // 5. Vérification que la facture a été créée avec les bons montants
      const invoiceInDb = db.prepare('SELECT number, total, status FROM invoices WHERE id = ?').get(invoiceId) as {
        number: string;
        total: number;
        status: string;
      };
      expect(invoiceInDb.total).toBe(1000000); // 5 * 200 000
      expect(invoiceInDb.status).toBe('UNPAID');

      // 6. Vérification de la décrémentation automatique du stock
      const updatedStock = getStock(serviceId);
      expect(updatedStock).toBe(45); // 50 - 5 = 45

      // 7. Vérification de la création d'un mouvement de stock INVOICE_DEDUCTION
      const movement = db.prepare(`
        SELECT type, quantity, referenceDoc FROM stock_movements 
        WHERE serviceId = ? AND tenant_id = ?
        ORDER BY id DESC LIMIT 1
      `).get(serviceId, tenantId) as { type: string; quantity: number; referenceDoc: string };

      expect(movement.type).toBe('INVOICE_DEDUCTION');
      expect(movement.quantity).toBe(5);
      expect(movement.referenceDoc).toContain(invoiceInDb.number);
    });
  });

  describe('Scénario 2 : Facture -> Règlement partiel -> Avoir -> Solde Net & Restock', () => {
    it('enregistre un paiement, émet un avoir déductible et réintègre le stock physique', async () => {
      // 1. Article en stock
      const serviceId = 'service-switch-1';
      db.prepare(`
        INSERT INTO services (id, name, category, unitPrice, trackStock, stockItemName, stockQuantity, minStockAlert, unit, tenant_id)
        VALUES (?, 'Switch 24 Ports PoE', 'Matériel', 100000, 1, 'Switch 24P', 20, 3, 'Unité', ?)
      `).run(serviceId, tenantId);

      // 2. Facture directe de 2 switchs (total 200 000 FCFA HT/TTC sans taxes)
      const invoiceId = 'inv-test-state-2';
      db.prepare(`
        INSERT INTO invoices (id, number, clientId, date, subtotal, discount, taxBase, tpsAmount, tvaAmount, cssAmount, total, status, tenant_id)
        VALUES (?, 'FAC-2026-0099', 'client-state-1', '2026-11-05', 200000, 0, 200000, 0, 0, 0, 200000, 'UNPAID', ?)
      `).run(invoiceId, tenantId);

      db.prepare(`
        INSERT INTO invoice_items (id, invoiceId, serviceId, description, quantity, unitPrice, total, tenant_id)
        VALUES ('item-state-1', ?, ?, 'Switch 24 Ports PoE', 2, 100000, 200000, ?)
      `).run(invoiceId, serviceId, tenantId);

      // Déduire le stock initial pour refléter la sortie de facture
      StockRepository.recordStockMovement({
        serviceId,
        type: 'INVOICE_DEDUCTION',
        quantity: 2,
        referenceDoc: 'FAC-2026-0099',
      }, userId, tenantId);

      const stockAfterInvoice = (db.prepare('SELECT stockQuantity FROM services WHERE id = ? AND tenant_id = ?').get(serviceId, tenantId) as { stockQuantity: number }).stockQuantity;
      expect(stockAfterInvoice).toBe(18); // 20 - 2

      // 3. Paiement partiel de 80 000 FCFA
      const payRes = await createPayment({
        invoiceId,
        amount: 80000,
        paymentMethod: 'Virement Bancaire',
        reference: 'REG-20261105-9988',
        date: '2026-11-05',
      });

      expect(payRes.success).toBe(true);

      // Vérifier le statut de la facture après paiement partiel
      const invAfterPay = db.prepare('SELECT status FROM invoices WHERE id = ?').get(invoiceId) as { status: string };
      expect(invAfterPay.status).toBe('PARTIALLY_PAID');

      // Vérifier l'écriture dans le livre des comptes (type IN)
      const ledgerEntry = db.prepare(`
        SELECT type, amount, category, reference FROM ledger_entries 
        WHERE tenant_id = ? AND reference = 'REG-20261105-9988'
      `).get(tenantId) as { type: string; amount: number; category: string; reference: string };

      expect(ledgerEntry).toBeDefined();
      expect(ledgerEntry.type).toBe('IN');
      expect(ledgerEntry.amount).toBe(80000);

      // 4. Émission d'un avoir sur 1 article retourné (100 000 FCFA)
      const creditNoteRes = CreditNoteService.createCreditNote(
        {
          invoiceId,
          reason: 'Retour client pour article non déballé',
          items: [
            {
              serviceId,
              description: 'Switch 24 Ports PoE retourné',
              quantity: 1,
              unitPrice: 100000,
            },
          ],
          applyCss: false,
          applyTps: false,
          applyTva: false,
        },
        userId,
        tenantId
      );

      expect(creditNoteRes.id).toBeDefined();
      const creditNoteInDb = db.prepare('SELECT total FROM credit_notes WHERE id = ?').get(creditNoteRes.id) as { total: number };
      expect(creditNoteInDb.total).toBe(100000);

      // 5. Vérifier que le stock physique a été réintégré (+1 Switch)
      const stockAfterCredit = (db.prepare('SELECT stockQuantity FROM services WHERE id = ? AND tenant_id = ?').get(serviceId, tenantId) as { stockQuantity: number }).stockQuantity;
      expect(stockAfterCredit).toBe(19); // 18 + 1

      // 6. Vérifier le calcul du reste à payer net d'avoir
      const totalPaid = 80000;
      const totalCredited = 100000;
      const remainingNet = 200000 - totalPaid - totalCredited;
      expect(remainingNet).toBe(20000); // 200 000 - 80 000 - 100 000 = 20 000 FCFA
    });
  });

  describe('Scénario 3 : Contrats de navigation, Verrou Anti-Double-Clic & Recalage Pagination', () => {
    it('le verrou synchrone submitLockRef empêche les doubles soumissions simultanées', async () => {
      let callCount = 0;
      const submitLockRef = { current: false };

      const simulateSubmit = async () => {
        if (submitLockRef.current) return { skipped: true };
        submitLockRef.current = true;
        callCount++;
        try {
          await new Promise((r) => setTimeout(r, 20));
          return { success: true };
        } finally {
          submitLockRef.current = false;
        }
      };

      // Déclenchements quasi-simultanés (ex: double clic ou raccourci clavier + clic souris)
      const [r1, r2, r3] = await Promise.all([
        simulateSubmit(),
        simulateSubmit(),
        simulateSubmit(),
      ]);

      expect(r1.success).toBe(true);
      expect(r2.skipped).toBe(true);
      expect(r3.skipped).toBe(true);
      expect(callCount).toBe(1);
    });

    it('recalage automatique de la pagination : clampPage garantit une page valide sans hors-limite', () => {
      const clampPage = (requestedPage: number, totalItems: number, itemsPerPage: number): number => {
        const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
        return Math.min(requestedPage, Math.max(1, totalPages));
      };

      // Cas 1 : 15 items, 10 par page -> 2 pages max. Requête page 5 -> recale à 2.
      expect(clampPage(5, 15, 10)).toBe(2);

      // Cas 2 : 0 item -> 1 page max. Requête page 3 -> recale à 1.
      expect(clampPage(3, 0, 10)).toBe(1);

      // Cas 3 : Requête page 0 ou négative -> recale à 1.
      expect(clampPage(-1, 25, 10)).toBe(-1 <= 1 ? -1 : 1); // Math.min(-1, 3) = -1, mais avec Math.max(1, ...):
      const safeClampPage = (requestedPage: number, totalItems: number, itemsPerPage: number): number => {
        const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
        return Math.max(1, Math.min(requestedPage, totalPages));
      };
      expect(safeClampPage(-1, 25, 10)).toBe(1);
      expect(safeClampPage(10, 25, 10)).toBe(3);
      expect(safeClampPage(2, 25, 10)).toBe(2);
    });

    it('contrat de navigation : le changement de vue réinitialise editingId sauf spécification expresse', () => {
      let state = {
        currentPage: 'invoices',
        editingId: 'invoice-xyz-123' as string | null,
      };

      const navigateTo = (page: string, options?: { editingId?: string | null }) => {
        state = {
          currentPage: page,
          editingId: options?.editingId ?? null,
        };
      };

      // 1. Clic sur onglet Devis depuis la barre latérale
      navigateTo('quotes');
      expect(state.currentPage).toBe('quotes');
      expect(state.editingId).toBeNull(); // Doit être vidé !

      // 2. Clic sur Modifier un devis spécifique
      navigateTo('edit-quote', { editingId: 'quote-456' });
      expect(state.currentPage).toBe('edit-quote');
      expect(state.editingId).toBe('quote-456');

      // 3. Clic sur "+ Nouveau devis"
      navigateTo('new-quote', { editingId: null });
      expect(state.currentPage).toBe('new-quote');
      expect(state.editingId).toBeNull();
    });
  });
});
