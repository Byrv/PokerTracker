import { describe, it, expect } from 'vitest';
import * as profiles from '@/lib/modules/profiles';
import { asUserId } from '@/lib/modules/core';
import { FIXTURE_USERS } from '@/tests/helpers/fixtures';
import { createFakeBoundary } from '@/tests/helpers/fakeBoundary';
import type { DbBoundary } from '@/lib/db/boundary';

type Boundary = ReturnType<typeof createFakeBoundary>;

/**
 * Helper: build a closed session with a fixed `played_on` and a buy-in/cashout
 * pair per participant. Returns the resulting net (out - in) per user.
 */
async function seedClosedSession(
  b: Boundary,
  opts: {
    sessionId: string;
    playedOn: string;
    createdBy: string;
    legs: Array<{ userId: string; buyinPaise: number; cashoutPaise: number }>;
  },
): Promise<void> {
  // Create the session (open by default).
  const session = await b.sessions.create({
    id: opts.sessionId,
    created_by: opts.createdBy,
    played_on: opts.playedOn,
    blinds_small: 100,
    blinds_big: 200,
    chips_per_paise: 1,
  });

  // Add all participants (creator is auto-added by the fake).
  for (const leg of opts.legs) {
    if (leg.userId === opts.createdBy) continue;
    // Insert the participant by abusing the test-only knob: invite-token join.
    const prev = b.__dump() as { participants: Map<string, unknown> };
    void prev;
    // The fake exposes no direct addParticipant; use the join-token path.
    b.__setCurrentUser(leg.userId);
    await b.auth.joinSessionWithToken(session.invite_token);
  }
  // Reset current user to the house (creator) for write paths.
  b.__setCurrentUser(opts.createdBy);

  // Record buy-ins and cashouts for each leg.
  for (const leg of opts.legs) {
    if (leg.buyinPaise > 0) {
      await b.buyins.create({
        session_id: session.id,
        user_id: leg.userId,
        amount_paise: leg.buyinPaise,
        chips: leg.buyinPaise, // ratio = 1
        recorded_by: opts.createdBy,
      });
    }
    // Cashout chip_count must yield amount_paise == cashoutPaise (ratio=1).
    await b.cashouts.upsert({
      session_id: session.id,
      user_id: leg.userId,
      chip_count: leg.cashoutPaise,
      amount_paise: 0,
      submitted_by: leg.userId,
    });
  }

  // Confirm every cashout and close the session.
  const cos = await b.cashouts.listForSession(session.id);
  for (const co of cos) {
    await b.cashouts.confirm(co.id, opts.createdBy);
  }
  await b.sessions.update(session.id, { status: 'closed', closed_at: new Date().toISOString() });
}

function makeBoundary(currentUserId: string | null = 'u-aman'): Boundary {
  return createFakeBoundary({
    users: FIXTURE_USERS,
    ...(currentUserId !== null ? { currentUserId } : {}),
  });
}

