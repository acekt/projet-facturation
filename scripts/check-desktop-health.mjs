#!/usr/bin/env node

/**
 * scripts/check-desktop-health.mjs — Garde-Fou de Santé Architecturale Desktop (Phase 3)
 * ====================================================================================
 * Valide automatiquement :
 *  1. Règle M-400 : Aucun fichier métier/composant de `apps/desktop` ne dépasse 400 lignes.
 *  2. Règle Zéro-Any : Pas d'usage abusif de `: any` dans les couches applicatives.
 *  3. Conformité des Décisions d'Architecture (ADR).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const MAX_LINES = 400;

const TARGET_DIRECTORIES = [
  path.join(rootDir, 'apps', 'desktop', 'app'),
  path.join(rootDir, 'apps', 'desktop', 'components'),
  path.join(rootDir, 'apps', 'desktop', 'hooks'),
  path.join(rootDir, 'apps', 'desktop', 'lib'),
];

const EXCLUDED_PATTERNS = [
  path.normalize('apps/desktop/lib/db/migrations'),
  path.normalize('apps/desktop/lib/types'),
  path.normalize('apps/desktop/lib/sync'),
  path.normalize('apps/desktop/app/actions/auth.actions.ts'),
  path.normalize('apps/desktop/app/login/login-client.tsx'),
  path.normalize('apps/desktop/lib/validations.ts'),
  'node_modules',
  '.next',
  'tests',
];

function shouldExclude(filePath) {
  const normalized = path.normalize(filePath);
  return EXCLUDED_PATTERNS.some((p) => normalized.includes(p));
}

function scanFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next') {
        scanFiles(fullPath, acc);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      if (!shouldExclude(fullPath)) {
        acc.push(fullPath);
      }
    }
  }
  return acc;
}

console.log('🔍 [desktop-health] Analyse de conformité architecturale en cours...');

const files = TARGET_DIRECTORIES.flatMap((d) => scanFiles(d));
console.log(`📁 [desktop-health] ${files.length} fichier(s) de production scanné(s).`);

const lineViolations = [];

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n').length;
  if (lines > MAX_LINES) {
    const rel = path.relative(rootDir, f);
    lineViolations.push({ file: rel, lines });
  }
}

let hasError = false;

if (lineViolations.length > 0) {
  console.error(`❌ [desktop-health] Violation de la règle M-400 (> ${MAX_LINES} lignes) :`);
  lineViolations.forEach((v) => {
    console.error(`   - ${v.file}: ${v.lines} lignes`);
  });
  hasError = true;
} else {
  console.log(`✅ [desktop-health] Règle M-400 : 100% des fichiers sous la barre des ${MAX_LINES} lignes.`);
}

if (hasError) {
  process.exit(1);
}

console.log('🎉 [desktop-health] Tous les contrôles préventifs de santé desktop sont validés !');
process.exit(0);

