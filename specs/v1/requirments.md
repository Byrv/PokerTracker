# Poker Tracker — Requirements

A web app for a fixed friend group (~20 people) who play poker regularly. Tracks sessions, buy-ins, cash-outs, who-owes-whom, and lifetime standings. The "house" is the player organizing a given session — everyone pays the house, and the house distributes chips. The house role **rotates session-to-session**; any player can be the house. Phone-first, also works on desktop. Currency: INR only.

---

## Functional Requirements

### 1. Sessions / Games
- Any player can create a session and becomes that session's house.
- At creation, the house sets: date, location, players (selected from the friend group + invitees), and **blinds** (fixed for that session — different sessions can have different blinds).
- Chip ratio is **not** set per session — it's a global app setting (see Settings).
- The house ends/closes a session, which locks in final numbers and writes them to history.

### 2. House feature
- The session creator is the house for that session. The role rotates naturally — whoever creates the next session is the next house.
- The house has a **distinct UI** with extra controls (record buy-ins, edit entries, confirm cash-outs, close session).
- All buy-ins are paid to the house in real life; all cash-outs are paid by the house.
- House sees a running ledger of cash they should be holding: Σ buy-ins − Σ cash-outs.
- End-of-session reconciliation screen flags any discrepancy between expected and actual cash.

