# profiles

Per-player view: lifetime stats, history, bankroll series, badges.

## Public interface

See `index.ts`.

## Dependencies

- `core`, `ledger`, `badges`, `DbBoundary.{profiles,sessions}`.

## Test plan

`tests/modules/profiles/` — aggregate correctness, streak math, bankroll ordering, self-only update.
