# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard-qa.spec.ts >> Dashboard QA (Typage et Affichage) >> Affichage correct des métriques du Dashboard (Refactoring type strict)
- Location: tests\e2e\dashboard-qa.spec.ts:50:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/11\s*918\s*FCFA/)
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByText(/11\s*918\s*FCFA/)

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
  - text: DA
  - paragraph: Dashboard User
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
  - paragraph: "1"
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
  7  | test.describe('Dashboard QA (Typage et Affichage)', () => {
  8  |   test.beforeEach(async () => {
  9  |     const dbPath = process.env.TEST_DB_PATH || path.join(os.tmpdir(), 'fintech-invoicing-e2e-test.sqlite');
  10 |     const db = new Database(dbPath);
  11 | 
  12 |     db.pragma('foreign_keys = OFF');
  13 |     db.exec(`
  14 |       DELETE FROM invoices;
  15 |       DELETE FROM clients;
  16 |       DELETE FROM users;
  17 |       DELETE FROM settings;
  18 |     `);
  19 |     db.pragma('foreign_keys = ON');
  20 | 
  21 |     db.prepare(`
  22 |       INSERT INTO settings (id, companyName, quotePrefix, invoicePrefix, tvaRate, tpsRate, cssRate)
  23 |       VALUES (1, 'QA Corp', 'DEV', 'FAC', 18, 9.5, 1)
  24 |     `).run();
  25 | 
  26 |     const bcrypt = require('bcryptjs');
  27 |     const operatorId = crypto.randomUUID();
  28 |     const operatorHash = bcrypt.hashSync('operator123', 10);
  29 |     db.prepare(`
  30 |       INSERT INTO users (id, username, email, password, role, name, is_active, created_at)
  31 |       VALUES (?, ?, ?, ?, 'user', ?, 1, CURRENT_TIMESTAMP)
  32 |     `).run(operatorId, 'dashboard@phase4.com', 'dashboard@phase4.com', operatorHash, 'Dashboard User');
  33 | 
  34 |     const clientId = crypto.randomUUID();
  35 |     db.prepare(`
  36 |       INSERT INTO clients (id, name, email, phone, address, status, createdAt)
  37 |       VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
  38 |     `).run(clientId, 'Client Dashboard', 'client@dashboard.com', '', '');
  39 | 
  40 |     // Inserer une facture payée pour avoir des métriques
  41 |     const invoiceId = crypto.randomUUID();
  42 |     db.prepare(`
  43 |       INSERT INTO invoices (id, number, clientId, clientName, date, subtotal, taxBase, tvaAmount, total, status, created_by)
  44 |       VALUES (?, 'F-100', ?, 'Client Dashboard', '2026-01-01', 10000, 10100, 1818, 11918, 'UNPAID', ?)
  45 |     `).run(invoiceId, clientId, operatorId);
  46 | 
  47 |     db.close();
  48 |   });
  49 | 
  50 |   test('Affichage correct des métriques du Dashboard (Refactoring type strict)', async ({ page }) => {
  51 |     await page.goto('/login');
  52 |     await page.getByLabel('Identifiant ou Email').fill('dashboard@phase4.com');
  53 |     await page.getByLabel('Mot de passe', { exact: true }).fill('operator123');
  54 |     await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  55 |     await expect(page).toHaveURL('/', { timeout: 15000 });
  56 | 
  57 |     await expect(page.getByRole('heading', { name: 'Tableau de Bord', exact: true })).toBeVisible({ timeout: 15000 });
  58 | 
  59 |     // Attendre que les skeletons disparaissent
  60 |     await expect(page.locator('text=Chargement sécurisé de votre espace...')).not.toBeVisible({ timeout: 15000 });
  61 | 
  62 |     // Vérifier les valeurs chiffrées (Factures impayées)
  63 |     // "11 918 FCFA" (sans espace insécable strict car la regex gère les deux)
> 64 |     await expect(page.getByText(/11\s*918\s*FCFA/)).toBeVisible();
     |                                                     ^ Error: expect(locator).toBeVisible() failed
  65 | 
  66 |     // Screenshot final du dashboard
  67 |     await page.screenshot({ path: 'tests/artifacts/screenshots/dashboard-metrics.png', fullPage: true });
  68 |   });
  69 | });
  70 | 
```