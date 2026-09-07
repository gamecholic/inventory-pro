# Architecture — inventory-pro

Status: [DECIDED] = agreed, not locked. [OPEN] = needs decision.

## 1. Stack
- [DECIDED] Shell: Electron + electron-builder (NSIS) + electron-updater, GitHub Releases provider (`publish: {provider: github, owner, repo}` explicit). Update card (features §1.6) polls on launch. Releases are cut by manually running `.github/workflows/release.yml` (patch/minor/major input bumps the version, builds Windows NSIS + `latest.yml`, pushes the version commit/tag, attaches assets to the Release).
- [DECIDED] Frontend: Vite + React + TypeScript + React Router (8 routes) + Zustand (ephemeral: cart, selection, filters) + TanStack Query over IPC (query keys per page/filter, invalidate on mutations).
- [DECIDED] DB: SQLite file per shop, better-sqlite3 in main only, Drizzle ORM + migrations. Sale completion = one transaction (insert sale + lines, decrement stock). Cost-averaging (§5.3) computed in main.
- [DECIDED] Validation: Zod schemas in `shared/` for forms + IPC payloads, both sides.
- [DECIDED] Backup: ExcelJS + JSON dump in main (§9.4, §1.8 close-intercept). Import replaces data after confirm + reload. The old-app Excel import (`main/db/legacyExcel.ts`) maps legacy sheets/columns into the same backup contract, then reuses `replaceAll()`.
- [DECIDED] Print: one HTML receipt template shared by POS (§3.11) + Sales History (§6.4) → `BrowserWindow.print()`. No thermal.
- [DECIDED] Tests: Vitest (unit: discount/split math §3.7–3.10, normalizeTR, cost-averaging) + Playwright (E2E: POS sale flow first). Main-process tests run against an electron stub (vitest alias), never the real binary.
- [DECIDED] Dates at API boundary: every IPC request/response carries dates as ISO8601 UTC strings (`z.string().datetime()`). Renderer converts Date/preset → ISO at the edge via `shared/dates.toISO()`; main parses/stores/filters in UTC and returns ISO. SQLite stores ISO text. No local-format or epoch-ms on the wire. This kills TZ bugs in dashboard/report/chart filters.

## 2. Layout
```
main/db/{client,schema,settingsStore,backup,excel,legacyExcel,categories,suppliers,products,stock,sales}.ts
main/ipc/{index,settings,backup,catalog,sales,updater}.ts  (./ipc resolves to index)
preload/ (window.api.* only)
renderer/pages/{dashboard,pos,products,stock,sales,expenses,reports,settings}
renderer/{hooks,stores,components,lib}  renderer/i18n/{en,tr}.ts
shared/{api,settings,products,sale,stock,normalizeTR,money,dates,units}.ts (+ *.test.ts)
```
Print (receipt template → BrowserWindow.print) and updater (GitHub Releases) live in
`main/index.ts` + `main/ipc/` for now; split into `main/print|updater` when they grow.

## 3. Separation (enforced)
- Two builds (electron-vite main + renderer). ESLint `no-restricted-imports` blocks renderer → `main/*`.
- Contracts first: channel names in `shared/api.ts`, Zod schemas beside them in `shared/*.ts`, then main handler in `main/ipc/<domain>.ts`, then renderer hook. No `any` across the boundary.
- Backend owns truth (SQLite). UI caches and invalidates after each mutation.
- Preload output is `out/preload/index.mjs` — main must reference the `.mjs` path, not `.js`.
- Settings live in a `settings` key-value table (one JSON row per section), merged over `shared/settings.ts` defaults. Display prefs (language/currency/dates) are read from the `['settings']` TanStack Query cache.

## 4. Must-not-break (from features.md)
Single-user offline-first, no auth/cloud. No hold/park sale (§3.12), no bulk product actions (§4.4), no stock history log (§5.4), no recurring expenses/attachments (§7.2), no report CSV/print (§8.6). Receipt # `INV-YYYYMMDD-HHmmss` + business identity + header/footer everywhere (§1.4, §3.11).

## 5. Approved deviations (owner-signed, override the spec above)
- Theme toggle (header → Settings > General). Spec has no theme requirement.
- Reports: 5 extra insight reports (reorder, dead stock, basket, discounts, card fees) beside the spec's 5 (§8).
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
