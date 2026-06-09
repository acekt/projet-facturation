const fs = require('fs');
const files = [
  'c:/Users/LENOVO/Downloads/fintech-invoicing-app/tests/integration/quotes-rbac.test.ts',
  'c:/Users/LENOVO/Downloads/fintech-invoicing-app/tests/integration/financial-flow.test.ts',
  'c:/Users/LENOVO/Downloads/fintech-invoicing-app/tests/integration/rbac-limits.test.ts'
];
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/'draft'/g, "'EN_ATTENTE'").replace(/'invoiced'/g, "'CONVERTI'");
  fs.writeFileSync(f, content);
});
console.log('Fixed');
