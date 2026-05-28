import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { GET } from '@/app/api/dashboard/metrics/route'
import { NextRequest } from 'next/server'
import db from '@/lib/db'

describe('Route API GET /api/dashboard/metrics', () => {
  beforeEach(() => {
    // Vider les tables pour repartir d'un environnement propre
    db.prepare('DELETE FROM payments').run()
    db.prepare('DELETE FROM invoice_items').run()
    db.prepare('DELETE FROM invoices').run()
    db.prepare('DELETE FROM clients').run()

    // Insérer un client fictif
    db.prepare(`
      INSERT INTO clients (id, name, email, phone, address, status)
      VALUES ('client-99', 'Client Moanda', 'moanda@client.com', '+241 01 02 03', 'Moanda', 'active')
    `).run()
  })

  afterEach(() => {
    db.prepare('DELETE FROM payments').run()
    db.prepare('DELETE FROM invoice_items').run()
    db.prepare('DELETE FROM invoices').run()
    db.prepare('DELETE FROM clients').run()
  })

  it('devrait calculer dynamiquement les statistiques à partir des requêtes SQLite (sans mocks)', async () => {
    const today = new Date().toISOString().split('T')[0]

    // 1. Créer deux factures actives de test
    // Facture 1 : 1 000 000 FCFA
    db.prepare(`
      INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, cssAmount, total, status, deletedAt)
      VALUES ('inv-1', 'FAC-2026-0001', 'client-99', 'Client Moanda', 'moanda@client.com', ?, ?, 1000000, 0, 1000000, 180000, 10000, 1190000, 'UNPAID', null)
    `).run(today, today)

    // Facture 2 : 500 000 FCFA
    db.prepare(`
      INSERT INTO invoices (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, cssAmount, total, status, deletedAt)
      VALUES ('inv-2', 'FAC-2026-0002', 'client-99', 'Client Moanda', 'moanda@client.com', ?, ?, 500000, 0, 500000, 90000, 5000, 595000, 'UNPAID', null)
    `).run(today, today)

    // 2. Insérer des paiements pour ces factures
    // Paiement 1 : 1 190 000 FCFA (FAC-2026-0001 est totalement payée)
    db.prepare(`
      INSERT INTO payments (id, invoiceId, amount, paymentMethod, date)
      VALUES ('pay-1', 'inv-1', 1190000, 'airtel', ?)
    `).run(today)
    db.prepare("UPDATE invoices SET status = 'PAID' WHERE id = 'inv-1'").run()

    // Paiement 2 : 100 000 FCFA (FAC-2026-0002 est partiellement payée, reste 495 000 FCFA)
    db.prepare(`
      INSERT INTO payments (id, invoiceId, amount, paymentMethod, date)
      VALUES ('pay-2', 'inv-2', 100000, 'moov', ?)
    `).run(today)
    db.prepare("UPDATE invoices SET status = 'PARTIALLY_PAID' WHERE id = 'inv-2'").run()

    // 3. Exécuter l'appel à l'API
    const request = new NextRequest(`http://localhost:3000/api/dashboard/metrics?range=month`)
    const response = await GET(request)
    expect(response.status).toBe(200)

    const data = await response.json()

    // 4. Assertions dynamiques sur les calculs SQLite
    expect(data.metrics).toBeDefined()
    
    // Le chiffre d'affaires cumulé des paiements doit être : 1 190 000 + 100 000 = 1 290 000 FCFA
    expect(data.metrics.totalRevenue).toBe(1290000)

    // Le CA en attente restant sur FAC-2026-0002 : Total (595 000) - Reçu (100 000) = 495 000 FCFA
    expect(data.metrics.pendingRevenue).toBe(495000)

    // Nombre de factures payées = 1 (la facture 1)
    expect(data.metrics.paidCount).toBe(1)

    // Nombre total de factures actives = 2
    expect(data.metrics.totalInvoicesCount).toBe(2)

    // Distribution des modes de paiement : airtel (50%) et moov (50%)
    expect(data.paymentMethodData).toBeDefined()
    expect(data.paymentMethodData.length).toBeGreaterThan(0)
    
    const airtelMethod = data.paymentMethodData.find((p: any) => p.name === 'Airtel Money')
    expect(airtelMethod).toBeDefined()
    expect(airtelMethod.value).toBe(50)
  })
})
