# export

CSV / PDF exports of sessions and full history.

## Public interface

See `index.ts`.

## Dependencies

- `core`, `ledger`, `sessions`, `DbBoundary.{sessions,buyins,cashouts,profiles}`.

## Test plan

`tests/modules/export/` — CSV column shape + numerics; PDF non-empty Blob; participant-only session export.
