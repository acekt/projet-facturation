import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

const db = new Database('database.sqlite');

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Helper function to generate IDs
const generateId = () => uuidv4();

// Helper function to format date
const formatDate = (date: Date) => date.toISOString().split('T')[0];

// Clear existing data (optional - comment out if you want to keep existing data)
console.log('Clearing existing data...');
db.prepare('DELETE FROM payments').run();
db.prepare('DELETE FROM invoice_items').run();
db.prepare('DELETE FROM invoices').run();
db.prepare('DELETE FROM quote_items').run();
db.prepare('DELETE FROM quotes').run();
db.prepare('DELETE FROM services').run();
db.prepare('DELETE FROM clients').run();
db.prepare('DELETE FROM sequences').run();

// Reset sequences
db.prepare("INSERT INTO sequences (name, current_value) VALUES ('quote', 0)").run();
db.prepare("INSERT INTO sequences (name, current_value) VALUES ('invoice', 0)").run();

console.log('Inserting clients...');
const clients = [
  {
    id: generateId(),
    name: 'Société Gabonaise de Télécommunications (GABON TELECOM)',
    email: 'contact@gabontelecom.ga',
    phone: '+241 01 44 00 00',
    address: 'Bd de la Mer, Libreville, Gabon',
    status: 'active'
  },
  {
    id: generateId(),
    name: 'Ministère de l\'Économie et des Finances',
    email: 'contact@economie.gouv.ga',
    phone: '+241 01 76 54 32',
    address: 'Bd de la République, Libreville, Gabon',
    status: 'active'
  },
  {
    id: generateId(),
    name: 'Port Autonome de Libreville',
    email: 'info@pal.ga',
    phone: '+241 01 73 20 00',
    address: 'Zone Portuaire, Libreville, Gabon',
    status: 'active'
  },
  {
    id: generateId(),
    name: 'Total Gabon',
    email: 'gabon@total.com',
    phone: '+241 01 73 40 00',
    address: 'Immeuble Total, Libreville, Gabon',
    status: 'active'
  },
  {
    id: generateId(),
    name: 'Shell Gabon',
    email: 'shell.gabon@shell.com',
    phone: '+241 01 73 30 00',
    address: 'Bd de l\'Indépendance, Libreville, Gabon',
    status: 'active'
  }
];

const insertClient = db.prepare(`
  INSERT INTO clients (id, name, email, phone, address, status)
  VALUES (@id, @name, @email, @phone, @address, @status)
`);

clients.forEach(client => insertClient.run(client));
console.log(`✓ Inserted ${clients.length} clients`);

console.log('Inserting services...');
const services = [
  {
    id: generateId(),
    name: 'Développement Web Application',
    description: 'Création d\'application web sur mesure',
    category: 'Développement',
    unitPrice: 500000
  },
  {
    id: generateId(),
    name: 'Maintenance Serveur',
    description: 'Maintenance mensuelle des serveurs',
    category: 'Maintenance',
    unitPrice: 150000
  },
  {
    id: generateId(),
    name: 'Consulting IT',
    description: 'Conseil en technologies de l\'information',
    category: 'Consulting',
    unitPrice: 300000
  },
  {
    id: generateId(),
    name: 'Formation Équipe',
    description: 'Formation technique pour les équipes',
    category: 'Formation',
    unitPrice: 200000
  },
  {
    id: generateId(),
    name: 'Audit Sécurité',
    description: 'Audit de sécurité informatique',
    category: 'Sécurité',
    unitPrice: 400000
  },
  {
    id: generateId(),
    name: 'Intégration API',
    description: 'Intégration d\'API tierces',
    category: 'Développement',
    unitPrice: 250000
  }
];

const insertService = db.prepare(`
  INSERT INTO services (id, name, description, category, unitPrice)
  VALUES (@id, @name, @description, @category, @unitPrice)
`);

services.forEach(service => insertService.run(service));
console.log(`✓ Inserted ${services.length} services`);

console.log('Inserting quotes...');
const quotes: any[] = [];
const quoteItems: any[] = [];

// Quote 1 - GABON TELECOM
const quote1Id = generateId();
quotes.push({
  id: quote1Id,
  number: 'DEV-001',
  clientId: clients[0].id,
  clientName: clients[0].name,
  clientEmail: clients[0].email,
  date: formatDate(new Date('2024-01-15')),
  dueDate: formatDate(new Date('2024-02-15')),
  subtotal: 0,
  discount: 0,
  taxBase: 0,
  tvaAmount: 0,
  cssAmount: 0,
  total: 0,
  status: 'invoiced',
  notes: 'Projet de refonte du site web'
});

