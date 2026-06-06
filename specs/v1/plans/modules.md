# Modules Plan

Per-module implementation playbook. Each section is a **self-contained work item** for one parallel agent. An agent assigned `<module>` reads:
1. `requirments.md`
2. `plan.md` (orchestrator)
3. `plans/architecture.md` (interface contract — frozen)
4. This file's section for `<module>` only

Every module follows the same shape: `index.ts` exports the frozen interface; `internal/` holds private code; tests live in `tests/modules/<module>/` and import only from `index.ts`.

---

## Universal rules for every module agent

1. **Do not change the public interface.** It's frozen in `architecture.md`. If it's wrong, stop and request a revision — don't patch.
2. **Edit only your module's folder + your module's test folder.**
3. **Use the `DbBoundary` interface for all Supabase access.** Don't import `@supabase/supabase-js` directly from module code. Boundary is injected via factory.
4. **Use shared primitives from `core`.** Never re-implement chip↔INR conversion, formatting, or permission checks.
5. **Add an audit log entry for every write-path action** that mutates ledger or session state (the DB trigger handles the actual insert; you call the typed wrapper).
6. **Handle session-closed lockout.** Every write checks `assertSessionOpen` before proceeding.
7. **No retries, no fallbacks, no error-recovery shims.** Errors propagate. The frontend handles UX.
8. **Tests pass before you merge.** Vitest + the boundary fake. No Supabase running during unit tests.

Module folder template (already scaffolded by foundation):
```
lib/modules/<module>/
├── index.ts           # PUBLIC — re-exports public types + functions
├── types.ts           # Public types only
├── README.md          # Mirror of this section
└── internal/
    ├── queries.ts     # DbBoundary calls
    ├── logic.ts       # Pure domain functions
    ├── factory.ts     # Wires DbBoundary into the public functions
    └── (other files as needed)
```

---

## Module: `core`

**Agent task:** implement the shared primitives. Everything else depends on these — `core` is the **only** Phase 1 module that other Phase 1 modules wait on. Ship `core` first within Phase 1.

### Implementation
- `internal/units.ts` — branded-type constructors and conversions (`asPaise`, `asChips`, `chipsToPaise`, `paiseToChips`).
- `internal/format.ts` — `formatINR`, `formatDate`, `formatDateTime`. Use `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`. Drop the trailing `.00` if integral rupees.
- `internal/pl.ts` — `computeNetPL` pure function.
- `internal/permissions.ts` — `permissionFor`, `assertSessionOpen`. Pure given inputs.
- `internal/settings.ts` — `getChipRatio` / `setChipRatio` — only file in `core` that touches `DbBoundary`. Backed by the singleton `app_settings` row.

### Inputs / outputs
- Pure helpers: synchronous, no side effects.
- Settings: async, single-row read/update on `app_settings`.

### Tests (`tests/modules/core/`)
- `units.test.ts` — round-trip conversions; rounding behavior at boundaries.
- `format.test.ts` — INR formatting with paise edge cases (0, 1 paisa, ₹1 crore).
- `pl.test.ts` — net = cashout − total buy-ins; negative, zero, large.
- `permissions.test.ts` — house, participant, none paths.
- `settings.test.ts` — get returns default; set updates; concurrent reads.

### Done when
- All public exports in `index.ts` match `architecture.md`.
- Vitest green.
- No imports from any other `lib/modules/*`.

---

## Module: `auth`

**Agent task:** wrap Supabase Auth + the `join_session_with_token` RPC behind the `auth` interface.

### Implementation
- `internal/client.ts` — supplies the typed `DbBoundary.auth` namespace.
- `internal/magic-link.ts` — `signInWithMagicLink(email, redirectTo)`. Wraps `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } })`.
- `internal/current-user.ts` — `getCurrentUser` reads `auth.getUser()` + joins `profiles` row. Caches per-request on the server (uses `cache()` from `react`).
- `internal/join-session.ts` — `joinSessionByToken` calls the `join_session_with_token` Postgres RPC.

### Cross-module rule
- `auth` only consumes `core` types. It never imports `sessions` or `ledger`.
- Onboarding flow (first-time users) creates a `profiles` row with email-derived nickname; user can rename later via `profiles` module.

### Tests (`tests/modules/auth/`)
- Magic-link send: payload shape correct, propagates Supabase errors.
- `getCurrentUser`: signed in, signed out.
- `joinSessionByToken`: valid token → SessionId; invalid token → throws specific error class; closed session token → throws.

### Done when
- Server-side and client-side usage both work (Server Component + client component examples in README).
- All tests green.

---

## Module: `sessions`

**Agent task:** session lifecycle and participants.

