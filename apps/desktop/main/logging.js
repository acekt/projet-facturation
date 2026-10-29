'use strict';

const fs = require('fs');
const path = require('path');

let logStream = null;
let currentLogPath = '';

/**
 * Initialise le flux de journalisation persistant dans userData/main.log.
 * @param {string} userDataPath
 * @returns {string} Le chemin du fichier de log
 */
function initLogger(userDataPath) {
  currentLogPath = path.join(userDataPath, 'main.log');
  try {
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    logStream = fs.createWriteStream(currentLogPath, { flags: 'a' });
  } catch (e) {
    logStream = null;
  }
  return currentLogPath;
}

/**
 * Écrit un log horodaté dans le fichier de log et sur la console.
 * @param {'INFO' | 'WARN' | 'ERROR' | 'DEBUG'} level
 * @param {string} message
 */
function logToFile(level, message) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${level}] ${message}\n`;
  if (logStream) {
    try {
      logStream.write(entry);
    } catch (_) {}
  }
  if (level === 'ERROR' || level === 'WARN') {
    console.error(entry.trim());
  } else {
    console.log(entry.trim());
  }
}

function getLogPath() {
  return currentLogPath;
}

module.exports = {
  initLogger,
  logToFile,
  getLogPath,
};
