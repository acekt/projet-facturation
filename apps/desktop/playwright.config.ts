import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import os from 'os';

const testDbPath = path.join(os.tmpdir(), 'fintech-invoicing-e2e-test.sqlite');
process.env.TEST_DB_PATH = testDbPath;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120000,
  expect: {
    timeout: 30000,
  },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { outputFolder: 'tests/artifacts/report' }]],
  use: {
    baseURL: 'http://localhost:3050',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 800 },
    actionTimeout: 20000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'admin',
      testMatch: /admin\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: './tests/e2e/.auth/adminState.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'operator',
      testMatch: /operator\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: './tests/e2e/.auth/operatorState.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'other-tests',
      testMatch: /.*\.spec\.ts/,
      testIgnore: [/admin\.spec\.ts/, /operator\.spec\.ts/],
      use: {
        ...devices['Desktop Chrome'],
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'node scripts/prepare-standalone.js && node .next/standalone/server.js',
    url: 'http://localhost:3050/login',
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      PORT: '3050',
      TEST_DB_PATH: testDbPath,
      DB_FILE_NAME: 'test.sqlite',
      SESSION_SECRET: 'super-secret-key-for-playwright-e2e-tests-32-chars!!',
      PASSWORD_SALT: 'facturier-gabon-2026',
      NODE_ENV: 'test',
    },
  },
});
