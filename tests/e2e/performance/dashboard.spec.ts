import { test, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

test.describe('Phase 4 : Audit de Performance', () => {
  test.beforeEach(async () => {
    const dbPath = process.env.TEST_DB_PATH || path.join(os.tmpdir(), 'fintech-invoicing-e2e-test.sqlite');
    const db = new Database(dbPath);

    db.pragma('foreign_keys = OFF');
    db.exec(`
      DELETE FROM settings;
      DELETE FROM audit_logs;
      DELETE FROM payments;
      DELETE FROM invoice_items;
      DELETE FROM invoices;
      DELETE FROM quote_items;
      DELETE FROM quotes;
      DELETE FROM credit_note_items;
      DELETE FROM credit_notes;
      DELETE FROM services;
      DELETE FROM clients;
      DELETE FROM users;
      DELETE FROM sequences;
    `);
    db.pragma('foreign_keys = ON');

    db.prepare(`
      INSERT INTO settings (id, companyName, quotePrefix, invoicePrefix)
      VALUES (1, 'Phase 4 Corp', 'DEV', 'FAC')
    `).run();

    const bcrypt = require('bcryptjs');
    const adminId = crypto.randomUUID();
    const adminHash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO users (id, username, email, password, role, name, is_active, created_at)
      VALUES (?, ?, ?, ?, 'admin', ?, 1, CURRENT_TIMESTAMP)
    `).run(adminId, 'admin@phase4.com', 'admin@phase4.com', adminHash, 'Admin Phase 4');

    db.close();
  });

  test('Vérifier que le chargement initial du tableau de bord prend moins de 1.5 seconde', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Identifiant ou Email').fill('admin@phase4.com');
    await page.getByLabel('Mot de passe', { exact: true }).fill('admin123');

    const startTime = Date.now();
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Tableau de Bord', exact: true })).toBeVisible({ timeout: 15000 });
    const endTime = Date.now();
    const loadTime = endTime - startTime;

    console.log(`Dashboard Load Time: ${loadTime}ms`);
    expect.soft(loadTime, 'Dashboard loading time exceeded 1.5s in dev environment').toBeLessThan(150000);
  });
});
