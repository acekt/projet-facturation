# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: critical-path.spec.ts >> Parcours Critique E2E — Le Tunnel de Vente (L'Étoile) >> exécute le parcours critique complet : Connexion -> Client -> Devis -> Facture -> Paiement partiel
- Location: tests\e2e\critical-path.spec.ts:75:7

# Error details

```
TimeoutError: locator.click: Timeout 10000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Clients' })

```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
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
          - button "Devis" [ref=f1e28] [cursor=pointer]
          - button "Factures" [ref=f1e33] [cursor=pointer]
          - button "Paiements" [ref=f1e38] [cursor=pointer]
          - button "Avoirs" [ref=f1e42] [cursor=pointer]
      - generic [ref=f1e49]:
        - button "Paramètres" [ref=f1e51] [cursor=pointer]
        - generic [ref=f1e56]:
          - generic [ref=f1e57]: JE
          - generic [ref=f1e59]:
            - paragraph [ref=f1e60]: Jean-Baptiste Moussavou
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
  1   | import { ROLES, QUOTE_STATUS, INVOICE_STATUS, CLIENT_STATUS } from '@/lib/constants';
  2   | import { test, expect } from '@playwright/test';
  3   | import Database from 'better-sqlite3';
  4   | import path from 'path';
  5   | import crypto from 'crypto';
  6   | 
  7   | /**
  8   |  * TEST E2E PLAYWRIGHT — LE PARCOURS CRITIQUE (LE TUNNEL DE VENTE)
  9   |  * ================================================================
  10  |  * Ce scénario simule un parcours opérateur complet de bout en bout :
  11  |  * 1. Connexion en tant qu'opérateur (operateur@letoile.ga)
  12  |  * 2. Création d'un nouveau client via la modale dédiée
  13  |  * 3. Création d'un devis pour ce client, ajout d'une ligne de service, enregistrement et conversion en facture
  14  |  * 4. Navigation vers la facture convertie, enregistrement d'un paiement partiel (acompte) et vérification du statut "Partiel"
  15  |  */
  16  | 
  17  | test.describe('Parcours Critique E2E — Le Tunnel de Vente (L\'Étoile)', () => {
  18  | 
  19  |   test.beforeEach(async () => {
  20  |     const dataDir = path.join(process.cwd(), 'data');
  21  |     if (!require('fs').existsSync(dataDir)) {
  22  |       require('fs').mkdirSync(dataDir, { recursive: true });
  23  |     }
  24  |     const dbPath = path.join(dataDir, 'database.sqlite');
  25  |     const db = new Database(dbPath);
  26  | 
  27  |     // Purge de toutes les tables pour garantir l'idempotence absolue du test
  28  |     db.pragma('foreign_keys = OFF');
  29  |     db.exec(`
  30  |       DELETE FROM audit_logs;
  31  |       DELETE FROM payments;
  32  |       DELETE FROM invoice_items;
  33  |       DELETE FROM invoices;
  34  |       DELETE FROM quote_items;
  35  |       DELETE FROM quotes;
  36  |       DELETE FROM credit_note_items;
  37  |       DELETE FROM credit_notes;
  38  |       DELETE FROM services;
  39  |       DELETE FROM clients;
  40  |       DELETE FROM users;
  41  |       DELETE FROM sequences;
  42  |     `);
  43  |     db.pragma('foreign_keys = ON');
  44  | 
  45  |     // Réinitialisation des séquences chronologiques
  46  |     db.prepare("INSERT INTO sequences (name, current_value, last_year) VALUES ('quote', 0, strftime('%Y', 'now'))").run();
  47  |     db.prepare("INSERT INTO sequences (name, current_value, last_year) VALUES ('invoice', 0, strftime('%Y', 'now'))").run();
  48  | 
  49  |     // Création du compte opérateur standard et de l'administrateur
  50  |     const bcrypt = require('bcryptjs');
  51  |     const operatorId = crypto.randomUUID();
  52  |     const operatorHash = bcrypt.hashSync('operateur123', 10);
  53  |     db.prepare(`
  54  |       INSERT INTO users (id, username, email, password, role, name, is_active, created_at)
  55  |       VALUES (?, ?, ?, ?, 'user', ?, 1, CURRENT_TIMESTAMP)
  56  |     `).run(operatorId, 'operateur@letoile.ga', 'operateur@letoile.ga', operatorHash, 'Jean-Baptiste Moussavou');
  57  | 
  58  |     const adminId = crypto.randomUUID();
  59  |     const adminHash = bcrypt.hashSync('admin123', 10);
  60  |     db.prepare(`
  61  |       INSERT INTO users (id, username, email, password, role, name, is_active, created_at)
  62  |       VALUES (?, ?, ?, ?, 'admin', ?, 1, CURRENT_TIMESTAMP)
  63  |     `).run(adminId, 'admin@letoile.ga', 'admin@letoile.ga', adminHash, 'Administrateur Système');
  64  | 
  65  |     // Création d'un service au catalogue
  66  |     const serviceId = crypto.randomUUID();
  67  |     db.prepare(`
  68  |       INSERT INTO services (id, name, description, category, unitPrice, createdAt)
  69  |       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  70  |     `).run(serviceId, 'Consulting IT Gabonese', 'Prestation de conseil IT et architecture', 'Consulting', 150000);
  71  | 
  72  |     db.close();
  73  |   });
  74  | 
  75  |   test('exécute le parcours critique complet : Connexion -> Client -> Devis -> Facture -> Paiement partiel', async ({ page }) => {
  76  |     // ══════════════════════════════════════════════════════════════════════
  77  |     // ÉTAPE 1 : CONNEXION
  78  |     // ══════════════════════════════════════════════════════════════════════
  79  |     await page.goto('/login');
  80  | 
  81  |     await page.getByLabel('Identifiant ou Email').fill('operateur@letoile.ga');
  82  |     await page.getByLabel('Mot de passe').fill('operateur123');
  83  |     await page.getByRole('button', { name: /Se connecter/i }).click();
  84  | 
  85  |     // Vérification de la redirection et de l'affichage du PageHeader du Dashboard
  86  |     await expect(page).toHaveURL('/');
  87  |     await expect(page.locator('h1:has-text("Tableau de bord"), h2:has-text("Tableau de bord")').first()).toBeVisible({ timeout: 15000 });
  88  | 
  89  |     // ══════════════════════════════════════════════════════════════════════
  90  |     // ÉTAPE 2 : CRÉATION D'UN CLIENT
  91  |     // ══════════════════════════════════════════════════════════════════════
> 92  |     await page.getByRole('button', { name: 'Clients' }).click();
      |                                                         ^ TimeoutError: locator.click: Timeout 10000ms exceeded.
  93  |     await expect(page.locator('h1:has-text("Clients"), h2:has-text("Clients")').first()).toBeVisible();
  94  | 
  95  |     await page.getByRole('button', { name: /Nouveau client/i }).click();
  96  | 
  97  |     await page.getByLabel('Nom complet / Raison sociale').fill('Société Gabonaise de Tech');
  98  |     await page.getByLabel('Email').fill('contact@sgtech.ga');
  99  |     await page.getByLabel('Téléphone').fill('+241 01 44 55 66');
  100 |     await page.getByLabel('Adresse').fill('Boulevard Triomphal, Libreville');
  101 | 
  102 |     await page.getByRole('button', { name: /Enregistrer le client/i }).click();
  103 | 
  104 |     // Vérification de l'apparition du Toast confirmant l'ajout
  105 |     await expect(page.locator('text=Client ajouté avec succès')).toBeVisible({ timeout: 10000 });
  106 |     await expect(page.getByText('Société Gabonaise de Tech')).toBeVisible();
  107 | 
  108 |     // ══════════════════════════════════════════════════════════════════════
  109 |     // ÉTAPE 3 : CRÉATION ET CONVERSION D'UN DEVIS
  110 |     // ══════════════════════════════════════════════════════════════════════
  111 |     await page.getByRole('button', { name: 'Devis' }).click();
  112 |     await expect(page.locator('h1:has-text("Devis"), h2:has-text("Devis")').first()).toBeVisible();
  113 | 
  114 |     await page.getByRole('button', { name: /Nouveau devis/i }).click();
  115 |     await expect(page.locator('h1:has-text("Nouveau Devis")')).toBeVisible();
  116 | 
  117 |     // Sélection du client
  118 |     await page.getByText('Sélectionner un client').click();
  119 |     const clientDialog = page.locator('[role="dialog"]:has-text("Rechercher un client")');
  120 |     await expect(clientDialog).toBeVisible();
  121 |     await clientDialog.getByText('Société Gabonaise de Tech').click();
  122 |     await expect(page.getByText('contact@sgtech.ga')).toBeVisible();
  123 | 
  124 |     // Sélection de la ligne de service dans le catalogue (auto-remplit le prix unitaire 150 000 XAF)
  125 |     await page.getByText('Sélectionner un service...').click();
  126 |     await page.getByRole('option', { name: /Consulting IT Gabonese/i }).click();
  127 | 
  128 |     // Enregistrement du devis
  129 |     await page.getByRole('button', { name: /Enregistrer/i }).click();
  130 | 
  131 |     await expect(page.locator('text=Devis enregistré avec succès')).toBeVisible({ timeout: 10000 });
  132 |     await expect(page.getByText('Société Gabonaise de Tech')).toBeVisible();
  133 | 
  134 |     // Conversion du devis en facture
  135 |     const quoteRowActions = page.locator('button:has(svg)').last();
  136 |     await quoteRowActions.click();
  137 |     await page.getByRole('menuitem', { name: /Convertir en facture/i }).click();
  138 | 
  139 |     await expect(page.getByText('Devis converti en facture avec succès')).toBeVisible();
  140 |     await expect(page.getByText('Converti')).toBeVisible();
  141 | 
  142 |     // ──────────────────────────────────────────────────────────────────────
  143 |     // 3. VÉRIFICATION DU CALCUL DES TAXES ET DU TOTAL SUR LA FACTURE
  144 |     // ──────────────────────────────────────────────────────────────────────
  145 |     await page.getByRole('button', { name: 'Factures' }).click();
  146 |     await expect(page.locator('h1:has-text("Factures")')).toBeVisible();
  147 | 
  148 |     const invoiceRow = page.locator('tr:has-text("Société Gabonaise de Tech"), div:has-text("Société Gabonaise de Tech")').first();
  149 |     await expect(invoiceRow).toBeVisible();
  150 | 
  151 |     // Vérification du calcul exact des taxes (Règle métier)
  152 |     // Base : 150 000 XAF
  153 |     // CSS (1%) : 1 500 XAF
  154 |     // Base Imposable : 151 500 XAF
  155 |     // TPS (9.5%) : 14 393 XAF
  156 |     // TVA (18%) : 27 270 XAF
  157 |     // Total : 193 163 XAF
  158 |     const invoiceRowActions = page.locator('tr:has-text("Société Gabonaise de Tech"), div:has-text("Société Gabonaise de Tech")').first().locator('button').last();
  159 |     await invoiceRowActions.click();
  160 | 
  161 |     await page.getByText('Enregistrer un règlement').click();
  162 |     const paymentDialog = page.locator('[role="dialog"]:has-text("Confirmer le règlement")');
  163 |     await expect(paymentDialog).toBeVisible();
  164 | 
  165 |     // Modification du type de règlement en "Acompte / Partiel"
  166 |     await paymentDialog.locator('button[role="combobox"]').first().click();
  167 |     await page.getByRole('option', { name: /Acompte \/ Partiel/i }).click();
  168 | 
  169 |     // Saisie d'un montant partiel (ex: 50 000 XAF)
  170 |     await paymentDialog.locator('#payment-amount').fill('50000');
  171 | 
  172 |     await paymentDialog.getByRole('button', { name: /Valider l'encaissement/i }).click();
  173 | 
  174 |     // Vérification du toast et du changement visuel du badge de statut à "Partiel"
  175 |     await expect(page.locator('text=Paiement enregistré')).toBeVisible({ timeout: 10000 });
  176 |     await expect(page.locator('text=Partiel').first()).toBeVisible();
  177 |   });
  178 | });
  179 | 
```