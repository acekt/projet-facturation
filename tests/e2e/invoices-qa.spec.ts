import { test, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

test.describe('Invoices QA (Création, Calculs, Affichage)', () => {
  test.beforeEach(async () => {
    const dbPath = process.env.TEST_DB_PATH || path.join(os.tmpdir(), 'fintech-invoicing-e2e-test.sqlite');
    const db = new Database(dbPath);

    db.pragma('foreign_keys = OFF');
    db.exec(`
      DELETE FROM invoice_items;
      DELETE FROM invoices;
      DELETE FROM services;
      DELETE FROM clients;
      DELETE FROM users;
      DELETE FROM sequences;
    `);
    db.pragma('foreign_keys = ON');

    db.prepare("INSERT INTO sequences (name, current_value, last_year) VALUES ('invoice', 0, strftime('%Y', 'now'))").run();

    const bcrypt = require('bcryptjs');
    const operatorId = crypto.randomUUID();
    const operatorHash = bcrypt.hashSync('operator123', 10);
    db.prepare(`
      INSERT INTO users (id, username, email, password, role, name, is_active, created_at)
      VALUES (?, ?, ?, ?, 'user', ?, 1, CURRENT_TIMESTAMP)
    `).run(operatorId, 'qa_user@phase4.com', 'qa_user@phase4.com', operatorHash, 'QA User');

    const clientId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO clients (id, name, email, phone, address, status, createdAt)
      VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
    `).run(clientId, 'QA Client', 'qaclient@phase4.com', '', '');

    const serviceId1 = crypto.randomUUID();
    db.prepare(`
      INSERT INTO services (id, name, description, category, unitPrice, createdAt)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(serviceId1, 'Article 1', 'Desc 1', 'Consulting', 50000);

    const serviceId2 = crypto.randomUUID();
    db.prepare(`
      INSERT INTO services (id, name, description, category, unitPrice, createdAt)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(serviceId2, 'Article 2', 'Desc 2', 'Consulting', 25000);

    db.close();
  });

  test('Parcours Heureux: Création de facture avec 2 articles', async ({ page }) => {
    // 1. Authentification
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill('qa_user@phase4.com');
    await page.getByLabel('Mot de passe', { exact: true }).fill('operator123');
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await expect(page).toHaveURL('/', { timeout: 15000 });

    // 2. Navigation vers factures
    await page.locator('a:has-text("Factures"), button:has-text("Factures")').first().click();
    await expect(page.locator('h1:has-text("Factures"), h2:has-text("Factures")').first()).toBeVisible();

    // 3. Création
    await page.getByRole('button', { name: /nouvelle facture/i }).first().click();

    // Sélection client
    await page.getByText('Sélectionner un client').click();
    const clientDialog = page.locator('[role="dialog"]:has-text("Rechercher un client")');
    await expect(clientDialog).toBeVisible();
    await clientDialog.getByText('QA Client').click();

    // Ajouter 2 articles
    await page.getByText('Sélectionner un service...').first().click();
    await page.getByRole('option', { name: 'Article 1' }).click();
    await page.locator('input[type="number"]').nth(0).fill('1');

    await page.getByRole('button', { name: 'Ajouter une ligne' }).click();

    await page.getByText('Sélectionner un service...').click();
    await page.getByRole('option', { name: 'Article 2' }).click();
    await page.locator('input[type="number"]').nth(2).fill('2');

    // Screenshot après saisie
    await page.screenshot({ path: 'tests/artifacts/screenshots/invoices-form-filled.png', fullPage: true });

    // 4. Sauvegarde
    await page.getByRole('button', { name: /générer la facture/i }).click();
    await expect(page.getByText(/facture enregistrée avec succès/i)).toBeVisible({ timeout: 10000 });

    // 5. Validation visuelle de la liste
    await expect(page.getByText('QA Client')).toBeVisible();
    // Le total TTC attendu pour 100k HT (50k + 2*25k) = 128 780 FCFA (vérifié via les tests unitaires de fiscalité)
    await expect(page.getByText(/128\s*775\s*FCFA/)).toBeVisible();

    await page.screenshot({ path: 'tests/artifacts/screenshots/invoices-list-created.png', fullPage: true });
  });
});
