# badges

Achievement rules engine + awarding on session close.

## Public interface

See `index.ts`.

## Dependencies

- `core`, `ledger`, `DbBoundary.{badges,sessions}`.

## Test plan

`tests/modules/badges/` — one rule per file with hand-built fixtures; idempotency; registry adds new rules without schema change.
