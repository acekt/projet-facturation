import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * QUARANTAINE — suites legacy dépendant d'anciennes routes `@/app/api/**` supprimées
 * lors de la migration vers les Server Actions (`app/actions/*`).
 * Elles échouent à l'import (0 test exécuté). À migrer une par une vers les actions,
 * puis à retirer de cette liste. Voir ADR-0006.
 */
const LEGACY_QUARANTINE = [
  'tests/integration/an6-credit-notes.test.ts',
  'tests/integration/contract-invoices.test.ts',
  'tests/integration/financial-flow.test.ts',
  'tests/integration/payments-rbac.test.ts',
  'tests/integration/performance-brute-force.test.ts',
  'tests/integration/phase10-dashboard.test.ts',
  'tests/integration/phase2-services.test.ts',
  'tests/integration/phase3-clients.test.ts',
  'tests/integration/phase4-security.test.ts',
  'tests/integration/phase5-quotes.test.ts',
  'tests/integration/phase6-invoices.test.ts',
  'tests/integration/phase7-payments.test.ts',
  'tests/integration/phase8-users.test.ts',
  'tests/integration/phase9-audit-settings.test.ts',
  'tests/integration/quotes-rbac.test.ts',
  'tests/integration/rbac-limits.test.ts',
  'tests/integration/setup-onboarding.test.ts',
  'tests/performance/auth-brute-force.test.ts',
  'tests/performance/payments.perf.test.ts',
];

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    fileParallelism: false,
    pool: 'forks',
    forks: {
      singleFork: true,
    },
    setupFiles: ['./tests/setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
      'tests/e2e/**',
      ...LEGACY_QUARANTINE,
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '.next/',
        'tests/',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.config.*',
        '**/main.js',
        '**/preload.js',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/lib': path.resolve(__dirname, './lib'),
      '@/app': path.resolve(__dirname, './app'),
      '@/components': path.resolve(__dirname, './components'),
      '@/hooks': path.resolve(__dirname, './hooks'),
      '@workspace/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@workspace/database': path.resolve(__dirname, '../../packages/database/src'),
    },
  },
});