describe('profiles.getProfile', () => {
  it('returns an empty profile for a player with no sessions', async () => {
    const b = makeBoundary();
    const p = profiles.withBoundary(b);
    const summary = await p.getProfile(asUserId('u-aman'));
    expect(summary.user.id).toBe('u-aman');
    expect(summary.user.nickname).toBe('Aman');
    expect(summary.lifetime.sessionsPlayed).toBe(0);
    expect(summary.lifetime.netPaise).toBe(0);
    expect(summary.lifetime.biggestWinPaise).toBe(0);
    expect(summary.lifetime.biggestLossPaise).toBe(0);
    expect(summary.lifetime.currentStreak).toBe(0);
    expect(summary.history).toEqual([]);
    expect(summary.bankrollSeries).toEqual([]);
    expect(summary.badges).toEqual([]);
  });

  it('throws "not_found" when the user does not exist', async () => {
    const b = makeBoundary();
    const p = profiles.withBoundary(b);
    await expect(p.getProfile(asUserId('u-ghost'))).rejects.toThrow('not_found');
  });

  it('aggregates lifetime stats across multiple closed sessions', async () => {
    const b = makeBoundary();

    // Aman: net +200 in s1, net -100 in s2, net +500 in s3.
    await seedClosedSession(b, {
      sessionId: 's1',
      playedOn: '2026-01-01',
      createdBy: 'u-aman',
      legs: [
        { userId: 'u-aman', buyinPaise: 1000, cashoutPaise: 1200 },
        { userId: 'u-ravi', buyinPaise: 1000, cashoutPaise: 800 },
      ],
    });
    await seedClosedSession(b, {
      sessionId: 's2',
      playedOn: '2026-01-02',
      createdBy: 'u-aman',
      legs: [
        { userId: 'u-aman', buyinPaise: 1000, cashoutPaise: 900 },
        { userId: 'u-ravi', buyinPaise: 1000, cashoutPaise: 1100 },
      ],
    });
    await seedClosedSession(b, {
      sessionId: 's3',
      playedOn: '2026-01-03',
      createdBy: 'u-aman',
      legs: [
        { userId: 'u-aman', buyinPaise: 1000, cashoutPaise: 1500 },
        { userId: 'u-ravi', buyinPaise: 1000, cashoutPaise: 500 },
      ],
    });

    const p = profiles.withBoundary(b);
    const summary = await p.getProfile(asUserId('u-aman'));

    expect(summary.lifetime.sessionsPlayed).toBe(3);
    expect(summary.lifetime.netPaise).toBe(600); // +200 - 100 + 500
    expect(summary.lifetime.biggestWinPaise).toBe(500);
    expect(summary.lifetime.biggestLossPaise).toBe(-100);
    // Most recent session was a win (+500), preceded by a loss → streak = 1.
    expect(summary.lifetime.currentStreak).toBe(1);
  });

  it('returns history ordered by played_on descending', async () => {
    const b = makeBoundary();
    await seedClosedSession(b, {
      sessionId: 's-old',
      playedOn: '2026-01-01',
      createdBy: 'u-aman',
      legs: [
        { userId: 'u-aman', buyinPaise: 500, cashoutPaise: 700 },
        { userId: 'u-ravi', buyinPaise: 500, cashoutPaise: 300 },
      ],
    });
    await seedClosedSession(b, {
      sessionId: 's-mid',
      playedOn: '2026-02-01',
      createdBy: 'u-aman',
      legs: [
        { userId: 'u-aman', buyinPaise: 500, cashoutPaise: 400 },
        { userId: 'u-ravi', buyinPaise: 500, cashoutPaise: 600 },
      ],
    });
    await seedClosedSession(b, {
      sessionId: 's-new',
      playedOn: '2026-03-01',
      createdBy: 'u-aman',
      legs: [
        { userId: 'u-aman', buyinPaise: 500, cashoutPaise: 800 },
        { userId: 'u-ravi', buyinPaise: 500, cashoutPaise: 200 },
      ],
    });

    const p = profiles.withBoundary(b);
    const summary = await p.getProfile(asUserId('u-aman'));
    const dates = summary.history.map((h) => h.playedOn);
    expect(dates).toEqual(['2026-03-01', '2026-02-01', '2026-01-01']);
    expect(summary.history.map((h) => h.netPaise)).toEqual([300, -100, 200]);
  });

  it('builds a cumulative bankroll series in ascending order', async () => {
    const b = makeBoundary();
    await seedClosedSession(b, {
      sessionId: 'ba',
      playedOn: '2026-01-01',
      createdBy: 'u-aman',
      legs: [
        { userId: 'u-aman', buyinPaise: 100, cashoutPaise: 250 }, // net +150
        { userId: 'u-ravi', buyinPaise: 100, cashoutPaise: 0 },
      ],
    });
    await seedClosedSession(b, {
      sessionId: 'bb',
      playedOn: '2026-01-02',
      createdBy: 'u-aman',
      legs: [
        { userId: 'u-aman', buyinPaise: 100, cashoutPaise: 50 }, // net -50
        { userId: 'u-ravi', buyinPaise: 100, cashoutPaise: 200 },
      ],
    });
    await seedClosedSession(b, {
      sessionId: 'bc',
      playedOn: '2026-01-03',
      createdBy: 'u-aman',
      legs: [
        { userId: 'u-aman', buyinPaise: 100, cashoutPaise: 300 }, // net +200
        { userId: 'u-ravi', buyinPaise: 100, cashoutPaise: 0 },
      ],
    });

    const p = profiles.withBoundary(b);
    const summary = await p.getProfile(asUserId('u-aman'));

    expect(summary.bankrollSeries.map((x) => x.at)).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
    ]);
    expect(summary.bankrollSeries.map((x) => x.cumulativeNetPaise)).toEqual([150, 100, 300]);
  });

  it('excludes open (non-closed) sessions from the profile', async () => {
    const b = makeBoundary();
    // Closed session: net +100.
    await seedClosedSession(b, {
      sessionId: 'closed',
      playedOn: '2026-01-01',
      createdBy: 'u-aman',
      legs: [
        { userId: 'u-aman', buyinPaise: 200, cashoutPaise: 300 },
        { userId: 'u-ravi', buyinPaise: 200, cashoutPaise: 100 },
      ],
    });
    // Open session: should NOT be counted.
    await b.sessions.create({
      id: 'open',
      created_by: 'u-aman',
      played_on: '2026-02-01',
      blinds_small: 100,
      blinds_big: 200,
      chips_per_paise: 1,
    });
    await b.buyins.create({
      session_id: 'open',
      user_id: 'u-aman',
      amount_paise: 9999,
      chips: 9999,
      recorded_by: 'u-aman',
    });

    const p = profiles.withBoundary(b);
    const summary = await p.getProfile(asUserId('u-aman'));
    expect(summary.lifetime.sessionsPlayed).toBe(1);
    expect(summary.lifetime.netPaise).toBe(100);
  });

  it('exposes earned badges from the boundary', async () => {
    const b = makeBoundary();
    await b.badges.create({ user_id: 'u-aman', badge_key: 'first_session' });
    await b.badges.create({
      user_id: 'u-aman',
      badge_key: 'biggest_pot',
      session_id: 'sess-x',
    });
    // A badge for a different user should be ignored.
    await b.badges.create({ user_id: 'u-ravi', badge_key: 'streak_10' });

    const p = profiles.withBoundary(b);
    const summary = await p.getProfile(asUserId('u-aman'));
    const keys = summary.badges.map((x) => x.key).sort();
    expect(keys).toEqual(['biggest_pot', 'first_session']);
    const big = summary.badges.find((x) => x.key === 'biggest_pot');
    expect(big?.sessionId).toBe('sess-x');
    const first = summary.badges.find((x) => x.key === 'first_session');
    expect(first?.sessionId).toBeUndefined();
  });
});

