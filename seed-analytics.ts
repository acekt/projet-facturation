import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

console.log('🌱 Démarrage d\'une simulation globale v4.0 (L\'Étoile) - Scenario 2025-2026...');

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

db.prepare("INSERT INTO sequences (name, current_value, last_year) VALUES ('quote', 45, 2026)").run();
db.prepare("INSERT INTO sequences (name, current_value, last_year) VALUES ('invoice', 32, 2026)").run();

const adminId = randomUUID();
const userId = randomUUID();

// Users
db.prepare(`
    INSERT INTO users (id, username, email, password, role, name, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
`).run(adminId, 'admin@letoile.ga', 'admin@letoile.ga', hashPassword('admin123'), 'admin', 'Administrateur Système');

db.prepare(`
    INSERT INTO users (id, username, email, password, role, name, is_active, created_by)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
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
    { id: randomUUID(), name: 'COMILOG', email: 'compta@comilog.ga', address: 'Moanda' },
];

const insertClient = db.prepare('INSERT INTO clients (id, name, email, address, status) VALUES (?, ?, ?, ?, ?)');
clients.forEach(c => insertClient.run(c.id, c.name, c.email, c.address, 'active'));

const years = [2025, 2026];
years.forEach(year => {
    let yearlyQuoteSeq = 1;
    let yearlyInvSeq = 1;

    // Simulate each month
    for (let month = 1; month <= 12; month++) {
        if (year === 2026 && month > 6) break; // Simulation up to June 2026

        const businessActivity = month % 3 === 0 ? 5 : 3; // Peaks every quarter

        for (let i = 0; i < businessActivity; i++) {
            const client = clients[Math.floor(Math.random() * clients.length)];
            const day = Math.floor(Math.random() * 25) + 1;
            const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

            const subtotal = Math.floor(Math.random() * 500000) + 100000;
            const css = Math.round(subtotal * 0.01);
            const baseTVA = subtotal + css;
            const tva = Math.round(baseTVA * 0.18);
            const total = subtotal + css + tva;

            // QUOTE
            const quoteId = randomUUID();
            const quoteNum = `${yearlyQuoteSeq.toString().padStart(3, '0')}/GM/${year}`;
            yearlyQuoteSeq++;

            // Quote Scenarios: 70% Invoiced, 20% Draft/Sent, 10% Rejected
            let quoteStatus = 'sent';
            const rand = Math.random();
            if (rand < 0.7) quoteStatus = 'invoiced';
            else if (rand < 0.9) quoteStatus = 'sent';
            else quoteStatus = 'rejected';

            db.prepare(`
                INSERT INTO quotes (id, number, clientId, clientName, date, subtotal, cssAmount, tvaAmount, total, status, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(quoteId, quoteNum, client.id, client.name, dateStr, subtotal, css, tva, total, quoteStatus, userId);

            // INVOICE (if quote was accepted/invoiced)
            if (quoteStatus === 'invoiced') {
                const invId = randomUUID();
                const invNum = `${yearlyInvSeq.toString().padStart(3, '0')}/GM/${year}`;
                yearlyInvSeq++;

                // Invoice Scenarios: 80% Paid, 15% Unpaid/Pending, 5% Overdue
                let invStatus = 'PAID';
                const randInv = Math.random();
                if (randInv < 0.8) invStatus = 'PAID';
                else if (randInv < 0.95) invStatus = 'UNPAID';
                else invStatus = 'overdue';

                const dueDate = new Date(new Date(dateStr).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

                db.prepare(`
                    INSERT INTO invoices (id, number, quoteId, clientId, clientName, date, dueDate, subtotal, cssAmount, tvaAmount, total, status, created_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(invId, invNum, quoteId, client.id, client.name, dateStr, dueDate, subtotal, css, tva, total, invStatus, userId);

                // PAYMENTS
                if (invStatus === 'PAID') {
                    db.prepare(`INSERT INTO payments (id, invoiceId, amount, paymentMethod, date) VALUES (?, ?, ?, ?, ?)`).run(
                        randomUUID(), invId, total, ['virement', 'airtel', 'moov', 'cash'][Math.floor(Math.random() * 4)], dateStr
                    );
                } else if (Math.random() > 0.5) {
                    // Partially paid
                    const acompte = Math.round(total / 3);
                    db.prepare(`INSERT INTO payments (id, invoiceId, amount, paymentMethod, date) VALUES (?, ?, ?, ?, ?)`).run(
                        randomUUID(), invId, acompte, 'cash', dateStr
                    );
                    db.prepare("UPDATE invoices SET status = 'PARTIALLY_PAID' WHERE id = ?").run(invId);
                }
            }
        }
    }
});

// Audit Logs
db.prepare(`INSERT INTO audit_logs (id, userId, userName, action, entityType, entityId, details) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    randomUUID(), adminId, 'Administrateur', 'LOGIN', 'user', adminId, 'Connexion réussie'
);
db.prepare(`INSERT INTO audit_logs (id, userId, userName, action, entityType, entityId, details) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    randomUUID(), userId, 'Opérateur', 'CREATE', 'quote', '001/GM/2026', 'Nouveau devis généré'
);

console.log(`✅ Simulation massive 2025-2026 terminée.`);
