import { describe, it, expect } from 'vitest';
import * as leaderboard from '@/lib/modules/leaderboard';
import { createFakeBoundary } from '../../helpers/fakeBoundary';
import { FIXTURE_USERS } from '../../helpers/fixtures';
import type { DbBoundary } from '@/lib/db/boundary';

/**
 * Helper: build a closed session with the given buy-ins and cashouts.
 * Bypasses sibling modules (sessions/ledger) and writes directly via DbBoundary.
 *
 * `entries` is { userId, buyinPaise, cashoutPaise }[]; each entry becomes
 * a single buy-in + a single confirmed cashout with `chip_count` chosen so
 * that `chip_count * chips_per_paise === cashoutPaise` (chips_per_paise = 1
 * in the fake by default).
 */
async function buildClosedSession(
  b: DbBoundary,
  opts: {
    sessionId: string;
    createdBy: string;
    playedOn: string; // ISO yyyy-mm-dd
    entries: Array<{ userId: string; buyinPaise: number; cashoutPaise: number }>;
  },
) {
  const session = await b.sessions.create({
    id: opts.sessionId,
    created_by: opts.createdBy,
    played_on: opts.playedOn,
    blinds_small: 100,
    blinds_big: 200,
    chips_per_paise: 1,
    invite_token: `tok_${opts.sessionId}`,
  });

  // Add every entry's user as a participant (creator was added by sessions.create).
  for (const e of opts.entries) {
    if (e.userId === opts.createdBy) continue;
    // Use joinSessionWithToken via the fake.
    const before = b as DbBoundary & {
      __setCurrentUser: (id: string | null) => void;
    };
    before.__setCurrentUser(e.userId);
    await b.auth.joinSessionWithToken(session.invite_token);
  }

  // Record buy-in + cashout for each entry.
  for (const e of opts.entries) {
    if (e.buyinPaise > 0) {
      await b.buyins.create({
        session_id: session.id,
        user_id: e.userId,
        amount_paise: e.buyinPaise,
        chips: e.buyinPaise,
        recorded_by: opts.createdBy,
      });
    }
    const co = await b.cashouts.upsert({
      session_id: session.id,
      user_id: e.userId,
      chip_count: e.cashoutPaise, // chips_per_paise=1 → amount_paise === chip_count
      amount_paise: e.cashoutPaise,
      submitted_by: e.userId,
    });
    await b.cashouts.confirm(co.id, opts.createdBy);
  }

  // Close the session.
  await b.sessions.update(session.id, { status: 'closed', closed_at: new Date().toISOString() });

  return session;
}

function freshBoundary() {
  return createFakeBoundary({ users: FIXTURE_USERS, currentUserId: 'u-aman' });
}

