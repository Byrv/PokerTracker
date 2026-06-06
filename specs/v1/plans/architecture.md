# Architecture Plan

Defines the v1 module breakdown, public interfaces, dependency graph, and shared primitives. Runs **third**, **sequentially**, **single agent**, after `database.md`. Output is the **contract** for all parallel Phase 1 / Phase 2 work — once approved, public interfaces are frozen.

This file is the plan-time architectural audit demanded by `requirments.md` → "Architectural Requirements".

---

## Module map (v1)

| Module | Purpose | Folder |
|---|---|---|
| `core` | Shared primitives (chip↔INR conversion, INR/date formatting, permission checks, settings access) | `lib/modules/core/` |
| `auth` | Supabase Auth wrapper, magic link, current user, session-invite onboarding | `lib/modules/auth/` |
| `sessions` | Create / configure / close sessions, manage participants, generate invite links | `lib/modules/sessions/` |
| `ledger` | Buy-ins, cash-outs, P&L, reconciliation, audit log | `lib/modules/ledger/` |
| `leaderboard` | All-time standings + filtering | `lib/modules/leaderboard/` |
| `profiles` | Per-player history, lifetime stats, charts data | `lib/modules/profiles/` |
| `badges` | Achievement rules engine + awarding | `lib/modules/badges/` |
| `media` | Notes + photos attached to a session | `lib/modules/media/` |
| `export` | CSV / PDF export of session or full history | `lib/modules/export/` |

9 modules. Each owns its domain logic **and** its data access (Supabase queries). UI layer consumes these; modules never reach into UI.

---

## Dependency diagram

```
                 ┌─────────┐
                 │  core   │ ◄── (everyone)
                 └─────────┘
                      ▲
        ┌─────────────┼─────────────┐
        │             │             │
   ┌─────────┐   ┌─────────┐   ┌─────────┐
   │  auth   │   │sessions │   │ ledger  │
   └─────────┘   └─────────┘   └─────────┘
        ▲             ▲             ▲
        │             │             │
        │       ┌─────┴─────┐ ┌─────┴────────┐
        │       │           │ │              │
        │  ┌────────┐  ┌────────┐  ┌──────────┐
        │  │ media  │  │ badges │  │leaderboard│
        │  └────────┘  └────────┘  └──────────┘
        │                  ▲
        │                  │
        │            ┌──────────┐
        └────────────│ profiles │
                     └──────────┘
                          │
                          ▼
                     ┌──────────┐
                     │  export  │
                     └──────────┘
```

Edges (justified, one-line each):
- `auth → core` — uses permission types and current-user shape.
- `sessions → core, auth` — needs current user; uses settings (chip ratio).
- `ledger → core, auth, sessions` — needs current user, session metadata, chip-ratio snapshot, permission checks.
- `leaderboard → core, ledger` — aggregates closed-session ledger results.
- `media → core, auth, sessions` — needs participant check, current user, session reference.
- `badges → core, ledger` — evaluates rules against ledger results on session close.
- `profiles → core, ledger, badges` — combines per-player ledger history + earned badges.
- `export → core, ledger, sessions` — formats ledger + session metadata into CSV/PDF.

**Cycle check:** none. Verified by topological sort: `core → auth → sessions → ledger → {leaderboard, media, badges} → profiles → export`.

---

## Shared primitives (DRY enforcement)

| Primitive | Owning module | Why here |
|---|---|---|
| `chipsToPaise(chips, chipsPerPaise)` / `paiseToChips` | `core` | Pure math; used by ledger, leaderboard, profiles, export |
| `formatINR(paise)` | `core` | Display helper; used by every UI page indirectly |
| `formatDate(d)` / `formatDateTime(d)` | `core` | Display helper |
| `isSessionHouse(userId, session)` / `isSessionParticipant(userId, session)` | `core` | Permission checks; mirrors DB helpers; used by sessions, ledger, media |
| `getChipRatio()` / `setChipRatio()` | `core` | Settings access |
| `computeNetPL(buyins, cashout)` | `core` | Pure P&L math; used by ledger, leaderboard, profiles, badges, export |
| `assertSessionOpen(session)` | `core` | Guard for write paths; used by ledger, media |
| `audit(action, before, after, actor)` | `ledger` | All audit-log writes go through here (DB trigger does the actual insert; this is the typed wrapper) |

