const fs = require('fs');
const file = 'lib/store.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  '      setDashboardMetrics: (dashboardMetrics) => set({ dashboardMetrics }),\n      setUser: (user) => {',
  '      setDashboardMetrics: (dashboardMetrics) => set({ dashboardMetrics }),\n      /**\n       * @function setUser\n       * @description Met à jour l\'utilisateur connecté et ses permissions associées.\n       */\n      setUser: (user) => {'
);

// also remove the wrongly added JSDoc in the previous attempt (it might have replaced the wrong one)
content = content.replace(
  '      /**\n       * @function setUser\n       * @description Met à jour l\'utilisateur connecté et ses permissions associées.\n       */\n      /**\n       * @function setUser\n       * @description Met à jour l\'utilisateur connecté et ses permissions associées.\n       */\n      setUser: (user) => {',
  '      /**\n       * @function setUser\n       * @description Met à jour l\'utilisateur connecté et ses permissions associées.\n       */\n      setUser: (user) => {'
);

fs.writeFileSync(file, content);
console.log('patched2');
