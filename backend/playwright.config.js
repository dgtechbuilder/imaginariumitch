import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:3000',
  },
  reporter: [['list']],
  timeout: 60_000,
  projects: [
    {
      name: 'api',
      testMatch: 'api.spec.js',
    },
    {
      name: 'sentry',
      testMatch: 'sentry.spec.js',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
