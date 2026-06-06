# Testing Plan (Unit + Integration)

Strategy for unit and integration tests. **Separate from E2E** — see `plans/e2e.md` for end-to-end Playwright tests.

This plan complements `plans/modules.md` — modules.md has per-module test outlines; this plan defines the framework, fakes, conventions, and CI gates that apply to all of them.

Designed for parallel execution: one test-author agent per module.

---

## Tooling

| Layer | Tool |
|---|---|
| Unit + integration runner | Vitest |
| React component testing | Vitest + `@testing-library/react` + `@testing-library/user-event` |
| DOM environment | jsdom |
| Coverage | `@vitest/coverage-v8` |
| External boundary fake | Hand-written `tests/helpers/fakeBoundary.ts` |

```bash
pnpm add -D vitest @vitest/coverage-v8 @testing-library/react \
  @testing-library/jest-dom @testing-library/user-event jsdom
```

`vitest.config.ts` (foundation agent ships initial; testing agent extends):
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['lib/modules/**/index.ts', 'lib/modules/**/internal/**'],
      exclude: ['**/*.test.ts', '**/types.ts'],
      thresholds: { lines: 80, branches: 75, functions: 80 },
    },
  },
});
```

---

## Test taxonomy

We run **three** kinds of tests in this project:

| Kind | Location | What it tests | What it mocks |
|---|---|---|---|
| **Module interface tests** | `tests/modules/<module>/*.test.ts` | A module's full public interface | External boundary only (`DbBoundary`) |
| **Cross-module integration test** | `tests/integration/full-flow.test.ts` | Multiple modules wired together (no UI) | External boundary only |
| **E2E** | `e2e/specs/*.spec.ts` | UI + modules + real (test) Supabase | Nothing — real services |

**Component tests are not a separate category.** UI components in `components/ui` are pulled from shadcn (already battle-tested) and `components/shared` are thin compositions over them — covered by E2E. We do not write Vitest tests for individual components.

---

## The boundary fake (the cornerstone)

`lib/db/boundary.ts` defines the `DbBoundary` interface (one method per Supabase operation any module needs). Production wires it to the real `@supabase/supabase-js` client.

`tests/helpers/fakeBoundary.ts` implements the same interface as an in-memory store:
- `Map`-backed tables: `sessions`, `buyins`, `cashouts`, `notes`, `photos`, `badges`, `audit_log`, `profiles`, `app_settings`, `session_participants`.
- Replicates the DB triggers we depend on (audit log entries written on `buyins.insert`, `cashouts.update.confirm`, etc.) — kept in sync manually with `database.md` triggers.
- Replicates the `join_session_with_token` RPC.
- **Does NOT replicate RLS** — RLS is verified in E2E against real Supabase.

The fake exports a factory:
```ts
export function createFakeBoundary(seed?: SeedData): DbBoundary;
```

Module tests do:
```ts
import { sessions } from '@/lib/modules/sessions';
import { createFakeBoundary } from 'tests/helpers/fakeBoundary';

const boundary = createFakeBoundary({ users: [aman, ravi], appSettings: { chipsPerPaise: 1 } });
const sessionsModule = sessions.withBoundary(boundary);
// ...test through public interface only
```

`<module>.withBoundary(boundary)` is the public DI hook every module exposes. Production wires it once at app boot.

---

## What module tests must cover

For every module:
1. **Happy path** for every public function.
2. **Validation errors** — invalid inputs surface domain-specific errors.
3. **Permission rejections** — non-house, non-participant operations rejected.
4. **State guards** — operations on a closed session rejected.
5. **Side effects through the boundary** — assert the right rows were written.
6. **No internals leaking** — TypeScript should reject any import beyond `index.ts`. (Verified by ESLint, but a smoke test in `tests/integration/imports.test.ts` confirms.)

---

## Cross-module integration test

A single integration test that mirrors the smoke flow described in `plans/modules.md`:

`tests/integration/full-flow.test.ts`:
```
Given: 5 seeded users.
When:
  1. Aman.createSession(...)
  2. Aman.generateInviteUrl
  3. Ravi, Priya joinSessionByToken
  4. Aman recordBuyin × N
  5. Each player submitCashout
  6. Aman confirmCashout × 3
  7. Aman closeSession
Then:
  - leaderboard reflects the 3 nets
  - profiles update (history + bankroll series)
  - badges awarded (first_session, possibly comeback_kid)
  - audit log has 1 + N + 3 + 3 + 1 entries (open + buy-ins + submits + confirms + close)
  - export.exportSessionCSV produces a CSV with 3 rows + header
```

This single test is the strongest signal that the module contracts compose correctly. It runs on every push.

---

## Conventions

- **One test file per topic, not per file.** `buyins.test.ts`, `cashouts.test.ts`, etc., not `recordBuyin.test.ts`.
- **Use `describe.each` and `test.each` for table-driven tests** (currency formatting, validation rules, permissions matrix).
- **Test names describe behavior, not function names.** `'rejects buy-in when session is closed'` beats `'recordBuyin throws when status=closed'`.
- **No snapshot tests for domain code.** Snapshots are for UI; we don't test UI in this plan.
- **No `setTimeout` in tests.** Use `vi.useFakeTimers` if time matters; otherwise time should be injected.
- **No real network.** Tests fail loud if anything tries to reach Supabase.

---

## CI gates

`pnpm test` in CI must:
- Run all module tests + integration test.
- Enforce coverage thresholds in `vitest.config.ts`.
- Fail if any test imports `@supabase/supabase-js` directly (grep gate).
- Fail if any test imports from `lib/modules/*/internal/` (grep gate).
- Fail if any module's test file is missing (one per module is mandatory).

---

## Folder layout

```
tests/
├── setup.ts                       # @testing-library/jest-dom matchers, console.error → throw
├── helpers/
│   ├── fakeBoundary.ts            # in-memory DbBoundary
│   ├── fixtures.ts                # canonical users / sessions / closed-session fixture
│   └── factories.ts               # builders: makeBuyin(), makeCashout(), ...
├── modules/
│   ├── core/
│   ├── auth/
│   ├── sessions/
│   ├── ledger/
│   ├── leaderboard/
│   ├── profiles/
│   ├── badges/
│   ├── media/
│   └── export/
└── integration/
    ├── full-flow.test.ts
    └── imports.test.ts             # smoke test that ESLint boundary rule is honored
```

---

## Acceptance checklist

- [ ] `pnpm test` runs and passes locally.
- [ ] Coverage thresholds met.
- [ ] One test file per module covering all public functions.
- [ ] Integration test covers the full-flow scenario.
- [ ] `tests/helpers/fakeBoundary.ts` mirrors every DB trigger we depend on.
- [ ] CI gates green: no direct Supabase imports, no internal-folder imports in tests.
- [ ] No flaky tests (run the suite 3× consecutively in CI as a sanity check).
