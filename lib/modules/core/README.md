# core

Shared primitives: chip↔INR conversion, formatting, P&L math, permission checks, settings access.

## Public interface

See `index.ts`.

## Inputs / outputs

- Pure helpers: synchronous, no side effects.
- Settings: async; reads/writes the `app_settings` singleton via DbBoundary.

## Dependencies

- `DbBoundary.appSettings` only.

## Owned shared primitives

All of them except `audit` (owned by `ledger`).

## Test plan

`tests/modules/core/` — unit tests for every pure function plus settings round-trips against `fakeBoundary`.
