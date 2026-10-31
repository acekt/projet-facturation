import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

function resolveDbPath(): string {
  // 1. Résolution canonique via __dirname (toujours apps/desktop/data)
  const canonicalPath = path.resolve(__dirname, '../data/database.sqlite');
  if (fs.existsSync(path.dirname(canonicalPath))) {
    return canonicalPath;
  }
  // 2. Si exécuté depuis la racine du projet
  const fromRoot = path.resolve(process.cwd(), 'apps/desktop/data/database.sqlite');
  if (fs.existsSync(path.dirname(fromRoot))) {
    return fromRoot;
  }
  // 3. Si exécuté depuis apps/desktop
  const fromDesktop = path.resolve(process.cwd(), 'data/database.sqlite');
  if (fs.existsSync(path.dirname(fromDesktop))) {
    return fromDesktop;
  }
  fs.mkdirSync(path.dirname(canonicalPath), { recursive: true });
  return canonicalPath;
}

const dbPath = resolveDbPath();
console.log(`[seed-multiyear] Connexion à la base SQLite : ${dbPath}`);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF');

// 1. Récupération ou initialisation de l'administrateur et du tenant_id
let adminUser = db.prepare("SELECT * FROM users WHERE role = 'admin' LIMIT 1").get() as any;
const tenantId = adminUser?.tenant_id || crypto.randomUUID();
const adminId = adminUser?.id || crypto.randomUUID();
const defaultPasswordHash = adminUser?.password || '$2b$10$dqVzxn1DVyXqQ1vF69f4iOCmY18L1yO0C4H2Q3N8U8e7e1X5v9iKu'; // @Dmin123
let paulId = '';
let sarahId = '';

console.log(`[seed-multiyear] Tenant ID actif : ${tenantId}`);
console.log(`[seed-multiyear] Admin ID : ${adminId} (${adminUser?.email || 'admin@gmail.com'})`);

// 2. Nettoyage des anciennes données métier pour un reseed propre
db.transaction(() => {
  db.exec(`
    DELETE FROM payments;
    DELETE FROM invoice_items;
    DELETE FROM invoices;
    DELETE FROM quote_items;
    DELETE FROM quotes;
    DELETE FROM credit_note_items;
    DELETE FROM credit_notes;
    DELETE FROM services;
    DELETE FROM clients;
    DELETE FROM audit_logs;
    DELETE FROM sequences;
  `);

  // Assurer le CHECK constraint étendu pour invoices (draft et BROUILLON)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS invoices_mig (
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
        status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PAID', 'PARTIALLY_PAID', 'CANCELLED', 'OVERDUE', 'pending', 'sent', 'open', 'paid', 'partially_paid', 'partial', 'cancelled', 'draft', 'BROUILLON')),
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
      DROP TABLE IF EXISTS invoices;
      ALTER TABLE invoices_mig RENAME TO invoices;
    `);
  } catch (e) {
    // Ignorer si déjà conforme
  }

  // Mise à jour de l'admin principal
  if (adminUser) {
    db.prepare(`
      UPDATE users 
      SET tenant_id = ?, is_active = 1, force_password_change = 0 
      WHERE id = ?
    `).run(tenantId, adminId);
  } else {
    db.prepare(`
      INSERT INTO users (id, username, email, password, name, role, is_active, force_password_change, phone, tenant_id)
      VALUES (?, 'admin@gmail.com', 'admin@gmail.com', ?, 'Administrateur', 'admin', 1, 0, '+241 01 76 00 00', ?)
    `).run(adminId, defaultPasswordHash, tenantId);
  }

  // Ajout de 3 utilisateurs d'entreprise pour simuler plusieurs années d'activité
  const users = [
    {
      id: crypto.randomUUID(),
      username: 'm.ndong@global-maintenance.ga',
      email: 'm.ndong@global-maintenance.ga',
      name: 'Marcelle NDONG',
      role: 'admin',
      phone: '+241 07 45 12 34',
    },
    {
      id: crypto.randomUUID(),
      username: 'p.biveghe@global-maintenance.ga',
      email: 'p.biveghe@global-maintenance.ga',
      name: 'Paul BIVEGHE',
      role: 'user',
      phone: '+241 06 23 89 01',
    },
    {
      id: crypto.randomUUID(),
      username: 's.obiang@global-maintenance.ga',
      email: 's.obiang@global-maintenance.ga',
      name: 'Sarah OBIANG',
      role: 'user',
      phone: '+241 04 56 78 90',
    },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (id, username, email, password, name, role, is_active, force_password_change, phone, tenant_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?)
  `);

  for (const u of users) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(u.email);
    if (!existing) {
      insertUser.run(u.id, u.username, u.email, defaultPasswordHash, u.name, u.role, u.phone, tenantId, '2024-01-15 08:30:00');
    }
  }

  const paulUser = db.prepare('SELECT id FROM users WHERE email = ?').get('p.biveghe@global-maintenance.ga') as { id: string } | undefined;
  const sarahUser = db.prepare('SELECT id FROM users WHERE email = ?').get('s.obiang@global-maintenance.ga') as { id: string } | undefined;
  paulId = paulUser?.id || users[1].id;
  sarahId = sarahUser?.id || users[2].id;

  // 3. Mise à jour des paramètres entreprise complets
  db.prepare(`
    UPDATE settings SET
      companyName = 'Global Maintenance',
      legalForm = 'SARL',
      nif = '0789456-M',
      rccm = 'GA-LBV-2018-B-1425',
      address = 'Boulevard Triomphal, Libreville, Gabon',
      email = 'contact@global-maintenance.ga',
      phone = '+241 01 76 54 32',
      bankName = 'BGFIBank Gabon',
      bankAgency = 'Agence Centrale - Libreville',
      accountNumber = '40001 02000 12345678901 25',
      swiftCode = 'BGFIGAXXX',
      iban = 'GA21 4000 1020 0012 3456 7890 125',
      tvaRate = 18.0,
      tpsRate = 9.5,
      cssRate = 1.0,
      sessionTimeout = 60,
      invoicePrefix = 'FAC',
      quotePrefix = 'DEV',
      companyCode = 'GM',
      mentionsLegales = 'Paiement à 30 jours à compter de la date démission. Tout retard de paiement donnera lieu au versement de pénalités de retard selon la réglementation en vigueur.',
      tenant_id = ?
    WHERE id = 1
  `).run(tenantId);
})();

