const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const nextDir = path.join(rootDir, '.next');
const standaloneDir = path.join(nextDir, 'standalone');
const nestedMonorepoDir = path.join(standaloneDir, 'apps', 'desktop');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyNextArtifacts(srcNext, destNext) {
  if (!fs.existsSync(srcNext)) return;
  if (!fs.existsSync(destNext)) fs.mkdirSync(destNext, { recursive: true });

  const ignoredFolders = new Set(['cache', 'standalone', 'dev', 'diagnostics']);
  const entries = fs.readdirSync(srcNext, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoredFolders.has(entry.name)) continue;
    const srcPath = path.join(srcNext, entry.name);
    const destPath = path.join(destNext, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('[prepare-standalone] Copie des assets et artéfacts de production...');

try {
  // 1. Copie vers .next/standalone racine
  if (fs.existsSync(standaloneDir)) {
    copyDir(path.join(rootDir, 'public'), path.join(standaloneDir, 'public'));
    copyNextArtifacts(nextDir, path.join(standaloneDir, '.next'));
    console.log('[prepare-standalone] Copie racine .next/standalone (.next + public + BUILD_ID) : OK');
  }

  // 2. Copie vers .next/standalone/apps/desktop (structure monorepo)
  if (fs.existsSync(nestedMonorepoDir)) {
    copyDir(path.join(rootDir, 'public'), path.join(nestedMonorepoDir, 'public'));
    copyNextArtifacts(nextDir, path.join(nestedMonorepoDir, '.next'));
    console.log('[prepare-standalone] Copie imbriquée .next/standalone/apps/desktop : OK');
  }

  // 3. Synchronisation de server.js entre racine et sous-dossier monorepo
  const rootServer = path.join(standaloneDir, 'server.js');
  const nestedServer = path.join(nestedMonorepoDir, 'server.js');
  if (!fs.existsSync(rootServer) && fs.existsSync(nestedServer)) {
    fs.copyFileSync(nestedServer, rootServer);
    console.log('[prepare-standalone] Miroir server.js racine créé.');
  } else if (fs.existsSync(rootServer) && !fs.existsSync(nestedServer)) {
    fs.mkdirSync(nestedMonorepoDir, { recursive: true });
    fs.copyFileSync(rootServer, nestedServer);
    console.log('[prepare-standalone] Miroir server.js monorepo créé.');
  }

  console.log('[prepare-standalone] Préparation standalone terminée avec succès !');
} catch (e) {
  console.error('[prepare-standalone] Erreur :', e);
  process.exit(1);
}
