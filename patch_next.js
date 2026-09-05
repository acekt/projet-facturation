const fs = require('fs');

// Patch quote-editor.tsx
let code = fs.readFileSync('components/pages/quote-editor.tsx', 'utf8');
code = code.replace(/startSubmitTransition/g, 'startTransition');
fs.writeFileSync('components/pages/quote-editor.tsx', code);

// Patch lib/electron-print.ts
// Electron IPC Interface memory rule says:
// Native operations such as printing documents and exporting PDFs are orchestrated through window.electron.printDocument ...
// Note: This IPC call returns a Promise<void>, not an object with a success boolean.
code = fs.readFileSync('lib/electron-print.ts', 'utf8');
code = code.replace(
  /const result = await window\.electron\.printDocument\(htmlDoc\);\n\s+\/\/ Si la fonction retourne une promesse avec un statut\n\s+if \(result && result\.success === false\) \{\n\s+toast\.warning\("Impression annulée ou échouée\."\);\n\s+\}/,
  `await window.electron.printDocument(htmlDoc);`
);
fs.writeFileSync('lib/electron-print.ts', code);