No other module may re-implement any of these.

---

## Module specifications

For each module: **public interface**, **inputs/outputs**, **dependencies**, **owned primitives**, **test plan**. This satisfies the plan-time audit checklist.

### `core`
**Public interface (`lib/modules/core/index.ts`):**
```ts
export type UserId = string & { __brand: 'UserId' };
export type SessionId = string & { __brand: 'SessionId' };
export type Paise = number & { __brand: 'Paise' };
export type Chips = number & { __brand: 'Chips' };

export type Permission = 'house' | 'participant' | 'none';

export type ChipRatio = { chipsPerPaise: number };

export function chipsToPaise(chips: Chips, ratio: ChipRatio): Paise;
export function paiseToChips(paise: Paise, ratio: ChipRatio): Chips;
export function formatINR(p: Paise): string;
export function formatDate(d: Date | string): string;
export function formatDateTime(d: Date | string): string;
export function computeNetPL(totalBuyinsPaise: Paise, cashoutPaise: Paise): Paise;
export function assertSessionOpen(s: { status: 'open' | 'closed' }): void;
export function getChipRatio(): Promise<ChipRatio>;
export function setChipRatio(r: ChipRatio): Promise<void>;
export function permissionFor(userId: UserId, session: { createdBy: UserId; participants: UserId[] }): Permission;
```
**Inputs/outputs:** pure functions for math/format; async functions for settings. No domain side effects beyond `app_settings` table.
**Deps:** Supabase client (only for settings).
**Owned primitives:** all of them except `audit`.
**Test plan:** pure-function tests with edge values (0, large numbers, rounding). Settings tests against a fake Supabase client.

### `auth`
**Public interface:**
```ts
export type CurrentUser = { id: UserId; email: string; nickname: string; avatarUrl?: string };
export function signInWithMagicLink(email: string, redirectTo: string): Promise<void>;
export function signOut(): Promise<void>;
export function getCurrentUser(): Promise<CurrentUser | null>;
export function requireUser(): Promise<CurrentUser>;            // throws if not signed in
export function joinSessionByToken(token: string): Promise<SessionId>;  // calls join_session_with_token RPC
```
**Deps:** `core` (UserId type), Supabase Auth client.
**Owned primitives:** none.
**Test plan:** through the public surface, with a fake Supabase Auth client. Cover: sign-in, sign-out, current-user fetch, token join (valid + invalid + closed-session token).

### `sessions`
**Public interface:**
```ts
export type Session = {
  id: SessionId;
  createdBy: UserId;
  name?: string;
  location?: string;
  playedOn: string;       // ISO date
  blinds: { small: Paise; big: Paise };
  chipsPerPaise: number;
  status: 'open' | 'closed';
  inviteToken: string;
  participants: UserId[];
};

export function createSession(input: { name?: string; location?: string; blinds: { small: Paise; big: Paise } }): Promise<Session>;
export function getSession(id: SessionId): Promise<Session>;
export function listSessions(filter?: { status?: 'open' | 'closed' }): Promise<Session[]>;
export function addParticipant(sessionId: SessionId, userId: UserId): Promise<void>;
export function removeParticipant(sessionId: SessionId, userId: UserId): Promise<void>;
export function closeSession(sessionId: SessionId): Promise<Session>;     // requires all cashouts confirmed
export function generateInviteUrl(sessionId: SessionId): Promise<string>;
```
**Deps:** `core`, `auth`.
**Owned primitives:** none.
**Test plan:** create → close happy path; permission rejections (non-house close attempts); reject close when cash-outs unconfirmed.

