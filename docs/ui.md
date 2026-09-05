# UI — inventory-pro (shadcn-only)

## 1. Rule
Every UI element uses shadcn/ui primitives + theme CSS vars. No hard-coded colors, no non-shadcn chart/form/table libs. Keeps dark/light free.

## 1b. App shell (shadcn dashboard example)
`App.tsx` follows `shadcn-ui/ui/apps/v4` dashboard: `SidebarProvider` with `--sidebar-width`/`--header-height` vars, `AppSidebar` (brand header + route nav), `SidebarInset` + sticky `SiteHeader` (trigger, separator, translated page title, `ModeToggle`), content in `@container/main > flex flex-col gap-4 py-4 md:gap-6 md:py-6`, page blocks padded `px-4 lg:px-6`. Icons: Lucide only (per `components.json`), not Tabler. No `NavUser` — single-user, no auth.

## 2. Theme (addition to spec — features.md has no theme requirement)
- Tailwind `darkMode: "class"` + shadcn CSS vars (`--background`, `--chart-1`…`--chart-5`).
- `ThemeProvider` (next-themes works with Vite/Electron) with `attribute="class"`, persisted choice, toggle in header + Settings > General.
- Charts reference `var(--chart-N)` / `var(--color-KEY)` only, never hex.

## 3. Forms
React Hook Form + `@hookform/resolvers/zod` + shadcn `Form/Input/Select/Dialog/Table/Toast`. One Zod schema per form in `shared/schemas`, shared by renderer validation and main IPC validation. Product (§4.1), stock adjust (§5.2), expense (§7.2), settings (§9) all follow this.

## 4. Charts
Recharts v3 via shadcn `chart` block only: `ChartContainer`, `ChartTooltipContent`, `ChartLegendContent`, `ChartConfig`. Covers all 10 dashboard panels (§2) + 5 reports (§8): bars, grouped bars, dual-axis, doughnut/pie with pie/bar toggle.

## 5. i18n / money / dates
react-i18next (Vite-safe; next-intl is Next-only), EN/TR JSON, instant switch in Settings. Money `Intl.NumberFormat` + currency from settings (§1.3); display dates format ISO → store format in renderer only (`shared/dates.formatISO()`). Filters/pickers send ISO8601 UTC to the API — never formatted strings. `normalizeTR()` (ğ→g ş→s ç→c ö→o ü→u ı/İ→i) wraps every product search (§3.1, §4.3, §5.1).

## 6. Lists
Loading / error+Retry / empty states per §1.7 using shadcn `Skeleton`, `Alert`, `Empty`. Confirm dialogs for delete/archive/restore/reset/import via shadcn `AlertDialog`.
