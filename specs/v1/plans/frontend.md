# Frontend Plan

Pages, routes, layouts, and page-level wiring. Runs in **Phase 2**, **after** `modules.md` modules and `ui.md` design system are ready. Designed for **fan-out parallelism**: each "page group" below can be built by a separate agent.

This plan owns `app/(app)/**` and `app/(marketing)/**`. It consumes module interfaces and UI components — never module internals.

---

## Page-group dispatch (parallel agents)

| Agent | Owns | Depends on (modules) |
|---|---|---|
| `auth-pages` | `app/sign-in/`, `app/auth/`, `app/join/`, `app/sign-out/` | `auth` (also defined by `plans/auth.md`) |
| `session-pages` | `app/(app)/sessions/**` | `sessions`, `ledger`, `media`, `core` |
| `leaderboard-pages` | `app/(app)/leaderboard/**` | `leaderboard`, `core` |
| `profile-pages` | `app/(app)/profile/**` | `profiles`, `badges`, `core` |
| `settings-pages` | `app/(app)/settings/**` | `core` (settings) |

These five agents work in parallel after Phase 1 finishes.

---

## Route map

```
/                              landing → redirect to /sessions if signed in
/sign-in                       magic-link form (auth.md)
/auth/callback                 code exchange (auth.md)
/join/[token]                  invite-link entry (auth.md)
/sign-out                      Server Action

/(app) layout: AppShell (UI agent) + auth gate (auth.md middleware)
  /sessions                    list of sessions (filter: all | open | mine)
    /new                       create-session form
    /[id]                      session detail (open or closed)
      /buyins                  add-buyin sheet (house only)
      /cashout                 submit/confirm cashout
      /close                   close-session confirmation
      /export                  download CSV / PDF (drawer)

  /leaderboard                 standings + filter / sort

  /profile                     current user's profile
  /profile/[userId]            view another player's profile

  /settings                    chip ratio + theme + about
```

All `/(app)/**` routes are authenticated (via middleware). All others are public.

---

## Page specs

### `/sessions` — Session list

**Owner:** `session-pages` agent.

**Server Component**: fetches `sessions.listSessions()` with optional `?status=open|closed` query param.

**Layout:**
- Sticky top: filter pills (All / Open / Closed / Mine).
- "New session" floating action button (bottom-right on mobile, top-right on desktop).
- Body: list of `<SessionCard>` items.
  - Open sessions show: date, location, # players, "join" or "view" CTA depending on participation.
  - Closed sessions show: date, location, your net (from leaderboard or ledger), participants count.

**Empty state:** prompts to create the first session.

### `/sessions/new` — Create session

**Form** (`react-hook-form` + `zod`):
- `name` (optional)
- `location` (optional)
- `playedOn` (date, default today)
- `blinds.small` and `blinds.big` (paise, INR-formatted input)
- `participants` (multi-select from existing players + "invite by link" hint)

**Action:** Server Action calls `sessions.createSession(...)` then redirects to `/sessions/[id]`. The creator is automatically added as the house and as a participant.

### `/sessions/[id]` — Session detail (the centerpiece)

**Server Component** loads:
- `sessions.getSession(id)`
- `ledger.listBuyins(id)`
- `ledger.listCashouts(id)`
- `ledger.getSessionLedger(id)`
- `ledger.getReconciliation(id)`
- `media.listNotes(id)`
- `media.listPhotos(id)`
- `auth.getCurrentUser()` → determines view mode

**Layout (mobile):** stacked sections, accessed via top tabs (`Ledger | Notes | Photos | Audit`).
**Layout (desktop):** ledger left (60%), sidebar right (40%) with tabs (Notes / Photos / Audit).

**Ledger section:**
- Header strip: session date, location, blinds, chip ratio snapshot, status pill (Open/Closed).
- Players table with columns: Player | Buy-ins (running total) | Cashout | Net.
  - Money values use `<MoneyAmount>`.
- Below table: house-only `<HouseControls>` block:
  - "Record buy-in" button → opens sheet (`/buyins` parallel route).
  - "Confirm cashouts" pending list with per-row Confirm button.
  - "Close session" button (disabled until reconciliation = 0 and all cashouts confirmed).
- Reconciliation strip: "Expected ₹X / Actual ₹Y / Discrepancy ₹Z" — green if 0, red otherwise.

**Open session, current user is participant (not house):**
- Same ledger view, read-only.
- "Submit your cashout" CTA when end-of-session phase; opens cashout drawer.

**Closed session view:**
- Same layout, all controls hidden, plus a top "Settlement" panel showing per-player net.
- Export CTA opens a drawer with CSV / PDF buttons.

**Notes tab:** `<NoteList>` + composer. Anyone in the session can add. Author can edit/delete. Polished UI (per requirements).

