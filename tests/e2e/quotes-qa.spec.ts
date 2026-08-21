import { test, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

test.describe('Quotes QA (Conversion et UI)', () => {
  test.beforeEach(async () => {
    const dbPath = process.env.TEST_DB_PATH || path.join(os.tmpdir(), 'fintech-invoicing-e2e-test.sqlite');
    const db = new Database(dbPath);

    db.pragma('foreign_keys = OFF');
    db.exec(`
      DELETE FROM quotes;
      DELETE FROM clients;
      DELETE FROM users;
      DELETE FROM sequences;
    `);
    db.pragma('foreign_keys = ON');

    db.prepare("INSERT INTO sequences (name, current_value, last_year) VALUES ('quote', 0, strftime('%Y', 'now'))").run();
    db.prepare("INSERT INTO sequences (name, current_value, last_year) VALUES ('invoice', 0, strftime('%Y', 'now'))").run();

    const bcrypt = require('bcryptjs');
    const operatorId = crypto.randomUUID();
    const operatorHash = bcrypt.hashSync('operator123', 10);
    db.prepare(`
      INSERT INTO users (id, username, email, password, role, name, is_active, created_at)
      VALUES (?, ?, ?, ?, 'user', ?, 1, CURRENT_TIMESTAMP)
    `).run(operatorId, 'qa_quote@phase4.com', 'qa_quote@phase4.com', operatorHash, 'QA User Quote');

    const clientId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO clients (id, name, email, phone, address, status, createdAt)
      VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
    `).run(clientId, 'QA Client Quote', 'qaclient2@phase4.com', '', '');

    db.close();
  });

  test('Conversion de devis en facture', async ({ page }) => {
    // Authentification
    await page.goto('/login');
    await page.getByLabel('Identifiant ou Email').fill('qa_quote@phase4.com');
    await page.getByLabel('Mot de passe', { exact: true }).fill('operator123');
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await expect(page).toHaveURL('/', { timeout: 15000 });

    // Création d'un devis
    await page.getByRole('button', { name: 'Devis', exact: true }).click();
    await page.locator('.border-dashed').getByRole('button', { name: 'Nouveau devis', exact: true }).click();

    await page.getByText('Sélectionner un client').click();
    const clientDialog = page.locator('[role="dialog"]:has-text("Rechercher un client")');
    await expect(clientDialog).toBeVisible();
    await clientDialog.getByText('QA Client Quote').click();

    await page.getByPlaceholder('Description de la prestation...').first().fill('Mission QA');
    await page.getByPlaceholder('0', { exact: true }).first().fill('1');
    await page.getByPlaceholder('0.00', { exact: true }).first().fill('200000');

    await page.getByRole('button', { name: 'Enregistrer le Devis', exact: true }).click();
    await expect(page.locator('text=Devis enregistré avec succès')).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: 'tests/artifacts/screenshots/quote-created.png', fullPage: true });

    // Conversion
    await expect(page.locator('text=QA Client Quote')).toBeVisible();
    await page.locator('table').locator('tr').filter({ hasText: 'QA Client Quote' }).getByRole('button').click();
    await page.getByRole('menuitem', { name: 'Convertir en facture' }).click();

    await expect(page.locator('text=Devis converti en facture avec succès')).toBeVisible();

    // Vérification du badge converti
    await expect(page.getByText('Converti')).toBeVisible();
    await page.screenshot({ path: 'tests/artifacts/screenshots/quote-converted.png', fullPage: true });
  });
});
