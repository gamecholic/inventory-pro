import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  use: {
    baseURL: 'http://localhost:5173'
  },
  webServer: {
    command: 'npm run dev:renderer',
    port: 5173,
    // Never reuse: a squatter serves stale code and tests pass against the wrong build.
    reuseExistingServer: false
  }
})
