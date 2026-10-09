const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const standaloneDir = path.join(rootDir, '.next', 'standalone');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('[prepare-standalone] Copie de public et .next/static vers .next/standalone...');

try {
  copyDir(path.join(rootDir, 'public'), path.join(standaloneDir, 'public'));
  copyDir(path.join(rootDir, '.next', 'static'), path.join(standaloneDir, '.next', 'static'));
  console.log('[prepare-standalone] Copie réussie !');
} catch (e) {
  console.error('[prepare-standalone] Erreur :', e);
  process.exit(1);
}
