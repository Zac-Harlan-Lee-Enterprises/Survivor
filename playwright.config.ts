import { defineConfig, devices } from '@playwright/test'
import ports from './build/ports.json' with { type: 'json' }

/**
 * Critical-path tests run against the PRODUCTION build served under a
 * repository subpath (/Survivor/) by scripts/serve-static.mjs, which mimics
 * GitHub Pages exactly: static files only, real 404s (with 404.html) for
 * unknown paths, no SPA fallback. If the app works here, it works on Pages.
 */
const BASE = '/Survivor/'
const PORT = ports.pages

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORT}${BASE}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npm run build:e2e && node scripts/serve-static.mjs --dir dist-e2e --base ${BASE} --port ${PORT}`,
    url: `http://localhost:${PORT}${BASE}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
})
