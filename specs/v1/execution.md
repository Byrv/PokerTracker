# Poker Tracker — Execution Runbook (Orchestrator)

This is the **master runbook**. It dispatches per-plan execution runbooks (`executions/*.md`) to agents in the correct order, gates between phases, and runs the final acceptance suite.

**Inputs (read in order, do not skip):**
1. [requirments.md](requirments.md) — frozen product, technical, design, and architectural requirements.
2. [plan.md](plan.md) — orchestrator plan; defines phases, contracts, and definition-of-done.
3. [plans/](plans/) — sub-plans, the source of truth for each agent's scope.
4. This file + the matching `executions/<name>.md` for each agent.

**Working directory throughout:** `c:\Users\linga\Documents\poker_tracker\poker-tracker\` once foundation has scaffolded the Next.js app inside the project root. Until then, work in `c:\Users\linga\Documents\poker_tracker\`.

---

## Sub-execution files

| # | Execution file | Plan reference | Agent role | Phase |
|---|---|---|---|---|
| 1 | [executions/foundation.md](executions/foundation.md) | [plans/foundation.md](plans/foundation.md) | scaffolding | 0 |
| 2 | [executions/database.md](executions/database.md) | [plans/database.md](plans/database.md) | DB schema + RLS | 0 |
| 3 | [executions/architecture.md](executions/architecture.md) | [plans/architecture.md](plans/architecture.md) | module skeletons + interfaces | 0 |
| 4 | [executions/modules.md](executions/modules.md) | [plans/modules.md](plans/modules.md) | per-module implementation | 1 |
| 5 | [executions/auth.md](executions/auth.md) | [plans/auth.md](plans/auth.md) | auth flow + middleware | 1 |
| 6 | [executions/ui.md](executions/ui.md) | [plans/ui.md](plans/ui.md) | design system + primitives | 1 |
| 7 | [executions/pwa.md](executions/pwa.md) | [plans/pwa.md](plans/pwa.md) | manifest + service worker | 1 |
| 8 | [executions/deployment.md](executions/deployment.md) | [plans/deployment.md](plans/deployment.md) | Vercel + CI | 1 |
| 9 | [executions/frontend.md](executions/frontend.md) | [plans/frontend.md](plans/frontend.md) | pages + routes | 2 |
| 10 | [executions/testing.md](executions/testing.md) | [plans/testing.md](plans/testing.md) | unit/integration tests | 2 |
| 11 | [executions/e2e.md](executions/e2e.md) | [plans/e2e.md](plans/e2e.md) | Playwright suite | 2 |

---

## Execution graph

```
┌──────────────────────── PHASE 0 (sequential) ─────────────────────────┐
│                                                                       │
│   [executions/foundation.md]                                          │
│         │                                                             │
│         ▼                                                             │
│   [executions/database.md]                                            │
│         │                                                             │
│         ▼                                                             │
│   [executions/architecture.md]                                        │
│         │                                                             │
└─────────┼─────────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────── PHASE 1 (parallel fan-out) ──────────────────┐
│                                                                      │
│   ┌─ [executions/modules.md] ──┬── core agent           (priority 1) │
│   │                            ├── auth agent                        │
│   │                            ├── sessions agent                    │
│   │                            ├── ledger agent                      │
│   │                            ├── leaderboard agent                 │
│   │                            ├── profiles agent                    │
│   │                            ├── badges agent                      │
│   │                            ├── media agent                       │
│   │                            └── export agent                      │
│   │                                                                  │
│   ├─ [executions/auth.md]        (auth UI/middleware agent)          │
│   ├─ [executions/ui.md]          (design system agent)               │
│   ├─ [executions/pwa.md]         (PWA agent)                         │
│   └─ [executions/deployment.md]  (CI/CD agent)                       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────── PHASE 2 (parallel) ──────────────────────────┐
│                                                                      │
│   ┌─ [executions/frontend.md] ─┬── auth-pages agent                  │
│   │                            ├── session-pages agent               │
│   │                            ├── leaderboard-pages agent           │
│   │                            ├── profile-pages agent               │
│   │                            └── settings-pages agent              │
│   │                                                                  │
│   ├─ [executions/testing.md]   (one agent per module's tests)        │
│   └─ [executions/e2e.md]       (single Playwright agent)             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────── PHASE 3 (sequential) ────────────────────────┐
│   integration smoke run + release-readiness audit (this file)        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Phase 0 — sequential foundation

### Step 0.1 — Dispatch foundation agent

**Agent prompt:**
> Read `requirments.md`, `plan.md`, `plans/foundation.md`, and `executions/foundation.md`. Execute every step in `executions/foundation.md` in order. Do not deviate from the listed dependencies, folder layout, tsconfig, or ESLint configuration — these are contracts every later agent depends on. Stop and report when the acceptance checklist in `plans/foundation.md` is fully green.

**Gate before Step 0.2:** All these must be true:
- [ ] `poker-tracker/` directory exists with the exact folder layout from `plans/foundation.md`.
- [ ] `pnpm install` runs cleanly.
- [ ] `pnpm dev` starts and the default Next.js page renders.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes (zero warnings).
- [ ] ESLint `import/no-restricted-paths` rule is enforced (sample violation rejected).
- [ ] `pnpm test` runs Vitest (zero tests, zero failures).
- [ ] `pnpm test:e2e` opens Playwright (zero tests).

If any check fails, **do not advance**. Re-dispatch the foundation agent with the failing check.

### Step 0.2 — Dispatch database agent

**Agent prompt:**
> Read `requirments.md`, `plan.md`, `plans/database.md`, and `executions/database.md`. Execute every migration in order, write all RLS policies and triggers exactly as specified, generate types into `lib/db/types.ts`, and load the seed file. The schema is **immutable** after this runbook completes — design carefully. Stop and report when the acceptance checklist in `plans/database.md` is fully green.

**Gate before Step 0.3:**
- [ ] `supabase start` brings up local Postgres + Auth + Storage.
- [ ] `supabase db reset` applies all migrations + seed cleanly.
- [ ] `lib/db/types.ts` exists, contains `Database` type, and `pnpm typecheck` passes.
- [ ] Manual RLS smoke: a non-participant cannot read another session's `buyins`; a non-house cannot insert a `buyin`; the `audit_log` populates via trigger.
- [ ] Seed loads 5 users + 1 closed session + 1 open session.

### Step 0.3 — Dispatch architecture agent

**Agent prompt:**
> Read `requirments.md`, `plan.md`, `plans/architecture.md`, and `executions/architecture.md`. Create the module skeletons for all 9 v1 modules (`core`, `auth`, `sessions`, `ledger`, `leaderboard`, `profiles`, `badges`, `media`, `export`) with the exact public interface signatures specified. Write each module's `README.md` with the five plan-time audit items. Implement nothing inside `internal/` yet — those are the next phase's job. After this runbook, public interfaces are **frozen**.

**Gate before Phase 1:**
- [ ] Every module has `index.ts` matching `plans/architecture.md` exactly.
- [ ] Every module has a `README.md` with the five audit items.
- [ ] Every module has `internal/` (empty placeholder is fine for now) and a `types.ts`.
- [ ] `pnpm typecheck` passes (interfaces type-check; bodies can be `throw new Error('not implemented')` for now).
- [ ] `madge --circular lib/modules/` reports no cycles.
- [ ] ESLint blocks importing `lib/modules/<m>/internal/*` from outside the module.

If any module's interface drifts from `plans/architecture.md`, halt and revise the plan first.

---

## Phase 1 — parallel fan-out

Dispatch **all** of the following agents in parallel. They have no dependencies on each other beyond Phase 0 outputs.

### 1A — Module agents (9 agents in parallel)

For each module in `[core, auth, sessions, ledger, leaderboard, profiles, badges, media, export]`, dispatch one agent.

**Agent prompt template:**
> You are the agent for module `<MODULE>`. Read `requirments.md`, `plan.md`, `plans/architecture.md` (frozen contract), `plans/modules.md` (your section only), and `executions/modules.md` (your section only).
>
> Implement the module under `lib/modules/<MODULE>/internal/`. The public interface in `index.ts` must not change. Use the `DbBoundary` interface for all Supabase access (no direct `@supabase/supabase-js` imports). Use `core` primitives — never re-implement them.
>
> Write tests under `tests/modules/<MODULE>/`. Tests import only from `lib/modules/<MODULE>/index.ts`. Use `tests/helpers/fakeBoundary.ts` for Supabase mocking. No internal-collaborator mocks.
>
> Edit only files under `lib/modules/<MODULE>/` and `tests/modules/<MODULE>/`.
>
> Stop and report when your section's acceptance checklist in `plans/modules.md` is fully green.

**Priority:** `core` agent must finish first (other modules depend on it). Other 8 can finish in any order.

### 1B — Auth flow agent (1 agent)
**Agent prompt:**
> Read `requirments.md`, `plan.md`, `plans/auth.md`, `executions/auth.md`. Implement magic-link sign-in, invite-onboarding, route protection middleware, and Supabase server/client wrappers. Edit only the files listed in `plans/auth.md`. Tests for these flows live in `executions/e2e.md` — do not duplicate them.

### 1C — UI design system agent (1 agent)
**Agent prompt:**
> Read `requirments.md`, `plan.md`, `plans/ui.md`, `executions/ui.md`. Install all listed shadcn primitives, configure theme tokens, build all shared components, and ship the AppShell. Edit only `components/ui/**`, `components/shared/**`, `lib/theme/**`, `styles/**`, and `app/(internal)/ui-kit/**`.

### 1D — PWA agent (1 agent)
**Agent prompt:**
> Read `requirments.md`, `plan.md`, `plans/pwa.md`, `executions/pwa.md`. Generate icons + manifest, wire `next-pwa`, add mobile chrome polish to `app/layout.tsx`. Edit only `public/**`, `next.config.ts`, the `<head>` block of `app/layout.tsx`, and `components/shared/install-button.tsx`.

### 1E — Deployment agent (1 agent)
**Agent prompt:**
> Read `requirments.md`, `plan.md`, `plans/deployment.md`, `executions/deployment.md`. Set up `.github/workflows/ci.yml`, `.env.example`, branch protection notes (in README), and Vercel project hooks. Edit only `.github/**`, `.env.example`, `vercel.json` (if needed), and the "Deploying" section of `README.md`.

### Gate before Phase 2

All Phase 1 agents must be complete. Verify:
- [ ] All 9 modules pass their tests under `tests/modules/<m>/`.
- [ ] `tests/integration/full-flow.test.ts` passes (this is the cross-module smoke).
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm lint` passes.
- [ ] All shared UI components render in `app/(internal)/ui-kit/` page.
- [ ] Manifest + service worker work in a production build.
- [ ] CI pipeline runs and is green on a sample PR.

If integration test fails, dispatch a debug agent with prompt: *"Read the failure in `tests/integration/full-flow.test.ts`, identify which module's contract is wrong, fix that module's implementation (not the test). Do not change any module's public interface."*

---

## Phase 2 — parallel pages + tests + E2E

### 2A — Frontend page-group agents (5 in parallel)

Dispatch one agent per page group from `plans/frontend.md`:
- `auth-pages` — owns `app/sign-in/`, `app/auth/`, `app/join/`, `app/sign-out/`
- `session-pages` — owns `app/(app)/sessions/**`
- `leaderboard-pages` — owns `app/(app)/leaderboard/**`
- `profile-pages` — owns `app/(app)/profile/**`
- `settings-pages` — owns `app/(app)/settings/**`

**Agent prompt template:**
> You are the agent for page group `<GROUP>`. Read `requirments.md`, `plan.md`, `plans/frontend.md` (your group section only), `plans/ui.md` (for the components you must consume), and `executions/frontend.md`.
>
> Build pages, layouts, loading/error boundaries, and Server Actions for your routes only. Consume modules through `lib/modules/<m>/index.ts`. Consume UI through `components/ui/**` and `components/shared/**`. **No direct Supabase imports.** **No imports from `internal/`.**
>
> Edit only files under your declared scope (listed in `plans/frontend.md`).

### 2B — Testing extension agents (per-module, parallel)

Module tests already shipped in Phase 1. This phase adds **regression tests** discovered during integration. Usually a single agent — dispatch on a per-module basis only if a regression is found.

### 2C — E2E agent (1 agent)
**Agent prompt:**
> Read `requirments.md`, `plan.md`, `plans/e2e.md`, `executions/e2e.md`. Build the full Playwright suite as specified — page object models, helpers, and every spec file. Edit only `e2e/**`, `playwright.config.ts`, and CI lanes that run E2E.

### Gate before Phase 3

- [ ] All Frontend agents report acceptance checklists green.
- [ ] `pnpm test:e2e` passes locally on `chromium-mobile` and `chromium-desktop` lanes.
- [ ] `pnpm build` succeeds with no TypeScript or lint errors.
- [ ] Lighthouse PWA install audit passes via `e2e/specs/pwa.spec.ts`.

---

## Phase 3 — release readiness

This phase is run by the orchestrator (this runbook), not a sub-agent.

### Step 3.1 — Re-run the architectural audit on real code

For each module:
1. Open `lib/modules/<m>/index.ts`. Compare exports to `plans/architecture.md`. Must match exactly.
2. Open `lib/modules/<m>/README.md`. Confirm the five audit items still describe the implementation.
3. Run `madge --circular lib/modules/`. Must report no cycles.
4. Run `grep -R "from '@/lib/modules/.*/internal'" app/ lib/modules/ tests/` (excluding the module's own internals). Must return nothing.
5. Run `grep -R "from '@supabase/supabase-js'" lib/modules/`. Must return nothing.

