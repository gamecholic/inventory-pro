/**
 * Wraps dist/app into the per-user installer.
 * Requires Inno Setup 6: winget install JRSoftware.InnoSetup
 */
import { $ } from 'bun'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')) as { version: string }

const isccCandidates = [
  join(process.env.ProgramFiles ?? process.env.PROGRAMFILES ?? '', 'Inno Setup 6', 'ISCC.exe'),
  join(process.env['ProgramFiles(x86)'] ?? '', 'Inno Setup 6', 'ISCC.exe'),
  // winget installs per-user by default (no admin).
  join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Inno Setup 6', 'ISCC.exe')
]
const iscc = isccCandidates.find((path) => existsSync(path))
if (!iscc) {
  throw new Error('Inno Setup 6 not found. Install it with: winget install JRSoftware.InnoSetup')
}

const sourceDir = join(root, 'dist/app')
if (!existsSync(join(sourceDir, 'Inventory Pro.exe'))) {
  throw new Error('dist/app is missing. Run: npm run app:build')
}

const outputDir = join(root, 'dist/installer')
const iconPath = join(root, 'packaging/icon.ico')
console.log(`packaging Inventory Pro ${pkg.version}`)

const iconArg = existsSync(iconPath) ? [`/DIconFile=${iconPath}`] : []
await $`${iscc} /Q /DAppVersion=${pkg.version} /DSourceDir=${sourceDir} /DOutputDir=${outputDir} ${iconArg} packaging/inventory-pro.iss`

const installer = join(outputDir, `Inventory-Pro-Setup-${pkg.version}.exe`)
console.log(`installer: ${installer} (${(statSync(installer).size / 1024 / 1024).toFixed(1)} MB)`)
