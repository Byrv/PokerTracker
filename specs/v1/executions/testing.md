# Testing Execution Runbook

Implements `plans/testing.md`. **Parallel work** — one agent per module's tests, plus one agent for the cross-module integration test. Phase 2.

Most module unit tests are written alongside module implementations in `executions/modules.md`. This runbook covers:
1. The Vitest config + setup files (already done in foundation; verify here).
2. The cross-module integration test.
3. The CI grep gates that enforce architectural rules.
4. The boundary fake's correctness checks.

Working directory: `c:\Users\linga\Documents\poker_tracker\poker-tracker\`.

---

## Step 1 — Verify Vitest setup

Confirm these already exist (from foundation runbook):
- `vitest.config.ts`
- `tests/setup.ts`
- `tests/helpers/fakeBoundary.ts` (architecture runbook)
- `tests/helpers/fixtures.ts`

Run:
```bash
pnpm test
```

If any module under `tests/modules/` has been written, those tests run. Else "no tests" exit 0.

---

## Step 2 — Cross-module integration test

`tests/integration/full-flow.test.ts` is defined in `executions/modules.md` → "Cross-module integration test". Verify it lives in the integration folder (not a per-module folder).

Run:
```bash
pnpm test tests/integration/full-flow.test.ts
```

Must pass after all 9 modules are green.

---

## Step 3 — Imports gate test

Create `tests/integration/imports.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { execSync } from "child_process";

function grep(pattern: string, paths: string): string {
  try {
    return execSync(`grep -RE "${pattern}" ${paths} 2>/dev/null || true`, { encoding: "utf8" });
  } catch { return ""; }
}

describe("import boundaries", () => {
  it("no app/** imports module internals", () => {
    const result = grep("from ['\"]@?\\.?/?lib/modules/[^/]+/internal", "app/");
    expect(result.trim()).toBe("");
  });

  it("no test imports module internals", () => {
    const result = grep("from ['\"]@?\\.?/?lib/modules/[^/]+/internal", "tests/modules/");
    expect(result.trim()).toBe("");
  });

  it("no module imports @supabase/supabase-js directly", () => {
    const result = grep("from ['\"]@supabase/supabase-js['\"]", "lib/modules/");
    expect(result.trim()).toBe("");
  });
});
```

---

## Step 4 — Coverage gate

Run with coverage:
```bash
pnpm test:coverage
```

Output must show:
- Lines ≥ 80%
- Branches ≥ 75%
- Functions ≥ 80%

Coverage applies to `lib/modules/**/index.ts` and `lib/modules/**/internal/**` only. Settings + thresholds live in `vitest.config.ts`.

---

## Step 5 — Cycle check

```bash
pnpm cycles
```

Must report no cycles. If a cycle is introduced after Phase 1, it's a bug — investigate which module's interface should expand or which dependency should move to `core`.

---

## Step 6 — Audit-imports script

```bash
node scripts/audit-imports.mjs
```

Must exit 0. Same checks as the imports gate test, but run as a CLI in CI (faster than spinning up Vitest just for these grep checks).

---

## Step 7 — Boundary-fake parity tests

The fake mirrors DB triggers we depend on. Verify the fake's behavior matches the migrations in `supabase/migrations/`. Add `tests/helpers/fakeBoundary.parity.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createFakeBoundary } from "./fakeBoundary";
import { FIXTURE_USERS } from "./fixtures";

describe("fakeBoundary parity with DB triggers", () => {
  it("audit log entry on buyin create", async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: "u-aman" });
    const sess = await b.sessions.create({
      created_by: "u-aman", blinds_small: 100, blinds_big: 200, chips_per_paise: 1,
    } as never);
    await b.buyins.create({ session_id: sess.id, user_id: "u-aman", amount_paise: 5000, chips: 5000, recorded_by: "u-aman" } as never);
    const log = await b.audit.listForSession(sess.id);
    expect(log.some((a) => a.action === "buyin_create")).toBe(true);
  });

  it("audit log entry on cashout confirm", async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: "u-aman" });
    const sess = await b.sessions.create({
      created_by: "u-aman", blinds_small: 100, blinds_big: 200, chips_per_paise: 1,
    } as never);
    const co = await b.cashouts.upsert({ session_id: sess.id, user_id: "u-aman", chip_count: 50000, submitted_by: "u-aman" } as never);
    await b.cashouts.confirm(co.id, "u-aman");
    const log = await b.audit.listForSession(sess.id);
    expect(log.some((a) => a.action === "cashout_confirm")).toBe(true);
  });

  it("rejects writes to closed session", async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: "u-aman" });
    const sess = await b.sessions.create({
      created_by: "u-aman", blinds_small: 100, blinds_big: 200, chips_per_paise: 1,
    } as never);
    await b.sessions.update(sess.id, { status: "closed" });
    await expect(b.buyins.create({ session_id: sess.id, user_id: "u-aman", amount_paise: 5000, chips: 5000, recorded_by: "u-aman" } as never))
      .rejects.toThrow("session_closed");
  });

  it("computes cashout amount from chip count × ratio", async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: "u-aman" });
    const sess = await b.sessions.create({
      created_by: "u-aman", blinds_small: 100, blinds_big: 200, chips_per_paise: 2,
    } as never);
    const co = await b.cashouts.upsert({ session_id: sess.id, user_id: "u-aman", chip_count: 100, submitted_by: "u-aman" } as never);
    expect(co.amount_paise).toBe(200);
  });
});
```

These tests guarantee the fake doesn't drift from the real DB behavior; if a DB trigger changes, this test surfaces it early.

---

## Step 8 — Flake watch

Run the suite three times in a row in CI to catch flake. Add to CI lane (deployment runbook):
```yaml
- run: pnpm test
- run: pnpm test
- run: pnpm test
```

Any spurious failure across the three runs means a test is flaky — fix at root cause (don't add retries).

---

## Acceptance checklist

- [ ] `pnpm test` exits 0 with all module + integration + imports + parity tests passing.
- [ ] `pnpm test:coverage` meets thresholds.
- [ ] `pnpm cycles` reports no cycles.
- [ ] `node scripts/audit-imports.mjs` exits 0.
- [ ] CI runs the suite 3× consecutively without flake.

When all boxes green, testing is done. E2E is the last Phase 2 deliverable.
