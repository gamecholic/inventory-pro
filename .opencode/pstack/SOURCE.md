# pstack — install provenance

- Source: https://github.com/cursor/plugins/tree/main/pstack
- Upstream version: 0.15.24 (`plugin.json` / `.cursor-plugin/plugin.json`)
- Installed: 2026-10-14 (UTC)
- Scope: full pstack pack (user chose "Full pstack pack", install in place on `master`)

## Layout mapping (upstream → this repo)

| Upstream (`pstack/…`)      | This repo                              | Notes |
|----------------------------|----------------------------------------|-------|
| `skills/*` (54 skills)     | `.opencode/skills/*`                   | Auto-discovered by OpenCode (project scope). IDs = directory names. |
| `agents/*` (2 agents)      | `.opencode/agents/*`                   | `poteto-agent.md`, `comment-sicko.md`. |
| `docs/guide/*`             | `docs/pstack-guide/*`                  | Kept out of `docs/features.md` scope; guide only. |
| `automations/benny/`       | `.cursor/automations/benny/`           | Per upstream `README`: benny pack lives at `.cursor/automations/benny/`, not as slash skills. See its `FOR_AGENTS.md` for setup. |
| `plugin.json`, `README.md`, `LICENSE`, `.cursor-plugin/`, `assets/logo.png` | `.opencode/pstack/` | Provenance copy; not runtime config. |

## Notes

- OpenCode also searches `.agents/skills` / `.claude/skills` as compatibility paths; canonical copy here is `.opencode/skills` (highest project precedence).
- `poteto-mode/SKILL.md` sets `disable-model-invocation: true` upstream — OpenCode hides it from the advertised list but it stays loadable by explicit ID (`@poteto-mode`).
- Benny skills under `.cursor/automations/benny/skills/` are intentionally NOT duplicated into `.opencode/skills/`.
- To update: re-download the zip from the source URL above, compare `plugin.json` version, and re-copy the mapped directories.
