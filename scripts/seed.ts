import Database from "better-sqlite3";
import path from "path";

const dbPath = path.resolve(process.cwd(), "data/database.sqlite");
const db = new Database(dbPath);

console.log(`[seed] Connecting to database at ${dbPath}`);

try {
  // Ensure schema is updated before seeding
  const quotesColumns = db.prepare("PRAGMA table_info(quotes)").all() as Array<{ name: string }>;
  if (!quotesColumns.some(c => c.name === 'subject')) {
    db.prepare("ALTER TABLE quotes ADD COLUMN subject TEXT").run();
  }
  if (!quotesColumns.some(c => c.name === 'validUntil')) {
    db.prepare("ALTER TABLE quotes ADD COLUMN validUntil TEXT").run();
  }
  
  const invoicesColumns = db.prepare("PRAGMA table_info(invoices)").all() as Array<{ name: string }>;
  if (!invoicesColumns.some(c => c.name === 'subject')) {
    db.prepare("ALTER TABLE invoices ADD COLUMN subject TEXT").run();
  }

  db.exec(`
    UPDATE settings SET companyCode = 'GM' WHERE id = 1;
    DELETE FROM payments;
    DELETE FROM invoice_items;
    DELETE FROM invoices;
    DELETE FROM quote_items;
    DELETE FROM quotes;
    DELETE FROM services;
    DELETE FROM clients;
  `);
  console.log("[seed] Successfully cleared business tables and set companyCode.");
} catch (error) {
  console.error("[seed] Error clearing tables:", error);
  process.exit(1);
}

const clients = [
  { id: "cli_1", name: "TechGabon Solutions", email: "contact@techgabon.com", phone: "011223344", address: "123 Avenue de l'Innovation, Libreville", created_by: "usr_1" },
  { id: "cli_2", name: "Libreville Logistique", email: "info@l-logistique.ga", phone: "077889900", address: "Zone Portuaire, Owendo", created_by: "usr_1" },
  { id: "cli_3", name: "Moanda Mining Co.", email: "procurement@moandamining.com", phone: "066554433", address: "Quartier Industriel, Moanda", created_by: "usr_1" }
];

const services = [
  { id: "srv_1", name: "Consulting IT", description: "Audit et conseil en architecture systeme", category: "Prestation", unitPrice: 150000, created_by: "usr_1" },
  { id: "srv_2", name: "Maintenance Serveur", description: "Forfait mensuel de maintenance serveurs Linux", category: "Maintenance", unitPrice: 75000, created_by: "usr_1" },
  { id: "srv_3", name: "Licence Logiciel", description: "Licence annuelle Facturier Pro", category: "Logiciel", unitPrice: 250000, created_by: "usr_1" },
  { id: "srv_4", name: "Developpement Sur Mesure", description: "Developpement d'un module specifique", category: "Developpement", unitPrice: 500000, created_by: "usr_1" }
];

const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
};

const today = addDays(0);

const quotes = [
  { id: "quo_1", number: "DEV/GM/2026/00001", clientId: "cli_1", clientName: "TechGabon Solutions", clientEmail: "contact@techgabon.com", date: today, subject: "Refonte de l'infrastructure reseau", status: "EN_ATTENTE", validUntil: addDays(15), subtotal: 300000, tvaAmount: 54000, cssAmount: 3000, total: 354000, created_by: "usr_1" },
  { id: "quo_2", number: "DEV/GM/2026/00002", clientId: "cli_2", clientName: "Libreville Logistique", clientEmail: "info@l-logistique.ga", date: addDays(-10), subject: "Mise en place ERP", status: "EXPIRED", validUntil: addDays(-5), subtotal: 500000, tvaAmount: 90000, cssAmount: 5000, total: 590000, created_by: "usr_1" },
  { id: "quo_3", number: "DEV/GM/2026/00003", clientId: "cli_3", clientName: "Moanda Mining Co.", clientEmail: "procurement@moandamining.com", date: addDays(-20), subject: "Audit de securite", status: "CONVERTI", validUntil: addDays(10), subtotal: 150000, tvaAmount: 27000, cssAmount: 1500, total: 177000, created_by: "usr_1" },
  { id: "quo_4", number: "DEV/GM/2026/00004", clientId: "cli_1", clientName: "TechGabon Solutions", clientEmail: "contact@techgabon.com", date: addDays(-25), subject: "Licences logicielles 2026", status: "CONVERTI", validUntil: addDays(5), subtotal: 250000, tvaAmount: 45000, cssAmount: 2500, total: 297500, created_by: "usr_1" }
];

const quote_items = [
  { id: "qi_1", quoteId: "quo_1", description: "Consulting IT (Jours)", quantity: 2, unitPrice: 150000, total: 300000 },
  { id: "qi_2", quoteId: "quo_2", description: "Developpement Sur Mesure", quantity: 1, unitPrice: 500000, total: 500000 },
  { id: "qi_3", quoteId: "quo_3", description: "Consulting IT (Jours)", quantity: 1, unitPrice: 150000, total: 150000 },
  { id: "qi_4", quoteId: "quo_4", description: "Licence Logiciel", quantity: 1, unitPrice: 250000, total: 250000 }
];

