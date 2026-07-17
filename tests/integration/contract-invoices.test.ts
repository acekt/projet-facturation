import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestDatabase, seedTestData, cleanupTestDatabase, createAuthenticatedSession, getTestDatabase } from '../helpers/db';
import { z } from 'zod';
import { GET as GETInvoices, POST as POSTInvoice } from '@/app/api/invoices/route';
import { getSession } from '@/lib/api/auth';

// Mock the global db module to redirect to test database (must be before API route imports)
vi.mock('@/lib/db', () => ({
  default: getTestDatabase(),
}));

// Mock the getSession function
vi.mock('@/lib/api/auth', () => ({
  getSession: vi.fn(),
}));

/**
 * SCHÉMAS DE CONTRAT FRONT-API (Zustand & DGI Gabon XAF)
 * Vérifie mathématiquement et structurellement que les payloads API
 * correspondent rigoureusement à l'attente du store Zustand (lib/types/api.ts).
 */
const invoiceItemContractSchema = z.object({
  id: z.string(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

const paymentContractSchema = z.object({
  id: z.string(),
  amount: z.number().int().positive(),
  paymentMethod: z.string(),
  date: z.string(),
});

const invoiceResponseContractSchema = z.object({
  id: z.string(),
  number: z.string().min(1),
  quoteId: z.string().nullable().optional(),
  clientId: z.string().min(1),
  clientName: z.string().min(1),
  clientEmail: z.string(),
  date: z.string(),
  dueDate: z.string().nullable().optional(),
  subtotal: z.number().int().nonnegative(),
  discount: z.number().int().nonnegative(),
  taxBase: z.number().int().nonnegative(),
  tpsAmount: z.number().int().nonnegative().optional(),
  tvaAmount: z.number().int().nonnegative(),
  cssAmount: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  notes: z.string().nullable().optional(),
  status: z.enum(['PAID', 'PARTIALLY_PAID', 'UNPAID', 'overdue', 'draft', 'cancelled', 'pending']),
  items: z.array(invoiceItemContractSchema),
  payments: z.array(paymentContractSchema),
  deletedAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  created_by: z.string().nullable().optional(),
});

describe('Contrat Front-API — Module Factures (Invoices)', () => {
  let testDb: ReturnType<typeof createTestDatabase>;

  beforeEach(() => {
    testDb = createTestDatabase();
    seedTestData(testDb);
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanupTestDatabase();
    vi.restoreAllMocks();
  });

  function getTestClientId(): string {
    const client = testDb.prepare('SELECT id FROM clients WHERE deletedAt IS NULL LIMIT 1').get() as { id: string } | undefined;
    if (!client) {
      throw new Error('No client found in test database');
    }
    return client.id;
  }

  it('devrait valider rigoureusement le contrat JSON des factures (types, schémas et intégrité XAF)', async () => {
    // 1. Authentifier l'utilisateur
    const session = createAuthenticatedSession('admin');
    vi.mocked(getSession).mockResolvedValue(session);

    const clientId = getTestClientId();

    // 2. Créer une facture via POST /api/invoices avec des données conformes
    const createPayload = {
      clientId,
      clientName: 'Client Contrat Test',
      clientEmail: 'contrat@letoile.ga',
      date: '2026-07-07',
      discount: 5000,
      notes: 'Test de résilience et de contrat Front-API',
      items: [
        {
          description: 'Licence Logiciel L\'Étoile Desktop',
          quantity: 2,
          unitPrice: 150000, // Entier XAF obligatoire
        },
        {
          description: 'Prestation d\'installation et formation',
          quantity: 1,
          unitPrice: 50000,
        }
      ]
    };

    const postReq = new Request('http://localhost/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createPayload),
    });

    const postRes = await POSTInvoice(postReq);
    expect(postRes.status).toBe(200);
    const postData = await postRes.json();
    expect(postData.id).toBeDefined();
    expect(postData.number).toBeDefined();

    // 3. Récupérer l'ensemble des factures via GET /api/invoices
    const getRes = await GETInvoices();
    expect(getRes.status).toBe(200);
    const invoices = await getRes.json();
    expect(Array.isArray(invoices)).toBe(true);
    expect(invoices.length).toBeGreaterThan(0);

    // 4. Vérifier que CHAQUE facture respecte le contrat mathématique et structurel attendu par Zustand
    for (const invoice of invoices) {
      // (a) Validation du schéma strict
      const validation = invoiceResponseContractSchema.safeParse(invoice);
      if (!validation.success) {
        console.error('Erreur de contrat API sur la facture:', JSON.stringify(validation.error.flatten(), null, 2));
      }
      expect(validation.success).toBe(true);

      // (b) Aucun champ undefined inattendu
      expect(invoice).not.toBeUndefined();
      expect(invoice.id).not.toBeUndefined();
      expect(invoice.number).not.toBeUndefined();

      // (c) Intégrité Mathématique XAF (Sous-total = somme des totaux d'items)
      if (invoice.items && invoice.items.length > 0) {
        const itemsSum = invoice.items.reduce((sum: number, item: any) => sum + item.total, 0);
        expect(invoice.subtotal).toBe(itemsSum);

        // Vérification des entiers XAF sur chaque item
        for (const item of invoice.items) {
          expect(Number.isInteger(item.unitPrice)).toBe(true);
          expect(Number.isInteger(item.total)).toBe(true);
          expect(item.total).toBe(Math.round(item.quantity * item.unitPrice));
        }
      }

      // (d) Vérification des montants globaux XAF (entiers obligatoires, pas de flottants)
      expect(Number.isInteger(invoice.subtotal)).toBe(true);
      expect(Number.isInteger(invoice.discount)).toBe(true);
      expect(Number.isInteger(invoice.taxBase)).toBe(true);
      expect(Number.isInteger(invoice.tvaAmount)).toBe(true);
      expect(Number.isInteger(invoice.cssAmount)).toBe(true);
      expect(Number.isInteger(invoice.total)).toBe(true);
    }
  });
});
