const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "L'Étoile - Gestion & Facturation",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'public/icon.png')
  });

  if (isDev) {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools();
  } else {
    // In production, we'd load the exported static files or use next-electron-server
    // For now, assume we're targeting the dev server for testing
    win.loadURL('http://localhost:3000');
  }

  win.on('closed', () => {
    app.quit();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Printer IPC
ipcMain.on('print-to-pdf', (event) => {
    const win = BrowserWindow.getFocusedWindow();
    win.webContents.print();
});
