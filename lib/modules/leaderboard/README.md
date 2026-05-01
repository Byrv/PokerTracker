# leaderboard

All-time standings + filters.

## Public interface

See `index.ts`.

## Dependencies

- `core`, `ledger`, `DbBoundary.{sessions,profiles,buyins,cashouts}`.

## Owned shared primitives

None.

## Test plan

`tests/modules/leaderboard/` — aggregation correctness, sort orders, date filters.
