import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 3 : Packaging & Distribution de l\'Application Desktop', () => {
  const desktopRoot = path.resolve(__dirname, '../..');
  const packageJsonPath = path.join(desktopRoot, 'package.json');
  const mainJsPath = path.join(desktopRoot, 'main.js');
  const preloadJsPath = path.join(desktopRoot, 'preload.js');
  const nextConfigPath = path.join(desktopRoot, 'next.config.mjs');
  const prepareStandalonePath = path.join(desktopRoot, 'scripts', 'prepare-standalone.js');

  // ---------------------------------------------------------------------------
  // 1. COMPILATION STANDALONE NEXT.JS + ELECTRON (Tâche 3.1)
  // ---------------------------------------------------------------------------
  describe('Standalone Next.js Configuration', () => {
    it('1.1 next.config.mjs must declare output: standalone and external better-sqlite3', () => {
      expect(fs.existsSync(nextConfigPath)).toBe(true);
      const content = fs.readFileSync(nextConfigPath, 'utf8');

      expect(content).toContain("output: 'standalone'");
      expect(content).toContain('serverExternalPackages:');
      expect(content).toContain('better-sqlite3');
    });

    it('1.2 prepare-standalone.js must handle root and nested monorepo paths', () => {
      expect(fs.existsSync(prepareStandalonePath)).toBe(true);
      const content = fs.readFileSync(prepareStandalonePath, 'utf8');

      expect(content).toContain('standaloneDir');
      expect(content).toContain('nestedMonorepoDir');
      expect(content).toContain('public');
      expect(content).toContain('.next');
    });

    it('1.3 main.js must implement dynamic resolveStandaloneServer for production resilience', () => {
      expect(fs.existsSync(mainJsPath)).toBe(true);
      const serverJsPath = path.join(desktopRoot, 'main', 'server.js');
      const content = fs.readFileSync(mainJsPath, 'utf8') +
        (fs.existsSync(serverJsPath) ? '\n' + fs.readFileSync(serverJsPath, 'utf8') : '');

      expect(content).toContain('resolveStandaloneServer');
      expect(content).toContain('server.js');
      expect(content).toContain('ELECTRON_USERDATA_PATH');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. CONFIGURATION ELECTRON-BUILDER & INSTALLATEUR WINDOWS (Tâche 3.2)
  // ---------------------------------------------------------------------------
  describe('Electron Builder & NSIS Packaging Configuration', () => {
    it('2.1 package.json must configure ASAR with native node unpack', () => {
      expect(fs.existsSync(packageJsonPath)).toBe(true);
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      expect(pkg.build).toBeDefined();
      expect(pkg.build.asar).toBe(true);
      expect(pkg.build.asarUnpack).toContain('**/*.node');
    });

    it('2.2 package.json must configure NSIS installer for Windows x64', () => {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      expect(pkg.build.win).toBeDefined();
      expect(pkg.build.win.target).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: 'nsis',
            arch: expect.arrayContaining(['x64']),
          }),
        ])
      );

      expect(pkg.build.nsis).toBeDefined();
      expect(pkg.build.nsis.oneClick).toBe(true);
      expect(pkg.build.nsis.artifactName).toBe('${productName}-Setup-${version}.${ext}');
    });

    it('2.3 package.json must declare publish target for GitHub Releases auto-updates', () => {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      expect(pkg.build.publish).toBeDefined();
      expect(pkg.build.publish).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            provider: 'github',
            owner: 'acekt',
            repo: 'projet-facturation',
          }),
        ])
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 3. AUTO-UPDATER ELECTRON & CONTRAT IPC (Tâche 3.3)
  // ---------------------------------------------------------------------------
  describe('Auto-Updater Lifecycle & IPC Bridge', () => {
    it('3.1 preload.js must expose updater bridge methods without raw node access', () => {
      expect(fs.existsSync(preloadJsPath)).toBe(true);
      const content = fs.readFileSync(preloadJsPath, 'utf8');

      expect(content).toContain('updater:');
      expect(content).toContain("ipcRenderer.invoke('updater:check')");
      expect(content).toContain("ipcRenderer.invoke('updater:download')");
      expect(content).toContain("ipcRenderer.invoke('updater:install')");
      expect(content).toContain("ipcRenderer.on('updater:status'");
      expect(content).toContain("ipcRenderer.on('updater:progress'");
    });

    it('3.2 main.js must register updater IPC handlers and event forwards', () => {
      const updaterJsPath = path.join(desktopRoot, 'main', 'updater.js');
      const content = fs.readFileSync(mainJsPath, 'utf8') +
        (fs.existsSync(updaterJsPath) ? '\n' + fs.readFileSync(updaterJsPath, 'utf8') : '');

      expect(content).toContain("setupAutoUpdater");
      expect(content).toContain("ipcMain.handle('updater:check'");
      expect(content).toContain("ipcMain.handle('updater:download'");
      expect(content).toContain("ipcMain.handle('updater:install'");
      expect(content).toContain("mainWindow.webContents.send('updater:status'");
      expect(content).toContain("mainWindow.webContents.send('updater:progress'");
    });

    it('3.3 types/electron.d.ts must type IElectronUpdaterBridge with strict interfaces', () => {
      const typesPath = path.join(desktopRoot, 'types', 'electron.d.ts');
      expect(fs.existsSync(typesPath)).toBe(true);
      const content = fs.readFileSync(typesPath, 'utf8');

      expect(content).toContain('interface IUpdateStatusPayload');
      expect(content).toContain('interface IUpdateProgressPayload');
      expect(content).toContain('interface IElectronUpdaterBridge');
      expect(content).toContain('updater?: IElectronUpdaterBridge');
    });
  });
});
