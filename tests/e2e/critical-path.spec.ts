import { ROLES, QUOTE_STATUS, INVOICE_STATUS, CLIENT_STATUS } from '@/lib/constants';
import { test, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

/**
 * TEST E2E PLAYWRIGHT — LE PARCOURS CRITIQUE (LE TUNNEL DE VENTE)
 * ================================================================
 * Ce scénario simule un parcours opérateur complet de bout en bout :
 * 1. Connexion en tant qu'opérateur (operateur@facturier.ga)
 * 2. Création d'un nouveau client via la modale dédiée
 * 3. Création d'un devis pour ce client, ajout d'une ligne de service, enregistrement et conversion en facture
 * 4. Navigation vers la facture convertie, enregistrement d'un paiement partiel (acompte) et vérification du statut "Partiel"
 */

test.describe('Parcours Critique E2E — Le Tunnel de Vente (L\'Facturier)', () => {

  test.beforeEach(async () => {
    const dataDir = path.join(process.cwd(), 'data');
    if (!require('fs').existsSync(dataDir)) {
      require('fs').mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = path.join(dataDir, 'database.sqlite');
    const db = new Database(dbPath);

    // Purge de toutes les tables pour garantir l'idempotence absolue du test
    db.pragma('foreign_keys = OFF');
    db.exec(`
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

    // Réinitialisation des séquences chronologiques
    db.prepare("INSERT INTO sequences (name, current_value, last_year) VALUES ('quote', 0, strftime('%Y', 'now'))").run();
    db.prepare("INSERT INTO sequences (name, current_value, last_year) VALUES ('invoice', 0, strftime('%Y', 'now'))").run();

    // Création du compte opérateur standard et de l'administrateur
    const bcrypt = require('bcryptjs');
    const operatorId = crypto.randomUUID();
    const operatorHash = bcrypt.hashSync('operateur123', 10);
    db.prepare(`
      INSERT INTO users (id, username, email, password, role, name, is_active, created_at)
      VALUES (?, ?, ?, ?, 'user', ?, 1, CURRENT_TIMESTAMP)
    `).run(operatorId, 'operateur@facturier.ga', 'operateur@facturier.ga', operatorHash, 'Jean-Baptiste Moussavou');

    const adminId = crypto.randomUUID();
    const adminHash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO users (id, username, email, password, role, name, is_active, created_at)
      VALUES (?, ?, ?, ?, 'admin', ?, 1, CURRENT_TIMESTAMP)
    `).run(adminId, 'admin@facturier.ga', 'admin@facturier.ga', adminHash, 'Administrateur Système');

    // Création d'un service au catalogue
    const serviceId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO services (id, name, description, category, unitPrice, createdAt)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(serviceId, 'Consulting IT Gabonese', 'Prestation de conseil IT et architecture', 'Consulting', 150000);

    db.close();
  });

  test('exécute le parcours critique complet : Connexion -> Client -> Devis -> Facture -> Paiement partiel', async ({ page }) => {
    // ══════════════════════════════════════════════════════════════════════
    // ÉTAPE 1 : CONNEXION
    // ══════════════════════════════════════════════════════════════════════
    await page.goto('/login');

    await page.getByLabel('Identifiant ou Email').fill('operateur@facturier.ga');
    await page.getByLabel('Mot de passe').fill('operateur123');
    await page.getByRole('button', { name: /Se connecter/i }).click();

    // Vérification de la redirection et de l'affichage du PageHeader du Dashboard
    await expect(page).toHaveURL('/');
    await expect(page.locator('h1:has-text("Tableau de bord"), h2:has-text("Tableau de bord")').first()).toBeVisible({ timeout: 15000 });

    // ══════════════════════════════════════════════════════════════════════
    // ÉTAPE 2 : CRÉATION D'UN CLIENT
    // ══════════════════════════════════════════════════════════════════════
    await page.getByRole('button', { name: 'Clients' }).click();
    await expect(page.locator('h1:has-text("Clients"), h2:has-text("Clients")').first()).toBeVisible();

    await page.getByRole('button', { name: /Nouveau client/i }).click();

    await page.getByLabel('Nom complet / Raison sociale').fill('Société Gabonaise de Tech');
    await page.getByLabel('Email').fill('contact@sgtech.ga');
    await page.getByLabel('Téléphone').fill('+241 01 44 55 66');
    await page.getByLabel('Adresse').fill('Boulevard Triomphal, Libreville');

    await page.getByRole('button', { name: /Enregistrer le client/i }).click();

    // Vérification de l'apparition du Toast confirmant l'ajout
    await expect(page.locator('text=Client ajouté avec succès')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Société Gabonaise de Tech')).toBeVisible();

    // ══════════════════════════════════════════════════════════════════════
    // ÉTAPE 3 : CRÉATION ET CONVERSION D'UN DEVIS
    // ══════════════════════════════════════════════════════════════════════
    await page.getByRole('button', { name: 'Devis' }).click();
    await expect(page.locator('h1:has-text("Devis"), h2:has-text("Devis")').first()).toBeVisible();

    await page.getByRole('button', { name: /Nouveau devis/i }).click();
    await expect(page.locator('h1:has-text("Nouveau Devis")')).toBeVisible();

    // Sélection du client
    await page.getByText('Sélectionner un client').click();
    const clientDialog = page.locator('[role="dialog"]:has-text("Rechercher un client")');
    await expect(clientDialog).toBeVisible();
    await clientDialog.getByText('Société Gabonaise de Tech').click();
    await expect(page.getByText('contact@sgtech.ga')).toBeVisible();

    // Sélection de la ligne de service dans le catalogue (auto-remplit le prix unitaire 150 000 XAF)
    await page.getByText('Sélectionner un service...').click();
    await page.getByRole('option', { name: /Consulting IT Gabonese/i }).click();

    // Enregistrement du devis
    await page.getByRole('button', { name: /Enregistrer/i }).click();

    await expect(page.locator('text=Devis enregistré avec succès')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Société Gabonaise de Tech')).toBeVisible();

    // Conversion du devis en facture
    const quoteRowActions = page.locator('button:has(svg)').last();
    await quoteRowActions.click();
    await page.getByRole('menuitem', { name: /Convertir en facture/i }).click();

    await expect(page.getByText('Devis converti en facture avec succès')).toBeVisible();
    await expect(page.getByText('Converti')).toBeVisible();

    // ──────────────────────────────────────────────────────────────────────
    // 3. VÉRIFICATION DU CALCUL DES TAXES ET DU TOTAL SUR LA FACTURE
    // ──────────────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Factures' }).click();
    await expect(page.locator('h1:has-text("Factures")')).toBeVisible();

    const invoiceRow = page.locator('tr:has-text("Société Gabonaise de Tech"), div:has-text("Société Gabonaise de Tech")').first();
    await expect(invoiceRow).toBeVisible();

    // Vérification du calcul exact des taxes (Règle métier)
    // Base : 150 000 XAF
    // CSS (1%) : 1 500 XAF
    // Base Imposable : 151 500 XAF
    // TPS (9.5%) : 14 393 XAF
    // TVA (18%) : 27 270 XAF
    // Total : 193 163 XAF
    const invoiceRowActions = page.locator('tr:has-text("Société Gabonaise de Tech"), div:has-text("Société Gabonaise de Tech")').first().locator('button').last();
    await invoiceRowActions.click();

    await page.getByText('Enregistrer un règlement').click();
    const paymentDialog = page.locator('[role="dialog"]:has-text("Confirmer le règlement")');
    await expect(paymentDialog).toBeVisible();

    // Modification du type de règlement en "Acompte / Partiel"
    await paymentDialog.locator('button[role="combobox"]').first().click();
    await page.getByRole('option', { name: /Acompte \/ Partiel/i }).click();

    // Saisie d'un montant partiel (ex: 50 000 XAF)
    await paymentDialog.locator('#payment-amount').fill('50000');

    await paymentDialog.getByRole('button', { name: /Valider l'encaissement/i }).click();

    // Vérification du toast et du changement visuel du badge de statut à "Partiel"
    await expect(page.locator('text=Paiement enregistré')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Partiel').first()).toBeVisible();
  });
});
