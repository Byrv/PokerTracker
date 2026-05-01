# auth

Magic-link sign-in, current-user resolution, session-invite onboarding.

## Public interface

See `index.ts`.

## Inputs / outputs

- `signInWithMagicLink(email, redirectTo)` — sends magic link.
- `getCurrentUser()` — returns the signed-in user or null.
- `joinSessionByToken(token)` — calls the `join_session_with_token` RPC.

## Dependencies

- `core` (UserId, SessionId types).
- `DbBoundary.auth`.

## Owned shared primitives

None.

## Test plan

`tests/modules/auth/` — magic-link payload, current user (signed in / out), token join (valid / invalid / closed).
