import type { DbBoundary, SessionRow } from '@/lib/db/boundary';

/**
 * Helper that builds a minimal closed session in the fake boundary, adds the
 * given participants, records buy-ins, submits + confirms cashouts, then
 * marks the session closed. Returns the created session row.
 *
 * We deliberately stay on the boundary here (no module deps) so badge tests
 * remain isolated from sessions/ledger module behavior.
 */
export async function buildClosedSession(
  b: DbBoundary,
  opts: {
    createdBy: string;
    playedOn?: string; // ISO date YYYY-MM-DD
    blindsBig?: number;
    blindsSmall?: number;
    chipsPerPaise?: number;
    participants: string[];
    buyins: Array<{ userId: string; amountPaise: number }>;
    cashouts?: Array<{ userId: string; chipCount: number; confirm?: boolean }>;
  },
): Promise<SessionRow> {
  const session = await b.sessions.create({
    created_by: opts.createdBy,
    blinds_small: opts.blindsSmall ?? 100,
    blinds_big: opts.blindsBig ?? 200,
    chips_per_paise: opts.chipsPerPaise ?? 1,
    played_on: opts.playedOn ?? new Date().toISOString().slice(0, 10),
  });

  // Ensure all participants are in. Creator is auto-added by the boundary.
  for (const userId of opts.participants) {
    if (userId === opts.createdBy) continue;
    // Backdoor: insert participant directly via the (typed) boundary internals
    // by re-running the auth join flow. We don't want a real auth here, so we
    // poke the participants map by issuing a join-token flow. Easier path:
    // call sessions.create twice? No — use the public participants API.
    // The fake exposes only listParticipants/removeParticipant; to add we need
    // to use the join-token flow which mutates currentUserId. Save & restore.
    const prev = await b.auth.getCurrentUser();
    type SetCurrent = { __setCurrentUser: (id: string | null) => void };
    const fake = b as unknown as SetCurrent;
    fake.__setCurrentUser(userId);
    await b.auth.joinSessionWithToken(session.invite_token);
    fake.__setCurrentUser(prev?.id ?? null);
  }

  for (const buyin of opts.buyins) {
    await b.buyins.create({
      session_id: session.id,
      user_id: buyin.userId,
      amount_paise: buyin.amountPaise,
      chips: buyin.amountPaise * (opts.chipsPerPaise ?? 1),
      recorded_by: opts.createdBy,
    });
  }

  for (const c of opts.cashouts ?? []) {
    const row = await b.cashouts.upsert({
      session_id: session.id,
      user_id: c.userId,
      chip_count: c.chipCount,
      amount_paise: c.chipCount, // 1:1 default; fake recomputes from chips_per_paise
      submitted_by: c.userId,
    });
    if (c.confirm !== false) {
      await b.cashouts.confirm(row.id, opts.createdBy);
    }
  }

  // Close the session.
  type SetCurrent = { __setCurrentUser: (id: string | null) => void };
  (b as unknown as SetCurrent).__setCurrentUser(opts.createdBy);
  const closed = await b.sessions.update(session.id, {
    status: 'closed',
    closed_at: new Date().toISOString(),
  });
  return closed;
}
