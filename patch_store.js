const fs = require('fs');
const file = 'lib/store.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove settings from partialize
content = content.replace(
  '        settings: state.settings,\n        viewFormat: state.viewFormat,',
  '        viewFormat: state.viewFormat,'
);

// 2. Add JSDoc to setUser
content = content.replace(
  '      setUser: (user) => {',
  '      /**\n       * @function setUser\n       * @description Met à jour l\'utilisateur connecté et ses permissions associées.\n       */\n      setUser: (user) => {'
);

fs.writeFileSync(file, content);
console.log('patched');
