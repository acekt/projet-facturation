const fs = require('fs');
const file = 'components/pages/protected-app-shell.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add import for UserResponse
content = content.replace(
  'import { DataSync } from "@/components/data-sync"',
  'import { DataSync } from "@/components/data-sync"\nimport type { UserResponse } from "@/lib/api/types"'
);

// 2. Fix 'any' to 'UserResponse'
content = content.replace(
  'interface ProtectedAppShellProps {\n  initialUser: any\n}',
  'interface ProtectedAppShellProps {\n  initialUser: UserResponse\n}'
);

// 3. Fix loading state & flicker
content = content.replace(
  /const \[initTimeout[\s\S]*?if \(\!isDataLoaded\) {[\s\S]*?return \([\s\S]*?<\/div>\n    \)\n  }/,
  `if (!isDataLoaded) {
    return (
      <div className="h-screen bg-background overflow-hidden flex flex-col">
        <DataSync />
        <Sidebar
          currentPage={currentPage}
          onPageChange={() => {}}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <TopBar collapsed={sidebarCollapsed} onCommandOpen={() => {}} />
        <motion.main
          initial={false}
          animate={{ marginLeft: sidebarCollapsed ? 72 : 260 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="h-screen pt-16 flex flex-col overflow-hidden relative"
        >
          <AnimatePresence mode="wait">
             <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 flex flex-col items-center justify-center bg-background z-50"
              >
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="mt-4 text-sm text-muted-foreground font-medium">Initialisation des modules locaux...</p>
              </motion.div>
          </AnimatePresence>
        </motion.main>
      </div>
    )
  }`
);

fs.writeFileSync(file, content);
console.log('patched');
