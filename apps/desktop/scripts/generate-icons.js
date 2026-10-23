const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateIco() {
  const rootDir = path.resolve(__dirname, '..');
  const srcPng = path.join(rootDir, 'build', 'icon.png');
  const destIco = path.join(rootDir, 'build', 'icon.ico');
  const publicIcon = path.join(rootDir, 'public', 'icon.png');
  const publicLogo = path.join(rootDir, 'public', 'logo.png');

  if (!fs.existsSync(srcPng)) {
    console.warn('[generate-icons] Source build/icon.png non trouvée');
    return;
  }

  // S'assurer que public/icon.png et public/logo.png existent
  if (!fs.existsSync(publicIcon)) {
    fs.copyFileSync(srcPng, publicIcon);
    console.log('[generate-icons] Copie effectuée vers public/icon.png');
  }
  if (!fs.existsSync(publicLogo)) {
    fs.copyFileSync(srcPng, publicLogo);
    console.log('[generate-icons] Copie effectuée vers public/logo.png');
  }

  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngBuffers = [];

  for (const size of sizes) {
    const buf = await sharp(srcPng).resize(size, size).png().toBuffer();
    pngBuffers.push({ size, buf });
  }

  // Entête ICO (6 octets)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type 1 = ICO
  header.writeUInt16LE(sizes.length, 4); // Nombre d'images

  const entries = [];
  let offset = 6 + sizes.length * 16;

  for (const { size, buf } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0); // Largeur (0 = 256)
    entry.writeUInt8(size === 256 ? 0 : size, 1); // Hauteur (0 = 256)
    entry.writeUInt8(0, 2); // Palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel (32-bit RGBA)
    entry.writeUInt32LE(buf.length, 8); // Taille des données
    entry.writeUInt32LE(offset, 12); // Offset absolu
    entries.push(entry);
    offset += buf.length;
  }

  const icoBuffer = Buffer.concat([header, ...entries, ...pngBuffers.map((p) => p.buf)]);
  fs.writeFileSync(destIco, icoBuffer);
  console.log(`[generate-icons] Icône multi-résolution générée : ${destIco} (${icoBuffer.length} octets, ${sizes.length} tailles)`);
}

generateIco().catch((err) => {
  console.error('[generate-icons] Erreur :', err);
});
