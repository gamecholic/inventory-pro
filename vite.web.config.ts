import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const COMPRESSIBLE_EXTS = new Set(['.js', '.css', '.html', '.json', '.svg', '.mjs', '.webmanifest'])

/** Emit web/sw.js from the renderer template with the release id baked in, so
 *  each release installs a fresh cache and drops the previous one. */
function pwaServiceWorker(): Plugin {
  let outDir = ''
  return {
    name: 'pwa-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf-8')) as { version: string }
      const template = readFileSync(resolve('src/renderer/pwa/sw.js'), 'utf-8')
      writeFileSync(join(outDir, 'sw.js'), template.replaceAll('__BUILD_ID__', pkg.version))
    }
  }
}

/** Emit .br/.gz twins of every compressible asset so server/index.ts can
 *  content-negotiate without re-compressing per request (low-end CPU win). */
function compressAssets(): Plugin {
  let outDir = ''
  return {
    name: 'compress-assets',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const walk = (dir: string): void => {
        for (const entry of readdirSync(dir)) {
          const full = join(dir, entry)
          const stat = statSync(full)
          if (stat.isDirectory()) {
            walk(full)
            continue
          }
          const ext = extname(full).toLowerCase()
          if (!COMPRESSIBLE_EXTS.has(ext)) continue
          const data = readFileSync(full)
          writeFileSync(`${full}.gz`, gzipSync(data, { level: 9 }))
          writeFileSync(`${full}.br`, brotliCompressSync(data, { quality: 11 }))
        }
      }
      walk(outDir)
    }
  }
}

// Bun build: the renderer is a plain static site served by server/index.ts.
// Same root/aliases as the Electron renderer, different outDir and base.
export default defineConfig({
  root: 'src/renderer',
  base: '/',
  resolve: {
    alias: {
      '@': resolve('src/renderer'),
      '@shared': resolve('src/shared')
    }
  },
  plugins: [react(), tailwindcss(), pwaServiceWorker(), compressAssets()],
  build: {
    chunkSizeWarningLimit: 900,
    outDir: resolve('out/web'),
    emptyOutDir: true
  }
})
