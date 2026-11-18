# Architecture — inventory-pro

Status: [DECIDED] = agreed, not locked. [OPEN] = needs decision.

## 1. Stack

- [DECIDED] Shell: Bun single-process server on Windows. `server/boot.ts` is
  compiled by `scripts/build-app.ts` into the windowless `Inventory Pro.exe`
  (Bun runtime, icon and version baked in); it serves the built renderer and
  the API on `127.0.0.1:5178` (tries 5178–5188 for a free port) and opens the
  app in a Chrome/Edge tab (`--new-tab`, default-browser fallback). With
  Network access (LAN) enabled it binds `0.0.0.0` on the same port instead of
  loopback (features §1.11). Inno Setup builds the per-user installer
  (`scripts/build-installer.ts`, `packaging/inventory-pro.iss`) into
  `%LOCALAPPDATA%\Programs\Inventory Pro`. Electron is fully removed from the
  tree; Linux is not currently shipped.
- [DECIDED] Updates: installer-based (`server/updater.ts`). The app polls the
  latest GitHub Release on launch, downloads the `Setup*.exe` asset and verifies
  its SHA-256 from the release's `checksums.txt` before executing it (a release
  without a checksum entry is refused). The installer runs silently and
  relaunches the app from its `[Run]` entry gated on `INVENTORY_RELAUNCH`; the
  successor keeps the old port and opens no second tab. The previous exe is
  kept as `<exe>.old` for rollback until the next launch deletes it. Releases
  are cut by `.github/workflows/release.yml` (version bump, typecheck,
  `test:bun`, installer, checksums, tag + Release assets). Download progress is
  polled from the server; `scripts/mock-updater-server.mjs` +
  `INVENTORY_UPDATE_API_URL` provide a local update endpoint for testing.
- [DECIDED] Frontend: Vite + React + TypeScript + React Router (8 routes, lazy
  loaded with a skeleton fallback) + Zustand (ephemeral: cart, selection,
  filters, restart/updater UI) + TanStack Query over HTTP (query keys per
  page/filter, invalidate on mutations). The renderer calls `window.api.*`,
  installed by `renderer/lib/http-api.ts`, which POSTs `/api/<channel>`. i18n
  en/tr; theme by next-themes (class on `<html>`, choice in Settings > General).
- [DECIDED] DB: SQLite file per shop via `bun:sqlite`, Drizzle ORM + migrations
  run at boot. WAL, `synchronous=NORMAL`, 8 MB page cache, 64 MB mmap,
  `temp_store=MEMORY`, `busy_timeout=5000`. Sale completion = one transaction
  (insert sale + lines, decrement stock). Cost-averaging (§5.3) and all
  analytics are computed server-side. Migration `0008` adds the reporting
  indexes (expenses date, products archived_at, sale_items product,
  sales status+created_at, stock_adjustments created_at).
- [DECIDED] PWA: `renderer/public/manifest.webmanifest` + generated `web/sw.js`
  (from `renderer/pwa/sw.js`, cache id = package version, written by
  `vite.web.config.ts`). The worker caches the app shell and hashed
  `assets/`, never `/api/*`; navigation is network-first so renderer rebuilds
  are picked up even without a version bump. `registerServiceWorker()` runs in
  production builds only and only in a secure context — true for
  `127.0.0.1`, false for plain-HTTP LAN access, so LAN devices get the app
  without the offline shell. iOS still honours the manifest for Add to Home
  Screen (standalone over HTTP); Android falls back to a browser shortcut.
  `components/install-hint.tsx` shows a one-time iOS Safari hint (Share → Add
  to Home Screen), stored in localStorage and hidden in standalone mode. The
  window talks to the same local server: no shop data is cached, and the Bun
  process must be running.
- [DECIDED] Validation: Zod schemas in `shared/` for forms + API payloads, both
  sides. A handler that throws `ZodError` answers 400 with the first issue;
  unknown channels 404; other failures 500 with the message.
- [DECIDED] Backup: ExcelJS + JSON dump in `main/db/` (§9.4); hourly scheduled
  Excel (`main/scheduledBackup.ts`, started by `server/boot.ts`, features
  §1.8); sidebar quick backup (§1.9); Windows-shell sync badge reader
  (`main/db/backupStatus.ts`). Import replaces data after confirm + reload. The
  old-app Excel import (`main/db/legacyExcel.ts`) maps legacy sheets/columns
  onto the same backup contract, then reuses `replaceAll()`.
