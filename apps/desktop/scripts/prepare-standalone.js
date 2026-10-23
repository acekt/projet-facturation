const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const standaloneDir = path.join(rootDir, '.next', 'standalone');
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

console.log('[prepare-standalone] Copie des assets statiques (public et .next/static)...');

try {
  // 1. Copie vers .next/standalone racine
  if (fs.existsSync(standaloneDir)) {
    copyDir(path.join(rootDir, 'public'), path.join(standaloneDir, 'public'));
    copyDir(path.join(rootDir, '.next', 'static'), path.join(standaloneDir, '.next', 'static'));
    console.log('[prepare-standalone] Copie racine .next/standalone : OK');
  }

  // 2. Copie vers .next/standalone/apps/desktop (structure monorepo)
  if (fs.existsSync(nestedMonorepoDir)) {
    copyDir(path.join(rootDir, 'public'), path.join(nestedMonorepoDir, 'public'));
    copyDir(path.join(rootDir, '.next', 'static'), path.join(nestedMonorepoDir, '.next', 'static'));
    console.log('[prepare-standalone] Copie imbriquée .next/standalone/apps/desktop : OK');
  }

  console.log('[prepare-standalone] Préparation standalone terminée avec succès !');
} catch (e) {
  console.error('[prepare-standalone] Erreur :', e);
  process.exit(1);
}
