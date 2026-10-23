# ADR-0022: Desktop ExtraResources Standalone Runtime Resilience

## Status

Accepted

## Scope

- Area: Desktop Packaging, Electron 42 Runtime, Next.js 16 Standalone Output, ASAR Isolation, Windows Filesystem CWD
- Library or platform: Electron 42.11.2, electron-builder ^25.1.8, Next.js 16.4.0
- Installed version: electron 42.11.2, electron-builder ^25.1.8, next 16.4.0
- Related files:
  - pps/desktop/package.json
  - pps/desktop/electron-builder.yml
  - pps/desktop/main.js
  - pps/desktop/middleware.ts
  - pps/desktop/scripts/prepare-standalone.js

## Documentation Source

- Context7 source: /electron-userland/electron-builder (extraResources packaging options and ASAR externalization)
- Context7 source: /vercel/next.js (standalone output monorepo structure and outputFileTracingRoot)
- Date checked: 2026-10-23

## Context

Lors de l'execution en production de l'application packagee sous Windows (Facturier-Setup-1.0.0.exe) :
1. **Element parasite de packaging ASAR** : Lorsque .next/standalone etait declare dans le tableau iles de la configuration electron-builder, le moteur ASAR excluait silencieusement le dossier interne 
ode_modules de Next.js (
ode_modules/next), entrainant l'erreur fatale au lancement : Error: Cannot find module 'next'.
2. **Incompatibilite Windows CWD sous ASAR** : Un sous-processus Node (utilityProcess.fork) sous Windows ne peut pas avoir un repertoire de travail (cwd) pointant dans une archive virtuelle (pp.asar).
3. **Double configuration concurrente** : Presence conjointe de electron-builder.yml et du bloc uild dans package.json avec des directives divergentes (sar: false vs sar: true).
4. **Disponibilite immediate du Splash Screen** : L'ecran de demarrage scrute /api/health avant l'initialisation complete de la session.

## Decision

1. **Externalisation du serveur autonome via extraResources** :
   - Migration de .next/standalone hors de iles et declaration explicite dans extraResources :
     `json
     extraResources: [
       {
         from: .next/standalone,
         to: standalone,
         filter: [**/*]
       }
     ]
     `
   - Cette configuration garantit la copie integrale et non filtree du serveur Next.js, de ses artefacts (.next/BUILD_ID, server/, static/), de public/ et de l'arbre complet de ses dependances resolues (
ode_modules/).

2. **Resolution Dynamique et Injection NODE_PATH dans main.js** :
   - Priorite absolue dans esolveStandaloneServer() a path.join(process.resourcesPath, 'standalone', 'apps', 'desktop', 'server.js').
   - Verification systematique de l'existence de .next/BUILD_ID avant validation du point d'entree.
   - Injection dynamique de NODE_PATH pointant vers esources/standalone/node_modules lors de l'appel a utilityProcess.fork.
   - Garantie que cwd est un chemin de disque dur reel (path.dirname(effectiveServer)).

3. **Exemption Inconditionnelle du Health Check dans le Middleware** :
   - Exclusion de /api/health au niveau du matcher de middleware.ts pour garantir une reponse 200 OK en moins de 10 ms sans dependance sur SESSION_SECRET.

4. **Consolidation des Directives de Build** :
   - Alignement strict de electron-builder.yml avec package.json (sar: true, extraResources et exclusion des sources TypeScript/maps).

## Alternatives Considered

- Alternative 1 : Desactiver completement l'ASAR (sar: false) — Rejete car cela expose l'integralite du code du processus principal Electron et affaiblit l'integrite du paquet installateur.
- Alternative 2 : Utiliser sarUnpack: [.next/standalone/**/*] — Rejete car iles filtre les dossiers 
ode_modules imbriques avant que sarUnpack ne puisse les extraire, provoquant le MODULE_NOT_FOUND sur 
ext.

## Risks

- Risk: Augmentation de la taille de decompression lors de l'installation du paquet NSIS.
- Mitigation: Le dossier .next/standalone est deja tree-shaked par le compilateur Next.js avec output: 'standalone', ne contenant que le strict necessaire a l'execution de production.

## Verification

- Command: 
pm run quality:decisions
- Command: 
px electron-builder --win