- [DECIDED] Print: one HTML receipt template shared by POS (§3.11) and Sales
  History (§6.4) → `window.print()` in the browser tab; print CSS lives in
  `index.css`. No thermal printing.
- [DECIDED] Tests: `vitest` for `src/shared` + renderer libs (`npm test`);
  `bun test` for DB/server (`npm run test:bun`) against `:memory:` SQLite with
  the `electron` module aliased to `server/electron.ts` (`tsconfig.bun.json`);
  Playwright for E2E (POS sale flow first).
- [DECIDED] Dates at API boundary: every request/response carries dates as
  ISO8601 UTC strings (`z.string().datetime()`). Renderer converts Date/preset →
  ISO at the edge via `shared/dates.toISO()`; server parses/stores/filters in
  UTC and returns ISO. SQLite stores ISO text. No local-format or epoch-ms on
  the wire. This kills TZ bugs in dashboard/report/chart filters.

## 2. Layout

```
server/{boot,index,electron,updater,dialogs}.ts   Bun process: boot/serve/update,
                                                  native dialogs, electron shim
main/{autostart,scheduledBackup}.ts               Run-key sync, hourly Excel timer
main/db/{client,schema,settingsStore,analytics,movements,backup,backupStatus,
         excel,legacyExcel,categories,suppliers,products,stock,sales,expenses}.ts
main/ipc/{settings,backup,catalog,sales,expenses,analytics}.ts
                                                  register*Ipc() -> POST /api/<channel>
renderer/{main.tsx,App.tsx}                       React mount, shell, providers
renderer/lib/{http-api,restart,pwa}.ts            window.api over fetch, restart watch, SW registration
renderer/{pages,hooks,stores,components,i18n}     UI (8 pages, 5 settings tabs)
renderer/public/{manifest.webmanifest,icons/}     PWA manifest + install icons
renderer/pwa/sw.js                                service-worker template -> web/sw.js
shared/{api,api-surface,settings,products,sale,stock,normalizeTR,money,dates,
        units,analytics,backup,updater}.ts (+ *.test.ts)
scripts/{build-app,build-installer,mock-updater-server.mjs,enable-lan.*,
         server-control.bat,server-restart.bat}
packaging/{inventory-pro.iss,icon.ico}
```

Runtime files: the install folder holds `Inventory Pro.exe`, `web/`
(renderer build), `drizzle/` (migrations) and the LAN/server helper scripts.
The database, backups and `launcher.log` live in `%APPDATA%\Inventory Pro`
(overridable with `INVENTORY_DATA_DIR`). A custom database folder is remembered
in `db-location.json` beside the exe (repo root when running from source); the
pointer is only read at boot.

## 3. Separation (enforced)

- Single Bun build: `scripts/build-app.ts` compiles `server/boot.ts` → exe and
  copies `out/web/`, `drizzle/` and the helper scripts beside it. ESLint
  `no-restricted-imports` blocks renderer → `main/*`.
- Renderer never imports `main/*`, `fs`, DB or ExcelJS. All data goes through
  `window.api.*` (typed by `shared/api-surface.ts`), never `fetch` directly.
- Contracts first: channel names + Zod input schemas in `shared/api.ts`, typed
  surface in `shared/api-surface.ts`, then the handler in
  `main/ipc/<domain>.ts` (registered via the `server/electron.ts` shim in
  `server/index.ts`), then the renderer hook. No `any` across the boundary.
- HTTP: `POST /api/<channel>` with `{ payload }`; `GET /api/health` (pid,
  version — used by single-instance detection and the restart watch);
  `GET /api/network-info` (LAN IP, port, bind state, URL); `GET
  /api/backup-events` (SSE for scheduled-backup failures, 15 s heartbeat,
  idle timeout disabled in `Bun.serve`).
- Static serving: `out/web` in dev, `web/` beside the exe when packaged.
  Precompressed `.br`/`.gz` twins are content-negotiated; hashed `assets/` are
  immutable for a year, the HTML shell is `no-store`, `sw.js` and the manifest
  are `no-cache` (updates must be noticed), and unknown extension-less paths
  fall back to the SPA shell (`HashRouter`). The manifest is served as
  `application/manifest+json`.
