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

export function getNextNumber(type: 'quote' | 'invoice' | 'credit_note') {
  const settings = db.prepare('SELECT companyCode FROM settings WHERE id = 1').get() as DbSettings | undefined;
  const now = new Date();
  const year = now.getFullYear();

  // Ensure last_year column exists in sequences table
  try {
      const columns = db.prepare(`PRAGMA table_info(sequences)`).all() as DbPragmaColumn[];
      if (!columns.find(c => c.name === 'last_year')) {
          db.prepare(`ALTER TABLE sequences ADD COLUMN last_year INTEGER`).run();
          db.prepare(`UPDATE sequences SET last_year = ?`).run(year);
      }
  } catch (e) {
      // Column might already exist or table doesn't exist yet
  }

  const sequence = db.prepare('SELECT current_value, last_year FROM sequences WHERE name = ?').get(type) as DbSequence | undefined;

  if (!settings) {
      throw new Error('Company settings not found');
  }

  const prefix = type === 'quote' ? 'DEV-' : (type === 'invoice' ? 'FAC-' : '');

  if (!sequence) {
      // Should not happen as sequences are initialized in db.ts, but for safety:
      db.prepare('INSERT INTO sequences (name, current_value, last_year) VALUES (?, 1, ?)').run(type, year);
      return `${prefix}001/${settings.companyCode}/${year}`;
  }

  let nextValue = sequence.current_value + 1;

  if (sequence.last_year !== year) {
      nextValue = 1;
      db.prepare('UPDATE sequences SET current_value = ?, last_year = ? WHERE name = ?').run(nextValue, year, type);
  } else {
      db.prepare('UPDATE sequences SET current_value = ? WHERE name = ?').run(nextValue, type);
  }

  return `${prefix}${String(nextValue).padStart(3, '0')}/${settings.companyCode}/${year}`;
}
