import { test, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

test.describe('Dashboard QA (Typage et Affichage)', () => {
  test.beforeEach(async () => {
    const dbPath = process.env.TEST_DB_PATH || path.join(os.tmpdir(), 'fintech-invoicing-e2e-test.sqlite');
    const db = new Database(dbPath);

    db.pragma('foreign_keys = OFF');
    db.exec(`
      DELETE FROM invoices;
      DELETE FROM clients;
      DELETE FROM users;
      DELETE FROM settings;
    `);
    db.pragma('foreign_keys = ON');

    db.prepare(`
      INSERT INTO settings (id, companyName, quotePrefix, invoicePrefix, tvaRate, tpsRate, cssRate)
      VALUES (1, 'QA Corp', 'DEV', 'FAC', 18, 9.5, 1)
    `).run();

    const bcrypt = require('bcryptjs');
    const operatorId = crypto.randomUUID();
    const operatorHash = bcrypt.hashSync('operator123', 10);
    db.prepare(`
      INSERT INTO users (id, username, email, password, role, name, is_active, created_at)
      VALUES (?, ?, ?, ?, 'user', ?, 1, CURRENT_TIMESTAMP)
    `).run(operatorId, 'dashboard@phase4.com', 'dashboard@phase4.com', operatorHash, 'Dashboard User');

    const clientId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO clients (id, name, email, phone, address, status, createdAt)
      VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
    `).run(clientId, 'Client Dashboard', 'client@dashboard.com', '', '');

    // Inserer une facture payée pour avoir des métriques
    const invoiceId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO invoices (id, number, clientId, clientName, date, subtotal, taxBase, tvaAmount, total, status, created_by)
      VALUES (?, 'F-100', ?, 'Client Dashboard', '2026-01-01', 10000, 10100, 1818, 11918, 'UNPAID', ?)
    `).run(invoiceId, clientId, operatorId);

    db.close();
  });

  test('Affichage correct des métriques du Dashboard (Refactoring type strict)', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Identifiant ou Email').fill('dashboard@phase4.com');
    await page.getByLabel('Mot de passe', { exact: true }).fill('operator123');
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await expect(page).toHaveURL('/', { timeout: 15000 });

    await expect(page.getByRole('heading', { name: 'Tableau de Bord', exact: true })).toBeVisible({ timeout: 15000 });

    // Attendre que les skeletons disparaissent
    await expect(page.locator('text=Chargement sécurisé de votre espace...')).not.toBeVisible({ timeout: 15000 });

    // Vérifier les valeurs chiffrées (Factures impayées)
    // "11 918 FCFA" (sans espace insécable strict car la regex gère les deux)
    await expect(page.getByText(/11\s*918\s*FCFA/)).toBeVisible();

    // Screenshot final du dashboard
    await page.screenshot({ path: 'tests/artifacts/screenshots/dashboard-metrics.png', fullPage: true });
  });
});
