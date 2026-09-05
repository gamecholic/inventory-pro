# Architecture — inventory-pro

Status: [DECIDED] = agreed, not locked. [OPEN] = needs decision.

## 1. Stack
- [DECIDED] Shell: Electron + electron-builder (NSIS) + electron-updater, GitHub Releases provider (`publish: {provider: github, owner, repo}` explicit). Update card (features §1.6) polls on launch.
- [DECIDED] Frontend: Vite + React + TypeScript + React Router (8 routes) + Zustand (ephemeral: cart, selection, filters) + TanStack Query over IPC (query keys per page/filter, invalidate on mutations).
- [DECIDED] DB: SQLite file per shop, better-sqlite3 in main only, Drizzle ORM + migrations. Sale completion = one transaction (insert sale + lines, decrement stock). Cost-averaging (§5.3) computed in main.
- [DECIDED] Validation: Zod schemas in `shared/` for forms + IPC payloads, both sides.
- [DECIDED] Backup: ExcelJS + JSON dump in main (§9.4, §1.8 close-intercept). Import replaces data after confirm + reload.
- [DECIDED] Print: one HTML receipt template shared by POS (§3.11) + Sales History (§6.4) → `BrowserWindow.print()`. No thermal.
- [DECIDED] Tests: Vitest (unit: discount/split math §3.7–3.10, normalizeTR, cost-averaging) + Playwright (E2E: POS sale flow first).
- [DECIDED] Dates at API boundary: every IPC request/response carries dates as ISO8601 UTC strings (`z.string().datetime()`). Renderer converts Date/preset → ISO at the edge via `shared/dates.toISO()`; main parses/stores/filters in UTC and returns ISO. SQLite stores ISO text. No local-format or epoch-ms on the wire. This kills TZ bugs in dashboard/report/chart filters.

## 2. Layout
```
main/db/* main/ipc/* main/backup main/print main/updater
preload/ (window.api.* only)
renderer/pages/{dashboard,pos,products,stock,sales,expenses,reports,settings}
shared/api.ts shared/schemas shared/normalizeTR shared/money shared/dates
```

## 3. Separation (enforced)
- Two builds (electron-vite main + renderer). ESLint `no-restricted-imports` blocks renderer → `main/*`.
- Contracts first: add channel + Zod schema + TS types in `shared/api.ts`, then main handler, then renderer hook.
- Backend owns truth (SQLite). UI caches and invalidates after each mutation.

## 4. Must-not-break (from features.md)
Single-user offline-first, no auth/cloud. No hold/park sale (§3.12), no bulk product actions (§4.4), no stock history log (§5.4), no recurring expenses/attachments (§7.2), no report CSV/print (§8.6). Receipt # `INV-YYYYMMDD-HHmmss` + business identity + header/footer everywhere (§1.4, §3.11).
