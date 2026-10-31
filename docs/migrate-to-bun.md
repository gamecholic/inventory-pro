# Migrating inventory-pro to Bun

Status: **working local preview**. The renderer, all 8 pages, the SQLite schema,
analytics, Excel backup and import run on a Bun HTTP server with no Electron.
This document is the map: what changed, what will bite you, and what is still
missing before this can ship.

Owner decision still open: the shell/updater sections of `docs/architecture.md`
§1 describe Electron and are now wrong. Update them when this stops being a
prototype (see §9).

---

## 1. Why, in numbers

Measured on the same machine, same app, idle with the dashboard open.

| | Electron (today) | Bun preview |
|---|---|---|
| Processes | 4 (main, renderer, GPU, network) | 1 |
| Working set | 429 MB | **74.6 MB** |
| Private / commit | 249 MB | 267 MB |
| Renderer JS bundle | 1.39 MB | 1.39 MB (405 KB gzip) |

Working set is the number that matters on the 2 GB target. The commit figure
looks worse than Electron's because JSC reserves heap up front; verify it on
the device before trusting either number:

```powershell
Get-CimInstance Win32_OperatingSystem | Select-Object @{n='FreeGB';e={[math]::Round($_.FreePhysicalMemory/1MB,2)}}
```

Add the Chrome tab (60–90 MB) to the server figure when budgeting.

---

## 2. Running it

```powershell
npm i -g bun            # or: winget install Oven-sh.Bun
npm run bun:preview     # builds the renderer, then serves it
```

Open http://127.0.0.1:5178.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5178` | HTTP port (bound to 127.0.0.1 only) |
| `INVENTORY_DATA_DIR` | `%APPDATA%\Inventory Pro` | Database + uploads + backups |
| `WEB_ROOT` | `out/web` | Renderer build to serve |
| `INVENTORY_DRIZZLE_DIR` | `<cwd>/drizzle` | Migration SQL folder |

By default it opens **the same `inventory.db` as the Electron app**, which is
the quickest way to prove parity. Set `INVENTORY_DATA_DIR` to a temp folder
for a throwaway instance.

---

## 3. Shape of the port

```
Chrome tab (React)
  window.api.sales.list(...)
        │  src/renderer/lib/http-api.ts      fetch
        ▼
server/index.ts    POST /api/sales:list
        │  handler lookup (Map<channel, fn>)
        ▼
src/main/ipc/sales.ts      ← UNCHANGED
        │  ipcMain.handle registered into the shim
        ▼
src/main/db/*.ts           ← UNCHANGED apart from client.ts
        ▼
bun:sqlite  →  %APPDATA%\Inventory Pro\inventory.db
```

The renderer never learns that IPC is gone: `window.api` keeps its exact shape,
so no page, hook, form or chart changed.

### Files

| File | Status | What |
|---|---|---|
| `src/shared/api-surface.ts` | **new** | `createApi(invoke)` — the API object, transport-agnostic |
| `src/preload/index.ts` | removed (Electron retired) | renderer now uses `src/renderer/lib/http-api.ts` only |
| `src/renderer/lib/http-api.ts` | **new** | binds `createApi` to `fetch`, installs `window.api` |
| `src/renderer/main.tsx` | +1 import | installs the transport before React mounts |
| `server/electron.ts` | **new** | `app` / `ipcMain` / `dialog` / `shell` shim |
| `server/index.ts` | **new** | Bun.serve: `/api/<channel>`, static files, uploads |
| `src/main/db/client.ts` | edited | `bun:sqlite` driver, migration path |
| `src/main/db/{categories,expenses,products,sales,suppliers}.ts` | edited | `RETURNING` instead of `lastInsertRowid` |
| `vite.web.config.ts` | **new** | renderer build → `out/web` |
| `tsconfig.bun.json` | **new** | `electron` → shim, for the Bun runtime + editor |
| `tsconfig.node.json` | edited | added `bun` to `types` |
| `package.json` | edited | `bun:start`, `bun:preview`, `@types/bun` |

`src/main/ipc/*.ts` (except the updater) are **untouched**. That is the whole
argument for this path over a Go rewrite.

---

## 4. The five edits that made it work

**1. One API definition, two transports.** `src/shared/api-surface.ts` holds
the object that used to live in preload. `Invoke` is the only seam:

```ts
export type Invoke = <T>(channel: Channel, payload?: unknown) => Promise<T>
export function createApi(invoke: Invoke) { /* every method */ }
```

Preload passes `ipcRenderer.invoke`; the browser passes `fetch`. Argument
shaping (`update(id, input)` → `{ ...input, id }`) stays in one place, so both
transports send identical payloads.

**2. The `electron` shim.** `src/main/db/*` and `src/main/ipc/*` import `app`,
`ipcMain`, `dialog`, `shell`. `server/electron.ts` provides those four;
`tsconfig.bun.json` maps the module name onto it. No source file changed.

```ts
export const handlers = new Map<string, Handler>()
export const ipcMain = { handle: (c, fn) => handlers.set(c, fn) }
export const app = { getPath: () => dataDir(), getVersion: () => version, isPackaged: false }
```