console.log('[seed-multiyear] Tables vidées, utilisateurs et paramètres configurés.');

// 4. Clients gabonais / CEMAC (15 entreprises réalistes)
const clients = [
  { id: 'cli_seeg', name: 'Société d\'Énergie et d\'Eau du Gabon (SEEG)', email: 'facturation@seeg-gabon.com', phone: '+241 01 76 70 00', address: 'Boulevard Léon Mba, Libreville' },
  { id: 'cli_comilog', name: 'Compagnie Minière de l\'Ogooué (COMILOG)', email: 'achats.fournisseurs@eramet-comilog.com', phone: '+241 01 66 11 00', address: 'Quartier Industriel, BP 211, Moanda' },
  { id: 'cli_setrag', name: 'Société d\'Exploitation du Transgabonais (SETRAG)', email: 'comptabilite.fournisseurs@setrag.ga', phone: '+241 01 70 80 00', address: 'Gare d\'Owendo, Owendo' },
  { id: 'cli_total', name: 'TotalEnergies EP Gabon', email: 'facturation-fournisseurs@totalenergies.ga', phone: '+241 01 55 60 00', address: 'Boulevard Hourcq, Port-Gentil' },
  { id: 'cli_airtel', name: 'Airtel Gabon SA', email: 'procurement@ga.airtel.com', phone: '+241 07 00 00 00', address: 'Immeuble Airtel, Batterie IV, Libreville' },
  { id: 'cli_moov', name: 'Moov Africa Gabon Telecom', email: 'tresorerie@gabontelecom.ga', phone: '+241 01 78 00 00', address: 'Immeuble Premium, Centre-Ville, Libreville' },
  { id: 'cli_bgfi', name: 'BGFIBank Gabon SA', email: 'relations.entreprises@bgfi.com', phone: '+241 01 76 23 23', address: 'Boulevard de l\'Indépendance, Libreville' },
  { id: 'cli_sobraga', name: 'Société des Brasseries du Gabon (SOBRAGA)', email: 'achats@sobraga.ga', phone: '+241 01 70 03 00', address: 'Zone Industrielle d\'Oloumi, Libreville' },
  { id: 'cli_ceca', name: 'Groupe CECA-GADIS (SuperGros)', email: 'approvisionnement@ceca-gadis.ga', phone: '+241 01 74 12 00', address: 'Zone Industrielle d\'Oloumi, Libreville' },
  { id: 'cli_oprag', name: 'Office des Ports et Rades du Gabon (OPRAG)', email: 'comptabilite@oprag.ga', phone: '+241 01 70 17 98', address: 'Zone Portuaire, Owendo' },
  { id: 'cli_mandji', name: 'Clinique Médico-Chirurgicale Mandji', email: 'administration@clinique-mandji.ga', phone: '+241 01 55 22 44', address: 'Quartier Balise, Port-Gentil' },
  { id: 'cli_mba', name: 'Cabinet Me MBA & Associés', email: 'contact@mba-avocats.ga', phone: '+241 01 72 34 56', address: 'Avenue de la Nation, Libreville' },
  { id: 'cli_kori', name: 'Kori Tech & Innovation SARL', email: 'hello@koritech.ga', phone: '+241 07 44 22 11', address: 'Immeuble Serena, Louis, Libreville' },
  { id: 'cli_nomad', name: 'Hôtel Le Nomad Libreville', email: 'direction@hotel-nomad.ga', phone: '+241 01 44 80 00', address: 'Avenue Colonel Parant, Libreville' },
  { id: 'cli_btp', name: 'BTP Gabon Construction SA', email: 'chantiers@btp-gabon.ga', phone: '+241 01 76 99 88', address: 'Zone Industrielle de Nkok, Nkok' },
];

