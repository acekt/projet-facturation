import Database from 'better-sqlite3';
import { Migration } from './types';

export const migration0007: Migration = {
  version: 7,
  name: '0007_selective_taxes_and_cleanup',
  up(db: Database.Database) {
    const replacements: Array<[string, string]> = [
      ['SociéTé', 'Société'],
      ['AssociéS', 'Associés'],
      ['MinièRe', 'Minière'],
      ['HôTel', 'Hôtel'],
      ['MéDico', 'Médico'],
      ['ÉNeRgie', 'Énergie'],
      ['Énergie', 'Énergie'],
      ['GéNéRale', 'Générale'],
      ['BâTiment', 'Bâtiment'],
      ['SéCurité', 'Sécurité'],
      ['RéSeau', 'Réseau'],
      ['TéléCom', 'Télécom'],
    ];

    const tablesAndColumns: Array<{ table: string; column: string }> = [
      { table: 'clients', column: 'name' },
      { table: 'invoices', column: 'clientName' },
      { table: 'quotes', column: 'clientName' },
      { table: 'credit_notes', column: 'clientName' },
      { table: 'services', column: 'name' },
    ];

    for (const { table, column } of tablesAndColumns) {
      for (const [corrupted, clean] of replacements) {
        try {
          db.prepare(
            `UPDATE ${table} SET ${column} = REPLACE(${column}, ?, ?) WHERE ${column} LIKE ?`
          ).run(corrupted, clean, `%${corrupted}%`);
        } catch {
          // Table ou colonne optionnelle selon l'état du schéma
        }
      }
    }
  },
};

