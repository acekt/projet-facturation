// Global TypeScript type declarations for the Electron bridge
// exposed via contextBridge.exposeInMainWorld('electron', {...}) in preload.js
// This eliminates all (window as any).electron unsafe casts in components.

export {};

declare global {
  interface Window {
    electron?: {
      /**
       * Sends an async IPC request to the main process to trigger the system
       * print dialog. Returns a Promise that resolves when printing completes
       * or rejects on failure.
       */
      print: () => Promise<{ success: boolean }>;

      /**
       * The platform string (e.g. 'win32', 'darwin', 'linux').
       * Exposed from preload.js for conditional cross-platform UI logic.
       */
      platform: NodeJS.Platform;
    };
  }
}
