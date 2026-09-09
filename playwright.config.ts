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
const READ_ONLY_PORT = ports.pagesReadOnly

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
    {
      name: 'chromium',
      testIgnore: /published\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    { name: 'mobile', testIgnore: /published\.spec\.ts/, use: { ...devices['Pixel 7'] } },
    {
      // The bundle as GitHub Pages serves it: read-only, no write controls.
      name: 'published',
      testMatch: /published\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${READ_ONLY_PORT}${BASE}` },
    },
  ],
  webServer: [
    {
      command: `npm run build:e2e && node scripts/serve-static.mjs --dir dist-e2e --base ${BASE} --port ${PORT}`,
      url: `http://localhost:${PORT}${BASE}`,
      // NEVER reuse a running server. The command below rebuilds the bundle, so
      // reusing one would skip that build and silently test STALE code — which is
      // exactly how a "my change did nothing" bug hides. Rebuilding costs ~1s.
      reuseExistingServer: false,
      timeout: 240_000,
    },
    {
      // VITE_READ_ONLY forces the published experience; serving on localhost
      // would otherwise be treated as the commissioner's own machine.
      command: `VITE_READ_ONLY=true npm run build:e2e:readonly && node scripts/serve-static.mjs --dir dist-e2e-readonly --base ${BASE} --port ${READ_ONLY_PORT}`,
      url: `http://localhost:${READ_ONLY_PORT}${BASE}`,
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
})
