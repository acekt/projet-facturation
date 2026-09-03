const fs = require('fs');
const file = 'components/pages/protected-app-shell.tsx';
let content = fs.readFileSync(file, 'utf8');

// The store typings expect User (which might be just a partial of UserResponse)
// So let's look at what store.ts expects
content = content.replace(
  'import type { UserResponse } from "@/lib/types/api"',
  '// No specific import needed if we use Partial<UserResponse> or any for now since initialUser is just a basic object from app/page.tsx'
);
content = content.replace(
  'initialUser: UserResponse',
  'initialUser: { id: string; name: string; role: "admin" | "user"; [key: string]: any }'
);

fs.writeFileSync(file, content);
console.log('patched_import2');
