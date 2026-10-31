import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'apps/desktop/data/database.sqlite');
const db = new Database(dbPath);

console.log('================================================================');
console.log('🔍 AUDIT D\'INTÉGRITÉ & DE COHÉRENCE : BASE SQLITE <-> INTERFACES');
console.log('================================================================\n');

// 1. Paramètres Entreprise & Multi-Tenancy
const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as any;
console.log('🏢 [1. PARAMÈTRES & MULTI-TENANT]');
console.log(`- Société : ${settings.companyName} (${settings.legalForm})`);
console.log(`- NIF : ${settings.nif} | RCCM : ${settings.rccm}`);
console.log(`- Code Entreprise : ${settings.companyCode} | Préfixe Factures : ${settings.invoicePrefix} | Devis : ${settings.quotePrefix}`);
console.log(`- Fiscalité Gabonaise : TVA ${settings.tvaRate}% | CSS ${settings.cssRate}% | TPS ${settings.tpsRate}%`);
console.log(`- Tenant ID : ${settings.tenant_id}`);
console.log(`- Banque : ${settings.bankName} (${settings.bankAgency}) - Compte : ${settings.accountNumber}`);

// 2. Utilisateurs & Gouvernance
const users = db.prepare('SELECT id, name, email, role, phone, is_active, created_at, tenant_id FROM users WHERE deletedAt IS NULL').all() as any[];
console.log(`\n👥 [2. GOUVERNANCE & UTILISATEURS] (${users.length} comptes)`);
for (const u of users) {
  console.log(`  • ${u.name.padEnd(20)} | Email: ${u.email.padEnd(30)} | Rôle: ${u.role.toUpperCase().padEnd(6)} | Actif: ${u.is_active === 1 ? 'OUI' : 'NON'} | Tenant: ${u.tenant_id === settings.tenant_id ? 'CONFORME' : 'DIVERGENT'}`);
}

// 3. Référentiel Clients
const clients = db.prepare('SELECT id, name, email, phone, status, tenant_id FROM clients WHERE deletedAt IS NULL').all() as any[];
console.log(`\n🏢 [3. RÉFÉRENTIEL CLIENTS] (${clients.length} clients)`);
const topClientsCa = db.prepare(`
  SELECT c.name, COUNT(i.id) as facturesCount, COALESCE(SUM(i.total), 0) as caTotal
  FROM clients c
  LEFT JOIN invoices i ON i.clientId = c.id AND i.deletedAt IS NULL AND i.status != 'cancelled'
  WHERE c.deletedAt IS NULL
  GROUP BY c.id
  ORDER BY caTotal DESC
  LIMIT 5
`).all() as any[];
console.log('Top 5 Clients par CA :');
for (const tc of topClientsCa) {
  console.log(`  • ${tc.name.padEnd(45)} : ${Math.round(tc.caTotal).toLocaleString('fr-FR')} XAF (${tc.facturesCount} factures)`);
}

// 4. Catalogue de Services
const services = db.prepare('SELECT id, name, category, unitPrice, tenant_id FROM services WHERE deletedAt IS NULL').all() as any[];
console.log(`\n💼 [4. SERVICES & TARIFS] (${services.length} prestations)`);
for (const s of services) {
  console.log(`  • [${s.category.padEnd(14)}] ${s.name.padEnd(45)} : ${Math.round(s.unitPrice).toLocaleString('fr-FR')} XAF`);
}

// 5. Facturation & Encaissements
const invoicesCount = db.prepare(`SELECT count(*) as c, sum(total) as ca FROM invoices WHERE deletedAt IS NULL`).get() as any;
const invoicesByStatus = db.prepare(`
  SELECT status, count(*) as count, sum(total) as total
  FROM invoices
  WHERE deletedAt IS NULL
  GROUP BY status
`).all() as any[];
console.log(`\n🧾 [5. FACTURATION & ENCAISSEMENT] (${invoicesCount.c} factures — Total CA : ${Math.round(invoicesCount.ca).toLocaleString('fr-FR')} XAF)`);
for (const ibs of invoicesByStatus) {
  console.log(`  • Statut ${ibs.status.padEnd(16)} : ${String(ibs.count).padStart(3)} factures | Total : ${Math.round(ibs.total).toLocaleString('fr-FR')} XAF`);
}

