import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Standalone renderer server for Playwright (dev:renderer). Not used for packaging.
// Also used by server/boot.ts (bun:start HMR): Bun serves /api, Vite serves UI
// live and proxies /api to Bun, giving real HMR from a single `npm run bun:start`.
export default defineConfig({
  root: 'src/renderer',
  resolve: {
    alias: {
      '@': resolve('src/renderer'),
      '@shared': resolve('src/shared')
    }
  },
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        // boot.ts passes PORT=actual Bun port so this stays correct even when
        // 5178 is taken and Bun picks the next free port.
        target: `http://127.0.0.1:${process.env.PORT ?? 5178}`,
        changeOrigin: true
      }
    }
  }
})
