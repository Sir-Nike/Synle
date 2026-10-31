import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3195',
    headless: true,
    launchOptions: {
      executablePath: process.env.BROWSER_PATH || '/usr/bin/brave-browser',
    },
    trace: 'retain-on-failure',
  },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'test-results/browser-report' }],
  ],
  outputDir: 'test-results/browser',
  webServer: {
    command:
      'npm run build && node --import tsx scripts/browser-test-server.ts',
    url: 'http://localhost:3195/api/health',
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      PORT: '3195',
      SYNLE_BROWSER_TEST: 'yes',
      NODE_ENV: 'production',
      SESSION_SECRET: 'browser-test-only-secret-longer-than-32-characters',
      SQLITE_PATH: ':memory:',
      DATABASE_URL: '',
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
      PUBLIC_URL: 'http://localhost:3195',
    },
  },
});