const invoices = [
  { id: "inv_1", number: "FAC/GM/2026/00001", quoteId: "quo_3", clientId: "cli_3", clientName: "Moanda Mining Co.", clientEmail: "procurement@moandamining.com", date: addDays(-19), dueDate: addDays(11), subject: "Audit de securite", status: "PAID", subtotal: 150000, taxBase: 150000, tvaAmount: 27000, cssAmount: 1500, total: 177000, created_by: "usr_1" },
  { id: "inv_2", number: "FAC/GM/2026/00002", quoteId: "quo_4", clientId: "cli_1", clientName: "TechGabon Solutions", clientEmail: "contact@techgabon.com", date: addDays(-24), dueDate: addDays(6), subject: "Licences logicielles 2026", status: "PAID", subtotal: 250000, taxBase: 250000, tvaAmount: 45000, cssAmount: 2500, total: 297500, created_by: "usr_1" },
  { id: "inv_3", number: "FAC/GM/2026/00003", quoteId: null, clientId: "cli_2", clientName: "Libreville Logistique", clientEmail: "info@l-logistique.ga", date: addDays(-5), dueDate: addDays(25), subject: "Maintenance Serveur Q3", status: "UNPAID", subtotal: 75000, taxBase: 75000, tvaAmount: 13500, cssAmount: 750, total: 89250, created_by: "usr_1" },
  { id: "inv_4", number: "FAC/GM/2026/00004", quoteId: null, clientId: "cli_1", clientName: "TechGabon Solutions", clientEmail: "contact@techgabon.com", date: addDays(-2), dueDate: addDays(28), subject: "Developpement interface API", status: "UNPAID", subtotal: 500000, taxBase: 500000, tvaAmount: 90000, cssAmount: 5000, total: 595000, created_by: "usr_1" },
  { id: "inv_5", number: "FAC/GM/2026/00005", quoteId: null, clientId: "cli_3", clientName: "Moanda Mining Co.", clientEmail: "procurement@moandamining.com", date: addDays(-40), dueDate: addDays(-10), subject: "Renouvellement parc informatique", status: "UNPAID", subtotal: 1000000, taxBase: 1000000, tvaAmount: 180000, cssAmount: 10000, total: 1190000, created_by: "usr_1" }
];

const invoice_items = [
  { id: "ii_1", invoiceId: "inv_1", description: "Consulting IT (Jours)", quantity: 1, unitPrice: 150000, total: 150000 },
  { id: "ii_2", invoiceId: "inv_2", description: "Licence Logiciel", quantity: 1, unitPrice: 250000, total: 250000 },
  { id: "ii_3", invoiceId: "inv_3", description: "Maintenance Serveur", quantity: 1, unitPrice: 75000, total: 75000 },
  { id: "ii_4", invoiceId: "inv_4", description: "Developpement Sur Mesure", quantity: 1, unitPrice: 500000, total: 500000 },
  { id: "ii_5", invoiceId: "inv_5", description: "Fourniture Materiel", quantity: 1, unitPrice: 1000000, total: 1000000 }
];

const payments = [
  { id: "pay_1", invoiceId: "inv_1", amount: 177000, paymentMethod: "virement", date: addDays(-18), reference: "VIR-123", created_by: "usr_1" },
  { id: "pay_2", invoiceId: "inv_2", amount: 297500, paymentMethod: "cash", date: addDays(-23), reference: "RECU-456", created_by: "usr_1" }
];

try {
  db.transaction(() => {
    const insertClient = db.prepare("INSERT INTO clients (id, name, email, phone, address, created_by) VALUES (?, ?, ?, ?, ?, ?)");
    for (const c of clients) insertClient.run(c.id, c.name, c.email, c.phone, c.address, c.created_by);

    const insertService = db.prepare("INSERT INTO services (id, name, description, category, unitPrice, created_by) VALUES (?, ?, ?, ?, ?, ?)");
    for (const s of services) insertService.run(s.id, s.name, s.description, s.category, s.unitPrice, s.created_by);

    const insertQuote = db.prepare("INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, subject, status, validUntil, subtotal, taxBase, tvaAmount, cssAmount, total, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    for (const q of quotes) insertQuote.run(q.id, q.number, q.clientId, q.clientName, q.clientEmail, q.date, q.subject, q.status, q.validUntil, q.subtotal, q.subtotal, q.tvaAmount, q.cssAmount, q.total, q.created_by);

    const insertQuoteItem = db.prepare("INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total) VALUES (?, ?, ?, ?, ?, ?)");
    for (const qi of quote_items) insertQuoteItem.run(qi.id, qi.quoteId, qi.description, qi.quantity, qi.unitPrice, qi.total);

    const insertInvoice = db.prepare("INSERT INTO invoices (id, number, quoteId, clientId, clientName, clientEmail, date, dueDate, subject, status, subtotal, taxBase, tvaAmount, cssAmount, total, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    for (const i of invoices) insertInvoice.run(i.id, i.number, i.quoteId, i.clientId, i.clientName, i.clientEmail, i.date, i.dueDate, i.subject, i.status, i.subtotal, i.taxBase, i.tvaAmount, i.cssAmount, i.total, i.created_by);

    const insertInvoiceItem = db.prepare("INSERT INTO invoice_items (id, invoiceId, description, quantity, unitPrice, total) VALUES (?, ?, ?, ?, ?, ?)");
    for (const ii of invoice_items) insertInvoiceItem.run(ii.id, ii.invoiceId, ii.description, ii.quantity, ii.unitPrice, ii.total);

    const insertPayment = db.prepare("INSERT INTO payments (id, invoiceId, amount, paymentMethod, date, reference, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)");
    for (const p of payments) insertPayment.run(p.id, p.invoiceId, p.amount, p.paymentMethod, p.date, p.reference, p.created_by);
  })();
  
  console.log("[seed] Seeding completed successfully.");
} catch (error) {
  console.error("[seed] Error during seeding:", error);
  process.exit(1);
}