**3. Channels become routes.** `server/index.ts` registers the existing
`register*Ipc()` functions, then serves the map:

```ts
const channel = decodeURIComponent(pathname.slice('/api/'.length))
const result = await handlers.get(channel)!(undefined, payload)
return Response.json(result ?? null)
```

Zod still validates inside each handler, exactly as before. A `ZodError`
becomes 400 with the first issue message; anything else becomes 500 with the
message, which the renderer already displays.

**4. `better-sqlite3` → `bun:sqlite`.** Four lines in `client.ts`:

```ts
import { Database } from 'bun:sqlite'
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'

handle.exec('PRAGMA journal_mode = WAL')   // not handle.pragma(...)
```

Schema and `drizzle/*.sql` migrations are unchanged. `transaction`,
`prepare`, `run`, `all`, `get`, `close` all exist on `bun:sqlite`.

**5. `lastInsertRowid` → `RETURNING`.** Drizzle's Bun driver types `.run()` as
`void`, so six call sites broke:

```ts
// before
.run().lastInsertRowid as number
// after
.returning({ id: categories.id }).get()!.id
```

Works on both drivers, and the type is real instead of a cast.

---

## 5. Gotchas (each one cost time)

- **Bun ignores `paths` from a non-default tsconfig.** `bun run server/index.ts`
  resolves `electron` from `node_modules/electron` and dies with
  `Export named 'app' not found`. Fix: `--tsconfig-override ./tsconfig.bun.json`
  (already in `bun:start`). Do **not** put the alias in the root
  `tsconfig.json` — it breaks the Electron typecheck.
- **`Bun.plugin` + `--preload` did not intercept the bare specifier.** Tried,
  removed. Don't spend time on it.
- **`migrationsPath()`** used `join(__dirname, '../../drizzle')`, which is
  correct for `out/main` and wrong when running from source. It now falls back
  to `<cwd>/drizzle`.
- **`@types/bun` must be a devDependency** and `tsconfig.node.json` needs
  `"bun"` in `types`, or `bun:sqlite` won't resolve for `tsc`.
- **Native dialogs have no server equivalent.** `backup:*` and `db:select-dir`
  routes are overridden in `server/index.ts`. Exports write a timestamped file
  into the backup folder; imports receive a path from an uploaded file.
- **`dialog`/`shell` in the shim are deliberately inert.** If you reach them
  it means a route was not overridden — that is a bug, not a fallback.

---

## 6. Not done yet (in the order I'd do it)

1. **Tests.** ~~Done~~ — migrated to `bun:sqlite` + `bun:test`; `npm run test:bun` green (81 tests). `npm run typecheck` is now clean.
2. ~~**Folder pickers.**~~ Done — see §10.
3. **Updater.** `updater:*` are stubs. Implement check → stage → apply-at-boot
   from `docs/updater.md`. Acceptance: a newer `latest.json` produces the card
   and the swap happens on the next start.
4. **Packaging.** ~~Done~~ — see §9.
5. **Backup on close.** Dropped — auto-backup (hourly) is the chosen mechanism.
6. **Printing.** Not implemented in the Electron app either (only i18n strings
   exist), so nothing to port. When it lands, `window.print()` in the tab plus
   Chrome's `--kiosk-printing`.
7. **Docs.** `architecture.md` §1 (shell, updater, packaging) and §3 (preload
   contract) describe Electron and are now stale.

---

## 7. Verification

```powershell
npm run build:web                 # must emit out/web
npm run bun:start                 # then hit the URL
npx tsc --noEmit -p tsconfig.web.json   # expect: clean
npx tsc --noEmit -p tsconfig.node.json  # expect: only the 3 test files
```

Smoke test through the API (no UI needed):

```powershell
$b = 'http://127.0.0.1:5178/api'
function Call($c, $p) { Invoke-RestMethod "$b/$c" -Method Post -ContentType application/json -Body (@{payload=$p} | ConvertTo-Json -Depth 10 -Compress) }
Call 'settings:get' @{}
Call 'categories:create' @{ name = 'Beverages'; description = '' }
Call 'analytics:inventory-overview' @{}
Call 'backup:export-excel' $null
```

