# v1.1 — Issue Backlog

Snapshot from https://github.com/Byrv/PokerTracker/issues taken on 2026-05-02.

## Bug reports (drive v1.1 scope)

| # | Title | Summary |
|---|---|---|
| [#11](11-issue-with-profile.md) | Issue with profile | Profile page fails to load when clicked. |
| [#12](12-vercel-error.md) | Vercel error | Generic "Something went wrong" Server Components error surfaces with no user-readable message. Improve error UX, and verify the right copy is shown when a non-participant tries to view a session. |
| [#13](13-issue-with-session-closing.md) | Issue with session closing | Need a policy/UX for sessions that are created but never closed (stale sessions, cleanup, ownership transfer). |

## Dependabot auto-bumps (low-priority — review and merge)

| # | Title |
|---|---|
| #1 | bump supabase/setup-cli from 1 to 2 |
| #2 | bump actions/upload-artifact from 4 to 7 |
| #3 | bump pnpm/action-setup from 4 to 6 |
| #4 | bump actions/checkout from 4 to 6 |
| #5 | bump actions/setup-node from 4 to 6 |
| #6 | bump the react group across 1 directory with 2 updates |
| #7 | bump eslint from 9.39.4 to 10.3.0 in the tooling group |
| #8 | bump @types/node from 20.19.39 to 25.6.0 |
| #9 | bump zod from 4.4.1 to 4.4.2 |
| #10 | bump react-hook-form from 7.74.0 to 7.75.0 |

Five workflow-action bumps and five dep bumps. Safe to merge in batches once CI passes; flag the React major and Node @types major for manual review (breaking-change risk).