### Implementation
- `internal/queries.ts` — CRUD over `sessions` and `session_participants` via DbBoundary.
- `internal/create.ts` — `createSession`: inserts row with `created_by = current_user`, `chips_per_paise` snapshotted from `core.getChipRatio()`. Inserts the creator into `session_participants`.
- `internal/close.ts` — `closeSession`: requires every participant has a confirmed cashout (calls `ledger.listCashouts` — **this is the one cross-module call**, justified). Sets `status='closed'`, `closed_at=now()`. Triggers `badges.evaluateBadgesForSession` (fire-and-forget on success path).
- `internal/invite.ts` — `generateInviteUrl(sessionId)` returns `${origin}/join/${invite_token}`.

### Edge cases
- `closeSession` while there are open buy-ins (no cashout submitted) → throw `IncompleteCashoutsError`.
- `addParticipant`/`removeParticipant` only allowed while session is open.
- A participant without buy-ins still counts as a participant (zero-net session).

### Tests (`tests/modules/sessions/`)
- create → addParticipant → close: happy path with all cashouts confirmed.
- close-with-pending-cashouts → throws.
- non-house attempting close → throws permission error.
- generateInviteUrl idempotent (same token → same URL).

### Done when
- All operations are idempotent or explicitly mutating with audit-log effect.
- Tests green.

---

## Module: `ledger`

**Agent task:** the heaviest module. Buy-ins, cash-outs, P&L computation, reconciliation, audit log access. Has the highest test density.

### Implementation
- `internal/buyins.ts` — `recordBuyin`, `editBuyin`, `deleteBuyin`, `listBuyins`. House-only writes. Each write also calls `internal/audit.ts` to log before/after. Rejects when session is closed.
- `internal/cashouts.ts` — `submitCashout` (player or house), `confirmCashout` (house only). On submit, `chip_count → amount_paise` is computed by the DB trigger; in-app, also call `core.chipsToPaise` for echo and validation. `confirmCashout` flips status from `pending` → `confirmed`.
- `internal/reconciliation.ts` — `getReconciliation`: expected = Σ buy-ins; actual = Σ cashouts; `discrepancy = expected − actual`. (Should be 0 on a well-reconciled session.)
- `internal/player-ledger.ts` — `getSessionLedger`: per-player rollup of buy-ins + cashout + net.
- `internal/audit.ts` — typed wrapper. The DB trigger writes `audit_log` rows automatically; this wrapper exposes a typed read API (`listAudit`) and re-shapes JSON-blob `before`/`after` into typed events.

### Validation rules
- `amount_paise > 0` for buy-ins.
- `chip_count >= 0` for cashouts (a player can lose all chips).
- Cashouts unique per `(session_id, user_id)`; submitting a second time edits the existing row (status returns to `pending` until re-confirmed).
- Edits to a confirmed cashout flip status back to `pending`.

### Tests (`tests/modules/ledger/`)
- buy-in lifecycle: record → edit → delete, audit entries verified.
- cash-out lifecycle: submit → confirm; edit-after-confirm flips to pending.
- session ledger correctness: 3 players, multiple buy-ins each, expected net per player matches.
- reconciliation: discrepancy detection.
- permission rejections: non-house edit, non-participant submit.
- session-closed lockout: every write fails post-close.

### Done when
- 100% of public functions covered by tests.
- Reconciliation correct on the seed-data closed session fixture.

---

## Module: `leaderboard`

**Agent task:** aggregate closed-session ledger results into all-time standings.

### Implementation
- `internal/aggregate.ts` — pulls all closed sessions via `ledger.getSessionLedger` (one query per session, batched). Reduces into `LeaderboardEntry[]`.
- Optionally: a Postgres view `leaderboard_view` for performance — but only if measured to be slow on realistic data (~20 players × 100 sessions). Decide at implementation time.
- Filtering: `from`/`to` date filter applied to `sessions.played_on`.
- Sort: in-app sort, not DB-side, since dataset is small.

### Tests (`tests/modules/leaderboard/`)
- Aggregation correctness: hand-computed expected on a 4-session, 3-player fixture.
- Date filter: include/exclude boundaries (inclusive).
- Sort orderings: each `LeaderboardSort` value.
- Player with 0 closed sessions excluded.

### Done when
- `getLeaderboard()` returns ranked entries on seed data with all sortings working.

---

## Module: `profiles`

**Agent task:** per-player view combining ledger history + badges + bankroll series.

### Implementation
- `internal/profile.ts` — `getProfile(userId)`:
  - Pulls `profiles` row (nickname, avatar).
  - Pulls all closed sessions where user is a participant via `ledger`.
  - Computes lifetime net, sessionsPlayed, biggestWin, biggestLoss, currentStreak.
  - Pulls earned badges via `badges.listBadgesForUser`.
  - Computes bankroll series: cumulative net by session-close date.
- `internal/update.ts` — `updateProfile` (self only).
- `internal/streak.ts` — pure function: from a chronologically sorted array of net-per-session, compute current streak (consecutive wins or losses up to most recent).