If any check fails, dispatch a remediation agent for the offending module.

### Step 3.2 — Run the full test pyramid

```
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test                        # unit + integration
pnpm test:e2e                    # Playwright on both lanes
```

All must be green.

### Step 3.3 — Run the critical-path E2E manually

Spin up `pnpm dev` + `supabase start` (with seed data wiped to match production parity) and walk through the flow once by hand:
1. Sign in as a fresh user via magic link.
2. Receive an invite link from another user.
3. Join the session.
4. House records buy-ins.
5. Players submit cashouts.
6. House confirms cashouts.
7. House closes the session.
8. Verify leaderboard, profile, audit log all updated.
9. Export CSV and PDF.

### Step 3.4 — Definition-of-done check

Confirm every item from `plan.md` → "Definition of done":
- [ ] Every sub-plan executed and merged.
- [ ] Architectural audit re-run on the actual code (Step 3.1).
- [ ] All modules pass their interface tests.
- [ ] E2E suite passes critical path.
- [ ] Lighthouse PWA install check passes.
- [ ] App deploys cleanly to Vercel from `main` with seed data wiped.
- [ ] `requirments.md` "Out of scope" list still accurate.

### Step 3.5 — Tag v1

When all checks are green:
```bash
git tag -a v1.0.0 -m "Poker Tracker v1"
git push origin v1.0.0
```

