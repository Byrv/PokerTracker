# Deployment Execution Runbook

Implements `plans/deployment.md`. Single agent. Phase 1 parallel. Owns CI, env templates, Vercel hooks.

Working directory: `c:\Users\linga\Documents\poker_tracker\poker-tracker\`.

---

## Step 1 — `.env.example` (verify foundation already created)

Confirm `.env.example` matches:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
E2E_BASE_URL=
E2E_SUPABASE_URL=
E2E_SUPABASE_ANON_KEY=
```

---

## Step 2 — GitHub Actions CI

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm format:check
      - run: pnpm typecheck
      - run: pnpm cycles
      - run: node scripts/audit-imports.mjs

  unit-tests:
    runs-on: ubuntu-latest
    needs: lint-and-typecheck
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
      - run: pnpm test
      - run: pnpm test
      # 3× to surface flake.

  e2e-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - run: supabase start
      - run: pnpm install --frozen-lockfile
      - run: pnpm dlx playwright install --with-deps chromium
      - run: pnpm db:reset
      - run: node scripts/seed-users.mjs
        env:
          NEXT_PUBLIC_SUPABASE_URL: http://localhost:54321
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_LOCAL_SERVICE_KEY }}
      - run: pnpm db:reset
      - run: pnpm build
        env:
          NEXT_PUBLIC_SUPABASE_URL: http://localhost:54321
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_LOCAL_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_LOCAL_SERVICE_KEY }}
          NEXT_PUBLIC_SITE_URL: http://localhost:3000
      - run: pnpm test:e2e
        env:
          E2E_BASE_URL: http://localhost:3000
          NEXT_PUBLIC_SUPABASE_URL: http://localhost:54321
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_LOCAL_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_LOCAL_SERVICE_KEY }}
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

**Note:** Local Supabase emits stable anon/service keys per `supabase status`. Either store these as repo secrets (`SUPABASE_LOCAL_ANON_KEY`, `SUPABASE_LOCAL_SERVICE_KEY`) or read them at runtime from `supabase status --output json`. Use the simpler stable-secret approach.

---

## Step 3 — Vercel project setup (manual, one-time)

The agent documents the steps; an admin executes them.

1. Go to https://vercel.com/new and import the repo.
2. Framework preset: **Next.js**.
3. Build command: `pnpm build` (default).
4. Install command: `pnpm install --frozen-lockfile`.
5. Output directory: `.next` (default).
6. Set environment variables (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://<your-project>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (from Supabase dashboard → Project Settings → API)
   - `SUPABASE_SERVICE_ROLE_KEY` = (same, service role key — Production only)
   - `NEXT_PUBLIC_SITE_URL` = `https://<your-vercel-domain>`
7. In Vercel → Project Settings → Git → Production Branch: `main`.
8. In Vercel → Project Settings → Git → "Ignored Build Step": leave default (or wire to a script that exits 0 only when CI lanes are green if Vercel's GitHub integration doesn't already handle this).

---

## Step 4 — Branch protection (GitHub repo settings)

Document in README; admin enables manually:
- Settings → Branches → Branch protection rule for `main`:
  - Require pull request before merging.
  - Require approvals: 1.
  - Require status checks to pass: `lint-and-typecheck`, `unit-tests`, `e2e-tests`.
  - Require linear history.
  - Do not allow force pushes.
  - Do not allow deletions.

---

## Step 5 — Env-presence startup check

Append to `lib/db/server.ts`:

```ts
function assertEnv() {
  const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  for (const k of required) {
    if (!process.env[k]) throw new Error(`Missing env var: ${k}`);
  }
}

assertEnv();
```

(Place above the `getServerSupabase` function.) This makes any deploy fail loud at boot if env vars are missing.

---

## Step 6 — README "Deploying" section

Append to `README.md`:

```markdown
## Deploying

The app is deployed to Vercel. Production deploys from `main`; preview deploys from every PR.

### Required env vars (Vercel)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (Production only)
- `NEXT_PUBLIC_SITE_URL`

### Database migrations
Migrations live in `supabase/migrations/`. To apply to a remote project:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

After applying migrations, regenerate types:

```bash
pnpm db:gen-types
git add lib/db/types.ts && git commit -m "chore: regen types"
```

### Branch protection
`main` is protected. All PRs must:
- Pass `lint-and-typecheck`
- Pass `unit-tests`
- Pass `e2e-tests`
- Receive 1 approval
- Use squash or rebase merge (linear history)
```

---

## Step 7 — `vercel.json` (optional)

Create `vercel.json` only if you need overrides. For v1 we don't, so skip unless you need to:
- Increase serverless function timeout for `app/(app)/sessions/[id]/export/*`.
- Customize headers for the manifest.

If exporting takes more than 10s, add:

```json
{
  "functions": {
    "app/(app)/sessions/*/export/route.ts": { "maxDuration": 30 }
  }
}
```

---

## Step 8 — First production deploy

After everything is green:
1. Push `main` (or merge first PR after creating the repo).
2. Watch Vercel for build success.
3. Open the production URL.
4. Confirm:
   - Sign-in page loads.
   - Magic-link auth works (real email).
   - Sessions list loads after sign-in.
   - PWA install banner appears on Chrome Android.

---

## Acceptance checklist

- [ ] `.github/workflows/ci.yml` exists and runs all three jobs.
- [ ] CI lanes are required status checks on `main`.
- [ ] Vercel project linked, env vars set, custom domain (if applicable).
- [ ] Production deploy succeeds from `main`.
- [ ] Preview deploy succeeds on a sample PR.
- [ ] `lib/db/server.ts` env-presence check exists.
- [ ] README "Deploying" section explains the workflow.
- [ ] Branch protection rules are active on `main`.

When all boxes green, deployment is wired. Commit as `chore: CI/CD + deploy hooks`.
