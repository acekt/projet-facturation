# ADR-0023: Desktop Window Icon and Splash Screen Packaging

## Status

Accepted

## Scope

- Area: Desktop UI, Electron Window Configuration, Windows Shell Title Bar Icon, ASAR Asset Bundling, Splash Screen
- Library or platform: Electron 42.11.2, electron-builder ^25.1.8, Win32 GDI / Chromium
- Installed version: electron 42.11.2, electron-builder ^25.1.8
- Related files:
  - apps/desktop/package.json
  - apps/desktop/main.js
  - apps/desktop/public/splash.html
  - apps/desktop/scripts/generate-icons.js
  - apps/desktop/build/icon.ico

## Documentation Source

- Context7 source: /electron/electron (BrowserWindow options icon, nativeImage formats on Windows, and HICON management)
- Context7 source: /electron-userland/electron-builder (win.icon and files packaging patterns)
- Date checked: 2026-10-23

## Context

Lors de l'exécution de l'application packagée sous Windows (`Facturier-Setup-1.0.0.exe`), deux défauts visuels majeurs ont été constatés :
1. **Écran Splash tout blanc** : La fenêtre du splash screen apparaissait entièrement vide/blanche sans logo ni barre de progression. En cause : le dossier `public/` n'était pas déclaré dans la liste `files` de `package.json`, rendant `splash.html` absent de l'archive `app.asar`. `splashWindow.loadFile(...)` échouait silencieusement et la fenêtre s'affichait avec sa couleur d'arrière-plan de repli (`#fafafa`).
2. **Icône de fenêtre avec carré noir dans la barre de titre** : L'icône de la fenêtre présentait un carré noir opaque ou découpé au lieu d'une transparence nette. En cause :
   - `main.js` utilisait `nativeImage.createFromPath(...).resize({ width: 32, height: 32 })`. L'appel à `.resize()` sur une image manquante ou sous Windows GDI détruit la couche de transparence ARGB pré-multipliée, forçant Win32 à peindre un carré noir (`0x000000`).
   - L'icône Windows n'était pas fournie sous forme de fichier `.ico` multi-résolutions (16, 24, 32, 48, 64, 128, 256) avec canaux alpha natifs.

## Decision

1. **Inclusion des assets dans le bundle ASAR et décompression de l'icône** :
   - Ajout explicite de `"public/**/*"`, `"build/icon.ico"` et `"build/icon.png"` dans la directive `files` de `package.json`.
   - Ajout de `"build/icon.ico"` dans `asarUnpack` pour qu'un fichier `.ico` physique existe sur le système de fichiers réel (`app.asar.unpacked/build/icon.ico`), directement consommable par les APIs Win32 `LoadImageW` / `WM_SETICON`.
   - Configuration de `win.icon` sur `"build/icon.ico"` pour que l'exécutable `Facturier.exe` incorpore nativement la ressource `IDI_ICON`.

2. **Génération d'icônes multi-résolutions natives (`generate-icons.js`)** :
   - Script Node automatisé générant un `.ico` contenant 7 tailles de mipmaps (16x16, 24x24, 32x32, 48x48, 64x64, 128x128, 256x256) en 32-bit RGBA sans perte de canal alpha.
   - Synchronisation automatique de `public/icon.png` et `public/logo.png` pour l'écran splash.

3. **Résolution d'icône résiliente sans redimensionnement destructeur (`resolveAppIcon`)** :
   - Détection prioritaire du fichier `.ico` réel dans `app.asar.unpacked`.
   - Utilisation directe des chemins ou des instances `nativeImage` sans jamais appeler `.resize()`.
   - Repli gracieux sur `undefined` en mode packagé Windows pour laisser l'OS utiliser l'icône native intégrée dans le PE de `Facturier.exe`.

4. **Résolution robuste du Splash Screen (`resolveSplashPath`)** :
   - Recherche en cascade du fichier `splash.html` (`public/splash.html`, `resources/standalone/public/splash.html`).
   - Journalisation de l'existence du fichier et capture explicite des erreurs de chargement.

## Alternatives Considered

- Alternative 1 : Laisser Windows redimensionner dynamiquement un PNG 512x512 dans BrowserWindow. Rejeté car les versions de Windows 10/11 sans mise à l'échelle DPI adaptée génèrent des bordures floues ou des artéfacts noirs sur les barres de titre à 100% DPI.
- Alternative 2 : Supprimer l'icône de BrowserWindow et se fier uniquement à l'exécutable. Conservé comme mécanisme de repli, mais la fourniture explicite du `.ico` décompressé garantit un affichage identique en mode développement et production.

## Risks

- Risk: Augmentation minime de la taille de l'archive ASAR.
- Mitigation: L'ensemble des images et du `.ico` représente moins de 500 Ko, négligeable par rapport aux 200 Mo de l'installeur.

## Verification

- Command: `npm run quality:decisions`
- Command: `node apps/desktop/scripts/generate-icons.js`
- Command: `npx electron-builder --win`
