# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: quotes-qa.spec.ts >> Quotes QA (Conversion et UI) >> Conversion de devis en facture
- Location: tests\e2e\quotes-qa.spec.ts:41:7

# Error details

```
TimeoutError: locator.click: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('.border-dashed').getByRole('button', { name: 'Nouveau devis', exact: true })

```

# Page snapshot

```yaml
- generic [ref=f1e1]:
  - generic [ref=f1e2]:
    - complementary [ref=f1e3]:
      - generic [ref=f1e9]:
        - generic [ref=f1e10]: L'ÉTOILE
        - generic [ref=f1e11]: Opérations
      - button "Nouveau devis" [ref=f1e13] [cursor=pointer]
      - generic [ref=f1e15]:
        - generic [ref=f1e16]:
          - paragraph [ref=f1e17]: Système
          - button "Tableau de bord" [ref=f1e18] [cursor=pointer]
        - generic [ref=f1e26]:
          - paragraph [ref=f1e27]: Opérations
          - button "Devis" [active] [ref=f1e28] [cursor=pointer]
          - button "Factures" [ref=f1e33] [cursor=pointer]
          - button "Paiements" [ref=f1e38] [cursor=pointer]
          - button "Avoirs" [ref=f1e42] [cursor=pointer]
      - generic [ref=f1e49]:
        - button "Paramètres" [ref=f1e51] [cursor=pointer]
        - generic [ref=f1e56]:
          - generic [ref=f1e57]: QA
          - generic [ref=f1e59]:
            - paragraph [ref=f1e60]: QA User Quote
            - button "Déconnexion" [ref=f1e61] [cursor=pointer]
      - button [ref=f1e65] [cursor=pointer]
    - banner [ref=f1e68]:
      - button "Rechercher... K" [ref=f1e69] [cursor=pointer]:
        - generic [ref=f1e73]: Rechercher...
        - generic [ref=f1e74]: K
      - generic [ref=f1e79]:
        - button "Basculer le theme" [ref=f1e80] [cursor=pointer]
        - button [ref=f1e83] [cursor=pointer]
    - generic [ref=f1e88]:
      - heading "Command Palette" [level=2] [ref=f1e89]
      - paragraph [ref=f1e90]: Search for a command to run...
    - main [ref=f1e91]:
      - generic [ref=f1e93]:
        - generic [ref=f1e95]:
          - heading "Tableau de Bord" [level=1] [ref=f1e96]
          - paragraph [ref=f1e97]: Espace Opérateur
        - generic [ref=f1e98]:
          - generic [ref=f1e99]:
            - generic [ref=f1e100]: Mes Devis Actifs
            - generic [ref=f1e105]:
              - paragraph [ref=f1e106]: "0"
              - paragraph [ref=f1e107]: Non convertis en factures
          - generic [ref=f1e108]:
            - generic [ref=f1e109]: Factures Payées
            - generic [ref=f1e114]:
              - paragraph [ref=f1e115]: "0"
              - paragraph [ref=f1e116]: Règlements complets
          - generic [ref=f1e117]:
            - generic [ref=f1e118]: Factures Partielles
            - generic [ref=f1e123]:
              - paragraph [ref=f1e124]: "0"
              - paragraph [ref=f1e125]: Acomptes reçus
          - generic [ref=f1e126]:
            - generic [ref=f1e127]: Factures Non Payées
            - generic [ref=f1e131]:
              - paragraph [ref=f1e132]: "0"
              - paragraph [ref=f1e133]: En attente de paiement
        - generic [ref=f1e134]:
          - generic [ref=f1e135]:
            - generic [ref=f1e137]:
              - generic [ref=f1e138]: Performance de Facturation
              - generic [ref=f1e139]: Revenus encaissés (XAF)
            - paragraph [ref=f1e146]: Aucune donnée financière générée sur cette période.
          - generic [ref=f1e147]:
            - generic [ref=f1e148]: Performance
            - generic [ref=f1e154]:
              - generic [ref=f1e155]:
                - generic [ref=f1e156]:
                  - generic [ref=f1e157]: Croissance
                  - generic [ref=f1e158]: +0.0%
                - paragraph [ref=f1e159]: vs mois précédent
              - generic [ref=f1e160]:
                - generic [ref=f1e161]:
                  - generic [ref=f1e162]: Chiffre d'Affaires
                  - generic [ref=f1e163]: Mois
                - paragraph [ref=f1e164]: 0 FCFA
        - generic [ref=f1e166]:
          - generic [ref=f1e167]:
            - generic [ref=f1e168]: Activité Récente
            - generic [ref=f1e169]: Derniers documents émis
          - button "TOUT VOIR" [ref=f1e170] [cursor=pointer]
  - region "Notifications alt+T"
  - alert [ref=f1e171]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import Database from 'better-sqlite3';
  3  | import path from 'path';
  4  | import crypto from 'crypto';
  5  | import os from 'os';
  6  | 
  7  | test.describe('Quotes QA (Conversion et UI)', () => {
  8  |   test.beforeEach(async () => {
  9  |     const dbPath = process.env.TEST_DB_PATH || path.join(os.tmpdir(), 'fintech-invoicing-e2e-test.sqlite');
  10 |     const db = new Database(dbPath);
  11 | 
  12 |     db.pragma('foreign_keys = OFF');
  13 |     db.exec(`
  14 |       DELETE FROM quotes;
  15 |       DELETE FROM clients;
  16 |       DELETE FROM users;
  17 |       DELETE FROM sequences;
  18 |     `);
  19 |     db.pragma('foreign_keys = ON');
  20 | 
  21 |     db.prepare("INSERT INTO sequences (name, current_value, last_year) VALUES ('quote', 0, strftime('%Y', 'now'))").run();
  22 |     db.prepare("INSERT INTO sequences (name, current_value, last_year) VALUES ('invoice', 0, strftime('%Y', 'now'))").run();
  23 | 
  24 |     const bcrypt = require('bcryptjs');
  25 |     const operatorId = crypto.randomUUID();
  26 |     const operatorHash = bcrypt.hashSync('operator123', 10);
  27 |     db.prepare(`
  28 |       INSERT INTO users (id, username, email, password, role, name, is_active, created_at)
  29 |       VALUES (?, ?, ?, ?, 'user', ?, 1, CURRENT_TIMESTAMP)
  30 |     `).run(operatorId, 'qa_quote@phase4.com', 'qa_quote@phase4.com', operatorHash, 'QA User Quote');
  31 | 
  32 |     const clientId = crypto.randomUUID();
  33 |     db.prepare(`
  34 |       INSERT INTO clients (id, name, email, phone, address, status, createdAt)
  35 |       VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
  36 |     `).run(clientId, 'QA Client Quote', 'qaclient2@phase4.com', '', '');
  37 | 
  38 |     db.close();
  39 |   });
  40 | 
  41 |   test('Conversion de devis en facture', async ({ page }) => {
  42 |     // Authentification
  43 |     await page.goto('/login');
  44 |     await page.getByLabel('Identifiant ou Email').fill('qa_quote@phase4.com');
  45 |     await page.getByLabel('Mot de passe', { exact: true }).fill('operator123');
  46 |     await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  47 |     await expect(page).toHaveURL('/', { timeout: 15000 });
  48 | 
  49 |     // Création d'un devis
  50 |     await page.getByRole('button', { name: 'Devis', exact: true }).click();
> 51 |     await page.locator('.border-dashed').getByRole('button', { name: 'Nouveau devis', exact: true }).click();
     |                                                                                                      ^ TimeoutError: locator.click: Timeout 10000ms exceeded.
  52 | 
  53 |     await page.getByText('Sélectionner un client').click();
  54 |     const clientDialog = page.locator('[role="dialog"]:has-text("Rechercher un client")');
  55 |     await expect(clientDialog).toBeVisible();
  56 |     await clientDialog.getByText('QA Client Quote').click();
  57 | 
  58 |     await page.getByPlaceholder('Description de la prestation...').first().fill('Mission QA');
  59 |     await page.getByPlaceholder('0', { exact: true }).first().fill('1');
  60 |     await page.getByPlaceholder('0.00', { exact: true }).first().fill('200000');
  61 | 
  62 |     await page.getByRole('button', { name: 'Enregistrer le Devis', exact: true }).click();
  63 |     await expect(page.locator('text=Devis enregistré avec succès')).toBeVisible({ timeout: 10000 });
  64 | 
  65 |     await page.screenshot({ path: 'tests/artifacts/screenshots/quote-created.png', fullPage: true });
  66 | 
  67 |     // Conversion
  68 |     await expect(page.locator('text=QA Client Quote')).toBeVisible();
  69 |     await page.locator('table').locator('tr').filter({ hasText: 'QA Client Quote' }).getByRole('button').click();
  70 |     await page.getByRole('menuitem', { name: 'Convertir en facture' }).click();
  71 | 
  72 |     await expect(page.locator('text=Devis converti en facture avec succès')).toBeVisible();
  73 | 
  74 |     // Vérification du badge converti
  75 |     await expect(page.getByText('Converti')).toBeVisible();
  76 |     await page.screenshot({ path: 'tests/artifacts/screenshots/quote-converted.png', fullPage: true });
  77 |   });
  78 | });
  79 | 
```