const insertClient = db.prepare(`
  INSERT INTO clients (id, name, email, phone, address, status, createdAt, created_by, tenant_id)
  VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)
`);

for (let i = 0; i < clients.length; i++) {
  const c = clients[i];
  const dateStr = i < 5 ? '2024-01-10 10:00:00' : (i < 10 ? '2024-06-20 14:00:00' : '2025-02-15 09:30:00');
  insertClient.run(c.id, c.name, c.email, c.phone, c.address, dateStr, adminId, tenantId);
}
console.log(`[seed-multiyear] 15 clients insérés.`);

// 5. Catalogue de Services (10 prestations représentatives)
const services = [
  { id: 'srv_1', name: 'Maintenance Réseau & Postes Informatiques', description: 'Forfait mensuel support niveau 1 et infogérance', category: 'Maintenance', unitPrice: 450000 },
  { id: 'srv_2', name: 'Audit de Cybersécurité & Pentest', description: 'Audit complet d infrastructure et conformité légale', category: 'Prestation', unitPrice: 1800000 },
  { id: 'srv_3', name: 'Développement Web & Applicatif Sur Mesure', description: 'Prestation journalière développeur senior full-stack', category: 'Développement', unitPrice: 250000 },
  { id: 'srv_4', name: 'Câblage Baie Réseau & Fibre Optique', description: 'Fourniture et tirage de rocade fibre optique monomode', category: 'Infrastructure', unitPrice: 650000 },
  { id: 'srv_5', name: 'Infogérance Systèmes Cloud & Datacenter', description: 'Surveillance 24/7 et gestion des sauvegardes sécurisées', category: 'Maintenance', unitPrice: 850000 },
  { id: 'srv_6', name: 'Formation Hygiène, Sécurité et Numérique', description: 'Session de formation certifiante 5 jours pour 10 agents', category: 'Formation', unitPrice: 1200000 },
  { id: 'srv_7', name: 'Fourniture Serveur Rack Dell PowerEdge', description: 'Serveur bi-processeur 64 Go RAM, stockage RAID SAS', category: 'Équipement', unitPrice: 3500000 },
  { id: 'srv_8', name: 'Contrat Entretien Extincteurs & SSI', description: 'Visite réglementaire semestrielle et recharge 20 extincteurs', category: 'Sécurité', unitPrice: 320000 },
  { id: 'srv_9', name: 'Licence Logicielle Annuelle de Supervision', description: 'Licence 50 nœuds monitoring réseau et alertes SMS', category: 'Logiciel', unitPrice: 750000 },
  { id: 'srv_10', name: 'Intervention Dépannage Urgence 24/7', description: 'Déplacement sous 2 heures avec remplacement de pièces', category: 'Support', unitPrice: 200000 },
];

const insertService = db.prepare(`
  INSERT INTO services (id, name, description, category, unitPrice, createdAt, created_by, tenant_id)
  VALUES (?, ?, ?, ?, ?, '2024-01-10 11:00:00', ?, ?)
`);

