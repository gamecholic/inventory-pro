import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Standalone renderer server for Playwright (dev:renderer). Not used for packaging.
export default defineConfig({
  root: 'src/renderer',
  resolve: {
    alias: {
      '@': resolve('src/renderer'),
      '@shared': resolve('src/shared')
    }
  },
  plugins: [react(), tailwindcss()]
})
