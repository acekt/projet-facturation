'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Charge ou génère les secrets persistants de l'application dans userData/secrets.json.
 * @param {string} userDataPath
 * @param {Function} logToFile
 * @returns {{ SESSION_SECRET: string, PASSWORD_SALT: string }}
 */
function loadOrGenerateSecrets(userDataPath, logToFile) {
  const SECRETS_FILE = path.join(userDataPath, 'secrets.json');
  let appSecrets;

  try {
    if (fs.existsSync(SECRETS_FILE)) {
      const raw = fs.readFileSync(SECRETS_FILE, 'utf8');
      appSecrets = JSON.parse(raw);
      if (
        !appSecrets.SESSION_SECRET || appSecrets.SESSION_SECRET.length < 32 ||
        !appSecrets.PASSWORD_SALT  || appSecrets.PASSWORD_SALT.length  < 16
      ) {
        throw new Error('Secrets corrompus ou trop courts — régénération forcée.');
      }
      logToFile('INFO', '[Secrets] Secrets persistants chargés depuis userData.');
    } else {
      throw new Error('Fichier secrets.json absent — première initialisation.');
    }
  } catch (secretsErr) {
    logToFile('INFO', `[Secrets] ${secretsErr.message}`);
    appSecrets = {
      SESSION_SECRET: crypto.randomBytes(48).toString('hex'),
      PASSWORD_SALT:  crypto.randomBytes(24).toString('hex'),
    };
    try {
      fs.writeFileSync(SECRETS_FILE, JSON.stringify(appSecrets, null, 2), { mode: 0o600 });
      logToFile('INFO', `[Secrets] Nouveaux secrets générés et persistés : ${SECRETS_FILE}`);
    } catch (writeErr) {
      logToFile('ERROR', `[Secrets] Impossible de persister les secrets : ${writeErr.message}`);
    }
  }

  return appSecrets;
}

module.exports = {
  loadOrGenerateSecrets,
};
