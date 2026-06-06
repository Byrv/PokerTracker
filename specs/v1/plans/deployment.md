# Deployment Plan

Vercel hosting, environment variables, CI/CD, preview deployments. Runs **in parallel** with module work, UI, auth, and PWA in Phase 1. Single deployment agent.

---

## Hosting

- **Production app:** Vercel (single project: `poker-tracker`).
- **Database / Auth / Storage:** Supabase (single hosted project, separate from local dev).
- **Custom domain:** TBD — placeholder `poker-tracker.vercel.app` works for v1.

---

## Environments

| Environment | Branch | Vercel preset | Supabase project |
|---|---|---|---|
| Production | `main` | Production | `prod` Supabase project |
| Preview | every PR | Preview | `prod` Supabase project (read-mostly) — see note |
| Development | local | — | local `supabase start` |
| E2E (CI) | CI runs | — | ephemeral local Supabase via `supabase start` |

**Note:** for v1 (single friend group, ~20 users), preview deployments share the prod DB. This keeps setup simple. If schema-breaking PRs become common, add a `staging` Supabase project — out of scope for v1.

---

## Environment variables

Defined in `.env.example` (committed) and configured per-environment in Vercel.

```
# Public (exposed to client)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=                 # e.g. https://poker-tracker.vercel.app — used for magic-link redirects

# Server-only
SUPABASE_SERVICE_ROLE_KEY=            # used by server actions for privileged operations (audit reads, badge awards)
```

**Rules:**
- Anything prefixed `NEXT_PUBLIC_` is fine on the client; everything else is Server-Component / Server-Action only.
- Service role key is only read inside `lib/db/server.ts` and never imported into client code (verified by ESLint `no-restricted-imports` + a CI grep).
- `.env.local` is git-ignored.

---

## Build & deploy pipeline

### Vercel (zero-config except env vars)
- Build command: `pnpm build` (Next.js detects automatically).
- Install command: `pnpm install --frozen-lockfile`.
- Output directory: `.next/` (default).
- Node 20.

### GitHub Actions (gates before Vercel deploys)

`.github/workflows/ci.yml`:
```yaml
name: CI
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm format:check
      - run: pnpm typecheck

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test

  e2e-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase start
      - run: supabase db reset
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm playwright install --with-deps
      - run: pnpm build
      - run: pnpm test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: playwright-report/ }
```

Vercel only deploys after `lint`, `unit-tests`, and `e2e-tests` are green. Configure via Vercel's "Ignored Build Step" pointing at a script that exits non-zero if any GitHub check is failing — or use Vercel's GitHub integration to wait on required checks.

---

## Branch protection (`main`)

- Require all CI lanes to pass.
- Require 1 review.
- No direct pushes.
- Require linear history (squash or rebase merges only).

---

## Migration deployment

- Supabase migrations live in `supabase/migrations/`. Apply via `supabase db push --db-url <prod>` from a privileged developer machine — **not** automated for v1 (small project, low frequency).
- Generated types are committed (`lib/db/types.ts`). Don't regenerate in CI; regenerate locally after every migration and commit.

---

## Files this plan owns

```
.github/workflows/ci.yml
.env.example
vercel.json                  # if needed (most config is dashboard-only)
README.md                    # contributes the "Deploying" section
```

---

## Acceptance checklist

- [ ] Vercel project created and linked to GitHub repo.
- [ ] All required env vars set in Production and Preview environments.
- [ ] Custom domain (if applicable) configured with HTTPS.
- [ ] CI runs on every push and pull request; required checks set on `main`.
- [ ] `main` is protected; can only be updated via PR.
- [ ] First successful preview deployment of a sample PR.
- [ ] First successful production deployment from `main`.
- [ ] Deploy fails loud if env vars are missing (a startup check in `lib/db/server.ts` throws on missing keys).
- [ ] Deploys roll forward only — no automatic rollback (manual via Vercel dashboard if needed).
