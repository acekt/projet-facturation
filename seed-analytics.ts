import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

console.log('🌱 Démarrage d\'une simulation globale v4.0 (L\'Étoile)...');

function randomUUID() {
    return crypto.randomUUID();
}

const SALT = 'letoile-gabon-2026';
function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

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

db.prepare("INSERT INTO sequences (name, current_value, last_year) VALUES ('quote', 0, 2026)").run();
db.prepare("INSERT INTO sequences (name, current_value, last_year) VALUES ('invoice', 0, 2026)").run();

const adminId = randomUUID();
const userId = randomUUID();

// New schema users
db.prepare(`
    INSERT INTO users (id, username, email, password, role, name, is_active, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
`).run(adminId, 'admin@letoile.ga', 'admin@letoile.ga', hashPassword('admin123'), 'admin', 'Administrateur Système');

db.prepare(`
    INSERT INTO users (id, username, email, password, role, name, is_active, createdAt, created_by)
    VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, ?)
`).run(userId, 'user@letoile.ga', 'user@letoile.ga', hashPassword('admin123'), 'user', 'Opérateur Service Client', adminId);

const serviceCatalog = [
    { name: 'Maintenance Climatisation Split', category: 'Maintenance', price: 45000 },
    { name: 'Installation Électrique Tertiaire', category: 'Installation', price: 150000 },
    { name: 'Audit Efficacité Énergétique', category: 'Conseil', price: 500000 },
];

const insertService = db.prepare('INSERT INTO services (id, name, category, unitPrice) VALUES (?, ?, ?, ?)');
serviceCatalog.forEach(s => insertService.run(randomUUID(), s.name, s.category, s.price));

const clients = [
    { id: randomUUID(), name: 'CGA Gabon', email: 'contact@cga-gabon.com', address: 'Zone Industrielle Oloumi, Libreville' },
    { id: randomUUID(), name: 'TotalEnergies Marketing Gabon', email: 'billing@totalenergies.ga', address: 'Boulevard de l\'Indépendance' },
    { id: randomUUID(), name: 'Setrag', email: 'finance@setrag.ga', address: 'Gare d\'Owendo' },
];

const insertClient = db.prepare('INSERT INTO clients (id, name, email, address, status) VALUES (?, ?, ?, ?, ?)');
clients.forEach(c => insertClient.run(c.id, c.name, c.email, c.address, 'active'));

years: [2025, 2026].forEach(year => {
    let yearlyQuoteSeq = 1;
    let yearlyInvSeq = 1;
    [1, 2, 3, 4, 5].forEach(month => {
        if (year === 2026 && month > 5) return;
        const count = 3;
        for (let i = 0; i < count; i++) {
            const client = clients[Math.floor(Math.random() * clients.length)];
            const dateStr = `${year}-${month.toString().padStart(2, '0')}-10`;
            const quoteId = randomUUID();
            const quoteNum = `${yearlyQuoteSeq.toString().padStart(3, '0')}/GM/${year}`;
            yearlyQuoteSeq++;

            db.prepare(`
                INSERT INTO quotes (id, number, clientId, clientName, date, subtotal, cssAmount, tvaAmount, total, status, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(quoteId, quoteNum, client.id, client.name, dateStr, 100000, 1000, 18180, 119180, 'invoiced', userId);

            const invId = randomUUID();
            const invNum = `${yearlyInvSeq.toString().padStart(3, '0')}/GM/${year}`;
            yearlyInvSeq++;
            db.prepare(`
                INSERT INTO invoices (id, number, quoteId, clientId, clientName, date, dueDate, subtotal, cssAmount, tvaAmount, total, status, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(invId, invNum, quoteId, client.id, client.name, dateStr, dateStr, 100000, 1000, 18180, 119180, 'PAID', userId);

            db.prepare(`INSERT INTO payments (id, invoiceId, amount, paymentMethod, date) VALUES (?, ?, ?, ?, ?)`).run(
                randomUUID(), invId, 119180, 'virement', dateStr
            );
        }
    });
});

console.log(`✅ Simulation v4.0 terminée avec succès.`);
