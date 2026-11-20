import { defineConfig } from '@playwright/test'

/**
 * E2E tests boot a real, isolated Bun server per spec file (see e2e/fixtures.ts)
 * on a random port with a throwaway SQLite DB. No Electron, no shared DB, no
 * `webServer` — the fixture owns the app lifecycle so parallel spec files can
 * never see each other's data.
 *
 * Requires a renderer build first — `npm run test:e2e` chains
 * `npm run build:web && playwright test` explicitly. Do not run
 * `npx playwright test` directly from a clean clone.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  }
})
