import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/shared/**/*.test.ts', 'src/main/**/*.test.ts'],
    environment: 'node',
    // Never load the real Electron package in tests: it downloads the binary
    // at require time when dist/ is missing and crashes workers (seen on CI).
    alias: {
      electron: fileURLToPath(new URL('./src/main/test-utils/electronMock.ts', import.meta.url))
    }
  }
})
