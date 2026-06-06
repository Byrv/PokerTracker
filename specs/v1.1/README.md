# Poker Tracker — v1.1

Iteration on top of [v1.0.0](../v1/) — the production release tagged at https://github.com/Byrv/PokerTracker/releases/tag/v1.0.0.

## Inputs

- [issues/INDEX.md](issues/INDEX.md) — snapshot of GitHub issues at v1.1 kickoff (3 bug reports + 10 dependabot bumps).
- [v1/requirments.md](../v1/requirments.md) — the frozen product spec from v1. v1.1 inherits it; new requirements get layered on top in `requirments.md` here once we draft one.

## Suggested layout (mirrors v1)

```
v1.1/
├── README.md          ← this file
├── issues/            ← captured GitHub issues at kickoff
├── requirments.md     ← TO DO: scope for v1.1 (which issues to ship + new asks)
├── plan.md            ← TO DO: orchestrator plan
├── execution.md       ← TO DO: master runbook
├── plans/             ← TO DO: per-area sub-plans (only the ones v1.1 touches)
└── executions/        ← TO DO: per-area runbooks
```

## Next step

Decide v1.1 scope before drafting `requirments.md`:

- Must-haves: #11 (profile load failure), #12 (visible error UX + non-participant gating), #13 (stale-session policy).
- Nice-to-haves: dependabot batches.
- Punt to v1.2: anything else.

Once scope is locked, `requirments.md` -> `plan.md` -> `execution.md` follows the same pattern as v1.
