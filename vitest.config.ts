import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Shared tests are pure logic and run under Node. Main tests (src/main/**)
    // import bun:test + bun:sqlite and need the Bun runtime — run them with
    // `npm run test:bun` instead (see docs/migrate-to-bun.md §6).
    include: ['src/shared/**/*.test.ts'],
    environment: 'node',
    // Never load the real Electron package in tests: it downloads the binary
    // at require time when dist/ is missing and crashes workers (seen on CI).
    alias: {
      electron: fileURLToPath(new URL('./src/main/test-utils/electronMock.ts', import.meta.url))
    }
  }
})