quoteItems.push(
  { id: generateId(), quoteId: quote1Id, description: 'Développement Web Application', quantity: 1, unitPrice: 500000, total: 500000 },
  { id: generateId(), quoteId: quote1Id, description: 'Maintenance Serveur (6 mois)', quantity: 6, unitPrice: 150000, total: 900000 }
);

// Quote 2 - Ministère Économie
const quote2Id = generateId();
quotes.push({
  id: quote2Id,
  number: 'DEV-002',
  clientId: clients[1].id,
  clientName: clients[1].name,
  clientEmail: clients[1].email,
  date: formatDate(new Date('2024-02-01')),
  dueDate: formatDate(new Date('2024-03-01')),
  subtotal: 0,
  discount: 0,
  taxBase: 0,
  tvaAmount: 0,
  cssAmount: 0,
  total: 0,
  status: 'sent',
  notes: 'Audit de sécurité du système'
});

quoteItems.push(
  { id: generateId(), quoteId: quote2Id, description: 'Audit Sécurité', quantity: 1, unitPrice: 400000, total: 400000 },
  { id: generateId(), quoteId: quote2Id, description: 'Consulting IT', quantity: 2, unitPrice: 300000, total: 600000 }
);

// Quote 3 - Port Autonome
const quote3Id = generateId();
quotes.push({
  id: quote3Id,
  number: 'DEV-003',
  clientId: clients[2].id,
  clientName: clients[2].name,
  clientEmail: clients[2].email,
  date: formatDate(new Date('2024-03-10')),
  dueDate: formatDate(new Date('2024-04-10')),
  subtotal: 0,
  discount: 0,
  taxBase: 0,
  tvaAmount: 0,
  cssAmount: 0,
  total: 0,
  status: 'draft',
  notes: 'Système de gestion portuaire'
});

quoteItems.push(
  { id: generateId(), quoteId: quote3Id, description: 'Développement Web Application', quantity: 1, unitPrice: 500000, total: 500000 },
  { id: generateId(), quoteId: quote3Id, description: 'Intégration API', quantity: 1, unitPrice: 250000, total: 250000 }
);

// Calculate totals for quotes
quotes.forEach(quote => {
  const items = quoteItems.filter(item => item.quoteId === quote.id);
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const taxBase = subtotal;
  const tvaAmount = taxBase * 0.18; // 18% TVA
  const cssAmount = taxBase * 0.01; // 1% CSS
  const total = subtotal + tvaAmount + cssAmount;
  
  quote.subtotal = subtotal;
  quote.taxBase = taxBase;
  quote.tvaAmount = tvaAmount;
  quote.cssAmount = cssAmount;
  quote.total = total;
});

const insertQuote = db.prepare(`
  INSERT INTO quotes (id, number, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, cssAmount, total, status, notes)
  VALUES (@id, @number, @clientId, @clientName, @clientEmail, @date, @dueDate, @subtotal, @discount, @taxBase, @tvaAmount, @cssAmount, @total, @status, @notes)
`);

quotes.forEach(quote => insertQuote.run(quote));
console.log(`✓ Inserted ${quotes.length} quotes`);

const insertQuoteItem = db.prepare(`
  INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total)
  VALUES (@id, @quoteId, @description, @quantity, @unitPrice, @total)
`);

quoteItems.forEach(item => insertQuoteItem.run(item));
console.log(`✓ Inserted ${quoteItems.length} quote items`);

console.log('Inserting invoices...');
const invoices: any[] = [];
const invoiceItems: any[] = [];

// Invoice 1 - From Quote 1
const invoice1Id = generateId();
invoices.push({
  id: invoice1Id,
  number: 'FAC-001',
  quoteId: quote1Id,
  clientId: clients[0].id,
  clientName: clients[0].name,
  clientEmail: clients[0].email,
  date: formatDate(new Date('2024-02-01')),
  dueDate: formatDate(new Date('2024-03-01')),
  subtotal: 0,
  discount: 0,
  taxBase: 0,
  tvaAmount: 0,
  cssAmount: 0,
  total: 0,
  status: 'PAID',
  notes: 'Facture correspondant au devis DEV-001'
});

const quote1Items = quoteItems.filter(item => item.quoteId === quote1Id);
quote1Items.forEach(item => {
  invoiceItems.push({
    id: generateId(),
    invoiceId: invoice1Id,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.total
  });
});

