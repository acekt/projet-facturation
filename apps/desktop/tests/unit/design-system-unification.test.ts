import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';

function getFiles(dir: string, fileList: string[] = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const stat = fs.statSync(path.join(dir, file));
    if (stat.isDirectory()) {
      getFiles(path.join(dir, file), fileList);
    } else if (file.endsWith('.tsx')) {
      fileList.push(path.join(dir, file));
    }
  }
  return fileList;
}

describe('Design System Unification', () => {
  it('should not contain hardcoded bg-emerald- or bg-green- on Buttons', () => {
    const componentsDir = path.resolve(__dirname, '../../components');
    const appDir = path.resolve(__dirname, '../../app');

    let allFiles = getFiles(componentsDir);
    allFiles = allFiles.concat(getFiles(appDir));

    const testFiles = [
      'stock.tsx',
      'ledger.tsx',
      'ShareDocumentModal.tsx',
      'DocumentCommercialHeader.tsx',
      'EditorItemsTable.tsx'
    ];

    for (const file of allFiles) {
      if (testFiles.some(tf => file.endsWith(tf))) {
        const content = fs.readFileSync(file, 'utf8');
        const hasBadButton = /<Button[^>]*bg-(emerald|green|amber)-[^>]*>/g.test(content);
        expect(hasBadButton).toBe(false);
      }
    }
  });

  it('should not contain specific forbidden placeholders in forms', () => {
    const componentsDir = path.resolve(__dirname, '../../components');
    const appDir = path.resolve(__dirname, '../../app');

    let allFiles = getFiles(componentsDir);
    allFiles = allFiles.concat(getFiles(appDir));

    const testFiles = [
      'ClientFormDialog.tsx',
      'ServiceFormDialog.tsx',
      'ShareDocumentModal.tsx',
      'DocumentCommercialHeader.tsx',
      'user-editor.tsx'
    ];

    for (const file of allFiles) {
      if (testFiles.some(tf => file.endsWith(tf))) {
        const content = fs.readFileSync(file, 'utf8');
        expect(content.includes('placeholder="client@entreprise.ga"')).toBe(false);
        expect(content.includes('placeholder="+241 07"')).toBe(false);
        expect(content.includes('placeholder="@exemple"')).toBe(false);
        expect(content.includes('placeholder="jean.ndong@entreprise.ga"')).toBe(false);
        expect(content.includes('placeholder="+241 74 00 00 00"')).toBe(false);
      }
    }
  });
});
