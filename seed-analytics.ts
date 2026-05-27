
import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

console.log('🌱 Démarrage d\'une simulation globale de l\'application L\'Étoile...');

function randomUUID() {
    return crypto.randomUUID();
}

const SALT = 'letoile-gabon-2026';
function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

// 1. Nettoyage complet
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

// 2. Initialisation des séquences
db.prepare("INSERT INTO sequences (name, current_value, last_year) VALUES ('quote', 0, 2026)").run();
db.prepare("INSERT INTO sequences (name, current_value, last_year) VALUES ('invoice', 0, 2026)").run();

// 3. Création des utilisateurs
const adminId = randomUUID();
const userId = randomUUID();

db.prepare('INSERT INTO users (id, username, password, role, name) VALUES (?, ?, ?, ?, ?)').run(
    adminId, 'admin@letoile.ga', hashPassword('admin123'), 'admin', 'Administrateur Système'
);
db.prepare('INSERT INTO users (id, username, password, role, name) VALUES (?, ?, ?, ?, ?)').run(
    userId, 'user@letoile.ga', hashPassword('admin123'), 'user', 'Opérateur'
);

// 4. Catalogue de Services réalistes pour une PME de maintenance/services au Gabon
const serviceCatalog = [
    { name: 'Maintenance Climatisation Split', category: 'Maintenance', price: 45000 },
    { name: 'Installation Électrique Tertiaire', category: 'Installation', price: 150000 },
    { name: 'Audit Efficacité Énergétique', category: 'Conseil', price: 500000 },
    { name: 'Contrat de Maintenance Mensuel (PME)', category: 'Contrat', price: 250000 },
    { name: 'Dépannage Groupe Électrogène', category: 'Maintenance', price: 120000 },
    { name: 'Fourniture de Consommables Informatiques', category: 'Vente', price: 35000 },
    { name: 'Câblage Réseau RJ45 (par point)', category: 'Installation', price: 25000 }
];

const insertService = db.prepare('INSERT INTO services (id, name, category, unitPrice) VALUES (?, ?, ?, ?)');
serviceCatalog.forEach(s => insertService.run(randomUUID(), s.name, s.category, s.price));

// 5. Référentiel Clients
const clients = [
    { id: randomUUID(), name: 'CGA Gabon', email: 'contact@cga-gabon.com', address: 'Zone Industrielle Oloumi, Libreville' },
    { id: randomUUID(), name: 'TotalEnergies Marketing Gabon', email: 'billing@totalenergies.ga', address: 'Boulevard de l\'Indépendance' },
    { id: randomUUID(), name: 'Setrag', email: 'finance@setrag.ga', address: 'Gare d\'Owendo' },
    { id: randomUUID(), name: 'Canal+ Gabon', email: 'admin@canalplus-gabon.com', address: 'Centre-ville, Libreville' },
    { id: randomUUID(), name: 'Comilog', email: 'logistique@eramet-comilog.com', address: 'Moanda, Haut-Ogooué' },
    { id: randomUUID(), name: 'Gabon Télécom', email: 'billing@gabontelecom.ga', address: 'Libreville, Gabon' },
    { id: randomUUID(), name: 'SOGARA', email: 'compta@sogara-gabon.com', address: 'Port-Gentil' }
];

const insertClient = db.prepare('INSERT INTO clients (id, name, email, address, status) VALUES (?, ?, ?, ?, ?)');
clients.forEach(c => insertClient.run(c.id, c.name, c.email, c.address, 'active'));

// 6. Simulation d'activité (2025 - 2026)
const years = [2025, 2026];
const months = Array.from({ length: 12 }, (_, i) => i + 1);

let quoteTotalSeq = 0;
let invTotalSeq = 0;