// Invoice 2 - Direct invoice
const invoice2Id = generateId();
invoices.push({
  id: invoice2Id,
  number: 'FAC-002',
  quoteId: null,
  clientId: clients[3].id,
  clientName: clients[3].name,
  clientEmail: clients[3].email,
  date: formatDate(new Date('2024-03-01')),
  dueDate: formatDate(new Date('2024-04-01')),
  subtotal: 0,
  discount: 0,
  taxBase: 0,
  tvaAmount: 0,
  cssAmount: 0,
  total: 0,
  status: 'pending',
  notes: 'Services de consulting'
});

invoiceItems.push(
  { id: generateId(), invoiceId: invoice2Id, description: 'Consulting IT', quantity: 3, unitPrice: 300000, total: 900000 },
  { id: generateId(), invoiceId: invoice2Id, description: 'Formation Équipe', quantity: 1, unitPrice: 200000, total: 200000 }
);

// Invoice 3 - Partial payment
const invoice3Id = generateId();
invoices.push({
  id: invoice3Id,
  number: 'FAC-003',
  quoteId: null,
  clientId: clients[4].id,
  clientName: clients[4].name,
  clientEmail: clients[4].email,
  date: formatDate(new Date('2024-04-01')),
  dueDate: formatDate(new Date('2024-05-01')),
  subtotal: 0,
  discount: 0,
  taxBase: 0,
  tvaAmount: 0,
  cssAmount: 0,
  total: 0,
  status: 'PARTIALLY_PAID',
  notes: 'Développement application mobile'
});

invoiceItems.push(
  { id: generateId(), invoiceId: invoice3Id, description: 'Développement Web Application', quantity: 1, unitPrice: 500000, total: 500000 }
);

// Calculate totals for invoices
invoices.forEach(invoice => {
  const items = invoiceItems.filter(item => item.invoiceId === invoice.id);
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const taxBase = subtotal;
  const tvaAmount = taxBase * 0.18; // 18% TVA
  const cssAmount = taxBase * 0.01; // 1% CSS
  const total = subtotal + tvaAmount + cssAmount;
  
  invoice.subtotal = subtotal;
  invoice.taxBase = taxBase;
  invoice.tvaAmount = tvaAmount;
  invoice.cssAmount = cssAmount;
  invoice.total = total;
});

const insertInvoice = db.prepare(`
  INSERT INTO invoices (id, number, quoteId, clientId, clientName, clientEmail, date, dueDate, subtotal, discount, taxBase, tvaAmount, cssAmount, total, status, notes)
  VALUES (@id, @number, @quoteId, @clientId, @clientName, @clientEmail, @date, @dueDate, @subtotal, @discount, @taxBase, @tvaAmount, @cssAmount, @total, @status, @notes)
`);

invoices.forEach(invoice => insertInvoice.run(invoice));
console.log(`✓ Inserted ${invoices.length} invoices`);

const insertInvoiceItem = db.prepare(`
  INSERT INTO invoice_items (id, invoiceId, description, quantity, unitPrice, total)
  VALUES (@id, @invoiceId, @description, @quantity, @unitPrice, @total)
`);

invoiceItems.forEach(item => insertInvoiceItem.run(item));
console.log(`✓ Inserted ${invoiceItems.length} invoice items`);

console.log('Inserting payments...');
const payments = [
  {
    id: generateId(),
    invoiceId: invoice1Id,
    amount: 1767000, // Full payment for invoice 1
    paymentMethod: 'virement',
    date: formatDate(new Date('2024-02-15')),
    reference: 'VIR-2024-001'
  },
  {
    id: generateId(),
    invoiceId: invoice3Id,
    amount: 300000, // Partial payment for invoice 3
    paymentMethod: 'airtel',
    date: formatDate(new Date('2024-04-15')),
    reference: 'AIRTEL-2024-001'
  }
];

const insertPayment = db.prepare(`
  INSERT INTO payments (id, invoiceId, amount, paymentMethod, date, reference)
  VALUES (@id, @invoiceId, @amount, @paymentMethod, @date, @reference)
`);

payments.forEach(payment => insertPayment.run(payment));
console.log(`✓ Inserted ${payments.length} payments`);

console.log('\n✅ Database seeding completed successfully!');
console.log('\nSummary:');
console.log(`- ${clients.length} clients`);
console.log(`- ${services.length} services`);
console.log(`- ${quotes.length} quotes`);
console.log(`- ${quoteItems.length} quote items`);
console.log(`- ${invoices.length} invoices`);
console.log(`- ${invoiceItems.length} invoice items`);
console.log(`- ${payments.length} payments`);

db.close();
