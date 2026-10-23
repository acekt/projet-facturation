/**
 * Contrat typé du pont Electron exposé par `preload.js` via contextBridge.
 * Doit rester synchronisé avec preload.js (window.electron.*).
 * Optionnel : absent lorsque l'app tourne dans un navigateur classique.
 */

export interface IUpdateStatusPayload {
  status: 'checking' | 'available' | 'not-available' | 'downloaded' | 'error';
  version?: string;
  releaseDate?: string;
  releaseNotes?: string | null;
  error?: string;
}

export interface IUpdateProgressPayload {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

export interface IElectronUpdaterBridge {
  check: () => Promise<{ success: boolean; updateAvailable?: boolean; isDev?: boolean; info?: any; error?: string }>;
  download: () => Promise<{ success: boolean; error?: string }>;
  install: () => Promise<{ success: boolean; error?: string }>;
  onStatus: (callback: (data: IUpdateStatusPayload) => void) => () => void;
  onProgress: (callback: (data: IUpdateProgressPayload) => void) => () => void;
}

export interface IElectronBridge {
  print: () => Promise<{ success: boolean }>;
  printDocument: (htmlContent: string) => Promise<{ success: boolean; error?: string }>;
  exportPDF: (
    htmlContent: string,
    defaultFilename: string
  ) => Promise<{ saved: boolean; filePath?: string; error?: string }>;
  getVersion: () => Promise<string>;
  getUserDataPath: () => Promise<string>;
  platform: 'win32' | 'darwin' | 'linux';
  isElectron: true;
  updater?: IElectronUpdaterBridge;
}

declare global {
  interface Window {
    electron?: IElectronBridge;
  }
}