### 3. Buy-in / Rebuy / Top-up tracker
- Only the house enters buy-ins (players don't update during the game).
- Each buy-in is timestamped; multiple rebuys per player are allowed.
- Running total per player and per session is always visible to the house.
- **Buy-ins are editable after entry** by the house. Every edit is recorded in the audit log.

### 4. Cash-out / Payout
- At end of session, each player's final chip count is entered.
- Either the house OR the player can submit their final chip count, but the **house must confirm** before it's locked.
- App auto-converts chips → INR using the current chip ratio.
- Net P&L per player = cash-out − total buy-ins.
- Cash-outs are editable (with audit log) until the session is closed.

### 5. Earnings calculator
- Per session: net for each player, color-coded green/red.
- Validates Σ nets = 0; flags discrepancy if chips don't reconcile.

### 6. Leaderboard
- All-time leaderboard across all closed sessions.
- Sortable by: total net winnings, sessions played, win rate, biggest single-session win, average per session.
- Filterable by date range.
- Updates whenever a session is closed (no live updates needed).

### 7. Player profiles
- Lifetime stats, full session history, biggest win/loss, current streak.
- Avatar / nickname.
- Charts and badges live here.

### 8. Invite-only sessions
- The house generates a session invite link.
- Players open the link, sign in with email magic link (or sign up if it's their first session), and are added to the session.
- Each session has its own summary page that contributes to the leaderboard once closed.
- Players can view a **read-only** session screen (running buy-ins, who's in, running totals) — they cannot edit anything during the game.

### 9. Session notes
- Free-text notes per session — memorable hands, quotes, "Aman cracked aces with 7-2", etc.
- **Polished UI**: dedicated notes panel on the session summary, not an afterthought textarea. Editable by anyone in the session.

### 10. Photos
- Upload end-of-night photos (chip stacks, group photo, settlement screenshot) attached to the session.
- **Polished UI**: gallery view per session, lightbox on tap.

### 11. Statistics & charts
- Bankroll-over-time line chart per player.
- Win-rate histogram.
- Computed from stored sessions on page load — no live/realtime updates.

### 12. Achievements / badges
- Small starter set of fun ones — e.g. *first session*, *10-session streak*, *biggest single pot*, *comeback kid* (lost early, finished net positive).
- Shown on player profile.
- Designed so new badges can be added later without schema changes.

### 13. Export
- CSV / PDF export of a single session or full history.

### 14. Audit log
- Every create / edit of a buy-in or cash-out is logged with actor + timestamp.
- Visible to all players for transparency.

---

## Settings (global, app-wide)

- **Chip ratio** — e.g. ₹1 = 1 chip. Set once at app config. Editable later by any player; changes apply only to **future** sessions (existing closed sessions keep their original ratio).
- **Currency** — INR (fixed, not user-configurable).
- **Achievements** — defined in code, not in settings.

---

## End-to-end flow

1. House creates a session, sets blinds and players, generates invite link if needed.
2. Players join via email magic link.
3. During play: only the house records buy-ins / rebuys. Players see a read-only session screen.
4. End of session: house (or player, then confirmed by house) enters final chip counts. App computes net P&L.
5. App shows settlement summary — everyone settles through the house. House closes the session.
6. Closed session rolls up into leaderboard, profiles, charts, and badges.

---

## Out of scope (deliberately dropped)

- Multi-group / Crews — single friend group only.
- Settle-up minimization (everyone settles via the house, that's enough).
- Live in-game updates / players self-entering buy-ins.
- Blind timer / tournament structure.
- Tournament vs. cash-game mode toggle.
- Multi-currency (INR only).
- Reminders / unpaid-debt nags.
- Head-to-head / "rival" stats.
- Realtime subscriptions.
- Offline mode.

---

## Technical Requirements

- **Frontend:** Next.js (App Router, TypeScript). Phone-first, responsive to desktop.
- **PWA:** installable on phone home screen.
- **Database / Auth / Storage:** Supabase (Postgres + Auth + Storage). No Realtime — players refresh / re-fetch to see updates.
- **No custom backend** — Next.js Server Components / Server Actions talk directly to Supabase. Row-level security (RLS) enforces per-user access.
- **Auth:** Supabase Auth via **email magic link**. Joining a session requires a session invite link generated by the house — that's how new players onboard.
- **Roles:** every player has equal account status; the `house` role is per-session and assigned to the session's creator. UI branches off this role.
- **Hosting:** Vercel.
- **State:** Server Components by default; client state only where interactive forms need it (react-hook-form + zod).
- **Charts:** Recharts (decide at build time — fits shadcn aesthetic).
- **File storage:** Supabase Storage for session photos.
- **Testing:** Playwright for critical flows (create session → buy-in → cash-out → leaderboard updates).

---

## Design Requirements

- **Feel:** clean, utility-first, phone-first, one-handed-friendly. Not a casino skin.
- **Theme:** standard poker-table palette — felt green primary, card-red and card-black accents, cream/white canvas — applied tastefully. Dark mode required.
- **Component library:** shadcn/ui (Radix + Tailwind). Pull components from the web; don't design from scratch.
- **Typography:** one sans (Inter or Geist) + one tabular mono for numbers so chip counts align in tables.
- **Density:** money and chip counts are the hero — big, tabular, easy to scan. Everything else recedes.
- **House vs. player UI:** distinct. House sees session controls (start, record buy-in, edit, close, confirm cash-outs); players see a clean read-only session view, their profile, and the leaderboard.
- **Polished surfaces** (extra design effort here):
  - Session summary (notes + photos + ledger)
  - End-of-session settle-up
  - Leaderboard
  - Player profile (with charts and badges)
- **Responsive scope:** phone (primary) + desktop (responsive). Tablet works by default.

---

## Architectural Requirements

These rules are non-negotiable and apply to the plan generated from this document. The plan must decide the module breakdown itself — these rules constrain *how* modules are designed, not *which* modules exist.

### 1. Don't Repeat Yourself (DRY)
- Any logic used by more than one feature must live in exactly one place and be re-used.
- The plan must identify shared primitives in this codebase (conversion, math, formatting, validation, permission checks, etc.) and assign each to a single owning module.
- No feature module may re-implement a primitive locally.

### 2. Big, testable modules
- Prefer a small number of large modules over many small ones. Each top-level domain concern is **one** module with **one** public surface.
- A module owns its data access and its domain logic. UI components consume modules; modules do not consume UI.
- The plan decides the module breakdown and must justify it.

### 3. Reduce and simplify dependencies between modules
- Modules depend only on other modules' **published interfaces** — never on internal files, helpers, or queries.
- The plan must include a **dependency diagram** showing every cross-module edge, with a one-line justification for each edge.
- Cycles are forbidden. If two modules need each other, extract the shared concept into a third module.
- A module's public interface should be small enough to fit on one screen. If it isn't, the plan must explain why.

### 4. Interface-first, tested through the interface
- Every module ships a single entry file (e.g. `index.ts`) that exports:
  - TypeScript types for all inputs and outputs
  - The functions / classes that form the public surface
  - Nothing else — internal helpers do not leak.
- Tests import **only** from the module's public interface. Tests do not reach into internals, do not mock internal collaborators, and do not stub private functions.
- External boundaries (DB, storage, third-party APIs) are mocked at the **edge**, not inside the module. The module's tests run its real internals against a fake of the external boundary.
- Every module ships tests that exercise the full public surface — happy paths, validation errors, and permission rejections.

### Plan-time audit (the plan must include this)

For each module the plan defines, it must list:
1. **Public interface** — type signatures of all exports.
2. **Inputs / outputs** — what data flows in, what flows out.
3. **Dependencies** — which other modules' interfaces it imports, and why each is needed.
4. **Owned shared primitives** — which DRY primitives (if any) live here.
5. **Test plan** — the scenarios covered through the public interface, including the external boundary fake used.

If any of these five items is missing for a module, the plan is incomplete.
