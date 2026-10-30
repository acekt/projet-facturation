import db from '@/lib/db';

interface DbSettings {
  companyCode?: string | null;
  invoicePrefix?: string | null;
  quotePrefix?: string | null;
}

interface DbSequence {
  current_value: number;
  last_year: number;
}

interface DbPragmaColumn {
  name: string;
}

/** Formate un numéro de document (Norme Gabonaise) : DEV-001/GAB/2026 ou DEV-P1-001/GAB/2026 en multi-caisses */
export function formatDocNumber(
  prefix: string,
  companyCode: string | null | undefined,
  year: number,
  seq: number,
  devicePrefixInput?: string
): string {
  const padded = String(seq).padStart(3, '0');
  const code = companyCode && companyCode.trim() !== '' ? companyCode.trim().toUpperCase() : 'GAB';
  const rawPrefix = devicePrefixInput ?? process.env.FACTURIER_DEVICE_PREFIX;
  const devPrefix = rawPrefix && rawPrefix.trim() !== '' ? `${rawPrefix.trim().toUpperCase()}-` : '';
  return `${prefix}-${devPrefix}${padded}/${code}/${year}`;
}

const getSettingsStmt = db.prepare('SELECT companyCode, invoicePrefix, quotePrefix FROM settings WHERE id = 1');
const getSequenceStmt = db.prepare('SELECT current_value, last_year FROM sequences WHERE name = ?');
const insertSequenceStmt = db.prepare('INSERT INTO sequences (name, current_value, last_year) VALUES (?, 1, ?)');
const updateSequenceNewYearStmt = db.prepare('UPDATE sequences SET current_value = ?, last_year = ? WHERE name = ?');
const updateSequenceStmt = db.prepare('UPDATE sequences SET current_value = ? WHERE name = ?');

export function getNextNumber(type: 'quote' | 'invoice' | 'credit_note') {
  const settings = getSettingsStmt.get() as DbSettings | undefined;
  if (!settings) {
    throw new Error('Company settings not found');
  }

  const now = new Date();
  const year = now.getFullYear();

  const sequence = getSequenceStmt.get(type) as DbSequence | undefined;

  const companyCode = settings.companyCode;

  // Harmonisation des préfixes selon les réglages avec fallback canonique et nettoyage des tirets/slashs résiduels
  let configuredPrefix: string | null | undefined = null;
  if (type === 'quote') {
    configuredPrefix = settings.quotePrefix || 'DEV';
  } else if (type === 'invoice') {
    configuredPrefix = settings.invoicePrefix || 'FAC';
  } else {
    configuredPrefix = 'AV';
  }

  const sanitizedPrefix = (configuredPrefix || '')
    .trim()
    .replace(/[-/]+$/, '')
    .toUpperCase();

  const prefix = sanitizedPrefix || (type === 'quote' ? 'DEV' : (type === 'invoice' ? 'FAC' : 'AV'));

  if (!sequence) {
    insertSequenceStmt.run(type, year);
    return formatDocNumber(prefix, companyCode, year, 1);
  }

  let nextValue = sequence.current_value + 1;

  if (sequence.last_year !== year) {
    nextValue = 1;
    updateSequenceNewYearStmt.run(nextValue, year, type);
  } else {
    updateSequenceStmt.run(nextValue, type);
  }

  return formatDocNumber(prefix, companyCode, year, nextValue);
}