- Settings live in a `settings` key-value table (one JSON row per section),
  merged over `shared/settings.ts` defaults. Stored legacy flags are migrated on
  read (`backupOnClose` / `autoBackup` → `scheduledBackup`, `startMaximized`
  dropped). Display prefs (language/currency/dates) are read from the
  `['settings']` TanStack Query cache.
- The server is trusted and local by default. There is no authentication by
  design; LAN access is opt-in (see §4 and §5).

## 4. Must-not-break (from features.md)

Single-user offline-first, no auth/cloud. No hold/park sale (§3.12), no bulk
product actions (§4.4), no stock history log (§5.4), no recurring
expenses/attachments (§7.2), no report CSV/print (§8.16). Receipt #
`INV-YYYYMMDD-HHmmss` + business identity + header/footer everywhere (§1.4,
§3.11).

LAN sharing (features §1.11) is the one network surface: it is off by default,
has no login, and exposes the same data to any device on the network that knows
the address. It is documented to the user and must stay opt-in.

## 5. Approved deviations and additions (owner-signed)

- Theme toggle in Settings > General (`Light` / `Dark` / `System`). The spec has
  no theme requirement; the choice is stored by next-themes, not the DB.
- Installable PWA (features §1.12): manifest, icons and an app-shell service
  worker so the app can open as a standalone window from Chrome/Edge. This is
  a packaging surface, not a second deployment: it serves the same local
  server and caches no data. A Chrome/Edge install is limited to
  `127.0.0.1`; iOS Add to Home Screen still works over the plain-HTTP LAN
  address, without the offline shell.
- Update restart overlay: installing an update stops the local server, so the
  browser tab would look frozen (the page still runs, every request fails). The
  renderer shows a full-screen overlay (indeterminate progress, restart steps,
  elapsed seconds) and a background watch polls `/api/health` until a *different*
  instance answers — then the tab reloads itself (`src/renderer/lib/restart.ts`,
  `src/renderer/components/restart-overlay.tsx`). The same watch is used for
  settings restarts (Network access / database folder): `app:restart` starts its
  own successor in-process (no helper `.bat`, no second `--restart` instance,
  no console window from the installed GUI exe) and then shuts down gracefully
  after the HTTP answer. The relaunch comes back on the same port and opens no
  second tab: the successor gets `INVENTORY_RELAUNCH=1` + `INVENTORY_RELAUNCH_PORT`
  (from `server/index.ts` for a restart, from the installer's `[Run]` entry for
  an install — `server/updater.ts` passes them to Setup.exe), and
  `server/boot.ts` honours them.
- Reports: extra insight reports beside the spec's 5 (§8) — reorder, dead stock,
  basket, discounts, card fees, frequently bought together, low margin, stock
  value by category/supplier, and year-over-year (own year picker; revenue and
  profit per month against the same months of the previous year, plus totals).
  The full list and groups are features §8.6–§8.15.
- Stock price-history chart + silent `stock_adjustments` log incl. prices. §5.4
  forbids shown history; the log has no UI except this chart.
- Expense category manager dialog (§7.1 names only Add buttons; edit/delete
  needs a list).
- Sales/expenses default filter window is Last 1 Month, not
  last-30-days/current-month (§6.2, §7.4).
- Tax rows omitted everywhere: no tax source exists, so `> 0` never fires
  (§6.3, §6.4).
- Sidebar quick backup and sync badge (features §1.9): writes to the same
  `inventory-YYYY-MM-DD-HHMM.xlsx` naming and one-file-per-day retention as
  scheduled backups, with no dialog. The sidebar reports the newest Excel
  backup's name and cloud state from the Windows shell overlay index
  (`SHGetFileInfoW` + `SHGFI_OVERLAYINDEX`, through PowerShell from the Bun
  server) compared with a file that has not changed for 10 minutes. No cloud API
  or account is contacted, and an absent badge is reported as unavailable rather
  than guessed. File badges are painted by provider shell extensions, not a
  queryable cloud API, so the state is only as current as Explorer's.
- LAN sharing (features §1.11): `Network access (LAN)` switch, LAN URL + QR code,
  a UAC firewall helper for TCP 5178 (`scripts/enable-lan.ps1`, bundled beside
  the exe), and an automatic server restart when the setting changes. The host
  binds `0.0.0.0` instead of `127.0.0.1`; the LAN IP prefers `192.168.*` >
  `10.*` > `172.16–31.*`. No account, relay or cloud.
