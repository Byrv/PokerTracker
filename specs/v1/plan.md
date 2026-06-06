# Poker Tracker — Plan (Orchestrator)

Top-level plan. Links every sub-plan, shows the multi-agent execution graph, and defines contracts so parallel agents don't step on each other.

**Source of truth:** [requirments.md](requirments.md). Functional, technical, design, and architectural requirements there are immutable inputs to every sub-plan.

---

## Sub-plans

All sub-plans live in [plans/](plans/). Each is self-contained — an agent reading `requirments.md` + `plan.md` + its own sub-plan has everything it needs.

| # | File | Owns | Parallelism | Depends on |
|---|------|------|-------------|------------|
| 1 | [plans/foundation.md](plans/foundation.md) | Repo scaffold, deps, folder layout, lint/format/typecheck, scripts | sequential, runs first | — |
| 2 | [plans/database.md](plans/database.md) | Supabase project, schema, RLS, migrations, seed, generated types | sequential, after #1 | #1 |
| 3 | [plans/architecture.md](plans/architecture.md) | Module map, public interfaces, dependency diagram, owned primitives | sequential, after #2 | #1, #2 |
| 4 | [plans/modules.md](plans/modules.md) | Per-module implementation (one agent per module) | **parallel — fan out per module** | #3 |
| 5 | [plans/auth.md](plans/auth.md) | Magic-link sign-in, session-invite onboarding, route protection | parallel with #4 | #2, #3 |
| 6 | [plans/ui.md](plans/ui.md) | Design system, theme tokens, shadcn primitives, layout shell | parallel with #4, #5 | #1 |
| 7 | [plans/pwa.md](plans/pwa.md) | Manifest, icons, install, mobile chrome | parallel with #4, #5, #6 | #1 |
| 8 | [plans/frontend.md](plans/frontend.md) | Pages, routes, layouts, page-level wiring (one agent per page group) | **parallel per page group** | #4, #6 |
| 9 | [plans/testing.md](plans/testing.md) | Unit + integration test strategy (one agent per module's tests) | **parallel per module** | #4 |
| 10 | [plans/e2e.md](plans/e2e.md) | Playwright end-to-end suite (separate from unit/integration) | parallel, runs alongside #8 | #1, #8 |
| 11 | [plans/deployment.md](plans/deployment.md) | Vercel project, env vars, CI/CD, preview deployments | parallel, runs alongside everything | #1 |

---

## Execution graph (multi-agent)

```
Phase 0 — sequential gate (single agent each, in order):
   [foundation] → [database] → [architecture]

Phase 1 — parallel fan-out (independent agents, dispatched together):
   ┌── [auth]
   ├── [ui]
   ├── [pwa]
   ├── [deployment]
   └── [modules] ──┬── module-A agent
                  ├── module-B agent
                  ├── module-C agent
                  └── ...one agent per module defined in architecture.md

Phase 2 — parallel, after Phase 1 (independent agents):
   ┌── [frontend] ──┬── auth-pages agent
   │              ├── session-pages agent
   │              ├── leaderboard-pages agent
   │              ├── profile-pages agent
   │              └── settings-pages agent
   ├── [testing]  ──┬── module-A tests agent
   │              ├── module-B tests agent
   │              └── ...one agent per module
   └── [e2e]       ── single Playwright agent

Phase 3 — sequential gate (single agent):
   integration smoke run + release-readiness audit
```

**An agent in Phase 1 or Phase 2 can begin the moment its named dependencies finish — they do not have to wait for siblings.**

---

## Inter-agent contracts (these prevent merge conflicts)

1. **Single source of domain types.** Database schema is generated to `lib/db/types.ts`. Module interfaces are exported from each module's `index.ts`. No agent invents or duplicates a domain type elsewhere.
2. **Module public interface is frozen after architecture.md ships.** Internals are free to change. Interface changes require a revision PR to architecture.md.
3. **Strict file ownership.** Each agent edits only files within its declared scope:
   - Module agents → `lib/modules/<their-module>/**` and `tests/modules/<their-module>/**` only.
   - UI agent → `components/ui/**`, `styles/**`, `lib/theme/**`.
   - Frontend page agents → `app/<their-route-group>/**` only — never module internals.
   - DB agent → `supabase/**`, `lib/db/**`.
   - E2E agent → `e2e/**`, `playwright.config.ts`.
   - Deployment agent → `.github/workflows/**`, `vercel.json`, env templates.
4. **Database schema is immutable after database.md ships.** Schema changes require a new migration via the DB agent only.
5. **No backwards-compat shims.** If a contract is wrong, fix the contract — don't add adapters.
6. **Tests follow the interface rule.** Every module test imports only from the module's `index.ts`. No reaching into internals; no internal-collaborator mocks. External boundaries (Supabase client, storage) are faked at the edge.

---

## Plan-time architectural audit (mandatory before Phase 1 starts)

`plans/architecture.md` must contain, for **every module**:
1. **Public interface** — exact TypeScript signatures of all exports.
2. **Inputs / outputs** — what flows in, what flows out (DTO shapes).
3. **Dependencies** — which other module interfaces it imports, with one-line justification per edge.
4. **Owned shared primitives** — which DRY primitives live here.
5. **Test plan** — scenarios covered through the public interface + the boundary fake used.

If any item is missing for any module, halt Phase 1 and revise architecture.md.

`plans/architecture.md` must also contain:
- A **dependency diagram** (text or mermaid) of all modules.
- A **shared primitives table** with one owning module per primitive.
- A **cycle check** confirming no cycles exist.

---

## Definition of done (release-ready v1)

- Every sub-plan executed and merged.
- Architectural audit re-run on the actual code: each module's public interface matches `architecture.md`, no internal-mock tests, dependency diagram still acyclic.
- All modules pass their interface tests (CI green).
- E2E suite passes the critical path: sign-in via magic link → join session via invite → record buy-ins → submit & confirm cash-outs → close session → leaderboard updates → audit log shows all entries.
- Lighthouse PWA install check passes on mobile Chrome.
- App deploys cleanly to Vercel from `main` with seed data wiped.
- `requirments.md` "Out of scope" list still accurate (nothing dropped crept back in).

---

## How an executing agent uses this plan

1. Read `requirments.md` end-to-end (mandatory).
2. Read `plan.md` (this file) end-to-end.
3. Read your assigned sub-plan in `plans/`.
4. Verify your dependencies are complete (don't start early).
5. Operate strictly within your declared file-ownership scope.
6. When you finish, your output is checked against:
   - The architectural rules in `requirments.md`.
   - The contracts in this file.
   - The acceptance criteria in your sub-plan.
