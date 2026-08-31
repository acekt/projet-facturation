import { ROLES, QUOTE_STATUS, INVOICE_STATUS, CLIENT_STATUS } from '@/lib/constants';
import { test as setup, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';

const adminFile = './tests/e2e/.auth/adminState.json';
const operatorFile = './tests/e2e/.auth/operatorState.json';

setup('Purge DB, initialisation des données et génération des Storage States', async ({ page, browser }) => {
  const authDir = path.join(process.cwd(), 'tests', 'e2e', '.auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const os = require('os');
  const dbName = process.env.DB_FILE_NAME || 'test.sqlite';
  const dbPath = process.env.TEST_DB_PATH || path.join(os.tmpdir(), dbName);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  // Initialisation complète du schéma SQL pour garantir que toutes les tables existent avant purge
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      companyName TEXT, legalForm TEXT, nif TEXT, rccm TEXT, address TEXT,
      email TEXT, phone TEXT, bankName TEXT, bankAgency TEXT, accountNumber TEXT,
      swiftCode TEXT, iban TEXT, tvaRate REAL, tpsRate REAL DEFAULT 9.5,
      cssRate REAL, sessionTimeout INTEGER, invoicePrefix TEXT, quotePrefix TEXT,
      companyCode TEXT, mentionsLegales TEXT, logo TEXT
    );
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT, address TEXT,
      status TEXT DEFAULT 'active', createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      deletedAt DATETIME, created_by TEXT
    );
    CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY, number TEXT UNIQUE NOT NULL, clientId TEXT NOT NULL,
      clientName TEXT, clientEmail TEXT, date TEXT NOT NULL, subtotal REAL DEFAULT 0,
      discount REAL DEFAULT 0, taxBase REAL DEFAULT 0, tpsAmount REAL DEFAULT 0,
      tvaAmount REAL DEFAULT 0, cssAmount REAL DEFAULT 0, total REAL DEFAULT 0,
      status TEXT DEFAULT 'EN_ATTENTE', notes TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      deletedAt DATETIME, created_by TEXT, FOREIGN KEY (clientId) REFERENCES clients(id)
    );
    CREATE TABLE IF NOT EXISTS quote_items (
      id TEXT PRIMARY KEY, quoteId TEXT NOT NULL, description TEXT NOT NULL,
      quantity REAL NOT NULL, unitPrice REAL NOT NULL, total REAL NOT NULL,
      FOREIGN KEY (quoteId) REFERENCES quotes(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY, number TEXT UNIQUE NOT NULL, quoteId TEXT, clientId TEXT NOT NULL,
      clientName TEXT, clientEmail TEXT, date TEXT NOT NULL, subtotal REAL DEFAULT 0,
      discount REAL DEFAULT 0, taxBase REAL DEFAULT 0, tpsAmount REAL DEFAULT 0,
      tvaAmount REAL DEFAULT 0, cssAmount REAL DEFAULT 0, total REAL DEFAULT 0,
      status TEXT DEFAULT 'pending', notes TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      deletedAt DATETIME, created_by TEXT, FOREIGN KEY (clientId) REFERENCES clients(id),
      FOREIGN KEY (quoteId) REFERENCES quotes(id)
    );
    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY, invoiceId TEXT NOT NULL, description TEXT NOT NULL,
      quantity REAL NOT NULL, unitPrice REAL NOT NULL, total REAL NOT NULL,
      FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY, invoiceId TEXT NOT NULL, amount REAL NOT NULL,
      paymentMethod TEXT NOT NULL, date TEXT NOT NULL, reference TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP, deletedAt DATETIME, created_by TEXT,
      FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS sequences (
      name TEXT PRIMARY KEY, current_value INTEGER DEFAULT 0, last_year INTEGER
    );
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, category TEXT,
      unitPrice REAL DEFAULT 0, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      deletedAt DATETIME, created_by TEXT
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE,
      password TEXT NOT NULL, name TEXT NOT NULL, role TEXT CHECK(role IN ('admin', 'user')) NOT NULL DEFAULT 'user',
      is_active INTEGER NOT NULL DEFAULT 1, force_password_change INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, last_login_at DATETIME,
      created_by TEXT, phone TEXT, deletedAt DATETIME
    );
    CREATE TABLE IF NOT EXISTS credit_notes (
      id TEXT PRIMARY KEY, number TEXT UNIQUE NOT NULL, invoiceId TEXT NOT NULL,
      clientId TEXT NOT NULL, clientName TEXT, date TEXT NOT NULL, reason TEXT,
      subtotal REAL DEFAULT 0, taxBase REAL DEFAULT 0, tpsAmount REAL DEFAULT 0,
      tvaAmount REAL DEFAULT 0, cssAmount REAL DEFAULT 0, total REAL DEFAULT 0,
      status TEXT DEFAULT 'open', createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT, deletedAt DATETIME, FOREIGN KEY (invoiceId) REFERENCES invoices(id),
      FOREIGN KEY (clientId) REFERENCES clients(id)
    );
    CREATE TABLE IF NOT EXISTS credit_note_items (
      id TEXT PRIMARY KEY, creditNoteId TEXT NOT NULL, description TEXT NOT NULL,
      quantity REAL NOT NULL, unitPrice REAL NOT NULL, total REAL NOT NULL,
      FOREIGN KEY (creditNoteId) REFERENCES credit_notes(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY, userId TEXT, userName TEXT, action TEXT NOT NULL,
      entityType TEXT NOT NULL, entityId TEXT, details TEXT, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Purge de toutes les tables pour garantir un état propre (Idempotence)
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
  db.prepare("INSERT INTO sequences (name, current_value, last_year) VALUES ('credit_note', 0, strftime('%Y', 'now'))").run();

  // Création d'une configuration par défaut dans settings
  db.prepare(`
    INSERT OR REPLACE INTO settings (
      id, companyName, legalForm, nif, rccm, address, email, phone,
      tvaRate, tpsRate, cssRate, sessionTimeout, invoicePrefix, quotePrefix, companyCode
    ) VALUES (
      1, 'L''Facturier SARL', 'SARL', 'NIF123456', 'RCCM98765', 'Libreville, Gabon',
      'contact@facturier.ga', '+241 01 23 45 67', 18.0, 9.5, 1.0, 60, 'FACT-', 'DEV-', 'ETO'
    )
  `).run();

  // Création des comptes (Opérateur et Administrateur)
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

  // Création d'un client initial pour le tunnel de vente
  const clientId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO clients (id, name, email, phone, address, createdAt)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(clientId, 'Société Gabonaise de Tech', 'contact@sgtech.ga', '+241 01 44 55 66', 'Boulevard Triomphal, Libreville');

  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (e) {
    // Ignorer si verrouillé
  }
  db.close();
  await page.waitForTimeout(500);

  // --- 1. Connexion et sauvegarde du Storage State Admin ---
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('#username');
  await page.waitForTimeout(1000);
  await page.fill('#username', 'admin@facturier.ga');
  await page.fill('#password', 'admin123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('http://localhost:3050/', { timeout: 45000 });
  await expect(page.locator('h1:has-text("Tableau de bord"), h2:has-text("Tableau de bord"), button:has-text("Factures")').first()).toBeVisible({ timeout: 45000 });
  await page.context().storageState({ path: adminFile });

  // --- 2. Connexion et sauvegarde du Storage State Opérateur ---
  const operatorContext = await browser.newContext();
  const operatorPage = await operatorContext.newPage();
  await operatorPage.goto('/login');
  await operatorPage.waitForLoadState('domcontentloaded');
  await operatorPage.waitForSelector('#username');
  await operatorPage.waitForTimeout(1000);
  await operatorPage.fill('#username', 'operateur@facturier.ga');
  await operatorPage.fill('#password', 'operateur123');
  await operatorPage.click('button[type="submit"]');
  await expect(operatorPage).toHaveURL('http://localhost:3050/', { timeout: 45000 });
  await expect(operatorPage.locator('h1:has-text("Tableau de bord"), h2:has-text("Tableau de bord"), button:has-text("Factures")').first()).toBeVisible({ timeout: 45000 });
  await operatorContext.storageState({ path: operatorFile });
  await operatorContext.close();
});
