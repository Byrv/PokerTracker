# sessions

Session lifecycle and participants.

## Public interface

See `index.ts`.

## Inputs / outputs

Session CRUD + participant management + invite-URL generation + close-with-validation.

## Dependencies

- `core` (UserId, SessionId, Paise, ChipRatio).
- `DbBoundary.sessions`.
- `auth` (current user) — via `DbBoundary.auth.getCurrentUser` (no direct module import).

## Owned shared primitives

None.

## Test plan

`tests/modules/sessions/` — create→addParticipant→close happy path; close-with-pending-cashouts rejection; non-house close rejection; invite URL idempotency.