years.forEach(year => {
    let yearlyQuoteSeq = 1;
    let yearlyInvSeq = 1;

    months.forEach(month => {
        if (year === 2026 && month > 5) return; // Jusqu'à Mai 2026

        const docsPerMonth = Math.floor(Math.random() * 4) + 3; // 3-7 documents par mois

        for (let i = 0; i < docsPerMonth; i++) {
            const client = clients[Math.floor(Math.random() * clients.length)];
            const day = Math.floor(Math.random() * 28) + 1;
            const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

            // --- DEVIS ---
            const quoteId = randomUUID();
            const quoteNum = `${yearlyQuoteSeq.toString().padStart(3, '0')}/GM/${year}`;
            yearlyQuoteSeq++;
            quoteTotalSeq++;

            // Sélectionner 1-3 services au hasard
            const numItems = Math.floor(Math.random() * 3) + 1;
            const selectedServices = [];
            let subtotal = 0;
            for(let j=0; j<numItems; j++) {
                const s = serviceCatalog[Math.floor(Math.random() * serviceCatalog.length)];
                const qty = Math.floor(Math.random() * 5) + 1;
                const totalItem = s.price * qty;
                selectedServices.push({ ...s, qty, totalItem });
                subtotal += totalItem;
            }

            const css = Math.round(subtotal * 0.01);
            const baseTva = subtotal + css;
            const tva = Math.round(baseTva * 0.18);
            const total = subtotal + css + tva;

            const isFuture = year === 2026 && month === 5 && day > 20;
            const status = isFuture ? 'draft' : (Math.random() > 0.2 ? 'invoiced' : (Math.random() > 0.5 ? 'sent' : 'rejected'));

            db.prepare(`
                INSERT INTO quotes (id, number, clientId, clientName, date, subtotal, cssAmount, tvaAmount, total, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(quoteId, quoteNum, client.id, client.name, dateStr, subtotal, css, tva, total, status);

            selectedServices.forEach(item => {
                db.prepare(`INSERT INTO quote_items (id, quoteId, description, quantity, unitPrice, total) VALUES (?, ?, ?, ?, ?, ?)`).run(
                    randomUUID(), quoteId, item.name, item.qty, item.price, item.totalItem
                );
            });

            // Log d'audit pour le devis
            db.prepare(`INSERT INTO audit_logs (id, userId, userName, action, entityType, entityId, details, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
                randomUUID(), userId, 'Opérateur', 'Création Devis', 'quote', quoteId, `Numéro: ${quoteNum}`, dateStr + ' 09:00:00'
            );

            // --- FACTURE (si invoqué) ---
            if (status === 'invoiced') {
                const invId = randomUUID();
                const invNum = `${yearlyInvSeq.toString().padStart(3, '0')}/GM/${year}`;
                yearlyInvSeq++;
                invTotalSeq++;

                const invStatus = (year === 2025 || (month < 4)) ? 'paid' : (Math.random() > 0.4 ? 'pending' : 'paid');

                db.prepare(`
                    INSERT INTO invoices (id, number, quoteId, clientId, clientName, date, dueDate, subtotal, cssAmount, tvaAmount, total, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(invId, invNum, quoteId, client.id, client.name, dateStr, dateStr, subtotal, css, tva, total, invStatus);

                selectedServices.forEach(item => {
                    db.prepare(`INSERT INTO invoice_items (id, invoiceId, description, quantity, unitPrice, total) VALUES (?, ?, ?, ?, ?, ?)`).run(
                        randomUUID(), invId, item.name, item.qty, item.price, item.totalItem
                    );
                });

                // Paiements
                if (invStatus === 'paid') {
                    db.prepare(`INSERT INTO payments (id, invoiceId, amount, paymentMethod, date) VALUES (?, ?, ?, ?, ?)`).run(
                        randomUUID(), invId, total, (Math.random() > 0.3 ? 'virement' : 'cash'), dateStr
                    );
                } else if (invStatus === 'pending' && Math.random() > 0.5) {
                    // Partiellement payé
                    const acompte = Math.round(total * 0.4);
                    db.prepare(`INSERT INTO payments (id, invoiceId, amount, paymentMethod, date) VALUES (?, ?, ?, ?, ?)`).run(
                        randomUUID(), invId, acompte, 'virement', dateStr
                    );
                }

                // Avoirs (Credit Notes) : simuler 2-3 annulations sur toute la période
                if (invStatus === 'paid' && Math.random() < 0.05) {
                    const cnId = randomUUID();
                    const cnNum = `AV-${invNum}`;
                    db.prepare(`
                        INSERT INTO credit_notes (id, number, invoiceId, clientId, clientName, date, reason, subtotal, cssAmount, tvaAmount, total, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(cnId, cnNum, invId, client.id, client.name, dateStr, 'Erreur de facturation / Retour client', subtotal, css, tva, total, 'closed');

                    db.prepare(`UPDATE invoices SET status = 'cancelled' WHERE id = ?`).run(invId);
                }

                db.prepare(`INSERT INTO audit_logs (id, userId, userName, action, entityType, entityId, details, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
                    randomUUID(), userId, 'Opérateur', 'Conversion Devis -> Facture', 'invoice', invId, `Source: ${quoteNum}, Facture: ${invNum}`, dateStr + ' 11:30:00'
                );
            }
        }
    });
});

console.log(`✅ Simulation globale terminée !`);
console.log(`- ${quoteTotalSeq} Devis injectés (Brouillons, Envoyés, Facturés, Refusés)`);
console.log(`- ${invTotalSeq} Factures injectées (Payées, En attente, Annulées)`);
console.log(`- ${clients.length} Clients dans le CRM`);
console.log(`- ${serviceCatalog.length} Services dans le catalogue`);
console.log(`- Journaux d'audit et paiements générés.`);
