import Database from 'better-sqlite3';
import { Migration } from './types';
import { ensureLegacyColumns } from './0001_initial_schema';

export const migration0002: Migration = {
  version: 2,
  name: 'schema_hardening_integers_and_constraints',
  up: (db: Database.Database) => {
    // 0. Rattrapage idempotent des colonnes manquantes sur une base locale préexistante
    //    (ex. qi.deletedAt, qi.tenant_id, ii.deletedAt, cni.deletedAt lorsque v1 a fait CREATE TABLE IF NOT EXISTS)
    ensureLegacyColumns(db);

    // 1. Sauvegarde des totaux de contrôle avant reconstruction (arrondi ligne par ligne)
    const prevInvoices = (db.prepare('SELECT COALESCE(SUM(CAST(ROUND(total) AS INTEGER)), 0) as s FROM invoices').get() as { s: number })?.s || 0;
    const prevQuotes = (db.prepare('SELECT COALESCE(SUM(CAST(ROUND(total) AS INTEGER)), 0) as s FROM quotes').get() as { s: number })?.s || 0;
    const prevPayments = (db.prepare('SELECT COALESCE(SUM(CAST(ROUND(amount) AS INTEGER)), 0) as s FROM payments').get() as { s: number })?.s || 0;

    // 2. Détermination d'un tenant_id de repli si des lignes ont tenant_id NULL ou vide
    const adminUser = db.prepare("SELECT tenant_id FROM users WHERE role = 'admin' AND tenant_id IS NOT NULL AND tenant_id != '' LIMIT 1").get() as { tenant_id?: string } | undefined;
    const fallbackTenant = adminUser?.tenant_id || '00000000-0000-4000-a000-000000000001';

    // Remplissage préventif de tenant_id sur toutes les tables avant la contrainte NOT NULL
    const tenantTables = ['clients', 'quotes', 'quote_items', 'invoices', 'invoice_items', 'payments', 'services', 'users', 'credit_notes', 'credit_note_items', 'audit_logs'];
    for (const tbl of tenantTables) {
      try {
        db.prepare(`UPDATE ${tbl} SET tenant_id = ? WHERE tenant_id IS NULL OR tenant_id = ''`).run(fallbackTenant);
      } catch {
        // Ignorer si la table n'a pas encore la colonne
      }
    }

    // Normalisation des statuts de factures vers les codes officiels
    db.prepare("UPDATE invoices SET status = 'UNPAID' WHERE status IN ('pending', 'sent', 'open', 'draft')").run();
    db.prepare("UPDATE invoices SET status = 'PAID' WHERE status IN ('paid')").run();
    db.prepare("UPDATE invoices SET status = 'PARTIALLY_PAID' WHERE status IN ('partially_paid', 'partial')").run();

    // Normalisation des statuts de devis
    db.prepare("UPDATE quotes SET status = 'EN_ATTENTE' WHERE status IN ('draft', 'pending', 'sent')").run();
    db.prepare("UPDATE quotes SET status = 'VALIDE' WHERE status IN ('accepted', 'valide')").run();
    db.prepare("UPDATE quotes SET status = 'REFUSE' WHERE status IN ('rejected', 'refuse')").run();

    // 3. Reconstruction des tables (foreign_keys désactivées par le runner pendant la migration)
    // -------------------------------------------------------------
    // TABLE : clients
    // -------------------------------------------------------------
      db.exec(`
        CREATE TABLE clients_new (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          address TEXT,
          nif TEXT,
          rccm TEXT,
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          deletedAt DATETIME,
          created_by TEXT,
          tenant_id TEXT NOT NULL,
          updated_at TEXT,
          synced_at TEXT
        );

        INSERT INTO clients_new (
          id, name, email, phone, address, nif, rccm, status, createdAt, deletedAt, created_by, tenant_id, updated_at, synced_at
        )
        SELECT
          id, name, email, phone, address, nif, rccm,
          COALESCE(status, 'active'),
          createdAt, deletedAt, created_by,
          COALESCE(NULLIF(tenant_id, ''), '${fallbackTenant}'),
          NULL, NULL
        FROM clients;

        DROP TABLE clients;
        ALTER TABLE clients_new RENAME TO clients;
      `);

      // -------------------------------------------------------------
      // TABLE : services
      // -------------------------------------------------------------
      db.exec(`
        CREATE TABLE services_new (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          category TEXT,
          unitPrice INTEGER NOT NULL DEFAULT 0 CHECK (unitPrice >= 0),
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          deletedAt DATETIME,
          created_by TEXT,
          tenant_id TEXT NOT NULL,
          updated_at TEXT,
          synced_at TEXT
        );

        INSERT INTO services_new (
          id, name, description, category, unitPrice, createdAt, deletedAt, created_by, tenant_id, updated_at, synced_at
        )
        SELECT
          id, name, description, category,
          CAST(ROUND(COALESCE(unitPrice, 0)) AS INTEGER),
          createdAt, deletedAt, created_by,
          COALESCE(NULLIF(tenant_id, ''), '${fallbackTenant}'),
          NULL, NULL
        FROM services;

        DROP TABLE services;
        ALTER TABLE services_new RENAME TO services;
      `);

      // -------------------------------------------------------------
      // TABLE : quotes
      // -------------------------------------------------------------
      db.exec(`
        CREATE TABLE quotes_new (
          id TEXT PRIMARY KEY,
          number TEXT UNIQUE NOT NULL,
          clientId TEXT NOT NULL,
          clientName TEXT,
          clientEmail TEXT,
          date TEXT NOT NULL,
          dueDate TEXT,
          subtotal INTEGER NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
          discount INTEGER NOT NULL DEFAULT 0 CHECK (discount >= 0),
          taxBase INTEGER NOT NULL DEFAULT 0 CHECK (taxBase >= 0),
          tpsAmount INTEGER NOT NULL DEFAULT 0 CHECK (tpsAmount >= 0),
          tvaAmount INTEGER NOT NULL DEFAULT 0 CHECK (tvaAmount >= 0),
          cssAmount INTEGER NOT NULL DEFAULT 0 CHECK (cssAmount >= 0),
          total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
          status TEXT NOT NULL DEFAULT 'EN_ATTENTE' CHECK (status IN ('EN_ATTENTE', 'VALIDE', 'REFUSE', 'BROUILLON', 'ENVOYE', 'CONVERTI', 'EXPIRE', 'EXPIRED', 'draft', 'sent', 'accepted', 'rejected', 'converti')),
          notes TEXT,
          subject TEXT,
          validUntil TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          deletedAt DATETIME,
          created_by TEXT,
          tenant_id TEXT NOT NULL,
          updated_at TEXT,
          synced_at TEXT,
          FOREIGN KEY (clientId) REFERENCES clients(id)
        );

        INSERT INTO quotes_new (
          id, number, clientId, clientName, clientEmail, date, dueDate,
          subtotal, discount, taxBase, tpsAmount, tvaAmount, cssAmount, total,
          status, notes, subject, validUntil, createdAt, deletedAt, created_by, tenant_id, updated_at, synced_at
        )
        SELECT
          id, number, clientId, clientName, clientEmail, date, NULL,
          CAST(ROUND(COALESCE(subtotal, 0)) AS INTEGER),
          CAST(ROUND(COALESCE(discount, 0)) AS INTEGER),
          CAST(ROUND(COALESCE(taxBase, 0)) AS INTEGER),
          CAST(ROUND(COALESCE(tpsAmount, 0)) AS INTEGER),
          CAST(ROUND(COALESCE(tvaAmount, 0)) AS INTEGER),
          CAST(ROUND(COALESCE(cssAmount, 0)) AS INTEGER),
          CAST(ROUND(COALESCE(total, 0)) AS INTEGER),
          COALESCE(status, 'EN_ATTENTE'),
          notes, subject, validUntil, createdAt, deletedAt, created_by,
          COALESCE(NULLIF(tenant_id, ''), '${fallbackTenant}'),
          NULL, NULL
        FROM quotes;

        DROP TABLE quotes;
        ALTER TABLE quotes_new RENAME TO quotes;
      `);

      // -------------------------------------------------------------
      // TABLE : quote_items
      // -------------------------------------------------------------
      db.exec(`
        CREATE TABLE quote_items_new (
          id TEXT PRIMARY KEY,
          quoteId TEXT NOT NULL,
          description TEXT NOT NULL,
          quantity REAL NOT NULL DEFAULT 1,
          unitPrice INTEGER NOT NULL DEFAULT 0 CHECK (unitPrice >= 0),
          total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
          tenant_id TEXT NOT NULL,
          deletedAt DATETIME,
          updated_at TEXT,
          synced_at TEXT,
          FOREIGN KEY (quoteId) REFERENCES quotes(id) ON DELETE CASCADE
        );

        INSERT INTO quote_items_new (
          id, quoteId, description, quantity, unitPrice, total, tenant_id, deletedAt, updated_at, synced_at
        )
        SELECT
          qi.id, qi.quoteId, qi.description,
          COALESCE(qi.quantity, 1),
          CAST(ROUND(COALESCE(qi.unitPrice, 0)) AS INTEGER),
          CAST(ROUND(COALESCE(qi.total, 0)) AS INTEGER),
          COALESCE(NULLIF(qi.tenant_id, ''), q.tenant_id, '${fallbackTenant}'),
          qi.deletedAt, NULL, NULL
        FROM quote_items qi
        LEFT JOIN quotes q ON q.id = qi.quoteId;

        DROP TABLE quote_items;
        ALTER TABLE quote_items_new RENAME TO quote_items;
      `);

      // -------------------------------------------------------------
      // TABLE : invoices
      // -------------------------------------------------------------
      db.exec(`
        CREATE TABLE invoices_new (
          id TEXT PRIMARY KEY,
          number TEXT UNIQUE NOT NULL,
          quoteId TEXT,
          clientId TEXT NOT NULL,
          clientName TEXT,
          clientEmail TEXT,
          date TEXT NOT NULL,
          dueDate TEXT,
          subtotal INTEGER NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
          discount INTEGER NOT NULL DEFAULT 0 CHECK (discount >= 0),
          taxBase INTEGER NOT NULL DEFAULT 0 CHECK (taxBase >= 0),
          tpsAmount INTEGER NOT NULL DEFAULT 0 CHECK (tpsAmount >= 0),
          tvaAmount INTEGER NOT NULL DEFAULT 0 CHECK (tvaAmount >= 0),
          cssAmount INTEGER NOT NULL DEFAULT 0 CHECK (cssAmount >= 0),
          total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
          status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PAID', 'PARTIALLY_PAID', 'CANCELLED', 'OVERDUE', 'pending', 'sent', 'open', 'paid', 'partially_paid', 'partial', 'cancelled')),
          notes TEXT,
          subject TEXT,
          validUntil TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          deletedAt DATETIME,
          created_by TEXT,
          tenant_id TEXT NOT NULL,
          updated_at TEXT,
          synced_at TEXT,
          FOREIGN KEY (clientId) REFERENCES clients(id),
          FOREIGN KEY (quoteId) REFERENCES quotes(id)
        );

        INSERT INTO invoices_new (
          id, number, quoteId, clientId, clientName, clientEmail, date, dueDate,
          subtotal, discount, taxBase, tpsAmount, tvaAmount, cssAmount, total,
          status, notes, subject, validUntil, createdAt, deletedAt, created_by, tenant_id, updated_at, synced_at
        )
        SELECT
          id, number, quoteId, clientId, clientName, clientEmail, date, dueDate,
          CAST(ROUND(COALESCE(subtotal, 0)) AS INTEGER),
          CAST(ROUND(COALESCE(discount, 0)) AS INTEGER),
          CAST(ROUND(COALESCE(taxBase, 0)) AS INTEGER),
          CAST(ROUND(COALESCE(tpsAmount, 0)) AS INTEGER),
          CAST(ROUND(COALESCE(tvaAmount, 0)) AS INTEGER),
          CAST(ROUND(COALESCE(cssAmount, 0)) AS INTEGER),
          CAST(ROUND(COALESCE(total, 0)) AS INTEGER),
          COALESCE(status, 'UNPAID'),
          notes, subject, NULL, createdAt, deletedAt, created_by,
          COALESCE(NULLIF(tenant_id, ''), '${fallbackTenant}'),
          NULL, NULL
        FROM invoices;

        DROP TABLE invoices;
        ALTER TABLE invoices_new RENAME TO invoices;
      `);

      // -------------------------------------------------------------
      // TABLE : invoice_items
      // -------------------------------------------------------------
      db.exec(`
        CREATE TABLE invoice_items_new (
          id TEXT PRIMARY KEY,
          invoiceId TEXT NOT NULL,
          description TEXT NOT NULL,
          quantity REAL NOT NULL DEFAULT 1,
          unitPrice INTEGER NOT NULL DEFAULT 0 CHECK (unitPrice >= 0),
          total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
          tenant_id TEXT NOT NULL,
          deletedAt DATETIME,
          updated_at TEXT,
          synced_at TEXT,
          FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE
        );

        INSERT INTO invoice_items_new (
          id, invoiceId, description, quantity, unitPrice, total, tenant_id, deletedAt, updated_at, synced_at
        )
        SELECT
          ii.id, ii.invoiceId, ii.description,
          COALESCE(ii.quantity, 1),
          CAST(ROUND(COALESCE(ii.unitPrice, 0)) AS INTEGER),
          CAST(ROUND(COALESCE(ii.total, 0)) AS INTEGER),
          COALESCE(NULLIF(ii.tenant_id, ''), inv.tenant_id, '${fallbackTenant}'),
          ii.deletedAt, NULL, NULL
        FROM invoice_items ii
        LEFT JOIN invoices inv ON inv.id = ii.invoiceId;

        DROP TABLE invoice_items;
        ALTER TABLE invoice_items_new RENAME TO invoice_items;
      `);

      // -------------------------------------------------------------
      // TABLE : payments
      // -------------------------------------------------------------
      db.exec(`
        CREATE TABLE payments_new (
          id TEXT PRIMARY KEY,
          invoiceId TEXT NOT NULL,
          amount INTEGER NOT NULL DEFAULT 0 CHECK (amount >= 0),
          paymentMethod TEXT NOT NULL,
          date TEXT NOT NULL,
          reference TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          deletedAt DATETIME,
          created_by TEXT,
          tenant_id TEXT NOT NULL,
          updated_at TEXT,
          synced_at TEXT,
          FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE
        );

        INSERT INTO payments_new (
          id, invoiceId, amount, paymentMethod, date, reference, createdAt, deletedAt, created_by, tenant_id, updated_at, synced_at
        )
        SELECT
          p.id, p.invoiceId,
          CAST(ROUND(COALESCE(p.amount, 0)) AS INTEGER),
          COALESCE(p.paymentMethod, 'VIREMENT'),
          p.date, p.reference, p.createdAt, p.deletedAt, p.created_by,
          COALESCE(NULLIF(p.tenant_id, ''), inv.tenant_id, '${fallbackTenant}'),
          NULL, NULL
        FROM payments p
        LEFT JOIN invoices inv ON inv.id = p.invoiceId;

        DROP TABLE payments;
        ALTER TABLE payments_new RENAME TO payments;
      `);

      // -------------------------------------------------------------
      // TABLE : credit_notes
      // -------------------------------------------------------------
      db.exec(`
        CREATE TABLE credit_notes_new (
          id TEXT PRIMARY KEY,
          number TEXT UNIQUE NOT NULL,
          invoiceId TEXT NOT NULL,
          clientId TEXT NOT NULL,
          clientName TEXT,
          date TEXT NOT NULL,
          reason TEXT,
          subtotal INTEGER NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
          taxBase INTEGER NOT NULL DEFAULT 0 CHECK (taxBase >= 0),
          tpsAmount INTEGER NOT NULL DEFAULT 0 CHECK (tpsAmount >= 0),
          tvaAmount INTEGER NOT NULL DEFAULT 0 CHECK (tvaAmount >= 0),
          cssAmount INTEGER NOT NULL DEFAULT 0 CHECK (cssAmount >= 0),
          total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
          status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'applied', 'cancelled')),
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT,
          deletedAt DATETIME,
          tenant_id TEXT NOT NULL,
          updated_at TEXT,
          synced_at TEXT,
          FOREIGN KEY (invoiceId) REFERENCES invoices(id),
          FOREIGN KEY (clientId) REFERENCES clients(id)
        );

        INSERT INTO credit_notes_new (
          id, number, invoiceId, clientId, clientName, date, reason,
          subtotal, taxBase, tpsAmount, tvaAmount, cssAmount, total,
          status, createdAt, created_by, deletedAt, tenant_id, updated_at, synced_at
        )
        SELECT
          id, number, invoiceId, clientId, clientName, date, reason,
          CAST(ROUND(COALESCE(subtotal, 0)) AS INTEGER),
          CAST(ROUND(COALESCE(taxBase, 0)) AS INTEGER),
          CAST(ROUND(COALESCE(tpsAmount, 0)) AS INTEGER),
          CAST(ROUND(COALESCE(tvaAmount, 0)) AS INTEGER),
          CAST(ROUND(COALESCE(cssAmount, 0)) AS INTEGER),
          CAST(ROUND(COALESCE(total, 0)) AS INTEGER),
          COALESCE(status, 'open'),
          createdAt, created_by, deletedAt,
          COALESCE(NULLIF(tenant_id, ''), '${fallbackTenant}'),
          NULL, NULL
        FROM credit_notes;

        DROP TABLE credit_notes;
        ALTER TABLE credit_notes_new RENAME TO credit_notes;
      `);

      // -------------------------------------------------------------
      // TABLE : credit_note_items
      // -------------------------------------------------------------
      db.exec(`
        CREATE TABLE credit_note_items_new (
          id TEXT PRIMARY KEY,
          creditNoteId TEXT NOT NULL,
          description TEXT NOT NULL,
          quantity REAL NOT NULL DEFAULT 1,
          unitPrice INTEGER NOT NULL DEFAULT 0 CHECK (unitPrice >= 0),
          total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
          tenant_id TEXT NOT NULL,
          deletedAt DATETIME,
          updated_at TEXT,
          synced_at TEXT,
          FOREIGN KEY (creditNoteId) REFERENCES credit_notes(id) ON DELETE CASCADE
        );

        INSERT INTO credit_note_items_new (
          id, creditNoteId, description, quantity, unitPrice, total, tenant_id, deletedAt, updated_at, synced_at
        )
        SELECT
          cni.id, cni.creditNoteId, cni.description,
          COALESCE(cni.quantity, 1),
          CAST(ROUND(COALESCE(cni.unitPrice, 0)) AS INTEGER),
          CAST(ROUND(COALESCE(cni.total, 0)) AS INTEGER),
          COALESCE(NULLIF(cni.tenant_id, ''), cn.tenant_id, '${fallbackTenant}'),
          cni.deletedAt, NULL, NULL
        FROM credit_note_items cni
        LEFT JOIN credit_notes cn ON cn.id = cni.creditNoteId;

        DROP TABLE credit_note_items;
        ALTER TABLE credit_note_items_new RENAME TO credit_note_items;
      `);

      // -------------------------------------------------------------
      // Colonnes logo_path / logo_sha256 sur settings (I5)
      // -------------------------------------------------------------
      const settingsCols = db.prepare('PRAGMA table_info(settings)').all() as Array<{ name: string }>;
      if (!settingsCols.some(c => c.name === 'logo_path')) {
        db.exec('ALTER TABLE settings ADD COLUMN logo_path TEXT');
      }
      if (!settingsCols.some(c => c.name === 'logo_sha256')) {
        db.exec('ALTER TABLE settings ADD COLUMN logo_sha256 TEXT');
      }
      if (!settingsCols.some(c => c.name === 'updated_at')) {
        db.exec('ALTER TABLE settings ADD COLUMN updated_at TEXT');
      }
      if (!settingsCols.some(c => c.name === 'synced_at')) {
        db.exec('ALTER TABLE settings ADD COLUMN synced_at TEXT');
      }

    // 4. Vérification d'intégrité des clés étrangères
    const fkErrors = db.pragma('foreign_key_check') as any[];
    if (fkErrors.length > 0) {
      throw new Error(`Échec de vérification des clés étrangères post-migration : ${JSON.stringify(fkErrors)}`);
    }

    // 5. Recréation des index optimaux
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_clients_deletedAt ON clients(deletedAt);
      CREATE INDEX IF NOT EXISTS idx_quotes_deletedAt ON quotes(deletedAt);
      CREATE INDEX IF NOT EXISTS idx_quotes_clientId ON quotes(clientId);
      CREATE INDEX IF NOT EXISTS idx_invoices_deletedAt ON invoices(deletedAt);
      CREATE INDEX IF NOT EXISTS idx_invoices_clientId ON invoices(clientId);
      CREATE INDEX IF NOT EXISTS idx_invoices_quoteId ON invoices(quoteId);
      CREATE INDEX IF NOT EXISTS idx_payments_deletedAt ON payments(deletedAt);
      CREATE INDEX IF NOT EXISTS idx_payments_invoiceId ON payments(invoiceId);
      CREATE INDEX IF NOT EXISTS idx_credit_notes_deletedAt ON credit_notes(deletedAt);
      CREATE INDEX IF NOT EXISTS idx_credit_notes_invoiceId ON credit_notes(invoiceId);
      CREATE INDEX IF NOT EXISTS idx_credit_notes_clientId ON credit_notes(clientId);
      CREATE INDEX IF NOT EXISTS idx_services_deletedAt ON services(deletedAt);
      CREATE INDEX IF NOT EXISTS idx_quote_items_quoteId ON quote_items(quoteId);
      CREATE INDEX IF NOT EXISTS idx_invoice_items_invoiceId ON invoice_items(invoiceId);
      CREATE INDEX IF NOT EXISTS idx_credit_note_items_creditNoteId ON credit_note_items(creditNoteId);

      CREATE INDEX IF NOT EXISTS idx_clients_tenant ON clients(tenant_id, deletedAt);
      CREATE INDEX IF NOT EXISTS idx_quotes_tenant ON quotes(tenant_id, deletedAt);
      CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id, deletedAt);
      CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id, deletedAt);
      CREATE INDEX IF NOT EXISTS idx_services_tenant ON services(tenant_id, deletedAt);
      CREATE INDEX IF NOT EXISTS idx_credit_notes_tenant ON credit_notes(tenant_id, deletedAt);
      CREATE INDEX IF NOT EXISTS idx_quote_items_quote_tenant ON quote_items(quoteId, tenant_id);
      CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_tenant ON invoice_items(invoiceId, tenant_id);
      CREATE INDEX IF NOT EXISTS idx_credit_note_items_cn_tenant ON credit_note_items(creditNoteId, tenant_id);

      CREATE INDEX IF NOT EXISTS idx_quotes_tenant_date ON quotes(tenant_id, date DESC) WHERE deletedAt IS NULL;
      CREATE INDEX IF NOT EXISTS idx_quotes_tenant_client ON quotes(tenant_id, clientId) WHERE deletedAt IS NULL;
      CREATE INDEX IF NOT EXISTS idx_quotes_tenant_status ON quotes(tenant_id, status) WHERE deletedAt IS NULL;
      CREATE INDEX IF NOT EXISTS idx_quotes_tenant_number ON quotes(tenant_id, number) WHERE deletedAt IS NULL;

      CREATE INDEX IF NOT EXISTS idx_invoices_tenant_date ON invoices(tenant_id, date DESC) WHERE deletedAt IS NULL;
      CREATE INDEX IF NOT EXISTS idx_invoices_tenant_number ON invoices(tenant_id, number) WHERE deletedAt IS NULL;
      CREATE INDEX IF NOT EXISTS idx_invoices_client_status ON invoices(tenant_id, clientId, status) WHERE deletedAt IS NULL;

      CREATE INDEX IF NOT EXISTS idx_credit_notes_tenant_date ON credit_notes(tenant_id, date DESC) WHERE deletedAt IS NULL;
      CREATE INDEX IF NOT EXISTS idx_credit_notes_tenant_invoice ON credit_notes(tenant_id, invoiceId) WHERE deletedAt IS NULL;

      CREATE INDEX IF NOT EXISTS idx_clients_tenant_email ON clients(tenant_id, lower(email)) WHERE deletedAt IS NULL AND email IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_clients_tenant_name ON clients(tenant_id, lower(name)) WHERE deletedAt IS NULL;
      CREATE INDEX IF NOT EXISTS idx_services_tenant_name ON services(tenant_id, lower(name)) WHERE deletedAt IS NULL;
    `);

    // 6. Vérification des totaux de contrôle
    const postInvoices = (db.prepare('SELECT COALESCE(SUM(total), 0) as s FROM invoices').get() as { s: number })?.s || 0;
    const postQuotes = (db.prepare('SELECT COALESCE(SUM(total), 0) as s FROM quotes').get() as { s: number })?.s || 0;
    const postPayments = (db.prepare('SELECT COALESCE(SUM(amount), 0) as s FROM payments').get() as { s: number })?.s || 0;

    if (Math.round(prevInvoices) !== postInvoices) {
      throw new Error(`Incohérence totale factures post-migration : avant=${Math.round(prevInvoices)}, après=${postInvoices}`);
    }
    if (Math.round(prevQuotes) !== postQuotes) {
      throw new Error(`Incohérence totale devis post-migration : avant=${Math.round(prevQuotes)}, après=${postQuotes}`);
    }
    if (Math.round(prevPayments) !== postPayments) {
      throw new Error(`Incohérence totale paiements post-migration : avant=${Math.round(prevPayments)}, après=${postPayments}`);
    }
  },
};
