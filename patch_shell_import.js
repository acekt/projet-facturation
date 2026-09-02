const fs = require('fs');
const file = 'components/pages/protected-app-shell.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix wrong import path for UserResponse
content = content.replace(
  'import type { UserResponse } from "@/lib/api/types"',
  'import type { UserResponse } from "@/lib/types/api"'
);

fs.writeFileSync(file, content);
console.log('patched_import');
