import db from '@/lib/db';

export interface DbSettings {
  id: number;
  companyName: string;
  legalForm?: string;
  nif: string;
  rccm: string;
  address: string;
  email: string;
  phone: string;
  logo?: string;
  tvaRate: number;
  tpsRate: number;
  cssRate: number;
  invoicePrefix: string;
  quotePrefix: string;
  companyCode: string;
  mentionsLegales?: string;
  bankName?: string;
  bankAgency?: string;
  accountNumber?: string;
  swiftCode?: string;
  iban?: string;
  sessionTimeout?: number;
  tenant_id?: string;
}

export interface InitialSettingsInput {
  companyName: string;
  legalForm?: string | null;
  nif?: string | null;
  rccm?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logo?: string | null;
  companyCode?: string | null;
  invoicePrefix?: string | null;
  quotePrefix?: string | null;
  tvaRate?: number | null;
  cssRate?: number | null;
  tpsRate?: number | null;
  mentionsLegales?: string | null;
  bankName?: string | null;
  bankAgency?: string | null;
  accountNumber?: string | null;
  swiftCode?: string | null;
  iban?: string | null;
  sessionTimeout?: number | null;
  tenant_id?: string | null;
}

const countSettingsStmt = db.prepare('SELECT COUNT(*) as c FROM settings WHERE id = 1');

export const SettingsRepository = {
  hasSettings(): boolean {
    const result = countSettingsStmt.get() as { c: number } | undefined;
    return (result?.c || 0) > 0;
  },

  upsertInitialSettings(
    input: InitialSettingsInput | string,
    nif?: string,
    rccm?: string,
    address?: string,
    phone?: string,
    email?: string
  ): void {
    const data: InitialSettingsInput = typeof input === 'string'
      ? {
          companyName: input,
          nif: nif || null,
          rccm: rccm || null,
          address: address || null,
          phone: phone || null,
          email: email || null,
        }
      : input;

    const legalForm = data.legalForm || 'SARL';
    const companyCode = data.companyCode || 'FAC';
    const invoicePrefix = data.invoicePrefix || 'FAC-';
    const quotePrefix = data.quotePrefix || 'DEV-';
    const tvaRate = data.tvaRate ?? 18.0;
    const cssRate = data.cssRate ?? 1.0;
    const tpsRate = data.tpsRate ?? 9.5;
    const sessionTimeout = data.sessionTimeout ?? 60;
    const tenantId = data.tenant_id || null;

    const stmt = db.prepare(`
      INSERT INTO settings (
        id, companyName, legalForm, nif, rccm, address, phone, email, logo,
        companyCode, invoicePrefix, quotePrefix, tvaRate, cssRate, tpsRate,
        mentionsLegales, bankName, bankAgency, accountNumber, swiftCode, iban,
        sessionTimeout, tenant_id
      ) VALUES (
        1, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?
      )
      ON CONFLICT(id) DO UPDATE SET
        companyName = excluded.companyName,
        legalForm = excluded.legalForm,
        nif = excluded.nif,
        rccm = excluded.rccm,
        address = excluded.address,
        phone = excluded.phone,
        email = excluded.email,
        logo = excluded.logo,
        companyCode = excluded.companyCode,
        invoicePrefix = excluded.invoicePrefix,
        quotePrefix = excluded.quotePrefix,
        tvaRate = excluded.tvaRate,
        cssRate = excluded.cssRate,
        tpsRate = excluded.tpsRate,
        mentionsLegales = excluded.mentionsLegales,
        bankName = excluded.bankName,
        bankAgency = excluded.bankAgency,
        accountNumber = excluded.accountNumber,
        swiftCode = excluded.swiftCode,
        iban = excluded.iban,
        sessionTimeout = excluded.sessionTimeout,
        tenant_id = COALESCE(excluded.tenant_id, settings.tenant_id)
    `);

    stmt.run(
      data.companyName,
      legalForm,
      data.nif || null,
      data.rccm || null,
      data.address || null,
      data.phone || null,
      data.email || null,
      data.logo || null,
      companyCode,
      invoicePrefix,
      quotePrefix,
      tvaRate,
      cssRate,
      tpsRate,
      data.mentionsLegales || null,
      data.bankName || null,
      data.bankAgency || null,
      data.accountNumber || null,
      data.swiftCode || null,
      data.iban || null,
      sessionTimeout,
      tenantId
    );
  }
};