A full pass should show: dashboard charts, POS product grid and checkout,
sales history, all 15 report tabs, settings save, Excel export written to
`<data dir>\backups\`.

---

## 8. Rollback

The Electron build no longer compiles from this tree: `client.ts` imports
`bun:sqlite`, so `npm run build` fails. The two builds cannot coexist without a
driver switch.

To roll back, revert the files in §3 — nothing in `src/renderer/pages`,
`src/shared/*` (except the new `api-surface.ts`), `src/main/ipc/*` or
`drizzle/` changed, so the revert is small and the database is untouched.

---

## 9. Packaging (done)

Two commands, no environment variables:

```powershell
npm run app:build       # dist/app: exe + web/ + drizzle/
npm run app:installer   # dist/installer/Inventory-Pro-Setup-<version>.exe
```

`app:installer` runs `app:build` first. Requires Inno Setup 6
(`winget install JRSoftware.InnoSetup`); `scripts/build-installer.ts` finds it
under `Program Files`, `Program Files (x86)` or `%LOCALAPPDATA%\Programs`.

**Layout.** The exe is not self-contained on purpose: `server/boot.ts` reads
`web/` and `drizzle/` next to `process.execPath`. Embedding them with
`Bun.embeddedFiles` was rejected because Bun then unpacks to `%TEMP%` on first
run, which is exactly the eMMC startup cost this port exists to avoid. The
installer already copies files, so there is nothing to gain.

```
%LOCALAPPDATA%\Programs\Inventory Pro\
  Inventory Pro.exe     112.2 MB (109.9 MB of it the Bun runtime)
  web\                  1.4 MB
  drizzle\              109 KB
  unins000.exe
```

**Installer.** Per-user (`PrivilegesRequired=lowest`), no UAC, no admin. It
creates a desktop shortcut, a Start Menu entry and an `HKCU\...\Run` value
(autostart is a task, checked by default, remembered across upgrades). The
`AppId` is fixed so an upgrade replaces the previous install in place.
Uninstalling removes the program files and **never** `%APPDATA%\Inventory Pro`,
where the shop database lives.

**Updating.** The installer is the update: it already knows how to replace a
running app.

```powershell
Inventory-Pro-Setup-1.3.4.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /FORCECLOSEAPPLICATIONS
```

`/FORCECLOSEAPPLICATIONS` is required � without it Inno refuses to close the
running server and exits with code 5. Silent installs do not relaunch the app
(`skipifsilent`), so whatever triggers the update must start the exe again
afterwards.

**Version.** The compiled exe has no `package.json`, so `scripts/build-app.ts`
bakes the version in with `--define INVENTORY_VERSION="x.y.z"`;
`server/boot.ts` exports it as `INVENTORY_VERSION` for `app.getVersion()`.
Windows file-version metadata gets the same value with a fourth `.0` part.

**Icon.** Drop a 256�256 `packaging/icon.ico` in and the build picks it up
automatically; without it the exe keeps the default Bun icon. The repository has
multi-resolution icon (16/24/32/48/64/128/256) generated from the user-supplied Adsiz.ico.

**Measured** (this machine, installed copy, dashboard open):

| | Value |
|---|---|
| Server process | 1, 54 MB working set / 177 MB private |
| Installer download | 42.0 MB (lzma2 over the 112 MB exe) |
| Install folder | 118 MB |

Startup: ~1 s to first response; the window opens in the Chrome process that is
already running, so no second browser engine is loaded.

**Verified end to end:** silent install � shortcuts and autostart � double-click
opens the window � second double-click reuses the running server (no second
port, no second process) � closing the window and reopening works � silent
upgrade over the running app exits 0 and the new version serves.

**Not done:** the updater itself (`updater:*` still stubs), and code signing �
without an Authenticode certificate SmartScreen warns on the first install.

---

## 10. Native dialogs (done)

A browser cannot hand a server an absolute path: `<input type=file>` uploads the
bytes, and `showDirectoryPicker()` returns an opaque handle. That made three
things impossible in the first port � Save As on export, Open on import, and the
Browse buttons in Settings.

The answer is that this server runs on the user's machine, so it can raise the
dialog itself. `server/dialogs.ts` spawns PowerShell with a WinForms dialog and
returns the chosen path; the channels keep the exact Electron contract
(`string | null`).

```ts
showNativeDialog({ kind: 'save', title: 'Export JSON backup', path, filters })
showNativeDialog({ kind: 'open',   title: 'Import JSON backup', path, filters })
showNativeDialog({ kind: 'folder', title: 'Choose backup folder', path })
```

Wiring lives in `server/index.ts`; `src/renderer/lib/http-api.ts` is back to a
plain POST shim, and the `/api/upload` endpoint plus the `uploads/` folder are
gone.

**Details that matter**

- The script is passed with `-EncodedCommand` (base64 UTF-16LE), so no quoting
  layer can mangle a Turkish path. Output is read as UTF-8; `���`/`����`
  round-trip byte for byte.
- `FolderBrowserDialog` and the modern shell dialogs are separate windows owned
  by the PowerShell process. They open *behind* the Chrome app window by
  default, which looks like a dead button. A WinForms `Timer` (it keeps ticking
  during the modal loop) finds the dialog by title and applies
  `SetWindowPos(HWND_TOPMOST)` + `SetForegroundWindow` once.
- Do not add an invisible owner form to force z-order: it also drags the dialog
  into a screen corner.
- Folder selection uses `FolderBrowserDialog`, which is the classic tree dialog
  on .NET Framework 4.8 (Windows 10 has no modern folder picker there). File
  selection uses the modern shell dialog.
- Cancelling exits 0 with empty stdout � `null`. A non-zero exit throws, so the
  UI shows a toast instead of silently doing nothing.
- Windows only; `showNativeDialog` throws elsewhere. This app is Windows only.

**Verified:** Save As writes the backup to the chosen path (766-byte JSON,
correct shape), cancel returns `null`, Unicode paths survive, and the dialog is
foreground when it appears.