### `ledger`
**Public interface:**
```ts
export type Buyin = { id: string; sessionId: SessionId; userId: UserId; amount: Paise; chips: Chips; recordedAt: string };
export type Cashout = { id: string; sessionId: SessionId; userId: UserId; chipCount: Chips; amount: Paise; status: 'pending' | 'confirmed'; submittedBy: UserId; confirmedBy?: UserId };
export type Reconciliation = { expected: Paise; actual: Paise; discrepancy: Paise };
export type PlayerLedger = { userId: UserId; totalBuyinsPaise: Paise; cashoutPaise: Paise; netPaise: Paise };
export type AuditEntry = { id: string; sessionId: SessionId; actor: UserId; action: string; before: unknown; after: unknown; createdAt: string };

export function recordBuyin(input: { sessionId: SessionId; userId: UserId; amount: Paise }): Promise<Buyin>;
export function editBuyin(id: string, patch: { amount?: Paise }): Promise<Buyin>;
export function deleteBuyin(id: string): Promise<void>;
export function listBuyins(sessionId: SessionId): Promise<Buyin[]>;

export function submitCashout(input: { sessionId: SessionId; userId: UserId; chipCount: Chips }): Promise<Cashout>;
export function confirmCashout(id: string): Promise<Cashout>;
export function listCashouts(sessionId: SessionId): Promise<Cashout[]>;

export function getSessionLedger(sessionId: SessionId): Promise<PlayerLedger[]>;
export function getReconciliation(sessionId: SessionId): Promise<Reconciliation>;

export function listAudit(sessionId: SessionId): Promise<AuditEntry[]>;
```
**Deps:** `core`, `auth`, `sessions`.
**Owned primitives:** `audit` (typed wrapper around the DB audit trigger).
**Test plan:** record/edit/delete buy-ins with audit entries; submit/confirm cash-outs; reconciliation math correctness; permission rejections (non-house edit, double-confirm); session-closed lockout.

### `leaderboard`
**Public interface:**
```ts
export type LeaderboardEntry = {
  userId: UserId;
  nickname: string;
  netPaise: Paise;
  sessionsPlayed: number;
  sessionsWon: number;            // net > 0 sessions
  winRate: number;                // sessionsWon / sessionsPlayed
  biggestWinPaise: Paise;
  averagePerSessionPaise: Paise;
};

export type LeaderboardFilter = { from?: string; to?: string };
export type LeaderboardSort = 'net' | 'sessions' | 'winRate' | 'biggestWin' | 'average';

export function getLeaderboard(filter?: LeaderboardFilter, sort?: LeaderboardSort): Promise<LeaderboardEntry[]>;
```
**Deps:** `core`, `ledger`.
**Owned primitives:** none.
**Test plan:** aggregation correctness across multiple sessions; date filter inclusivity; sort orders; player with zero closed sessions excluded.

### `profiles`
**Public interface:**
```ts
export type ProfileSummary = {
  user: { id: UserId; nickname: string; avatarUrl?: string };
  lifetime: { netPaise: Paise; sessionsPlayed: number; biggestWinPaise: Paise; biggestLossPaise: Paise; currentStreak: number };
  badges: Array<{ key: string; earnedAt: string; sessionId?: SessionId }>;
  history: Array<{ sessionId: SessionId; playedOn: string; netPaise: Paise }>;
  bankrollSeries: Array<{ at: string; cumulativeNetPaise: Paise }>;
};

export function getProfile(userId: UserId): Promise<ProfileSummary>;
export function updateProfile(patch: { nickname?: string; avatarUrl?: string }): Promise<void>;
```
**Deps:** `core`, `ledger`, `badges`.
**Owned primitives:** none.
**Test plan:** lifetime aggregate correctness; bankroll series ordering; streak calculation edges (alternating win/loss, zero-sessions player); profile-update permission (self only).

