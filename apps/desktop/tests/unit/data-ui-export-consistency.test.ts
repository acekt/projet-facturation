import { describe, it, expect, beforeEach, vi } from 'vitest';
import db from '@/lib/db';
import { runMigrations } from '@/lib/db/migrations';
import { getAuditLogs, getPaginatedAuditLogs } from '@/app/actions/audit.actions';
import { getLedgerEntriesAction } from '@/app/actions/ledger.actions';
import {
  formatAuditMoneyAndPhrases,
  cleanDocumentNumbersInText,
  formatAuditDetails,
} from '@/lib/utils/auditFormatter';
import {
  isInvoicePendingPayment,
  isPendingQuote,
  getUnpaidInvoicesCount,
  getPendingQuotesCount,
} from '@/lib/utils/counters';
import type { Invoice, Quote, CreditNote } from '@/lib/store';

vi.mock('@/lib/api/auth', () => ({
  getSession: vi.fn().mockResolvedValue({
    userId: 'user-admin-1',
    role: 'admin',
    tenantId: 'tenant-consistency-test',
    name: 'Admin Consistency',
  }),
}));

describe('Data, UI & Export Center Mathematical Consistency (163 === 163)', () => {
  const tenantId = 'tenant-consistency-test';
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

    db.prepare(`
      INSERT INTO users (id, name, username, email, role, password, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, 'Admin Consistency', 'admin', 'admin@consistency.test', 'admin', 'hash', tenantId);
  });

  describe('1. Suppression du plafond LIMIT 100 sur audit_logs (165 === 165)', () => {
    it('getAuditLogs() retourne la totalité des 165 logs pour le Centre d\'Exportation et concorde avec la pagination', async () => {
      const insertStmt = db.prepare(`
        INSERT INTO audit_logs (id, userId, userName, action, entityType, entityId, details, createdAt, tenant_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const totalLogsToInsert = 165;
      const baseDate = new Date('2026-11-05T08:00:00.000Z').getTime();

      for (let i = 1; i <= totalLogsToInsert; i++) {
        const logDate = new Date(baseDate + i * 1000).toISOString();
        insertStmt.run(
          `log-${i}`,
          userId,
          'Admin Consistency',
          i % 2 === 0 ? 'UPDATE' : 'CREATE',
          'invoice',
          `inv-${i}`,
          `Paiement enregistré: ${10000 + i} XAF sur facture FAC-${i}/GM/2026`,
          logDate,
          tenantId
        );
      }

      // Vérification 1 : getPaginatedAuditLogs rapporte le totalCount exact
      const paginatedRes = await getPaginatedAuditLogs(1, 10, '');
      expect(paginatedRes.success).toBe(true);
      expect(paginatedRes.data?.totalCount).toBe(165);
      expect(paginatedRes.data?.logs.length).toBe(10);

      // Vérification 2 : getAuditLogs (sans limite) ne tronque plus à 100 et retourne bien les 165 entrées
      const exportRes = await getAuditLogs();
      expect(exportRes.success).toBe(true);
      expect(exportRes.data?.length).toBe(165);

      // Vérification 3 : Le premier log est bien le plus récent chronologiquement
      expect(exportRes.data?.[0].id).toBe(`log-${totalLogsToInsert}`);
    });
  });

  describe('2. Déblocage de l\'historique complet du Livre des Comptes (Tous les mois)', () => {
    it('getLedgerEntriesAction({}) charge 100% de l\'historique multi-mois, tandis que { month } filtre précisément', async () => {
      const insertLedger = db.prepare(`
        INSERT INTO ledger_entries (id, tenant_id, date, type, category, description, amount, paymentMethod, created_by, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `);

      // 5 écritures en octobre 2026
      for (let i = 1; i <= 5; i++) {
        insertLedger.run(
          `led-oct-${i}`,
          tenantId,
          `2026-10-0${i}`,
          'IN',
          'Ventes & Facturation',
          `Recette Octobre ${i}`,
          50000,
          'Virement',
          userId
        );
      }

      // 8 écritures en novembre 2026
      for (let i = 1; i <= 8; i++) {
        insertLedger.run(
          `led-nov-${i}`,
          tenantId,
          `2026-11-0${i}`,
          'OUT',
          'Loyer & Charges',
          `Dépense Novembre ${i}`,
          20000,
          'Espèces',
          userId
        );
      }

      // Filtre mensuel Novembre (utilisé par la page ledger.tsx par défaut)
      const novRes = await getLedgerEntriesAction({ month: '2026-11' });
      expect(novRes.success).toBe(true);
      expect(novRes.data?.length).toBe(8);

      // Filtre mensuel Octobre
      const octRes = await getLedgerEntriesAction({ month: '2026-10' });
      expect(octRes.success).toBe(true);
      expect(octRes.data?.length).toBe(5);

      // Sans filtre de mois (utilisé par DataExportModal pour "Tout l'historique")
      const allRes = await getLedgerEntriesAction({});
      expect(allRes.success).toBe(true);
      expect(allRes.data?.length).toBe(13); // 5 + 8 = 13 écritures au total
    });
  });

  describe('3. Normalisation et formatage des montants FCFA & libellés comptables', () => {
    it('Formate automatiquement les motifs 1072620 XAF en FCFA avec séparateur de milliers', () => {
      const formatted = formatAuditMoneyAndPhrases(
        'Paiement enregistré: 1072620 XAF sur facture FAC-008/GM/2026 (REG-20261105-5201)'
      );
      // Remplace 1072620 XAF par 1 072 620 FCFA (avec espace insécable ou standard fr-FR)
      expect(formatted).toMatch(/1[\s\u00a0\u202f]072[\s\u00a0\u202f]620 FCFA/);
      expect(formatted).not.toContain('XAF');
    });

    it('Transforme "Création écriture OUT de 15000 XAF" en "Dépense enregistrée : 15 000 FCFA"', () => {
      const formatted = formatAuditMoneyAndPhrases('Création écriture OUT de 15000 XAF');
      expect(formatted).toMatch(/Dépense enregistrée : 15[\s\u00a0\u202f]000 FCFA/);
    });

    it('Transforme "Création écriture IN de 50000 XAF" en "Recette enregistrée : 50 000 FCFA"', () => {
      const formatted = formatAuditMoneyAndPhrases('Création écriture IN de 50000 XAF');
      expect(formatted).toMatch(/Recette enregistrée : 50[\s\u00a0\u202f]000 FCFA/);
    });

    it('formatAuditDetails applique automatiquement la normalisation sur les textes bruts d\'audit', () => {
      const res = formatAuditDetails('Création écriture OUT de 250000 XAF pour loyer commercial');
      expect(res.humanText).toMatch(/Dépense enregistrée : 250[\s\u00a0\u202f]000 FCFA pour loyer commercial/);
    });
  });

  describe('4. Prédicats de compteurs canoniques partagés (isInvoicePendingPayment & isPendingQuote)', () => {
    it('isInvoicePendingPayment exclut les factures soldées par avoir ou payées', () => {
      const invPaid = {
        id: 'inv-1',
        total: 100000,
        status: 'PAID',
        payments: [{ amount: 100000 }],
      } as unknown as Invoice;
      expect(isInvoicePendingPayment(invPaid, [])).toBe(false);

      const invCredited = {
        id: 'inv-2',
        total: 50000,
        status: 'UNPAID',
        payments: [],
      } as unknown as Invoice;
      const creditNote = {
        id: 'cn-1',
        invoiceId: 'inv-2',
        total: 50000,
      } as unknown as CreditNote;
      // Solde net = 0 grâce à l'avoir => non en attente !
      expect(isInvoicePendingPayment(invCredited, [creditNote])).toBe(false);

      const invPending = {
        id: 'inv-3',
        total: 80000,
        status: 'PARTIALLY_PAID',
        payments: [{ amount: 30000 }],
      } as unknown as Invoice;
      // Solde net = 50 000 > 0 => en attente !
      expect(isInvoicePendingPayment(invPending, [])).toBe(true);

      expect(getUnpaidInvoicesCount([invPaid, invCredited, invPending], [creditNote])).toBe(1);
    });

    it('isPendingQuote inclut uniquement les devis actifs et non expirés', () => {
      const today = '2026-11-05';
      const qActive = {
        id: 'q-1',
        status: 'EN_ATTENTE',
        validUntil: '2026-11-20',
      } as unknown as Quote;
      const qConverted = {
        id: 'q-2',
        status: 'CONVERTI',
      } as unknown as Quote;
      const qExpired = {
        id: 'q-3',
        status: 'EN_ATTENTE',
        validUntil: '2026-11-01',
      } as unknown as Quote;

      expect(isPendingQuote(qActive, today)).toBe(true);
      expect(isPendingQuote(qConverted, today)).toBe(false);
      expect(isPendingQuote(qExpired, today)).toBe(false);

      expect(getPendingQuotesCount([qActive, qConverted, qExpired], today)).toBe(1);
    });
  });
});
