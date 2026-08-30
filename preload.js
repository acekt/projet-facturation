/**
 * preload.js — Script de Préchargement Electron "Facturier"
 * ==========================================================
 * RÈGLES DE SÉCURITÉ (contextIsolation = true) :
 *  ✅ Exposer uniquement des fonctions sûres via contextBridge
 *  ❌ NE JAMAIS exposer `require`, `process`, `ipcRenderer` brut
 *  ❌ NE JAMAIS exposer __dirname ou des accès système non contrôlés
 *
 * Le renderer accède à ces méthodes via : window.electron.xxx()
 */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  /**
   * Déclenche la boîte de dialogue d'impression native (Ancien système).
   * @returns {Promise<{ success: boolean }>}
   */
  print: () => ipcRenderer.invoke('print-to-pdf'),

  /**
   * Imprime un document spécifique via une fenêtre cachée en envoyant son code HTML.
   * @param {string} htmlContent - Le code HTML complet à imprimer.
   * @returns {Promise<{ success: boolean }>}
   */
  printDocument: (htmlContent) => ipcRenderer.invoke('print-document', htmlContent),

  /**
   * Génère un fichier PDF haute fidélité depuis un HTML complet et ouvre
   * la boîte de dialogue de sauvegarde native pour choisir l'emplacement.
   * @param {string} htmlContent - Le code HTML complet (avec styles inline).
   * @param {string} defaultFilename - Nom de fichier suggéré (ex: "FACTURE_001.pdf").
   * @returns {Promise<{ saved: boolean, filePath?: string }>}
   */
  exportPDF: (htmlContent, defaultFilename) =>
    ipcRenderer.invoke('export-pdf', htmlContent, defaultFilename),

  /**
   * Récupère la version de l'application (depuis package.json via main).
   * @returns {Promise<string>} — ex: "4.0.0"
   */
  getVersion: () => ipcRenderer.invoke('app:get-version'),

  /**
   * Récupère le chemin du dossier userData (pour debug dans l'UI Paramètres).
   * @returns {Promise<string>} — ex: "C:\\Users\\User\\AppData\\Roaming\\Facturier"
   */
  getUserDataPath: () => ipcRenderer.invoke('app:get-userData-path'),

  /**
   * Identifiant de la plateforme OS — lecture seule, pas d'invoke réseau.
   * @type {'win32' | 'darwin' | 'linux'}
   */
  platform: process.platform,

  /**
   * Indique si l'app tourne dans Electron (utile pour les composants UI
   * qui adaptent leur comportement Desktop vs. navigateur web).
   */
  isElectron: true,
});