### Tests (`tests/modules/profiles/`)
- `getProfile` end-to-end against seed fixture.
- Streak: monotonic wins, monotonic losses, zero-mid sessions, alternating.
- Bankroll series: ordering, cumulative correctness.
- `updateProfile`: self allowed, other rejected.

### Done when
- Profile renders on a fixture without missing fields.

---

## Module: `badges`

**Agent task:** rules engine that evaluates badge eligibility on session close.

### Starter rule set
- `first_session` — awarded on the user's first closed session.
- `streak_10` — 10 consecutive sessions played.
- `biggest_pot` — held by the user with the largest single-session win across all closed sessions; transfers to a new holder if surpassed.
- `comeback_kid` — at any point during the session the user's net was below `-2 × big_blind`, and finished net positive.

### Implementation
- `internal/rules/` — one file per rule. Each rule is `(ctx) => Badge | null` where `ctx` includes the just-closed session ledger + the user's history.
- `internal/registry.ts` — registers all rules so adding a new badge means adding a new file (no schema change).
- `internal/evaluate.ts` — `evaluateBadgesForSession`: pulls the session ledger, runs each rule for each participant, dedupes against existing awards, inserts new badges.
- Idempotency: re-evaluating an already-evaluated session is a no-op.

### Tests (`tests/modules/badges/`)
- Each rule has its own test file with hand-built fixtures.
- Idempotency: evaluate twice → no duplicates.
- Add a "fake" rule and confirm registry picks it up without DB changes.

### Done when
- All four starter rules pass tests; the registry pattern lets the frontend display "earned this session" badges right after close.

---

## Module: `media`

**Agent task:** notes (text) and photos (storage) attached to a session.

### Implementation
- `internal/notes.ts` — CRUD on `notes` table. Anyone in the session can add; only author can edit/delete. `listNotes` ordered desc by `created_at`.
- `internal/photos.ts` — `uploadPhoto`:
  - Validate: image MIME type, max 10 MB.
  - Upload via `DbBoundary.storage.upload(path, file)` where `path = ${sessionId}/${uuid}.${ext}`.
  - Insert metadata row in `photos`.
  - Return `Photo` with `url` from `getSignedUrl`.
- `deletePhoto` — uploader only; deletes both Storage object and metadata row.

### Tests (`tests/modules/media/`)
- Notes: add/edit/delete; non-author edit rejected.
- Photos: upload happy path, oversize rejection, wrong-MIME rejection, non-uploader delete rejection.
- Participant gating: non-participant cannot list, add, or upload.

### Done when
- Notes panel and photo gallery have data layers that just work for the frontend agent.

---

## Module: `export`

**Agent task:** generate CSV and PDF for a single session and CSV for full history.

### Implementation
- `internal/csv-session.ts` — columns: `played_on,user,nickname,total_buyins_inr,cashout_inr,net_inr`. Use `papaparse` (add as dep in this module's section of `package.json`). Build a Blob with `text/csv;charset=utf-8;`.
- `internal/csv-history.ts` — wide form with one row per (session, player).
- `internal/pdf-session.ts` — use `@react-pdf/renderer`. Layout: header (date/location/blinds), participants table with buy-ins/cashout/net, totals row, footer with reconciliation status. Returns a Blob.
- All exports go through `ledger` and `sessions` interfaces — no direct DB access.

### Permission
- Session export: requester must be a participant of that session.
- Full history: any authenticated user (it's the friend group's group history).

### Tests (`tests/modules/export/`)
- CSV column shape against a fixture.
- CSV numerical correctness (chips→INR rounding).
- PDF returns non-empty Blob with expected MIME.
- Permission: non-participant rejected for session export.

### Done when
- Hitting the export endpoint returns a downloadable file in dev.

---

## Cross-module integration smoke test (run after all modules ship)

End-to-end through interfaces only (no UI yet) — lives in `tests/integration/`:

```ts
// 1. Sign in as Aman (boundary fake auth).
// 2. Aman creates a session.
// 3. Generate invite, "join" Ravi and Priya via joinSessionByToken.
// 4. Record buy-ins for all three.
// 5. Each submits a cashout; Aman confirms.
// 6. Close session.
// 7. Assert: leaderboard reflects nets; profiles show new history entry; badges awarded; export produces CSV with right rows; audit log has all events.
```

This integration test runs in CI as a gate before frontend / E2E work.

---

## Acceptance checklist (per module agent)

- [ ] `index.ts` matches `architecture.md` exactly.
- [ ] `internal/` is private (ESLint blocks external imports).
- [ ] All tests in `tests/modules/<module>/` pass via `pnpm test`.
- [ ] No internal-collaborator mocks in tests.
- [ ] No direct `@supabase/supabase-js` imports — only `DbBoundary`.
- [ ] No re-implementations of `core` primitives.
- [ ] `README.md` mirrors this section's spec.

When every module's checklist is green, Phase 2 (frontend, testing-extensions, e2e) can begin.
