
import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

console.log('🌱 Démarrage de l\'injection des données analytiques...');

function randomUUID() {
    return crypto.randomUUID();
}

const SALT = 'letoile-gabon-2026';
function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

// 1. Nettoyage (Optionnel, décocher si on veut garder l'existant)
// db.exec('DELETE FROM payments; DELETE FROM invoice_items; DELETE FROM invoices; DELETE FROM quote_items; DELETE FROM quotes; DELETE FROM clients; DELETE FROM users;');

// 2. Création des utilisateurs si absents
const adminId = randomUUID();
const userId = randomUUID();

const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
    db.prepare('INSERT INTO users (id, username, password, role, name) VALUES (?, ?, ?, ?, ?)').run(
        adminId, 'admin@letoile.ga', hashPassword('admin123'), 'admin', 'Administrateur Système'
    );
    db.prepare('INSERT INTO users (id, username, password, role, name) VALUES (?, ?, ?, ?, ?)').run(
        userId, 'user@letoile.ga', hashPassword('admin123'), 'user', 'Opérateur'
    );
}

// 3. Création des clients
const clients = [
    { id: randomUUID(), name: 'CGA Gabon', email: 'contact@cga-gabon.com', address: 'Zone Industrielle Oloumi, Libreville' },
    { id: randomUUID(), name: 'TotalEnergies Marketing Gabon', email: 'billing@totalenergies.ga', address: 'Boulevard de l\'Indépendance' },
    { id: randomUUID(), name: 'Setrag', email: 'finance@setrag.ga', address: 'Gare d\'Owendo' },
    { id: randomUUID(), name: 'Canal+ Gabon', email: 'admin@canalplus-gabon.com', address: 'Centre-ville, Libreville' },
    { id: randomUUID(), name: 'Comilog', email: 'logistique@eramet-comilog.com', address: 'Moanda, Haut-Ogooué' }
];

const insertClient = db.prepare('INSERT OR IGNORE INTO clients (id, name, email, address, status) VALUES (?, ?, ?, ?, ?)');
clients.forEach(c => insertClient.run(c.id, c.name, c.email, c.address, 'active'));

// 4. Génération de Devis et Factures sur 2025 et 2026
const years = [2025, 2026];
const months = Array.from({ length: 12 }, (_, i) => i + 1);

let quoteSeq = 1;
let invSeq = 1;

years.forEach(year => {
    months.forEach(month => {
        // Ignorer les mois futurs si on est en 2026
        if (year === 2026 && month > 5) return;

        // Créer 2-4 documents par mois
        const count = Math.floor(Math.random() * 3) + 2;

        for (let i = 0; i < count; i++) {
            const client = clients[Math.floor(Math.random() * clients.length)];
            const day = Math.floor(Math.random() * 28) + 1;
            const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

            const quoteId = randomUUID();
            const quoteNum = `${quoteSeq.toString().padStart(3, '0')}/GM/${year}`;
            quoteSeq++;

            const subtotal = Math.floor(Math.random() * 1500000) + 100000;
            const css = Math.round(subtotal * 0.01);
            const baseTva = subtotal + css;
            const tva = Math.round(baseTva * 0.18);
            const total = subtotal + css + tva;

            // Statuts variés
            const is2025 = year === 2025;
            const status = is2025 ? 'invoiced' : (Math.random() > 0.3 ? 'invoiced' : 'sent');

            db.prepare(`
                INSERT INTO quotes (id, number, clientId, clientName, date, subtotal, cssAmount, tvaAmount, total, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(quoteId, quoteNum, client.id, client.name, dateStr, subtotal, css, tva, total, status);

            // Créer items pour le devis
            db.prepare(`INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total) VALUES (?, ?, ?, ?, ?, ?)`).run(
                randomUUID(), quoteId, 'Maintenance Systèmes Climatisation', 1, subtotal, subtotal
            );

            if (status === 'invoiced') {
                const invId = randomUUID();
                const invNum = `${invSeq.toString().padStart(3, '0')}/GM/${year}`;
                invSeq++;

                // Statut de paiement (plus de payées en 2025)
                const invStatus = is2025 ? 'paid' : (Math.random() > 0.5 ? 'paid' : 'pending');

                db.prepare(`
                    INSERT INTO invoices (id, number, quoteId, clientId, clientName, date, dueDate, subtotal, cssAmount, tvaAmount, total, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(invId, invNum, quoteId, client.id, client.name, dateStr, dateStr, subtotal, css, tva, total, invStatus);

                db.prepare(`INSERT INTO invoice_items (id, invoiceId, description, quantity, unitPrice, total) VALUES (?, ?, ?, ?, ?, ?)`).run(
                    randomUUID(), invId, 'Maintenance Systèmes Climatisation', 1, subtotal, subtotal
                );

                if (invStatus === 'paid') {
                    db.prepare(`INSERT INTO payments (id, invoiceId, amount, paymentMethod, date) VALUES (?, ?, ?, ?, ?)`).run(
                        randomUUID(), invId, total, 'virement', dateStr
                    );
                } else if (!is2025 && Math.random() > 0.5) {
                    // Acompte pour certaines factures pending de 2026
                    const acompte = Math.round(total * 0.3);
                    db.prepare(`INSERT INTO payments (id, invoiceId, amount, paymentMethod, date) VALUES (?, ?, ?, ?, ?)`).run(
                        randomUUID(), invId, acompte, 'cash', dateStr
                    );
                }
            }
        }
    });
});

console.log(`✅ Injection terminée avec succès.`);
console.log(`- ${quoteSeq - 1} Devis générés`);
console.log(`- ${invSeq - 1} Factures générées`);
console.log(`- Données couvrant Janvier 2025 à Mai 2026`);
