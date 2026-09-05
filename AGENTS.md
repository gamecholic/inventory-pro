# AGENTS.md — inventory-pro

Always-loaded. Keep tight.

## Stack
Electron (Windows) + Vite + React + TypeScript + Tailwind + shadcn/ui + Recharts + react-i18next + Zustand + Drizzle + better-sqlite3 (main only) + React Hook Form + Zod + Vitest + Playwright. Details in `docs/architecture.md`.

## Sources of truth
- `docs/features.md` — what the app does. Never contradict it. Theme toggle is the only addition (not in spec).
- `docs/architecture.md` — system, IPC, DB, updater, tests. Read before coding.
- `docs/ui.md` — shadcn-only UI rules, theme, forms, charts. Read before touching renderer.

## Boundaries
- Renderer never imports `main/*`, `fs`, DB, ExcelJS. All data via `window.api.*` (preload), validated with Zod in `shared/`.
- UI uses shadcn components + CSS vars only. No custom colors that break dark/light.
- Turkish `normalizeTR()` on every product search path. Money/dates via `shared/` helpers.

## Workflow
1. Use `package.json` scripts; don't invent. 2. Smallest diff per `docs/features.md`.
3. Install libs via the package-manager CLI (`npm i -S/-D <pkg>`, `npx shadcn@latest add <component>`) — never hand-write version numbers into `package.json`.
4. Verify: `npm run typecheck`, `npm run test` if present; else state what was skipped.
