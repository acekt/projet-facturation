import db from '@/lib/db';

export interface DbSettings {
  id: number;
  companyName: string;
  nif: string;
  rccm: string;
  address: string;
  email: string;
  phone: string;
  tvaRate: number;
  tpsRate: number;
  cssRate: number;
  invoicePrefix: string;
  quotePrefix: string;
  companyCode: string;
}

const countSettingsStmt = db.prepare('SELECT COUNT(*) as c FROM settings WHERE id = 1');
const insertSettingsStmt = db.prepare(`
  INSERT INTO settings (id, companyName, nif, rccm, address, phone, email, tvaRate, tpsRate, cssRate, invoicePrefix, quotePrefix, companyCode)
  VALUES (1, ?, ?, ?, ?, ?, ?, 18.0, 9.5, 1.0, 'FAC-', 'DEV-', 'FACTURIER')
`);
const updateSettingsStmt = db.prepare(`
  UPDATE settings
  SET companyName = ?, nif = ?, rccm = ?, address = ?, phone = ?, email = ?
  WHERE id = 1
`);

export const SettingsRepository = {
  hasSettings(): boolean {
    const result = countSettingsStmt.get() as { c: number } | undefined;
    return (result?.c || 0) > 0;
  },

  upsertInitialSettings(companyName: string, nif: string, rccm: string, address: string, phone: string, email: string): void {
    if (this.hasSettings()) {
      updateSettingsStmt.run(companyName, nif, rccm, address, phone, email);
    } else {
      insertSettingsStmt.run(companyName, nif, rccm, address, phone, email);
    }
  }
};