for (const s of services) {
  insertService.run(s.id, s.name, s.description, s.category, s.unitPrice, adminId, tenantId);
}
console.log(`[seed-multiyear] 10 services insérés.`);

// 6. Générateur de Devis et Factures multi-années (2024, 2025, 2026)
// Structuration mensuelle réaliste pour garantir des graphiques cohérents :
// - Année 2024 : 20 factures (CA total ~ 38M XAF)
// - Année 2025 : 30 factures (CA total ~ 65M XAF)
// - Année 2026 : 42 factures (CA total ~ 95M XAF dont 16 sur les 60 derniers jours)

const insertQuote = db.prepare(`
  INSERT INTO quotes (
    id, number, clientId, clientName, clientEmail, date, subtotal, discount, taxBase,
    tpsAmount, tvaAmount, cssAmount, total, status, notes, subject, validUntil,
    createdAt, created_by, tenant_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertQuoteItem = db.prepare(`
  INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total, tenant_id)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertInvoice = db.prepare(`
  INSERT INTO invoices (
    id, number, quoteId, clientId, clientName, clientEmail, date, subtotal, discount, taxBase,
    tpsAmount, tvaAmount, cssAmount, total, status, notes, subject, dueDate,
    createdAt, created_by, tenant_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertInvoiceItem = db.prepare(`
  INSERT INTO invoice_items (id, invoiceId, description, quantity, unitPrice, total, tenant_id)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertPayment = db.prepare(`
  INSERT INTO payments (id, invoiceId, amount, paymentMethod, date, reference, createdAt, created_by, tenant_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const paymentMethodsPool = [
  'Virement Bancaire',
  'Virement Bancaire',
  'Virement Bancaire',
  'Airtel Money',
  'Airtel Money',
  'Moov Money',
  'Chèque',
  'Espèces',
];

const auditLogsData: Array<{ action: string; entityType: string; entityId: string; details: string; date: string; user: string }> = [];

let quoteSeq = 1;
let invoiceSeq = 1;

interface PrestationPlan {
  year: number;
  month: number;
  day: number;
  clientIndex: number;
  serviceIndex: number;
  qty: number;
  isQuoteOnly?: boolean;
  invoiceStatus: 'PAID' | 'PARTIALLY_PAID' | 'sent' | 'OVERDUE' | 'CANCELLED';
  paidRatio?: number;
}

const schedule: PrestationPlan[] = [];

// ── 2024 (24 opérations)
for (let m = 1; m <= 12; m++) {
  schedule.push({ year: 2024, month: m, day: 5, clientIndex: (m * 2) % 15, serviceIndex: (m) % 10, qty: 1 + (m % 3), invoiceStatus: 'PAID', paidRatio: 1 });
  schedule.push({ year: 2024, month: m, day: 20, clientIndex: (m * 3 + 1) % 15, serviceIndex: (m + 2) % 10, qty: 2 + (m % 2), invoiceStatus: 'PAID', paidRatio: 1 });
}

// ── 2025 (32 opérations)
for (let m = 1; m <= 12; m++) {
  schedule.push({ year: 2025, month: m, day: 4, clientIndex: (m * 2 + 3) % 15, serviceIndex: (m + 1) % 10, qty: 1 + (m % 4), invoiceStatus: 'PAID', paidRatio: 1 });
  schedule.push({ year: 2025, month: m, day: 16, clientIndex: (m * 4) % 15, serviceIndex: (m + 3) % 10, qty: 2, invoiceStatus: 'PAID', paidRatio: 1 });
  if (m % 2 === 0) {
    schedule.push({ year: 2025, month: m, day: 26, clientIndex: (m + 5) % 15, serviceIndex: (m + 4) % 10, qty: 1, invoiceStatus: m === 6 ? 'CANCELLED' : 'PAID', paidRatio: m === 6 ? 0 : 1 });
  }
}

// ── 2026 (Janvier à Octobre 2026) : Croissance et diversité des statuts
for (let m = 1; m <= 9; m++) {
  schedule.push({ year: 2026, month: m, day: 3, clientIndex: (m) % 15, serviceIndex: (m) % 10, qty: 2, invoiceStatus: 'PAID', paidRatio: 1 });
  schedule.push({ year: 2026, month: m, day: 12, clientIndex: (m + 2) % 15, serviceIndex: (m + 1) % 10, qty: 3, invoiceStatus: 'PAID', paidRatio: 1 });
  schedule.push({ year: 2026, month: m, day: 22, clientIndex: (m + 4) % 15, serviceIndex: (m + 5) % 10, qty: 1, invoiceStatus: 'PAID', paidRatio: 1 });
}

// ── Septembre 2026 (Mois précédent pour calcul de croissance)
schedule.push({ year: 2026, month: 9, day: 8, clientIndex: 0, serviceIndex: 1, qty: 2, invoiceStatus: 'PAID', paidRatio: 1 }); // SEEG Pentest 3.6M
schedule.push({ year: 2026, month: 9, day: 18, clientIndex: 1, serviceIndex: 6, qty: 1, invoiceStatus: 'PAID', paidRatio: 1 }); // COMILOG Serveur 3.5M
schedule.push({ year: 2026, month: 9, day: 27, clientIndex: 3, serviceIndex: 4, qty: 3, invoiceStatus: 'PAID', paidRatio: 1 }); // TotalEnergies Infogérance

// ── Octobre 2026 (Mois en cours - jusqu'au 29/10/2026)
// Alimente le graphique journalier des 30 jours et les cartes de trésorerie du Dashboard
schedule.push({ year: 2026, month: 10, day: 2, clientIndex: 0, serviceIndex: 0, qty: 4, invoiceStatus: 'PAID', paidRatio: 1 }); // 1.8M HT
schedule.push({ year: 2026, month: 10, day: 5, clientIndex: 6, serviceIndex: 8, qty: 2, invoiceStatus: 'PAID', paidRatio: 1 }); // BGFIBank Supervision
schedule.push({ year: 2026, month: 10, day: 9, clientIndex: 2, serviceIndex: 3, qty: 3, invoiceStatus: 'PAID', paidRatio: 1 }); // SETRAG Fibre
schedule.push({ year: 2026, month: 10, day: 12, clientIndex: 7, serviceIndex: 7, qty: 4, invoiceStatus: 'PARTIALLY_PAID', paidRatio: 0.5 }); // SOBRAGA Acompte 50%
schedule.push({ year: 2026, month: 10, day: 15, clientIndex: 4, serviceIndex: 2, qty: 8, invoiceStatus: 'PAID', paidRatio: 1 }); // Airtel Dév
schedule.push({ year: 2026, month: 10, day: 18, clientIndex: 5, serviceIndex: 1, qty: 1, invoiceStatus: 'PAID', paidRatio: 1 }); // Moov Pentest
schedule.push({ year: 2026, month: 10, day: 21, clientIndex: 8, serviceIndex: 4, qty: 2, invoiceStatus: 'PAID', paidRatio: 1 }); // CECA Infogérance
schedule.push({ year: 2026, month: 10, day: 24, clientIndex: 10, serviceIndex: 0, qty: 2, invoiceStatus: 'UNPAID', paidRatio: 0 }); // Clinique Mandji en attente
schedule.push({ year: 2026, month: 10, day: 26, clientIndex: 12, serviceIndex: 2, qty: 5, invoiceStatus: 'UNPAID', paidRatio: 0 }); // Kori Tech émise récente
schedule.push({ year: 2026, month: 10, day: 28, clientIndex: 13, serviceIndex: 9, qty: 3, invoiceStatus: 'PAID', paidRatio: 1 }); // Nomad Dépannage hier

// Factures échues / en retard (statut UNPAID avec échéance antérieure à aujourd'hui)
schedule.push({ year: 2026, month: 8, day: 14, clientIndex: 14, serviceIndex: 6, qty: 1, invoiceStatus: 'UNPAID', paidRatio: 0 }); // BTP Gabon en retard
schedule.push({ year: 2026, month: 9, day: 5, clientIndex: 11, serviceIndex: 8, qty: 1, invoiceStatus: 'UNPAID', paidRatio: 0 }); // Me MBA en retard

// Factures brouillons pour tester les flux en cours de saisie
schedule.push({ year: 2026, month: 10, day: 29, clientIndex: 1, serviceIndex: 2, qty: 2, invoiceStatus: 'draft' as any, paidRatio: 0 });
schedule.push({ year: 2026, month: 10, day: 30, clientIndex: 5, serviceIndex: 6, qty: 1, invoiceStatus: 'draft' as any, paidRatio: 0 });

// Devis supplémentaires non convertis (En attente, acceptés, refusés, brouillons)
const extraQuotes = [
  { year: 2026, month: 10, day: 14, clientIndex: 0, serviceIndex: 1, qty: 2, status: 'EN_ATTENTE', subject: 'Audit de sécurité SI et résilience SCADA' },
  { year: 2026, month: 10, day: 19, clientIndex: 3, serviceIndex: 6, qty: 2, status: 'EN_ATTENTE', subject: 'Acquisition clusters de virtualisation' },
  { year: 2026, month: 10, day: 22, clientIndex: 1, serviceIndex: 4, qty: 6, status: 'EN_ATTENTE', subject: 'Infogérance site minier Moanda S1 2027' },
  { year: 2026, month: 9, day: 20, clientIndex: 9, serviceIndex: 3, qty: 5, status: 'REFUSE', subject: 'Raccordement fibre terminal portuaire' },
  { year: 2026, month: 10, day: 25, clientIndex: 13, serviceIndex: 0, qty: 2, status: 'EN_ATTENTE', subject: 'Contrat maintenance parc hôtelier' },
  { year: 2026, month: 10, day: 29, clientIndex: 2, serviceIndex: 5, qty: 1, status: 'draft', subject: 'Brouillon - Audit infrastructure réseau' },
  { year: 2026, month: 10, day: 30, clientIndex: 4, serviceIndex: 7, qty: 2, status: 'draft', subject: 'Brouillon - Déploiement baie de stockage' },
];

db.transaction(() => {
  // ── Insertion de l'historique complet des devis et factures
  for (const item of schedule) {
    const client = clients[item.clientIndex];
    const service = services[item.serviceIndex];
    const subtotal = service.unitPrice * item.qty;
    const tvaAmount = Math.round(subtotal * 0.18);
    const cssAmount = Math.round(subtotal * 0.01);
    const total = subtotal + tvaAmount + cssAmount;

    const dateStr = `${item.year}-${String(item.month).padStart(2, '0')}-${String(item.day).padStart(2, '0')}`;
    const dueDay = item.day <= 15 ? item.day + 15 : 28;
    const dueMonth = item.day <= 15 ? item.month : (item.month === 12 ? 1 : item.month + 1);
    const dueYear = item.day <= 15 ? item.year : (item.month === 12 ? item.year + 1 : item.year);
    const dueDateStr = `${dueYear}-${String(dueMonth).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;

    const quoteId = `quo_${item.year}_${quoteSeq}`;
    const quoteNum = `DEV-${String(quoteSeq).padStart(3, '0')}/GM/${item.year}`;
    quoteSeq++;

    let creatorId = adminId;
    let creatorName = 'Administrateur';
    if (invoiceSeq % 4 === 1) {
      creatorId = paulId;
      creatorName = 'Paul BIVEGHE';
    } else if (invoiceSeq % 4 === 2) {
      creatorId = sarahId;
      creatorName = 'Sarah OBIANG';
    }

    // Devis converti
    insertQuote.run(
      quoteId,
      quoteNum,
      client.id,
      client.name,
      client.email,
      dateStr,
      subtotal,
      subtotal,
      tvaAmount,
      cssAmount,
      total,
      'CONVERTI',
      'Devis accepté et converti en facturation officielle.',
      service.name,
      dueDateStr,
      `${dateStr} 09:00:00`,
      creatorId,
      tenantId
    );

    insertQuoteItem.run(
      `qi_${quoteId}_1`,
      quoteId,
      service.name,
      item.qty,
      service.unitPrice,
      subtotal,
      tenantId
    );

    // Facture correspondante
    const invoiceId = `inv_${item.year}_${invoiceSeq}`;
    const invoiceNum = `FAC-${String(invoiceSeq).padStart(3, '0')}/GM/${item.year}`;
    invoiceSeq++;

    insertInvoice.run(
      invoiceId,
      invoiceNum,
      quoteId,
      client.id,
      client.name,
      client.email,
      dateStr,
      subtotal,
      subtotal,
      tvaAmount,
      cssAmount,
      total,
      item.invoiceStatus,
      'Conforme aux dispositions fiscales gabonaises (DGI). Règlement par virement ou mobile money.',
      service.name,
      dueDateStr,
      `${dateStr} 09:15:00`,
      creatorId,
      tenantId
    );

    insertInvoiceItem.run(
      `ii_${invoiceId}_1`,
      invoiceId,
      service.name,
      item.qty,
      service.unitPrice,
      subtotal,
      tenantId
    );

    // Règlements associés
    if (item.paidRatio && item.paidRatio > 0) {
      const payAmount = Math.round(total * item.paidRatio);
      const payMethod = paymentMethodsPool[(quoteSeq + invoiceSeq) % paymentMethodsPool.length];
      const payDate = `${dateStr}`;

      insertPayment.run(
        `pay_${invoiceId}_1`,
        invoiceId,
        payAmount,
        payMethod,
        payDate,
        `VIR-${item.year}-${String(invoiceSeq).padStart(4, '0')}`,
        `${dateStr} 15:30:00`,
        creatorId,
        tenantId
      );

      if (item.year === 2026) {
        auditLogsData.push({
          action: 'PAYMENT_CREATE',
          entityType: 'Payment',
          entityId: `pay_${invoiceId}_1`,
          details: JSON.stringify({
            action: 'PAYMENT_CREATE',
            invoiceNumber: invoiceNum,
            amount: payAmount,
            paymentMethod: payMethod,
          }),
          date: `${dateStr} 15:35:00`,
          user: creatorName,
        });
      }
    }

    // Journal d'audit synthétique
    if (item.year === 2026) {
      auditLogsData.push({
        action: 'INVOICE_CREATE',
        entityType: 'Invoice',
        entityId: invoiceId,
        details: JSON.stringify({ action: 'INVOICE_CREATE', invoiceNumber: invoiceNum, client: client.name, total }),
        date: `${dateStr} 09:16:00`,
        user: creatorName,
      });
    }
  }

  // ── Insertion des devis supplémentaires
  for (const eq of extraQuotes) {
    const client = clients[eq.clientIndex];
    const service = services[eq.serviceIndex];
    const subtotal = service.unitPrice * eq.qty;
    const tvaAmount = Math.round(subtotal * 0.18);
    const cssAmount = Math.round(subtotal * 0.01);
    const total = subtotal + tvaAmount + cssAmount;
    const dateStr = `${eq.year}-${String(eq.month).padStart(2, '0')}-${String(eq.day).padStart(2, '0')}`;
    const validUntil = `${eq.year}-${String(eq.month).padStart(2, '0')}-28`;

    const quoteId = `quo_${eq.year}_${quoteSeq}`;
    const quoteNum = `DEV-${String(quoteSeq).padStart(3, '0')}/GM/${eq.year}`;
    quoteSeq++;

    insertQuote.run(
      quoteId,
      quoteNum,
      client.id,
      client.name,
      client.email,
      dateStr,
      subtotal,
      subtotal,
      tvaAmount,
      cssAmount,
      total,
      eq.status,
      'Proposition commerciale valable 30 jours.',
      eq.subject,
      validUntil,
      `${dateStr} 10:00:00`,
      adminId,
      tenantId
    );

    insertQuoteItem.run(
      `qi_${quoteId}_1`,
      quoteId,
      service.name,
      eq.qty,
      service.unitPrice,
      subtotal,
      tenantId
    );
  }

  // ── 7. Notes d'avoir (OHADA)
  const creditNotes = [
    {
      id: 'cn_1',
      number: 'AVR-001/GM/2025',
      invoiceId: 'inv_2025_12',
      clientId: 'cli_seeg',
      clientName: 'Société d\'Énergie et d\'Eau du Gabon (SEEG)',
      date: '2025-06-28',
      reason: 'Remise commerciale de fin de semestre accordée par la direction',
      subtotal: 450000,
      total: 535500,
    },
    {
      id: 'cn_2',
      number: 'AVR-001/GM/2026',
      invoiceId: 'inv_2026_45',
      clientId: 'cli_comilog',
      clientName: 'Compagnie Minière de l\'Ogooué (COMILOG)',
      date: '2026-04-12',
      reason: 'Rectification suite à réajustement du volume horaire effectif',
      subtotal: 500000,
      total: 595000,
    },
    {
      id: 'cn_3',
      number: 'AVR-002/GM/2026',
      invoiceId: 'inv_2026_70',
      clientId: 'cli_total',
      clientName: 'TotalEnergies EP Gabon',
      date: '2026-09-22',
      reason: 'Annulation partielle pour reliquat matériel non livré',
      subtotal: 650000,
      total: 773500,
    },
  ];

  const insertCreditNote = db.prepare(`
    INSERT INTO credit_notes (
      id, number, invoiceId, clientId, clientName, date, reason, subtotal, taxBase,
      tpsAmount, tvaAmount, cssAmount, total, status, createdAt, created_by, tenant_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'open', ?, ?, ?)
  `);

  const insertCreditNoteItem = db.prepare(`
    INSERT INTO credit_note_items (id, creditNoteId, description, quantity, unitPrice, total, tenant_id)
    VALUES (?, ?, ?, 1, ?, ?, ?)
  `);

  for (const cn of creditNotes) {
    const tva = Math.round(cn.subtotal * 0.18);
    const css = Math.round(cn.subtotal * 0.01);
    insertCreditNote.run(
      cn.id,
      cn.number,
      cn.invoiceId,
      cn.clientId,
      cn.clientName,
      cn.date,
      cn.reason,
      cn.subtotal,
      cn.subtotal,
      tva,
      css,
      cn.total,
      `${cn.date} 16:00:00`,
      adminId,
      tenantId
    );

    insertCreditNoteItem.run(
      `cni_${cn.id}_1`,
      cn.id,
      cn.reason,
      cn.subtotal,
      cn.subtotal,
      tenantId
    );
  }

  // ── 8. Mise à jour des séquences
  db.prepare(`
    INSERT OR REPLACE INTO sequences (name, current_value, last_year) VALUES
    ('invoice_sequence', ?, 2026),
    ('quote_sequence', ?, 2026),
    ('credit_note_sequence', 3, 2026)
  `).run(invoiceSeq, quoteSeq);

  // ── 9. Journal d'audit complet
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, userId, userName, action, entityType, entityId, details, createdAt, tenant_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Log initial de setup
  insertAudit.run(
    crypto.randomUUID(),
    adminId,
    'Administrateur',
    'FIRST_RUN_SETUP',
    'Settings',
    '1',
    JSON.stringify({ action: 'FIRST_RUN_SETUP', companyName: 'Global Maintenance', adminEmail: 'admin@gmail.com' }),
    '2024-01-02 08:00:00',
    tenantId
  );

  for (let i = 0; i < auditLogsData.length; i++) {
    const al = auditLogsData[i];
    insertAudit.run(
      crypto.randomUUID(),
      adminId,
      al.user,
      al.action,
      al.entityType,
      al.entityId,
      al.details,
      al.date,
      tenantId
    );
  }
})();

