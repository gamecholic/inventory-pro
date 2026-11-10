# Architecture — inventory-pro

Status: [DECIDED] = agreed, not locked. [OPEN] = needs decision.

## 1. Stack
- [DECIDED] Shell: Bun single-process server (Windows). `server/boot.ts` compiles to `Inventory Pro.exe` (Bun runtime) which serves the Vite renderer + API on 127.0.0.1 and opens a Chrome/Edge `--app` window. Packaging via `scripts/build-app.ts` + Inno Setup (`scripts/build-installer.ts`, `packaging/inventory-pro.iss`). Auto-update is installer-based (see `server/updater.ts`, `docs/migrate-to-bun.md` §6.3/§9). Electron is fully removed from the tree; Linux is not currently shipped.
- [DECIDED] Frontend: Vite + React + TypeScript + React Router (8 routes) + Zustand (ephemeral: cart, selection, filters) + TanStack Query over HTTP (query keys per page/filter, invalidate on mutations). Renderer calls `window.api.*` installed by `renderer/lib/http-api.ts` (`POST /api/<channel>`).
- [DECIDED] DB: SQLite file per shop via `bun:sqlite`, Drizzle ORM + migrations. Sale completion = one transaction (insert sale + lines, decrement stock). Cost-averaging (§5.3) computed server-side.
- [DECIDED] Validation: Zod schemas in `shared/` for forms + API payloads, both sides.
- [DECIDED] Backup: ExcelJS + JSON dump in `src/main/db/` (§9.4, §1.8 scheduled hourly Excel, started from `server/boot.ts` via `src/main/scheduledBackup.ts`). Import replaces data after confirm + reload. The old-app Excel import (`main/db/legacyExcel.ts`) maps legacy sheets/columns into the same backup contract, then reuses `replaceAll()`.
- [DECIDED] Print: one HTML receipt template shared by POS (§3.11) + Sales History (§6.4) → `window.print()` in the Chrome/Edge `--app` tab. No thermal.
- [DECIDED] Tests: `bun:test` (`npm run test:bun`, unit: discount/split math §3.7–3.10, normalizeTR, cost-averaging, analytics) + Playwright (E2E: POS sale flow first). Main-process tests run against `:memory:` SQLite with the `electron` module aliased to `server/electron.ts` (see `tsconfig.bun.json`), never the real binary.
- [DECIDED] Dates at API boundary: every API request/response carries dates as ISO8601 UTC strings (`z.string().datetime()`). Renderer converts Date/preset → ISO at the edge via `shared/dates.toISO()`; server parses/stores/filters in UTC and returns ISO. SQLite stores ISO text. No local-format or epoch-ms on the wire. This kills TZ bugs in dashboard/report/chart filters.

## 2. Layout
```
server/{boot,index,electron,updater,dialogs}.ts        (Bun process: serve + shim + dialogs)
main/db/{client,schema,settingsStore,backup,excel,legacyExcel,categories,suppliers,products,stock,sales}.ts
main/ipc/{settings,backup,catalog,sales,updater}.ts    (register*Ipc() handlers; served as POST /api/<channel>)
renderer/{main.tsx,App.tsx,lib/http-api.ts}             ( installs window.api over fetch before React mounts)
renderer/pages/{dashboard,pos,products,stock,sales,expenses,reports,settings}
renderer/{hooks,stores,components,lib}  renderer/i18n/{en,tr}.ts
shared/{api,api-surface,settings,products,sale,stock,normalizeTR,money,dates,units}.ts (+ *.test.ts)
```
Print (receipt template → `window.print()`) lives in the renderer (`ReceiptDialog` + print CSS); updater checks live in `server/updater.ts` + `server/index.ts` stubs until the installer-based updater lands (see `migrate-to-bun.md` §6).

## 3. Separation (enforced)
- Single Bun build: `scripts/build-app.ts` compiles `server/boot.ts` → exe and copies `out/web/` + `drizzle/` beside it. ESLint `no-restricted-imports` blocks renderer → `main/*`.
- Contracts first: channel names in `shared/api.ts`, Zod schemas beside them in `shared/*.ts`, then server handler in `main/ipc/<domain>.ts` (registered via the `server/electron.ts` shim in `server/index.ts`), then renderer hook. No `any` across the boundary.
- Settings live in a `settings` key-value table (one JSON row per section), merged over `shared/settings.ts` defaults. Display prefs (language/currency/dates) are read from the `['settings']` TanStack Query cache.

## 4. Must-not-break (from features.md)
Single-user offline-first, no auth/cloud. No hold/park sale (§3.12), no bulk product actions (§4.4), no stock history log (§5.4), no recurring expenses/attachments (§7.2), no report CSV/print (§8.6). Receipt # `INV-YYYYMMDD-HHmmss` + business identity + header/footer everywhere (§1.4, §3.11).

## 5. Approved deviations (owner-signed, override the spec above)
- Theme toggle (header → Settings > General). Spec has no theme requirement.
- Reports: extra insight reports beside the spec's 5 (§8) — reorder, dead stock, basket, discounts, card fees, frequently bought together, low margin, stock value by category/supplier, and year-over-year (own year picker; revenue and profit per month against the same months of the previous year, plus totals).
- Stock price-history chart + silent `stock_adjustments` log incl. prices. §5.4 forbids shown history; the log has no UI except this chart.
- Expense category manager dialog (§7.1 names only Add buttons; edit/delete needs a list).
- Sales/expenses default filter window is Last 1 Month, not last-30-days/current-month (§6.2, §7.4).
- Tax rows omitted everywhere: no tax source exists, so `> 0` never fires (§6.3, §6.4).

## 6. Legacy import mapping (old-app Excel → current DB)
- Source sheets use lowercase names (`categories`, `products`, `sales`, `sale_items`, `expense_categories`, `expenses`, `stock_adjustments`, `product_price_history`, `settings`); required: categories, products, sales, sale_items, settings.
- Core column mappings: `stock_quantity` → `stock_qty`, `min_stock_threshold` → `min_stock`, `receipt_number` → `receipt_no`, `discount_amount` → `discount`, `total_amount` → `total`, `quantity` → `qty`, `total_price` → `line_total`, `historical_cost_price` → `unit_cost`, `expense_date` → `date`, `reference_number` → `reference`.
- Status flags: `is_deleted`/`deleted_at` → `archived_at`; `is_returned` → sale `status` (`canceled` + `canceled_at` parsed from the `CANCELED:` note timestamp, else `updated_at`). Stock-adjustment `reference` is merged into the current `reason` text.
- Settings: legacy key/value/type rows map onto the nested sections (language, currency, date format, notifications, card fee, business identity, receipt header/footer); unmapped keys fall back to current defaults. Expense `transfer`/`bankTransfer`/`bank_transfer` → `bank`, anything outside the current payment lists → `other`. Sales accept only cash/card/split and reject anything else before any write.
- Price history: legacy `product_price_history` rows become zero-quantity priced `stock_adjustments` (the stock price chart reads that table); one `initial` baseline per product (current stock minus legacy movements, at current prices) anchors the chart. The chart orders by (`created_at`, `id`).
- Intentionally unsupported (no current column): supplier `tax_id`/`website`/`notes`, product `image_path`, sale `cashier`/split details, expense `receipt_image_path`, category `updated_at`.