// Vérification de la cohérence des paiements
const paymentsSummary = db.prepare(`
  SELECT p.paymentMethod, count(*) as count, sum(p.amount) as encaisse
  FROM payments p
  WHERE p.deletedAt IS NULL
  GROUP BY p.paymentMethod
`).all() as any[];
const totalEncaisse = paymentsSummary.reduce((sum: number, p: any) => sum + p.encaisse, 0);
console.log(`Total Règlements Encaissés : ${Math.round(totalEncaisse).toLocaleString('fr-FR')} XAF`);
console.log('Répartition par mode de règlement :');
for (const ps of paymentsSummary) {
  const pct = ((ps.encaisse / totalEncaisse) * 100).toFixed(1);
  console.log(`  • ${ps.paymentMethod.padEnd(20)} : ${Math.round(ps.encaisse).toLocaleString('fr-FR')} XAF (${pct}%)`);
}

// 6. Devis (Quotes)
const quotesCount = db.prepare(`SELECT count(*) as c, sum(total) as total FROM quotes WHERE deletedAt IS NULL`).get() as any;
const quotesByStatus = db.prepare(`
  SELECT status, count(*) as count, sum(total) as total
  FROM quotes
  WHERE deletedAt IS NULL
  GROUP BY status
`).all() as any[];
console.log(`\n📄 [6. DEVIS COMMERCIAUX] (${quotesCount.c} devis — Total : ${Math.round(quotesCount.total).toLocaleString('fr-FR')} XAF)`);
for (const qbs of quotesByStatus) {
  console.log(`  • Statut ${qbs.status.padEnd(16)} : ${String(qbs.count).padStart(3)} devis | Total : ${Math.round(qbs.total).toLocaleString('fr-FR')} XAF`);
}

// 7. Notes d'Avoir (Credit Notes)
const creditNotes = db.prepare(`
  SELECT cn.number, cn.clientName, cn.date, cn.total, cn.reason, i.number as invoiceNum
  FROM credit_notes cn
  LEFT JOIN invoices i ON i.id = cn.invoiceId
  WHERE cn.deletedAt IS NULL
`).all() as any[];
console.log(`\n🔄 [7. NOTES D'AVOIR OHADA] (${creditNotes.length} avoirs)`);
for (const cn of creditNotes) {
  console.log(`  • ${cn.number} (${cn.date}) | Client: ${cn.clientName} | Facture liée: ${cn.invoiceNum || 'N/A'} | Montant: ${Math.round(cn.total).toLocaleString('fr-FR')} XAF`);
  console.log(`    Motif: "${cn.reason}"`);
}

// 8. Journal d'Audit
const auditCount = db.prepare(`SELECT count(*) as c FROM audit_logs`).get() as any;
const recentAudit = db.prepare(`
  SELECT userName, action, details, createdAt
  FROM audit_logs
  ORDER BY createdAt DESC
  LIMIT 5
`).all() as any[];
console.log(`\n📋 [8. JOURNAL D'AUDIT] (${auditCount.c} événements enregistrés)`);
console.log('Derniers événements :');
for (const a of recentAudit) {
  console.log(`  • [${a.createdAt}] ${a.userName} -> ${a.action} : ${a.details}`);
}

// 9. Vérification des anomalies d'intégrité
console.log('\n================================================================');
console.log('🛡️ CONTRÔLES D\'INTÉGRITÉ RELATIONNELLE :');
const orphanInvoiceItems = db.prepare('SELECT count(*) as c FROM invoice_items WHERE invoiceId NOT IN (SELECT id FROM invoices)').get() as any;
const orphanQuoteItems = db.prepare('SELECT count(*) as c FROM quote_items WHERE quoteId NOT IN (SELECT id FROM quotes)').get() as any;
const orphanPayments = db.prepare('SELECT count(*) as c FROM payments WHERE invoiceId NOT IN (SELECT id FROM invoices)').get() as any;
const nullTenantInvoices = db.prepare('SELECT count(*) as c FROM invoices WHERE tenant_id IS NULL OR tenant_id != ?').get(settings.tenant_id) as any;
const nullTenantQuotes = db.prepare('SELECT count(*) as c FROM quotes WHERE tenant_id IS NULL OR tenant_id != ?').get(settings.tenant_id) as any;

console.log(`- Lignes de facture orphelines : ${orphanInvoiceItems.c}`);
console.log(`- Lignes de devis orphelines : ${orphanQuoteItems.c}`);
console.log(`- Règlements orphelins : ${orphanPayments.c}`);
console.log(`- Factures hors tenant actif : ${nullTenantInvoices.c}`);
console.log(`- Devis hors tenant actif : ${nullTenantQuotes.c}`);
console.log('================================================================\n');
db.close();
process.exit(0);
