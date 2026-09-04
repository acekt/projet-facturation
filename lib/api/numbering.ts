import db from '@/lib/db';

interface DbSettings {
  companyCode: string;
}

interface DbSequence {
  current_value: number;
  last_year: number;
}

interface DbPragmaColumn {
  name: string;
}

/** Formate un numéro de document (Norme Gabonaise) : DEV-001/GAB/2026 */
function formatDocNumber(prefix: string, companyCode: string | null | undefined, year: number, seq: number): string {
  const padded = String(seq).padStart(3, '0');
  const code = companyCode && companyCode.trim() !== '' ? companyCode.trim().toUpperCase() : 'GAB';
  return `${prefix}-${padded}/${code}/${year}`;
}

const getSettingsStmt = db.prepare('SELECT companyCode FROM settings WHERE id = 1');
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
  const prefix = type === 'quote' ? 'DEV' : (type === 'invoice' ? 'FAC' : 'AV');

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