### `badges`
**Public interface:**
```ts
export type BadgeKey = 'first_session' | 'streak_10' | 'biggest_pot' | 'comeback_kid' | string;
export type Badge = { key: BadgeKey; earnedAt: string; sessionId?: SessionId };

export function evaluateBadgesForSession(sessionId: SessionId): Promise<Badge[]>;
export function listBadgesForUser(userId: UserId): Promise<Badge[]>;
```
**Deps:** `core`, `ledger`.
**Owned primitives:** none. Badge rules are pure functions internal to this module.
**Test plan:** rule-by-rule unit tests through `evaluateBadgesForSession`; idempotency (re-evaluating doesn't double-award); new-badge addition without schema change.

### `media`
**Public interface:**
```ts
export type Note = { id: string; sessionId: SessionId; authorUserId: UserId; body: string; createdAt: string; updatedAt: string };
export type Photo = { id: string; sessionId: SessionId; uploadedBy: UserId; url: string; caption?: string; createdAt: string };

export function listNotes(sessionId: SessionId): Promise<Note[]>;
export function addNote(input: { sessionId: SessionId; body: string }): Promise<Note>;
export function editNote(id: string, body: string): Promise<Note>;
export function deleteNote(id: string): Promise<void>;

export function listPhotos(sessionId: SessionId): Promise<Photo[]>;
export function uploadPhoto(input: { sessionId: SessionId; file: File; caption?: string }): Promise<Photo>;
export function deletePhoto(id: string): Promise<void>;
```
**Deps:** `core`, `auth`, `sessions`.
**Owned primitives:** none.
**Test plan:** participant-only access; author-only edit/delete; storage path correctness; upload size/type validation.

### `export`
**Public interface:**
```ts
export function exportSessionCSV(sessionId: SessionId): Promise<Blob>;
export function exportSessionPDF(sessionId: SessionId): Promise<Blob>;
export function exportFullHistoryCSV(): Promise<Blob>;
```
**Deps:** `core`, `ledger`, `sessions`.
**Owned primitives:** none.
**Test plan:** CSV column shape + numerical correctness against a fixture; PDF generation produces non-empty blob; permission rejection for non-participants.

---

## File-system contract per module

```
lib/modules/<module>/
├── index.ts          # Public surface — only this is importable from outside
├── types.ts          # Public types (re-exported from index.ts)
├── README.md         # One-page summary of this spec section
└── internal/         # Everything else — private
    ├── queries.ts    # Supabase calls
    ├── logic.ts      # Pure domain logic
    └── ...
```

ESLint `import/no-restricted-paths` rule (configured in `foundation.md`) enforces that `internal/` is never imported from outside the module.

---

## Boundary fake (used by every module's tests)

`lib/db/boundary.ts` defines a typed interface that wraps every Supabase call any module makes. Production: real Supabase client. Tests: `tests/helpers/fakeBoundary.ts` — in-memory fake.

```ts
// lib/db/boundary.ts (sketch)
export interface DbBoundary {
  sessions: { /* read/write functions */ };
  buyins: { /* ... */ };
  cashouts: { /* ... */ };
  // ...one namespace per table
  storage: { upload: (path: string, file: File) => Promise<string>; getSignedUrl: (path: string) => Promise<string> };
  auth: { currentUser: () => Promise<CurrentUser | null>; /* ... */ };
}
```

Modules accept the boundary via dependency injection (constructor or factory). Tests pass `fakeBoundary`; production passes the real one. **This is the only place external services are mocked.**

---

## Acceptance checklist

- [ ] `index.ts` exists for every module with the exact signatures above (or revised — but revisions live in this file too).
- [ ] Each module has a `README.md` with the five audit items (interface, I/O, deps, primitives, test plan).
- [ ] Dependency diagram is in this file and matches what each module's `index.ts` actually imports.
- [ ] Cycle check passes (run `madge --circular lib/modules/` in CI).
- [ ] Shared primitives table matches `lib/modules/core/index.ts` exports — no module re-implements them.
- [ ] ESLint boundary rule blocks any import that violates `index.ts`-only access.

When all boxes are checked, **public interfaces are frozen.** Phase 1 fan-out begins.
