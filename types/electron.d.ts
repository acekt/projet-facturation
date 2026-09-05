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
       * Prints a specific HTML document using a hidden window.
       */
      printDocument: (htmlContent: string) => Promise<{ success: boolean }>;

      /**
       * Exports a specific HTML document as a PDF file using the native
       * Electron printToPDF engine and a system save dialog.
       * @param htmlContent    - Complete HTML string (with Tailwind CDN).
       * @param defaultFilename - Suggested filename shown in the save dialog.
       * @returns { saved: boolean, filePath?: string }
       */
      exportPDF: (
        htmlContent: string,
        defaultFilename: string
      ) => Promise<{ saved: boolean; filePath?: string }>;

      /**
       * The platform string (e.g. 'win32', 'darwin', 'linux').
       * Exposed from preload.js for conditional cross-platform UI logic.
       */
      platform: NodeJS.Platform;

      /** Generic escape hatch for other future IPC methods. */
      [key: string]: unknown;
    };
  }
}
