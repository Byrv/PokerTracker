# ledger

Buy-ins, cash-outs, P&L, reconciliation, audit log.

## Public interface

See `index.ts`.

## Inputs / outputs

- Record/edit/delete buy-ins (house only).
- Submit/confirm cash-outs.
- Compute per-player and per-session ledger + reconciliation.
- Read the audit log.

## Dependencies

- `core` (Paise, Chips, conversions, computeNetPL, assertSessionOpen).
- `auth` (current user, permission checks via DbBoundary).
- `DbBoundary.{buyins,cashouts,audit,sessions}`.

## Owned shared primitives

The typed audit-log read API (DB triggers do the actual writes).

## Test plan

`tests/modules/ledger/` — heavy. Lifecycle of buyins + cashouts; reconciliation correctness; permission rejections; closed-session lockout.
