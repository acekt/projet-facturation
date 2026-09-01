# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: invoices-qa.spec.ts >> Invoices QA (Création, Calculs, Affichage) >> Parcours Heureux: Création de facture avec 2 articles
- Location: tests\e2e\invoices-qa.spec.ts:42:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('h1:has-text("Factures"), h2:has-text("Factures")').first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('h1:has-text("Factures"), h2:has-text("Factures")').first()

```

```yaml
- complementary:
  - text: L'ÉTOILE Opérations
  - button "Nouveau devis"
  - paragraph: Système
  - button "Tableau de bord"
  - paragraph: Opérations
  - button "Devis"
  - button "Factures"
  - button "Paiements"
  - button "Avoirs"
  - button "Paramètres"
  - text: QA
  - paragraph: QA User
  - button "Déconnexion"
  - button
- banner:
  - button "Rechercher... K"
  - button "Basculer le theme"
  - button
- heading "Command Palette" [level=2]
- paragraph: Search for a command to run...
- main:
  - heading "Tableau de Bord" [level=1]
  - paragraph: Espace Opérateur
  - text: Mes Devis Actifs
  - paragraph: "0"
  - paragraph: Non convertis en factures
  - text: Factures Payées
  - paragraph: "0"
  - paragraph: Règlements complets
  - text: Factures Partielles
  - paragraph: "0"
  - paragraph: Acomptes reçus
  - text: Factures Non Payées
  - paragraph: "0"
  - paragraph: En attente de paiement
  - text: Performance de Facturation Revenus encaissés (XAF)
  - paragraph: Aucune donnée financière générée sur cette période.
  - text: Performance Croissance +0.0%
  - paragraph: vs mois précédent
  - text: Chiffre d'Affaires Mois
  - paragraph: 0 FCFA
  - text: Activité Récente Derniers documents émis
  - button "TOUT VOIR"
- region "Notifications alt+T"
- alert
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import Database from 'better-sqlite3';
  3  | import path from 'path';
  4  | import crypto from 'crypto';
  5  | import os from 'os';
  6  | 
  7  | test.describe('Invoices QA (Création, Calculs, Affichage)', () => {
  8  |   test.beforeEach(async () => {
  9  |     const dbPath = process.env.TEST_DB_PATH || path.join(os.tmpdir(), 'fintech-invoicing-e2e-test.sqlite');
  10 |     const db = new Database(dbPath);
  11 | 
  12 |     db.pragma('foreign_keys = OFF');
  13 |     db.exec(`
  14 |       DELETE FROM invoice_items;
  15 |       DELETE FROM invoices;
  16 |       DELETE FROM services;
  17 |       DELETE FROM clients;
  18 |       DELETE FROM users;
  19 |       DELETE FROM sequences;
  20 |     `);
  21 |     db.pragma('foreign_keys = ON');
  22 | 
  23 |     db.prepare("INSERT INTO sequences (name, current_value, last_year) VALUES ('invoice', 0, strftime('%Y', 'now'))").run();
  24 | 
  25 |     const bcrypt = require('bcryptjs');
  26 |     const operatorId = crypto.randomUUID();
  27 |     const operatorHash = bcrypt.hashSync('operator123', 10);
  28 |     db.prepare(`
  29 |       INSERT INTO users (id, username, email, password, role, name, is_active, created_at)
  30 |       VALUES (?, ?, ?, ?, 'user', ?, 1, CURRENT_TIMESTAMP)
  31 |     `).run(operatorId, 'qa_user@phase4.com', 'qa_user@phase4.com', operatorHash, 'QA User');
  32 | 
  33 |     const clientId = crypto.randomUUID();
  34 |     db.prepare(`
  35 |       INSERT INTO clients (id, name, email, phone, address, status, createdAt)
  36 |       VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
  37 |     `).run(clientId, 'QA Client', 'qaclient@phase4.com', '', '');
  38 | 
  39 |     db.close();
  40 |   });
  41 | 
  42 |   test('Parcours Heureux: Création de facture avec 2 articles', async ({ page }) => {
  43 |     // 1. Authentification
  44 |     await page.goto('/login');
  45 |     await page.getByLabel('Identifiant ou Email').fill('qa_user@phase4.com');
  46 |     await page.getByLabel('Mot de passe', { exact: true }).fill('operator123');
  47 |     await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  48 |     await expect(page).toHaveURL('/', { timeout: 15000 });
  49 | 
  50 |     // 2. Navigation vers factures
  51 |     await page.locator('a:has-text("Factures"), button:has-text("Factures")').first().click();
> 52 |     await expect(page.locator('h1:has-text("Factures"), h2:has-text("Factures")').first()).toBeVisible();
     |                                                                                            ^ Error: expect(locator).toBeVisible() failed
  53 | 
  54 |     // 3. Création
  55 |     await page.locator('.border-dashed').getByRole('button', { name: /nouvelle facture/i }).click();
  56 | 
  57 |     // Sélection client
  58 |     await page.getByText('Sélectionner un client').click();
  59 |     const clientDialog = page.locator('[role="dialog"]:has-text("Rechercher un client")');
  60 |     await expect(clientDialog).toBeVisible();
  61 |     await clientDialog.getByText('QA Client').click();
  62 | 
  63 |     // Ajouter 2 articles
  64 |     await page.getByPlaceholder('Description de la prestation...').first().fill('Article 1');
  65 |     await page.getByPlaceholder('0', { exact: true }).first().fill('1');
  66 |     await page.getByPlaceholder('0.00', { exact: true }).first().fill('50000');
  67 | 
  68 |     await page.getByRole('button', { name: 'Ajouter une ligne' }).click();
  69 | 
  70 |     await page.getByPlaceholder('Description de la prestation...').nth(1).fill('Article 2');
  71 |     await page.getByPlaceholder('0', { exact: true }).nth(1).fill('2');
  72 |     await page.getByPlaceholder('0.00', { exact: true }).nth(1).fill('25000');
  73 | 
  74 |     // Screenshot après saisie
  75 |     await page.screenshot({ path: 'tests/artifacts/screenshots/invoices-form-filled.png', fullPage: true });
  76 | 
  77 |     // 4. Sauvegarde
  78 |     await page.getByRole('button', { name: /créer la facture/i }).click();
  79 |     await expect(page.getByText(/facture créée avec succès/i)).toBeVisible({ timeout: 10000 });
  80 | 
  81 |     // 5. Validation visuelle de la liste
  82 |     await expect(page.getByText('QA Client')).toBeVisible();
  83 |     // Le total TTC attendu pour 100k HT (50k + 2*25k) = 128 780 FCFA (vérifié via les tests unitaires de fiscalité)
  84 |     await expect(page.getByText(/128\s*780\s*FCFA/)).toBeVisible();
  85 | 
  86 |     await page.screenshot({ path: 'tests/artifacts/screenshots/invoices-list-created.png', fullPage: true });
  87 |   });
  88 | });
  89 | 
```