// Résumé des métriques insérées
const totalInvoices = db.prepare('SELECT count(*) as count, sum(total) as ca FROM invoices').get() as any;
const totalQuotes = db.prepare('SELECT count(*) as count FROM quotes').get() as any;
const totalPayments = db.prepare('SELECT count(*) as count, sum(amount) as encaisse FROM payments').get() as any;
const totalClients = db.prepare('SELECT count(*) as count FROM clients').get() as any;

console.log('\n======================================================');
console.log('✅ SEEDING MULTI-ANNÉES EFFECTUÉ AVEC SUCCÈS !');
console.log(`- Période couverte : 2024, 2025 et 2026 (jusqu'à fin Octobre 2026)`);
console.log(`- Clients enregistrés : ${totalClients.count}`);
console.log(`- Devis émis : ${totalQuotes.count}`);
console.log(`- Factures émises : ${totalInvoices.count} (Chiffre d'Affaires total : ${Math.round(totalInvoices.ca).toLocaleString('fr-FR')} XAF)`);
console.log(`- Règlements enregistrés : ${totalPayments.count} (Total encaissé : ${Math.round(totalPayments.encaisse).toLocaleString('fr-FR')} XAF)`);
console.log('======================================================\n');

// Synchronisation miroir vers AppData si existant
const appDataDb = path.join(process.env.APPDATA || '', 'Facturier/data/database.sqlite');
if (fs.existsSync(path.dirname(appDataDb))) {
  try {
    fs.copyFileSync(dbPath, appDataDb);
    console.log(`[seed-multiyear] Base synchronisée avec succès vers : ${appDataDb}`);
  } catch (err: any) {
    console.warn(`[seed-multiyear] Attention : synchronisation AppData ignorée (${err.message})`);
  }
}
