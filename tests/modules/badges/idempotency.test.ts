import { describe, it, expect } from 'vitest';
import * as badges from '@/lib/modules/badges';
import { asSessionId, asUserId } from '@/lib/modules/core';
import { FIXTURE_USERS } from '@/tests/helpers/fixtures';
import { createFakeBoundary } from '@/tests/helpers/fakeBoundary';
import { buildClosedSession } from './helpers';

describe('badges/idempotency', () => {
  it('re-evaluating the same closed session does not double-award', async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: 'u-aman' });
    const session = await buildClosedSession(b, {
      createdBy: 'u-aman',
      participants: ['u-aman', 'u-ravi'],
      buyins: [
        { userId: 'u-aman', amountPaise: 5000 },
        { userId: 'u-ravi', amountPaise: 30_000 }, // unique top
      ],
      cashouts: [
        { userId: 'u-aman', chipCount: 5000 },
        { userId: 'u-ravi', chipCount: 30_000 },
      ],
    });
    const m = badges.withBoundary(b);

    const first = await m.evaluateBadgesForSession(asSessionId(session.id));
    expect(first.length).toBeGreaterThan(0);

    const second = await m.evaluateBadgesForSession(asSessionId(session.id));
    // Second pass produces zero new awards.
    expect(second).toEqual([]);

    // listBadgesForUser shows each badge exactly once per (user, key).
    const ravi = await m.listBadgesForUser(asUserId('u-ravi'));
    const counts = new Map<string, number>();
    for (const badge of ravi) {
      counts.set(badge.key, (counts.get(badge.key) ?? 0) + 1);
    }
    for (const [, c] of counts) {
      expect(c).toBe(1);
    }
  });

  it('returns [] for an open or unknown session', async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: 'u-aman' });
    const open = await b.sessions.create({
      created_by: 'u-aman',
      blinds_small: 100,
      blinds_big: 200,
      chips_per_paise: 1,
    });
    const m = badges.withBoundary(b);
    expect(await m.evaluateBadgesForSession(asSessionId(open.id))).toEqual([]);
    expect(await m.evaluateBadgesForSession(asSessionId('does-not-exist'))).toEqual([]);
  });
});