**Photos tab:** grid gallery. Tap to open lightbox. Upload button. Polished UI (per requirements).

**Audit tab:** chronological list of every buy-in / cashout / session-state change with actor, action, before/after summary. Used to settle disputes.

### Buy-in sheet (`/sessions/[id]/buyins`)

Parallel route rendered as a sheet (mobile) or dialog (desktop). House-only.

Form: pick a participant, enter INR amount. Submit → `ledger.recordBuyin(...)` → revalidate.

### Cashout drawer (`/sessions/[id]/cashout`)

Form: chip count input. Display computed INR using `core.chipsToPaise`. Submit → `ledger.submitCashout(...)` for current user (or any user, if house).

### Close-session confirm (`/sessions/[id]/close`)

Modal. Requires the session to have all cashouts confirmed and reconciliation = 0. On confirm → `sessions.closeSession(id)`. Triggers badge evaluation server-side. Redirects to closed view.

### `/leaderboard` — Standings

**Server Component** fetches `leaderboard.getLeaderboard(filter, sort)`.

**UI:**
- Top: filter (date range) + sort dropdown.
- Body: ranked list. Each row: rank, avatar, nickname, net, sessions played, win rate, biggest win.
- Top-3 styling: gold/silver/bronze accent strip on the row.

### `/profile` (current user) and `/profile/[userId]` (other)

**Server Component** fetches `profiles.getProfile(userId)`.

**UI sections:**
1. Header: avatar, nickname, lifetime net (big number), nickname/avatar edit (only on own profile).
2. Lifetime stats card: sessions played, biggest win, biggest loss, current streak.
3. Bankroll-over-time chart (`Recharts` line chart). Series passed through `<MoneyAmount>` formatting on tooltip.
4. Win-rate histogram (sessions binned by net, colored profit/loss).
5. Earned badges grid (with badge name + tooltip describing rule + earned-on session link).
6. Session history list, paginated.

### `/settings` — App settings

Sections:
1. **Chip ratio** — current value (chips per ₹) + edit. Edit modal warns: "Affects future sessions only. Closed sessions retain their original ratio." Submit → `core.setChipRatio(...)`.
2. **Theme** — light / dark / system toggle.
3. **About** — version, link to source, sign-out button.

---

## Data-fetching patterns

- **Default:** Server Component + module call. No client-side fetch where Server Components can do it.
- **Mutations:** Server Actions defined inline next to the page (e.g. `actions.ts` per route). Server Actions call module functions, then `revalidatePath`.
- **Forms:** `react-hook-form` + `zod`. Submit handler calls a Server Action.
- **Optimistic updates:** only for buy-in entry on the session detail page (mobile use case is a phone in one hand mid-game). Use `useOptimistic`. Roll back on error.

---

## Error & loading boundaries

Each route group has:
- `loading.tsx` — shows the matching `<LoadingSkeleton>` from UI agent.
- `error.tsx` — `<ErrorState>` with retry.
- `not-found.tsx` for missing-resource cases (`/sessions/[id]`, `/profile/[userId]`).

---

## Mobile interaction details

- Bottom-sheet form patterns for buy-in and cashout (`vaul`-backed shadcn `Sheet`).
- Long-press on a buy-in row (house only) opens edit/delete actions.
- Pull-to-refresh on session detail uses the standard browser behavior; we don't add custom gestures.

---

## Files this plan owns

```
app/sign-in/                      # auth-pages agent (also referenced in auth.md)
app/auth/
app/join/
app/sign-out/

app/(app)/layout.tsx              # uses <AppShell> from UI agent

app/(app)/sessions/                # session-pages agent
├── page.tsx
├── new/page.tsx
└── [id]/
    ├── page.tsx
    ├── actions.ts
    ├── @buyins/page.tsx          # parallel route
    ├── @cashout/page.tsx
    ├── @close/page.tsx
    └── export/page.tsx

app/(app)/leaderboard/page.tsx     # leaderboard-pages agent

app/(app)/profile/                 # profile-pages agent
├── page.tsx
└── [userId]/page.tsx

app/(app)/settings/page.tsx        # settings-pages agent
```

---

## Acceptance checklist (per page-group agent)

- [ ] All listed routes render against real modules in dev.
- [ ] Loading and error boundaries present.
- [ ] House view and player view of a session both render correctly.
- [ ] All money values rendered through `<MoneyAmount>` — not raw numbers.
- [ ] No direct Supabase imports anywhere in `app/**`.
- [ ] No imports from `lib/modules/**/internal/**` (ESLint enforces).
- [ ] Lighthouse score ≥ 90 (perf + a11y) on a representative page over 3G fast.
- [ ] Visual QA on iPhone 13 viewport (390 × 844) and desktop (1440 × 900).