- `Start with Windows` (features §9.1) replaces the old Electron
  `startMaximized` flag: per-user `HKCU\...\Run` value pointing at the installed
  exe, reconciled at every launch by `src/main/autostart.ts`.
- About tab (features §9.5) with version + manual update check, and a
  `Restart server` card (features §1.10/§9.1). The CLI modes
  `Inventory Pro.exe --restart | --stop` and the bundled
  `server-control.bat` / `server-restart.bat` provide the same control outside
  the app.
- Native file/folder dialogs come from `server/dialogs.ts` (PowerShell +
  WinForms, `-EncodedCommand`, foreground + start-folder handling) because a
  browser cannot return an absolute path. Deterministic file operations
  (exports, imports, folder pickers) still show Windows dialogs; there are no
  browser file inputs.

## 6. Legacy import mapping (old-app Excel → current DB)

- Source sheets use lowercase names (`categories`, `products`, `sales`, `sale_items`, `expense_categories`, `expenses`, `stock_adjustments`, `product_price_history`, `settings`); required: categories, products, sales, sale_items, settings.
- Core column mappings: `stock_quantity` → `stock_qty`, `min_stock_threshold` → `min_stock`, `receipt_number` → `receipt_no`, `discount_amount` → `discount`, `total_amount` → `total`, `quantity` → `qty`, `total_price` → `line_total`, `historical_cost_price` → `unit_cost`, `expense_date` → `date`, `reference_number` → `reference`.
- Status flags: `is_deleted`/`deleted_at` → `archived_at`; `is_returned` → sale `status` (`canceled` + `canceled_at` parsed from the `CANCELED:` note timestamp, else `updated_at`). Stock-adjustment `reference` is merged into the current `reason` text.
- Settings: legacy key/value/type rows map onto the nested sections (language, currency, date format, notifications, card fee, business identity, receipt header/footer); unmapped keys fall back to current defaults. Expense `transfer`/`bankTransfer`/`bank_transfer` → `bank`, anything outside the current payment lists → `other`. Sales accept only cash/card/split and reject anything else before any write.
- Price history: legacy `product_price_history` rows become zero-quantity priced `stock_adjustments` (the stock price chart reads that table); one `initial` baseline per product (current stock minus legacy movements, at current prices) anchors the chart. The chart orders by (`created_at`, `id`).
- Intentionally unsupported (no current column): supplier `tax_id`/`website`/`notes`, product `image_path`, sale `cashier`/split details, expense `receipt_image_path`, category `updated_at`.

## 7. Runtime and operations

Start-up order in `server/boot.ts`:

1. Clean leftover installer temp files and `<exe>.old` from a previous update.
2. Handle `--restart` / `--stop` (stop the running instance, then exit or
   continue).
3. Resolve migrations (`INVENTORY_DRIZZLE_DIR`, else `drizzle/` beside the exe).
4. Read `general.networkAccess` to choose the bind host (`0.0.0.0` / loopback).
5. Reconcile the Start-with-Windows Run entry with `general.autoStartOnLogin`
   (non-fatal).
6. Pick the port: a relaunch waits for its old port up to 20 s; otherwise scan
   5178–5188 for a healthy instance (reopen its tab and exit) or a free port.
7. Start the HTTP server, wire update progress, start the hourly backup timer.
8. Open a Chrome/Edge tab (skipped on a relaunch that reclaimed its port).

Environment variables (development/testing; the installed app needs none):

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5178` | First HTTP port tried (range is `PORT`…`PORT+10`) |
| `HOST` | from `networkAccess` | Override the bind address |
| `VITE_PORT` | `5173` | HMR dev server |
| `WEB_ROOT` | `out/web` or `web/` beside the exe | Renderer build to serve |
| `INVENTORY_DATA_DIR` | `%APPDATA%\Inventory Pro` | DB, backups, logs |
| `INVENTORY_DRIZZLE_DIR` | `drizzle/` beside the exe | Migrations |
| `INVENTORY_UPDATE_API_URL` | GitHub `releases/latest` | Local updater mock |
| `INVENTORY_RELAUNCH`, `INVENTORY_RELAUNCH_PORT` | unset | Internal restart/install handover |

Logs go to `%APPDATA%\Inventory Pro\launcher.log` (the exe has no console);
fatal start-up errors also show a Windows message box. The single instance is
detected through `/api/health`; `--restart`/`--stop` stop it gracefully through
`/api/app:stop` and fall back to `taskkill` after a timeout.
