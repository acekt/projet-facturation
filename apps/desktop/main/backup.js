'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Sauvegarde automatique journalière de la base SQLite avec vérification d'intégrité
 * et politique de rétention des 7 derniers jours glissants.
 * @param {string} userDataPath
 * @param {Function} logToFile
 */
function performDailyBackup(userDataPath, logToFile) {
  try {
    const dataDir = path.join(userDataPath, 'data');
    const dbPath = path.join(dataDir, 'database.sqlite');
    const backupDir = path.join(userDataPath, 'backups');

    if (!fs.existsSync(dbPath)) {
      logToFile('INFO', '[Backup] Aucune base de données source, sauvegarde ignorée.');
      return;
    }

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const today = new Date().toISOString().split('T')[0];
    const backupFileName = `backup_${today}.sqlite`;
    const backupFilePath = path.join(backupDir, backupFileName);

    if (fs.existsSync(backupFilePath)) {
      logToFile('INFO', `[Backup] Sauvegarde journalière déjà existante pour aujourd'hui : ${backupFileName}`);
    } else {
      fs.copyFileSync(dbPath, backupFilePath);
      try {
        const Database = require('better-sqlite3');
        const check = new Database(backupFilePath, { readonly: true });
        const ok = check.pragma('integrity_check', { simple: true }) === 'ok';
        check.close();
        if (!ok) {
          fs.unlinkSync(backupFilePath);
          logToFile('ERROR', `[Backup] Sauvegarde corrompue détectée et supprimée : ${backupFileName}`);
        } else {
          logToFile('INFO', `[Backup] Sauvegarde journalière vérifiée avec succès : ${backupFileName}`);
        }
      } catch (checkErr) {
        logToFile('INFO', `[Backup] Sauvegarde journalière effectuée (vérification ignorée) : ${backupFileName}`);
      }
    }

    // Nettoyage (Rétention de 7 jours)
    const files = fs.readdirSync(backupDir);
    const backupFiles = files
      .filter((f) => f.startsWith('backup_') && f.endsWith('.sqlite'))
      .map((f) => ({
        name: f,
        path: path.join(backupDir, f),
        time: fs.statSync(path.join(backupDir, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.time - a.time);

    if (backupFiles.length > 7) {
      const toDelete = backupFiles.slice(7);
      for (const file of toDelete) {
        try {
          fs.unlinkSync(file.path);
          logToFile('INFO', `[Backup] Nettoyage : Ancienne sauvegarde supprimée (${file.name})`);
        } catch (e) {
          logToFile('ERROR', `[Backup] Erreur nettoyage ${file.name} : ${e.message}`);
        }
      }
    }
  } catch (err) {
    logToFile('ERROR', `[Backup] Échec fatal de la sauvegarde : ${err.message}`);
  }
}

module.exports = {
  performDailyBackup,
};
