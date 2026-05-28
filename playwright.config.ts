import { defineConfig } from '@playwright/test';

const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4000',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    viewport: {
      width: 1440,
      height: 900,
    },
  },
  webServer: {
    command: 'npm run dev:dashboard',
    url: 'http://127.0.0.1:4000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    isCi
      ? {
          name: 'chromium',
          use: {
            browserName: 'chromium',
          },
        }
      : {
          name: 'msedge',
          use: {
            channel: 'msedge',
          },
        },
  ],
});
