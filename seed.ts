/**
 * seed.ts — Seeder professionnel "L'Étoile"
 * ==========================================
 * Purge la BDD et injecte un jeu de données cohérent et hyper-réaliste
 * pour valider les graphiques du Dashboard et les droits RBAC.
 *
 * Usage: npx ts-node --project tsconfig.json seed.ts
 *        ou via: npm run seed
 */

import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

const SALT = 'letoile-gabon-2026';
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

/** Retourne une date ISO (YYYY-MM-DD) décalée de `daysOffset` jours depuis aujourd'hui */
function daysAgo(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysOffset);
  return d.toISOString().split('T')[0];
}

/** Arrondi à l'entier le plus proche */
function round(n: number): number {
  return Math.round(n);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🌟  Seeder "L\'Étoile" — Démarrage');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// ──────────────────────────────────────────────
// 1. PURGE COMPLÈTE (ordre respectant les FK)
// ──────────────────────────────────────────────
console.log('\n🧹  Purge de la base de données...');
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

// Reset sequences
db.prepare("INSERT INTO sequences (name, current_value, last_year) VALUES ('quote', 0, strftime('%Y', 'now'))").run();
db.prepare("INSERT INTO sequences (name, current_value, last_year) VALUES ('invoice', 0, strftime('%Y', 'now'))").run();

// ──────────────────────────────────────────────
// 2. UTILISATEURS (1 Admin + 1 Opérateur)
// ──────────────────────────────────────────────
console.log('\n👥  Création des utilisateurs...');

const adminId = crypto.randomUUID();
db.prepare(`
  INSERT INTO users (id, username, email, password, role, name, is_active, created_at)
  VALUES (?, ?, ?, ?, 'admin', ?, 1, CURRENT_TIMESTAMP)
`).run(adminId, 'admin@letoile.ga', 'admin@letoile.ga', hashPassword('admin123'), 'Administrateur Système');

const operatorId = crypto.randomUUID();
db.prepare(`
  INSERT INTO users (id, username, email, password, role, name, is_active, created_at)
  VALUES (?, ?, ?, ?, 'user', ?, 1, CURRENT_TIMESTAMP)
`).run(operatorId, 'operateur@letoile.ga', 'operateur@letoile.ga', hashPassword('operateur123'), 'Jean-Baptiste Moussavou');

console.log('  ✅  Admin        : admin@letoile.ga / admin123');
console.log('  ✅  Opérateur    : operateur@letoile.ga / operateur123');

// ──────────────────────────────────────────────
// 3. CLIENTS (3 entreprises gabonaises réalistes)
// ──────────────────────────────────────────────
console.log('\n🏢  Création des clients...');

const clientIds = {
  cga: crypto.randomUUID(),
  gabon_telecom: crypto.randomUUID(),
  seeg: crypto.randomUUID(),
};

const insertClient = db.prepare(`
  INSERT INTO clients (id, name, email, phone, address, status, createdAt)
  VALUES (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
`);

insertClient.run(clientIds.cga,          'CGA – Compagnie Gabonaise d\'Assurances', 'daf@cga.ga',          '+241 01 76 10 20', 'Boulevard Triomphal, Libreville, Gabon');
insertClient.run(clientIds.gabon_telecom, 'Gabon Télécom S.A.',                     'comptabilite@gt.ga',  '+241 01 72 00 00', 'Quartier Glass, BP 2020, Libreville, Gabon');
insertClient.run(clientIds.seeg,          'SEEG – Société d\'Eau et d\'Énergie',    'achats@seeg.ga',      '+241 01 76 30 00', 'Rue des Frangipaniers, Libreville, Gabon');

console.log('  ✅  3 clients créés (CGA, Gabon Télécom, SEEG)');

// ──────────────────────────────────────────────
// 4. SERVICES (5 prestations)
// ──────────────────────────────────────────────
console.log('\n🔧  Création des services...');

const serviceIds = {
  maint_prev:  crypto.randomUUID(),
  maint_corr:  crypto.randomUUID(),
  audit_tech:  crypto.randomUUID(),
  formation:   crypto.randomUUID(),
  fourniture:  crypto.randomUUID(),
};

const insertService = db.prepare(`
  INSERT INTO services (id, name, description, category, unitPrice, createdAt)
  VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
`);

insertService.run(serviceIds.maint_prev, 'Maintenance Préventive',   'Entretien régulier des équipements industriels et informatiques',  'Maintenance',   75000);
insertService.run(serviceIds.maint_corr, 'Maintenance Corrective',   'Intervention curative sur panne ou dysfonctionnement détecté',     'Maintenance',  120000);
insertService.run(serviceIds.audit_tech, 'Audit Technique',          'Diagnostic complet de l\'infrastructure technique existante',      'Conseil',      250000);
insertService.run(serviceIds.formation,  'Formation Technique',      'Session de formation du personnel sur les équipements (1 jour)',    'Formation',    180000);
insertService.run(serviceIds.fourniture, 'Fournitures & Pièces',     'Fourniture de pièces détachées et consommables techniques',        'Fournitures',   45000);

console.log('  ✅  5 services créés');

// ──────────────────────────────────────────────
// 5. DEVIS (10 devis — répartis sur 3 mois)
// ──────────────────────────────────────────────
console.log('\n📋  Création des devis...');

/**
 * Calcule les montants TTC gabonais
 * TVA: 18% | TPS: 9.5% | CSS: 1%
 */
function calcTaxes(subtotal: number, discount = 0) {
  const taxBase   = subtotal - discount;
  const tvaAmount = round(taxBase * 0.18);
  const tpsAmount = round(taxBase * 0.095);
  const cssAmount = round(taxBase * 0.01);
  const total     = taxBase + tvaAmount + tpsAmount + cssAmount;
  return { subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total: round(total) };
}

const insertQuote = db.prepare(`
  INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, dueDate,
    subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total,
    status, notes, createdAt, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
`);

const insertQuoteItem = db.prepare(`
  INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total)
  VALUES (?, ?, ?, ?, ?, ?)
`);

type QuoteData = {
  id: string;
  number: string;
  clientKey: keyof typeof clientIds;
  clientName: string;
  clientEmail: string;
  date: string;
  status: string;
  items: Array<{ description: string; qty: number; unitPrice: number }>;
  notes?: string;
};

const quotesData: QuoteData[] = [
  // Devis convertis en factures (status: 'invoiced')
  {
    id: crypto.randomUUID(), number: 'DEV-001/CGA/2026',
    clientKey: 'cga', clientName: 'CGA – Compagnie Gabonaise d\'Assurances', clientEmail: 'daf@cga.ga',
    date: daysAgo(85), status: 'invoiced',
    items: [{ description: 'Maintenance Préventive — Parc Informatique CGA', qty: 3, unitPrice: 75000 }],
    notes: 'Contrat annuel de maintenance — Tranche 1'
  },
  {
    id: crypto.randomUUID(), number: 'DEV-002/GT/2026',
    clientKey: 'gabon_telecom', clientName: 'Gabon Télécom S.A.', clientEmail: 'comptabilite@gt.ga',
    date: daysAgo(70), status: 'invoiced',
    items: [
      { description: 'Audit Technique de l\'Infrastructure Réseau', qty: 1, unitPrice: 250000 },
      { description: 'Rapport d\'audit et recommandations', qty: 1, unitPrice: 50000 },
    ],
    notes: 'Audit complet infrastructure réseau & télécom'
  },
  {
    id: crypto.randomUUID(), number: 'DEV-003/SEEG/2026',
    clientKey: 'seeg', clientName: 'SEEG – Société d\'Eau et d\'Énergie', clientEmail: 'achats@seeg.ga',
    date: daysAgo(55), status: 'invoiced',
    items: [
      { description: 'Maintenance Corrective — Centrale Électrique N°2', qty: 2, unitPrice: 120000 },
      { description: 'Fournitures & Pièces de rechange', qty: 5, unitPrice: 45000 },
    ],
    notes: 'Intervention urgente centrale N°2'
  },
  {
    id: crypto.randomUUID(), number: 'DEV-004/CGA/2026',
    clientKey: 'cga', clientName: 'CGA – Compagnie Gabonaise d\'Assurances', clientEmail: 'daf@cga.ga',
    date: daysAgo(40), status: 'invoiced',
    items: [{ description: 'Formation Technique — Équipe IT CGA (2 jours)', qty: 2, unitPrice: 180000 }],
    notes: 'Formation sur les nouveaux équipements installés'
  },
  {
    id: crypto.randomUUID(), number: 'DEV-005/GT/2026',
    clientKey: 'gabon_telecom', clientName: 'Gabon Télécom S.A.', clientEmail: 'comptabilite@gt.ga',
    date: daysAgo(30), status: 'invoiced',
    items: [{ description: 'Maintenance Préventive — Équipements Transmission', qty: 4, unitPrice: 75000 }],
  },
  // Devis en attente (status: 'sent')
  {
    id: crypto.randomUUID(), number: 'DEV-006/SEEG/2026',
    clientKey: 'seeg', clientName: 'SEEG – Société d\'Eau et d\'Énergie', clientEmail: 'achats@seeg.ga',
    date: daysAgo(20), status: 'sent',
    items: [{ description: 'Audit Technique — Réseau de distribution eau', qty: 1, unitPrice: 250000 }],
    notes: 'En attente de validation par le service achats'
  },
  {
    id: crypto.randomUUID(), number: 'DEV-007/CGA/2026',
    clientKey: 'cga', clientName: 'CGA – Compagnie Gabonaise d\'Assurances', clientEmail: 'daf@cga.ga',
    date: daysAgo(15), status: 'sent',
    items: [
      { description: 'Maintenance Préventive — Parc Informatique CGA', qty: 2, unitPrice: 75000 },
      { description: 'Fournitures & Pièces', qty: 3, unitPrice: 45000 },
    ],
  },
  {
    id: crypto.randomUUID(), number: 'DEV-008/GT/2026',
    clientKey: 'gabon_telecom', clientName: 'Gabon Télécom S.A.', clientEmail: 'comptabilite@gt.ga',
    date: daysAgo(10), status: 'sent',
    items: [{ description: 'Formation Technique — Équipe Réseau GT (3 jours)', qty: 3, unitPrice: 180000 }],
  },
  // Devis brouillons
  {
    id: crypto.randomUUID(), number: 'DEV-009/SEEG/2026',
    clientKey: 'seeg', clientName: 'SEEG – Société d\'Eau et d\'Énergie', clientEmail: 'achats@seeg.ga',
    date: daysAgo(5), status: 'draft',
    items: [{ description: 'Maintenance Corrective — Groupe électrogène de secours', qty: 1, unitPrice: 120000 }],
  },
  {
    id: crypto.randomUUID(), number: 'DEV-010/CGA/2026',
    clientKey: 'cga', clientName: 'CGA – Compagnie Gabonaise d\'Assurances', clientEmail: 'daf@cga.ga',
    date: daysAgo(2), status: 'draft',
    items: [
      { description: 'Audit Technique complet du parc informatique', qty: 1, unitPrice: 250000 },
      { description: 'Rapport et plan d\'action', qty: 1, unitPrice: 75000 },
    ],
  },
];

const quoteIds: string[] = [];
for (const q of quotesData) {
  const lineItems = q.items.map(item => ({
    ...item,
    total: round(item.qty * item.unitPrice)
  }));
  const rawSubtotal = lineItems.reduce((s, i) => s + i.total, 0);
  const taxes = calcTaxes(rawSubtotal);
  const dueDate = new Date(q.date);
  dueDate.setDate(dueDate.getDate() + 30);
  const dueDateStr = dueDate.toISOString().split('T')[0];

  insertQuote.run(
    q.id, q.number, clientIds[q.clientKey], q.clientName, q.clientEmail,
    q.date, dueDateStr,
    taxes.subtotal, taxes.discount, taxes.taxBase, taxes.tvaAmount, taxes.tpsAmount, taxes.cssAmount, taxes.total,
    q.status, q.notes || null, operatorId
  );

  for (const item of lineItems) {
    insertQuoteItem.run(crypto.randomUUID(), q.id, item.description, item.qty, item.unitPrice, item.total);
  }
  quoteIds.push(q.id);
}

console.log('  ✅  10 devis créés (5 convertis, 3 envoyés, 2 brouillons)');

// ──────────────────────────────────────────────
// 6. FACTURES (5 — statuts variés)
//    Mappées sur les 5 premiers devis "invoiced"
// ──────────────────────────────────────────────
console.log('\n🧾  Création des factures...');

const insertInvoice = db.prepare(`
  INSERT INTO invoices (id, number, quoteId, clientId, clientName, clientEmail, date, dueDate,
    subtotal, discount, taxBase, tvaAmount, tpsAmount, cssAmount, total,
    status, notes, createdAt, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
`);

const insertInvoiceItem = db.prepare(`
  INSERT INTO invoice_items (id, invoiceId, description, quantity, unitPrice, total)
  VALUES (?, ?, ?, ?, ?, ?)
`);

type InvoiceSpec = {
  invoiceNumber: string;
  quoteIndex: number;   // index dans quotesData
  status: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID';
  dateOffset: number;   // daysAgo
};

const invoiceSpecs: InvoiceSpec[] = [
  { invoiceNumber: 'FAC-001/CGA/2026',  quoteIndex: 0, status: 'PAID',            dateOffset: 80 },
  { invoiceNumber: 'FAC-002/GT/2026',   quoteIndex: 1, status: 'PAID',            dateOffset: 65 },
  { invoiceNumber: 'FAC-003/SEEG/2026', quoteIndex: 2, status: 'PARTIALLY_PAID',  dateOffset: 50 },
  { invoiceNumber: 'FAC-004/CGA/2026',  quoteIndex: 3, status: 'PARTIALLY_PAID',  dateOffset: 35 },
  { invoiceNumber: 'FAC-005/GT/2026',   quoteIndex: 4, status: 'UNPAID',          dateOffset: 25 },
];

const invoiceIds: string[] = [];

for (const spec of invoiceSpecs) {
  const q = quotesData[spec.quoteIndex];
  const lineItems = q.items.map(item => ({
    ...item,
    total: round(item.qty * item.unitPrice)
  }));
  const rawSubtotal = lineItems.reduce((s, i) => s + i.total, 0);
  const taxes = calcTaxes(rawSubtotal);

  const invoiceDate = daysAgo(spec.dateOffset);
  const dueD = new Date(invoiceDate);
  dueD.setDate(dueD.getDate() + 30);
  const dueDateStr = dueD.toISOString().split('T')[0];

  const invoiceId = crypto.randomUUID();
  invoiceIds.push(invoiceId);

  insertInvoice.run(
    invoiceId, spec.invoiceNumber, q.id, clientIds[q.clientKey], q.clientName, q.clientEmail,
    invoiceDate, dueDateStr,
    taxes.subtotal, taxes.discount, taxes.taxBase, taxes.tvaAmount, taxes.tpsAmount, taxes.cssAmount, taxes.total,
    spec.status, q.notes || null, operatorId
  );

  for (const item of lineItems) {
    insertInvoiceItem.run(crypto.randomUUID(), invoiceId, item.description, item.qty, item.unitPrice, item.total);
  }
}

console.log('  ✅  5 factures créées (2 PAID, 2 PARTIALLY_PAID, 1 UNPAID)');

// ──────────────────────────────────────────────
// 7. PAIEMENTS (associés aux factures)
//    Répartis sur les 3 derniers mois pour
//    alimenter le graphique "Revenus"
// ──────────────────────────────────────────────
console.log('\n💳  Enregistrement des paiements...');

const insertPayment = db.prepare(`
  INSERT INTO payments (id, invoiceId, amount, paymentMethod, date, reference, createdAt)
  VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
`);

type PaymentSpec = {
  invoiceIndex: number;
  amount: number;
  method: 'airtel' | 'moov' | 'virement' | 'cash';
  dateOffset: number;
  reference: string;
};

// Reconstituons les totaux pour les calculs de paiement
const invoiceTotals = invoiceSpecs.map(spec => {
  const q = quotesData[spec.quoteIndex];
  const rawSubtotal = q.items.reduce((s, i) => s + round(i.qty * i.unitPrice), 0);
  return calcTaxes(rawSubtotal).total;
});

const paymentSpecs: PaymentSpec[] = [
  // FAC-001/CGA — PAID en 2 virements
  { invoiceIndex: 0, amount: round(invoiceTotals[0] * 0.6), method: 'virement', dateOffset: 75, reference: 'VIR-001/CGA/2026' },
  { invoiceIndex: 0, amount: invoiceTotals[0] - round(invoiceTotals[0] * 0.6), method: 'virement', dateOffset: 60, reference: 'VIR-002/CGA/2026' },

  // FAC-002/GT — PAID en 1 paiement Airtel Money
  { invoiceIndex: 1, amount: invoiceTotals[1], method: 'airtel', dateOffset: 58, reference: 'AM-GT-001-2026' },

  // FAC-003/SEEG — PARTIALLY_PAID (acompte 50%)
  { invoiceIndex: 2, amount: round(invoiceTotals[2] * 0.5), method: 'moov', dateOffset: 45, reference: 'MM-SEEG-001-2026' },

  // FAC-004/CGA — PARTIALLY_PAID (acompte 40%)
  { invoiceIndex: 3, amount: round(invoiceTotals[3] * 0.4), method: 'cash', dateOffset: 28, reference: 'ESP-CGA-001-2026' },

  // FAC-005/GT — UNPAID → pas de paiement
];

for (const p of paymentSpecs) {
  insertPayment.run(
    crypto.randomUUID(),
    invoiceIds[p.invoiceIndex],
    p.amount,
    p.method,
    daysAgo(p.dateOffset),
    p.reference
  );
}

console.log('  ✅  5 paiements enregistrés (virement, airtel, moov, cash)');

// ──────────────────────────────────────────────
// 8. LOGS D'AUDIT (historique réaliste)
// ──────────────────────────────────────────────
console.log('\n📊  Génération des logs d\'audit...');

const insertLog = db.prepare(`
  INSERT INTO audit_logs (id, userId, userName, action, entityType, entityId, details, createdAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', ? || ' seconds'))
`);

const auditEvents = [
  { userId: adminId,    userName: 'Administrateur Système', action: 'LOGIN',   entityType: 'auth',    entityId: null,         details: 'Connexion administrateur réussie',                 offset: -3600  },
  { userId: operatorId, userName: 'Jean-Baptiste Moussavou', action: 'CREATE', entityType: 'client',  entityId: clientIds.cga, details: 'Nouveau client: CGA – Compagnie Gabonaise d\'Assurances', offset: -3000 },
  { userId: operatorId, userName: 'Jean-Baptiste Moussavou', action: 'CREATE', entityType: 'quote',   entityId: quoteIds[0],   details: 'Devis créé: DEV-001/CGA/2026 — 279 450 XAF',       offset: -2500  },
  { userId: operatorId, userName: 'Jean-Baptiste Moussavou', action: 'UPDATE', entityType: 'quote',   entityId: quoteIds[0],   details: 'Devis envoyé au client: DEV-001/CGA/2026',          offset: -2000  },
  { userId: operatorId, userName: 'Jean-Baptiste Moussavou', action: 'CREATE', entityType: 'invoice', entityId: invoiceIds[0], details: 'Facture émise: FAC-001/CGA/2026 — 279 450 XAF',     offset: -1500  },
  { userId: operatorId, userName: 'Jean-Baptiste Moussavou', action: 'CREATE', entityType: 'payment', entityId: invoiceIds[0], details: 'Paiement reçu: FAC-001/CGA/2026 — Virement bancaire', offset: -1000 },
  { userId: adminId,    userName: 'Administrateur Système', action: 'VIEW',    entityType: 'report',  entityId: null,          details: 'Rapport mensuel consulté par l\'administrateur',    offset: -500   },
];

for (const e of auditEvents) {
  insertLog.run(
    crypto.randomUUID(), e.userId, e.userName,
    e.action, e.entityType, e.entityId, e.details,
    String(e.offset)
  );
}

console.log('  ✅  7 logs d\'audit générés');

// ──────────────────────────────────────────────
// 9. RÉSUMÉ FINAL
// ──────────────────────────────────────────────
const totalPayments = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE deletedAt IS NULL").get() as { total: number };
const invoiceCount  = db.prepare("SELECT COUNT(*) as c FROM invoices WHERE deletedAt IS NULL").get() as { c: number };
const quoteCount    = db.prepare("SELECT COUNT(*) as c FROM quotes WHERE deletedAt IS NULL").get() as { c: number };

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅  Seeding terminé avec succès !');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n📊  Statistiques BDD :');
console.log(`    Utilisateurs  : 2 (1 admin, 1 opérateur)`);
console.log(`    Clients       : 3`);
console.log(`    Services      : 5`);
console.log(`    Devis         : ${quoteCount.c} (5 convertis, 3 envoyés, 2 brouillons)`);
console.log(`    Factures      : ${invoiceCount.c} (2 PAID, 2 PARTIALLY_PAID, 1 UNPAID)`);
console.log(`    Paiements     : 5 paiements`);
console.log(`    CA total BDD  : ${totalPayments.total.toLocaleString('fr-FR')} XAF`);
console.log('\n🔑  Accès :');
console.log('    Admin      → admin@letoile.ga     / admin123');
console.log('    Opérateur  → operateur@letoile.ga / operateur123');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
