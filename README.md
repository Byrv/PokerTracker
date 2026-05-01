# Poker Tracker

Web app for tracking home/private poker games. See [requirments.md](../requirments.md) for product spec, [plan.md](../plan.md) for implementation plan, [executions/foundation.md](../executions/foundation.md) for build runbook.

## Local development

```bash
pnpm install
supabase start
pnpm db:reset
pnpm dev
```

Visit http://localhost:3000.

## Common scripts

See `package.json` `scripts` for the full list. Key ones:

- `pnpm dev` — start the app
- `pnpm test` — unit + integration
- `pnpm test:e2e` — Playwright
- `pnpm typecheck` / `pnpm lint` — gates

## Architecture

See [plans/architecture.md](../plans/architecture.md) for the module map and dependency rules.