describe('profiles.updateProfile', () => {
  it('updates the current user only (self)', async () => {
    const b = makeBoundary('u-aman');
    const p = profiles.withBoundary(b);
    await p.updateProfile({ nickname: 'AmanX', avatarUrl: 'https://x/a.png' });
    const row = await b.profiles.get('u-aman');
    expect(row?.nickname).toBe('AmanX');
    expect(row?.avatar_url).toBe('https://x/a.png');
    // Other users untouched.
    const other = await b.profiles.get('u-ravi');
    expect(other?.nickname).toBe('Ravi');
  });

  it('throws "not_authenticated" when no user is signed in', async () => {
    const b = makeBoundary(null);
    const p = profiles.withBoundary(b);
    await expect(p.updateProfile({ nickname: 'whoever' })).rejects.toThrow('not_authenticated');
  });

  it('only writes the fields that were provided', async () => {
    const b = makeBoundary('u-aman');
    const p = profiles.withBoundary(b);
    // First, set both fields.
    await p.updateProfile({ nickname: 'A1', avatarUrl: 'url1' });
    // Then update nickname only — avatar_url must remain.
    await p.updateProfile({ nickname: 'A2' });
    const row = await b.profiles.get('u-aman');
    expect(row?.nickname).toBe('A2');
    expect(row?.avatar_url).toBe('url1');
  });
});

describe('profiles.getProfile streak math', () => {
  // Each test seeds Aman's net per session in chronological order, then asserts
  // the resulting `currentStreak` from the public profile output.
  async function seedNetsForAman(b: Boundary, nets: number[]): Promise<void> {
    for (let i = 0; i < nets.length; i++) {
      const net = nets[i] ?? 0;
      const buyin = 1000;
      const cashout = buyin + net; // net = cashout - buyin
      // Build a deterministic ascending played_on so order is stable.
      const day = String(i + 1).padStart(2, '0');
      await seedClosedSession(b, {
        sessionId: `sk-${day}`,
        playedOn: `2026-06-${day}`,
        createdBy: 'u-aman',
        legs: [
          { userId: 'u-aman', buyinPaise: buyin, cashoutPaise: cashout },
          { userId: 'u-ravi', buyinPaise: buyin, cashoutPaise: 2 * buyin - cashout },
        ],
      });
    }
  }

  it('streak is 0 when most recent session is a loss', async () => {
    const b = makeBoundary();
    await seedNetsForAman(b, [100, 200, -50]);
    const p = profiles.withBoundary(b);
    const summary = await p.getProfile(asUserId('u-aman'));
    expect(summary.lifetime.currentStreak).toBe(0);
  });

  it('streak counts a single trailing win', async () => {
    const b = makeBoundary();
    await seedNetsForAman(b, [-100, -50, 75]);
    const p = profiles.withBoundary(b);
    const summary = await p.getProfile(asUserId('u-aman'));
    expect(summary.lifetime.currentStreak).toBe(1);
  });

  it('streak counts every trailing win for a monotonic series', async () => {
    const b = makeBoundary();
    await seedNetsForAman(b, [50, 60, 70, 80]);
    const p = profiles.withBoundary(b);
    const summary = await p.getProfile(asUserId('u-aman'));
    expect(summary.lifetime.currentStreak).toBe(4);
  });

  it('streak stops at the first non-win walking backward', async () => {
    const b = makeBoundary();
    await seedNetsForAman(b, [200, -100, 10, 20, 30]);
    const p = profiles.withBoundary(b);
    const summary = await p.getProfile(asUserId('u-aman'));
    expect(summary.lifetime.currentStreak).toBe(3);
  });
});

// Sanity: the public surface matches the frozen interface shape.
describe('profiles public surface', () => {
  it('exposes withBoundary returning Profiles', () => {
    const b = makeBoundary() as DbBoundary;
    const p = profiles.withBoundary(b);
    expect(typeof p.getProfile).toBe('function');
    expect(typeof p.updateProfile).toBe('function');
  });
});
