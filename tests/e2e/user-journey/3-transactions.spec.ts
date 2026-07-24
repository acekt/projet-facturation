import { test, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import os from 'os';

test.describe('Phase 3 : User Journey (Transaction Operator)', () => {

  test.beforeEach(async () => {
    // CRITICAL FIX: The Next.js web server spawned by Playwright uses the OS tmp dir
    // as defined in playwright.config.ts `testDbPath`.
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

    db.prepare("INSERT INTO sequences (name, current_value, last_year) VALUES ('quote', 0, strftime('%Y', 'now'))").run();
    db.prepare("INSERT INTO sequences (name, current_value, last_year) VALUES ('invoice', 0, strftime('%Y', 'now'))").run();

    db.prepare(`
      INSERT INTO settings (id, companyName, quotePrefix, invoicePrefix)
      VALUES (1, 'Phase 3 Corp', 'DEV', 'FAC')
    `).run();

    const bcrypt = require('bcryptjs');
    const operatorId = crypto.randomUUID();
    const operatorHash = bcrypt.hashSync('operator123', 10);
    db.prepare(`
      INSERT INTO users (id, username, email, password, role, name, is_active, created_at)
      VALUES (?, ?, ?, ?, 'user', ?, 1, CURRENT_TIMESTAMP)
    `).run(operatorId, 'operator@phase3.com', 'operator@phase3.com', operatorHash, 'John Operator');

    // SEED CLIENT IN DB SO OPERATOR DOES NOT NEED TO ACCESS /clients
    const clientId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO clients (id, name, email, phone, address, status, createdAt)
      VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
    `).run(clientId, 'Client Phase 3', 'client@phase3.com', '', '');

    // SEED A SERVICE TO AVOID UI ISSUES
    const serviceId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO services (id, name, description, category, unitPrice, createdAt)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(serviceId, 'Consulting IT Gabonese', 'Prestation de conseil IT et architecture', 'Consulting', 150000);

    db.close();
  });

  test('Parcours Opérateur complet (Devis -> Facture -> Paiement)', async ({ page }) => {
    await page.goto('/login');

    await expect(page).toHaveURL(/.*\/login/);

    await page.getByLabel('Identifiant ou Email').fill('operator@phase3.com');
    await page.getByLabel('Mot de passe', { exact: true }).fill('operator123');
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click();

    await expect(page).toHaveURL('/', { timeout: 15000 });

    await expect(page.getByRole('heading', { name: 'Tableau de Bord', exact: true })).toBeVisible({ timeout: 15000 });

    // Go straight to Devis
    await page.getByRole('button', { name: 'Devis', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Devis', exact: true })).toBeVisible();

    // Select the button that is inside the empty state to avoid resolving to both header and empty state
    await page.locator('.border-dashed').getByRole('button', { name: 'Nouveau devis', exact: true }).click();

    await page.getByText('Sélectionner un client').click();
    const clientDialog = page.locator('[role="dialog"]:has-text("Rechercher un client")');
    await expect(clientDialog).toBeVisible();
    await clientDialog.getByText('Client Phase 3').click();

    await page.getByText('Sélectionner un service...').click();
    await page.getByRole('option', { name: 'Consulting IT Gabonese' }).click();

    // 1. Intégrité Financière (Devis) : Vérifier que le montant total s'affiche à l'écran (avec regex pour gérer l'espace insécable potentiel)
    await expect(page.getByText(/164\s*250\s*FCFA/)).toBeVisible();

    await page.getByRole('button', { name: 'Enregistrer le Devis', exact: true }).click();
    await expect(page.locator('text=Devis enregistré avec succès')).toBeVisible({ timeout: 10000 });

    // Conversion en facture
    // Quotes list, wait for item to appear
    await expect(page.locator('text=Client Phase 3')).toBeVisible();
    // Since there is only one item in the list and we want to click its row's menu:
    // We target the table cell or the direct button inside the row.
    // The button has a MoreVertical icon, no visible text label ("Actions du document" might not be its actual name).
    // The previous timeout occurred because `name: 'Actions du document'` didn't match anything.
    await page.locator('table').locator('tr').filter({ hasText: 'Client Phase 3' }).getByRole('button').click();
    await page.getByRole('menuitem', { name: 'Convertir en facture' }).click();

    // 2. Feedback Utilisateur (Conversion) : Toast de succès
    await expect(page.locator('text=Devis converti en facture avec succès')).toBeVisible();

    await page.getByRole('button', { name: 'Factures', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Factures', exact: true })).toBeVisible();

    await expect(page.locator('text=Client Phase 3')).toBeVisible();
    await page.locator('table').locator('tr').filter({ hasText: 'Client Phase 3' }).getByRole('button').click();
    await page.getByRole('menuitem', { name: 'Enregistrer un règlement' }).click();

    const paymentDialog = page.locator('[role="dialog"]:has-text("Confirmer le règlement")');
    await expect(paymentDialog).toBeVisible();

    // Multiple comboboxes might exist (Type of payment, Payment method)
    // Select the first one (Type of payment)
    await paymentDialog.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Acompte / Partiel', exact: true }).click();

    await paymentDialog.locator('#payment-amount').fill('50000');

    await paymentDialog.getByRole('button', { name: 'Valider l\'encaissement', exact: true }).click();
    await expect(page.locator('text=Paiement enregistré')).toBeVisible({ timeout: 10000 });

    // Check partial status (the badge has label "Partiel — Payé: X | Reste: Y")
    await expect(page.getByText(/Partiel\s*—\s*Payé/)).toBeVisible();

    // We can open the invoice to view details
    await page.locator('table').locator('tr').filter({ hasText: 'Client Phase 3' }).getByRole('button').click();
    await page.getByRole('menuitem', { name: 'Aperçu' }).click();

    // 3. Traçabilité (Facture) : numéro de la facture dans l'en-tête (Dialog title ou composant d'aperçu)
    await expect(page.getByRole('heading', { name: /Aperçu du Facture - FAC-/ })).toBeVisible();

    // 4. Cohérence des Paiements : Reste à payer mis à jour
    // 164 250 - 50 000 = 114 250 FCFA
    await expect(page.getByText('RESTE À PAYER', { exact: true })).toBeVisible();
    await expect(page.getByRole('dialog').getByText('114\u202F250 FCFA', { exact: true }).first()).toBeVisible();
  });
});
