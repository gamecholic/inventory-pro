/**
 * Builds the shippable app folder: windowless exe + renderer + migrations.
 *
 *   dist/app/
 *     Inventory Pro.exe
 *     web/          (renderer build)
 *     drizzle/      (migrations, read at startup)
 */
import { $ } from 'bun'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')) as { version: string }

const outDir = join(root, 'dist/app')
const exePath = join(outDir, 'Inventory Pro.exe')
const iconPath = join(root, 'packaging/icon.ico')

console.log(`building Inventory Pro ${pkg.version}`)
rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

// 1. Renderer (served from <app>/web).
await $`npx vite build --config vite.web.config.ts`

// 2. Single windowless exe. --windows-version wants four parts.
// Spawned with an argv array (not the `$` shell) because the --define value
// contains quotes, which cmd.exe mangles.
const buildArgs = [
  'build',
  '--compile',
  '--target=bun-windows-x64',
  '--tsconfig-override',
  './tsconfig.bun.json',
  '--windows-hide-console',
  '--windows-title',
  'Inventory Pro',
  '--windows-description',
  'Offline inventory, POS, expenses and reports for a single shop',
  '--windows-version',
  `${pkg.version}.0`,
  '--define',
  `INVENTORY_VERSION="${pkg.version}"`,
  ...(existsSync(iconPath) ? ['--windows-icon', iconPath] : []),
  'server/boot.ts',
  '--outfile',
  exePath
]
if (!existsSync(iconPath)) console.log('note: packaging/icon.ico not found, building without a custom icon')

const build = Bun.spawn([process.execPath, ...buildArgs], { cwd: root, stdout: 'inherit', stderr: 'inherit' })
const buildCode = await build.exited
if (buildCode !== 0) throw new Error(`bun build failed with exit code ${buildCode}`)

// 3. Assets the server reads at runtime.
cpSync(join(root, 'out/web'), join(outDir, 'web'), { recursive: true })
cpSync(join(root, 'drizzle'), join(outDir, 'drizzle'), { recursive: true })

const sizeMb = (path: string): string => `${(statSync(path).size / 1024 / 1024).toFixed(1)} MB`

console.log(`\nexe:   ${exePath} (${sizeMb(exePath)})`)
console.log(`app:   ${outDir}`)
