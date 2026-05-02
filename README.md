# Poker Tracker

Web app for tracking home/private poker games. The v1 build runbook (frozen on release) lives in [../v1/](../v1/): see [v1/requirments.md](../v1/requirments.md) for product spec, [v1/plan.md](../v1/plan.md) for implementation plan, [v1/executions/foundation.md](../v1/executions/foundation.md) for build runbook.

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

See [v1/plans/architecture.md](../v1/plans/architecture.md) for the module map and dependency rules.

## Deploying

The app is hosted on Vercel. Production deploys from `main`; preview deploys from every PR.
Database, Auth, and Storage are hosted on Supabase.

### CI

`.github/workflows/ci.yml` runs on every push to `main` and every PR. Jobs:

- `lint-and-typecheck` — `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm cycles`, import audit
- `unit-tests` — `pnpm test` (run 3× to surface flake)
- `build` — `pnpm build` against placeholder env vars
- `e2e-tests` — Supabase local + Playwright Chromium

Note: `e2e-tests` is currently `continue-on-error: true` because Phase 2 has not yet shipped Playwright specs. Flip it to `false` once specs land in `e2e/`.

### Required env vars (Vercel)

Set these in Vercel → Project Settings → Environment Variables. Apply to **Production** and **Preview** unless noted.

| Name | Scope | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production + Preview | `https://<project>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production + Preview | Supabase dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Production only | Server-only; never exposed to the client |
| `NEXT_PUBLIC_SITE_URL` | Production + Preview | Used for magic-link redirects (e.g. `https://poker-tracker.vercel.app`) |

### Required GitHub secrets (CI)

Set these in GitHub → repo → Settings → Secrets and variables → Actions:

| Name | Used by | Notes |
|---|---|---|
| `SUPABASE_LOCAL_ANON_KEY` | `e2e-tests` build + run | Stable anon key emitted by `supabase start` locally |
| `SUPABASE_LOCAL_SERVICE_KEY` | `e2e-tests` | Stable service role key emitted by `supabase start` locally |

The `build` job uses repo secrets (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`) when present and falls back to placeholders so PRs from forks still build.

### Vercel project setup (one-time, manual)

1. https://vercel.com/new → import the repo.
2. Framework preset: **Next.js**.
3. Build command: `pnpm build` (default).
4. Install command: `pnpm install --frozen-lockfile`.
5. Output directory: `.next` (default).
6. Set the env vars above for **Production** and **Preview**.
7. Project Settings → Git → Production Branch: `main`.

### Branch protection (`main`)

Configure in GitHub → repo → Settings → Branches → Branch protection rule for `main`:

- Require pull request before merging
- Require approvals: **1**
- Require status checks to pass before merging:
  - `lint-and-typecheck`
  - `unit-tests`
  - `build`
  - `e2e-tests` (once specs land)
- Require linear history (squash or rebase merges only)
- Do not allow force pushes
- Do not allow deletions

### Database migrations

Migrations live in `supabase/migrations/`. To apply to a remote project:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

After applying migrations, regenerate types and commit:

```bash
pnpm db:gen-types
git add lib/db/types.ts && git commit -m "chore: regen types"
```

### Dependency updates

`.github/dependabot.yml` opens grouped PRs weekly for npm and GitHub Actions updates.