Production deploy via Vercel happens automatically on `main`.

---

## Failure / abort procedure

If any phase fails repeatedly:

1. **Capture the failure**: collect logs, failing test output, agent's last report.
2. **Identify which contract is broken**: Is it a type mismatch (architecture.md drift)? A schema mismatch (database.md drift)? A boundary fake out of sync (testing.md)?
3. **Fix the contract first**, then re-dispatch the affected agent.
4. **Never skip a gate.** Don't advance to the next phase with a failing previous-phase check.

If a contract revision is unavoidable:
- Update the plan file (`plans/<name>.md`).
- Update the corresponding execution file (`executions/<name>.md`).
- Re-run the affected agent (and any downstream agents that consumed the contract).

---

## Inter-agent communication protocol

Agents do **not** communicate with each other directly. All coordination flows through:
1. The contracts in `plan.md` (immutable during execution).
2. The frozen interfaces in `plans/architecture.md`.
3. The DB schema and types from `plans/database.md`.

If an agent encounters something it thinks needs cross-coordination, it stops and reports up to the orchestrator. The orchestrator (this runbook) decides whether to revise a contract or instruct the agent to work within it.

---

## Quick-reference command palette

| Action | Command |
|---|---|
| Local dev | `pnpm dev` |
| Local Supabase | `supabase start` |
| Apply migrations | `supabase db reset` |
| Generate types | `pnpm db:gen-types` |
| Type-check | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Format check | `pnpm format:check` |
| Unit + integration tests | `pnpm test` |
| E2E tests | `pnpm test:e2e` |
| Production build | `pnpm build` |
| Cycle check | `pnpm dlx madge --circular lib/modules/` |
| Boundary-rule audit | `grep -R "from '@/lib/modules/.*/internal'" app/ lib/modules/ tests/` |

---

## Done

When Phase 3 acceptance is fully green, the v1 release runbook is complete. Hand the deployment URL to the friend group, observe a real session, and capture follow-up issues in a separate `feedback.md`.