describe('leaderboard', () => {
  it('aggregates closed sessions: net, sessionsPlayed, sessionsWon, biggestWin, average, winRate', async () => {
    const b = freshBoundary();

    // Session A (2026-01-10): Aman +20000, Ravi -20000.
    await buildClosedSession(b, {
      sessionId: 's-a',
      createdBy: 'u-aman',
      playedOn: '2026-01-10',
      entries: [
        { userId: 'u-aman', buyinPaise: 50000, cashoutPaise: 70000 },
        { userId: 'u-ravi', buyinPaise: 50000, cashoutPaise: 30000 },
      ],
    });

    // Session B (2026-02-15): Aman -10000, Ravi +5000, Priya +5000.
    await buildClosedSession(b, {
      sessionId: 's-b',
      createdBy: 'u-aman',
      playedOn: '2026-02-15',
      entries: [
        { userId: 'u-aman', buyinPaise: 20000, cashoutPaise: 10000 },
        { userId: 'u-ravi', buyinPaise: 20000, cashoutPaise: 25000 },
        { userId: 'u-priya', buyinPaise: 20000, cashoutPaise: 25000 },
      ],
    });

    // Session C (2026-03-20): Priya +1000, Karan -1000. Priya is the house here.
    await buildClosedSession(b, {
      sessionId: 's-c',
      createdBy: 'u-priya',
      playedOn: '2026-03-20',
      entries: [
        { userId: 'u-priya', buyinPaise: 5000, cashoutPaise: 6000 },
        { userId: 'u-karan', buyinPaise: 5000, cashoutPaise: 4000 },
      ],
    });

    const lb = leaderboard.withBoundary(b);
    const board = await lb.getLeaderboard();

    const aman = board.find((e) => e.userId === 'u-aman');
    const ravi = board.find((e) => e.userId === 'u-ravi');
    const priya = board.find((e) => e.userId === 'u-priya');
    const karan = board.find((e) => e.userId === 'u-karan');
    const neha = board.find((e) => e.userId === 'u-neha');

    expect(aman).toBeDefined();
    expect(aman?.netPaise).toBe(10000); // 20000 + (-10000)
    expect(aman?.sessionsPlayed).toBe(2);
    expect(aman?.sessionsWon).toBe(1); // session A only
    expect(aman?.biggestWinPaise).toBe(20000);
    expect(aman?.winRate).toBeCloseTo(0.5, 10);
    expect(aman?.averagePerSessionPaise).toBe(5000);
    expect(aman?.nickname).toBe('Aman');

    expect(ravi?.netPaise).toBe(-15000); // -20000 + 5000
    expect(ravi?.sessionsPlayed).toBe(2);
    expect(ravi?.sessionsWon).toBe(1);
    expect(ravi?.biggestWinPaise).toBe(5000);
    expect(ravi?.winRate).toBeCloseTo(0.5, 10);
    expect(ravi?.averagePerSessionPaise).toBe(-7500);

    expect(priya?.netPaise).toBe(6000); // 5000 + 1000
    expect(priya?.sessionsPlayed).toBe(2);
    expect(priya?.sessionsWon).toBe(2);
    expect(priya?.biggestWinPaise).toBe(5000);
    expect(priya?.winRate).toBeCloseTo(1, 10);
    expect(priya?.averagePerSessionPaise).toBe(3000);

    expect(karan?.netPaise).toBe(-1000);
    expect(karan?.sessionsPlayed).toBe(1);
    expect(karan?.sessionsWon).toBe(0);
    expect(karan?.biggestWinPaise).toBe(0);
    expect(karan?.winRate).toBe(0);
    expect(karan?.averagePerSessionPaise).toBe(-1000);

    // Player with zero closed sessions excluded.
    expect(neha).toBeUndefined();
  });

  it('sorts by net (default) descending', async () => {
    const b = freshBoundary();
    await buildClosedSession(b, {
      sessionId: 's1',
      createdBy: 'u-aman',
      playedOn: '2026-01-01',
      entries: [
        { userId: 'u-aman', buyinPaise: 1000, cashoutPaise: 4000 }, // +3000
        { userId: 'u-ravi', buyinPaise: 1000, cashoutPaise: 0 }, // -1000
        { userId: 'u-priya', buyinPaise: 1000, cashoutPaise: 0 }, // -1000
      ],
    });
    await buildClosedSession(b, {
      sessionId: 's2',
      createdBy: 'u-aman',
      playedOn: '2026-01-02',
      entries: [
        { userId: 'u-ravi', buyinPaise: 1000, cashoutPaise: 3000 }, // +2000
        { userId: 'u-priya', buyinPaise: 1000, cashoutPaise: 0 }, // -1000
      ],
    });

    const lb = leaderboard.withBoundary(b);
    const board = await lb.getLeaderboard();
    expect(board.map((e) => e.userId)).toEqual(['u-aman', 'u-ravi', 'u-priya']);
  });

  it('sorts by sessions descending', async () => {
    const b = freshBoundary();
    await buildClosedSession(b, {
      sessionId: 's1',
      createdBy: 'u-aman',
      playedOn: '2026-01-01',
      entries: [
        { userId: 'u-aman', buyinPaise: 1000, cashoutPaise: 1000 },
        { userId: 'u-ravi', buyinPaise: 1000, cashoutPaise: 1000 },
      ],
    });
    await buildClosedSession(b, {
      sessionId: 's2',
      createdBy: 'u-aman',
      playedOn: '2026-01-02',
      entries: [{ userId: 'u-aman', buyinPaise: 1000, cashoutPaise: 1000 }],
    });

    const lb = leaderboard.withBoundary(b);
    const board = await lb.getLeaderboard({}, 'sessions');
    expect(board[0]?.userId).toBe('u-aman');
    expect(board[0]?.sessionsPlayed).toBe(2);
    expect(board[1]?.userId).toBe('u-ravi');
    expect(board[1]?.sessionsPlayed).toBe(1);
  });

  it('sorts by winRate descending', async () => {
    const b = freshBoundary();
    // Aman: 1/2 win rate. Ravi: 2/2. Priya: 0/1.
    await buildClosedSession(b, {
      sessionId: 's1',
      createdBy: 'u-aman',
      playedOn: '2026-01-01',
      entries: [
        { userId: 'u-aman', buyinPaise: 1000, cashoutPaise: 2000 }, // +
        { userId: 'u-ravi', buyinPaise: 1000, cashoutPaise: 2000 }, // +
        { userId: 'u-priya', buyinPaise: 1000, cashoutPaise: 0 }, // -
      ],
    });
    await buildClosedSession(b, {
      sessionId: 's2',
      createdBy: 'u-aman',
      playedOn: '2026-01-02',
      entries: [
        { userId: 'u-aman', buyinPaise: 1000, cashoutPaise: 0 }, // -
        { userId: 'u-ravi', buyinPaise: 1000, cashoutPaise: 2000 }, // +
      ],
    });

    const lb = leaderboard.withBoundary(b);
    const board = await lb.getLeaderboard({}, 'winRate');
    expect(board[0]?.userId).toBe('u-ravi');
    expect(board[0]?.winRate).toBeCloseTo(1, 10);
    expect(board[board.length - 1]?.userId).toBe('u-priya');
    expect(board[board.length - 1]?.winRate).toBe(0);
  });

  it('sorts by biggestWin descending', async () => {
    const b = freshBoundary();
    await buildClosedSession(b, {
      sessionId: 's1',
      createdBy: 'u-aman',
      playedOn: '2026-01-01',
      entries: [
        { userId: 'u-aman', buyinPaise: 1000, cashoutPaise: 5000 }, // +4000
        { userId: 'u-ravi', buyinPaise: 1000, cashoutPaise: 3000 }, // +2000
        { userId: 'u-priya', buyinPaise: 6000, cashoutPaise: 0 }, // -6000
      ],
    });

    const lb = leaderboard.withBoundary(b);
    const board = await lb.getLeaderboard({}, 'biggestWin');
    expect(board[0]?.userId).toBe('u-aman');
    expect(board[0]?.biggestWinPaise).toBe(4000);
    expect(board[1]?.userId).toBe('u-ravi');
    expect(board[1]?.biggestWinPaise).toBe(2000);
    expect(board[2]?.userId).toBe('u-priya');
    expect(board[2]?.biggestWinPaise).toBe(0);
  });

  it('sorts by average descending', async () => {
    const b = freshBoundary();
    // Aman 2 sessions: +4000, -2000 → avg +1000.
    // Ravi 1 session: +500.
    // Priya 1 session: +2000.
    await buildClosedSession(b, {
      sessionId: 's1',
      createdBy: 'u-aman',
      playedOn: '2026-01-01',
      entries: [
        { userId: 'u-aman', buyinPaise: 1000, cashoutPaise: 5000 }, // +4000
        { userId: 'u-ravi', buyinPaise: 1000, cashoutPaise: 1500 }, // +500
        { userId: 'u-priya', buyinPaise: 1000, cashoutPaise: 3000 }, // +2000
      ],
    });
    await buildClosedSession(b, {
      sessionId: 's2',
      createdBy: 'u-aman',
      playedOn: '2026-01-02',
      entries: [{ userId: 'u-aman', buyinPaise: 3000, cashoutPaise: 1000 }], // -2000
    });

    const lb = leaderboard.withBoundary(b);
    const board = await lb.getLeaderboard({}, 'average');
    expect(board.map((e) => e.userId)).toEqual(['u-priya', 'u-aman', 'u-ravi']);
    expect(board[0]?.averagePerSessionPaise).toBe(2000);
    expect(board[1]?.averagePerSessionPaise).toBe(1000);
    expect(board[2]?.averagePerSessionPaise).toBe(500);
  });

  it('filters by from/to inclusive', async () => {
    const b = freshBoundary();
    await buildClosedSession(b, {
      sessionId: 'jan',
      createdBy: 'u-aman',
      playedOn: '2026-01-15',
      entries: [
        { userId: 'u-aman', buyinPaise: 1000, cashoutPaise: 2000 },
        { userId: 'u-ravi', buyinPaise: 1000, cashoutPaise: 0 },
      ],
    });
    await buildClosedSession(b, {
      sessionId: 'feb',
      createdBy: 'u-aman',
      playedOn: '2026-02-15',
      entries: [
        { userId: 'u-aman', buyinPaise: 1000, cashoutPaise: 0 },
        { userId: 'u-ravi', buyinPaise: 1000, cashoutPaise: 2000 },
      ],
    });
    await buildClosedSession(b, {
      sessionId: 'mar',
      createdBy: 'u-aman',
      playedOn: '2026-03-15',
      entries: [
        { userId: 'u-aman', buyinPaise: 1000, cashoutPaise: 2000 },
        { userId: 'u-ravi', buyinPaise: 1000, cashoutPaise: 0 },
      ],
    });

    const lb = leaderboard.withBoundary(b);

    // Only February.
    const febOnly = await lb.getLeaderboard({ from: '2026-02-01', to: '2026-02-28' });
    expect(febOnly.find((e) => e.userId === 'u-aman')?.sessionsPlayed).toBe(1);
    expect(febOnly.find((e) => e.userId === 'u-aman')?.netPaise).toBe(-1000);
    expect(febOnly.find((e) => e.userId === 'u-ravi')?.netPaise).toBe(1000);

    // From only.
    const fromFeb = await lb.getLeaderboard({ from: '2026-02-01' });
    expect(fromFeb.find((e) => e.userId === 'u-aman')?.sessionsPlayed).toBe(2);

    // To only.
    const toFeb = await lb.getLeaderboard({ to: '2026-02-28' });
    expect(toFeb.find((e) => e.userId === 'u-aman')?.sessionsPlayed).toBe(2);

    // Inclusive boundary: from === to === played_on of the Feb session.
    const exact = await lb.getLeaderboard({ from: '2026-02-15', to: '2026-02-15' });
    expect(exact.find((e) => e.userId === 'u-aman')?.sessionsPlayed).toBe(1);
  });

  it('returns empty array when no sessions match filter', async () => {
    const b = freshBoundary();
    await buildClosedSession(b, {
      sessionId: 's1',
      createdBy: 'u-aman',
      playedOn: '2026-05-01',
      entries: [
        { userId: 'u-aman', buyinPaise: 1000, cashoutPaise: 2000 },
        { userId: 'u-ravi', buyinPaise: 1000, cashoutPaise: 0 },
      ],
    });

    const lb = leaderboard.withBoundary(b);
    const board = await lb.getLeaderboard({ from: '2030-01-01', to: '2030-12-31' });
    expect(board).toEqual([]);
  });

  it('returns empty array when no closed sessions exist', async () => {
    const b = freshBoundary();
    // Open session only — should be ignored.
    await b.sessions.create({
      id: 'open-only',
      created_by: 'u-aman',
      played_on: '2026-01-01',
      blinds_small: 100,
      blinds_big: 200,
      chips_per_paise: 1,
      invite_token: 'tok_open_only',
    });
    const lb = leaderboard.withBoundary(b);
    const board = await lb.getLeaderboard();
    expect(board).toEqual([]);
  });

  it('counts a participant with zero buyins/cashouts as a played session with net 0', async () => {
    const b = freshBoundary();
    await buildClosedSession(b, {
      sessionId: 's1',
      createdBy: 'u-aman',
      playedOn: '2026-01-01',
      entries: [
        { userId: 'u-aman', buyinPaise: 1000, cashoutPaise: 1000 },
        // u-ravi joins below as a no-action participant.
      ],
    });
    // Manually add Ravi as a participant after the fact (session is closed; bypass via raw boundary call would re-trigger checks).
    // Easier: rebuild with an entry that is 0/0 so they appear in participants and have no buyin/no cashout we explicitly check.
    const b2 = freshBoundary();
    // First, open session and add Ravi as participant before closing.
    const sess = await b2.sessions.create({
      id: 's2',
      created_by: 'u-aman',
      played_on: '2026-01-01',
      blinds_small: 100,
      blinds_big: 200,
      chips_per_paise: 1,
      invite_token: 'tok_s2',
    });
    b2.__setCurrentUser('u-ravi');
    await b2.auth.joinSessionWithToken(sess.invite_token);
    b2.__setCurrentUser('u-aman');
    // Aman buys in and cashes out.
    await b2.buyins.create({
      session_id: sess.id,
      user_id: 'u-aman',
      amount_paise: 1000,
      chips: 1000,
      recorded_by: 'u-aman',
    });
    const co = await b2.cashouts.upsert({
      session_id: sess.id,
      user_id: 'u-aman',
      chip_count: 1000,
      amount_paise: 1000,
      submitted_by: 'u-aman',
    });
    await b2.cashouts.confirm(co.id, 'u-aman');
    // Ravi: still a participant, no buyin, no cashout. Close.
    await b2.sessions.update(sess.id, {
      status: 'closed',
      closed_at: new Date().toISOString(),
    });

    const lb = leaderboard.withBoundary(b2);
    const board = await lb.getLeaderboard();
    const ravi = board.find((e) => e.userId === 'u-ravi');
    expect(ravi).toBeDefined();
    expect(ravi?.sessionsPlayed).toBe(1);
    expect(ravi?.netPaise).toBe(0);
    expect(ravi?.sessionsWon).toBe(0);
    expect(ravi?.biggestWinPaise).toBe(0);
    expect(ravi?.averagePerSessionPaise).toBe(0);
    expect(ravi?.winRate).toBe(0);
  });
});
