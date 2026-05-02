import { describe, it, expect } from 'vitest';
import * as badges from '@/lib/modules/badges';
import { asSessionId } from '@/lib/modules/core';
import { FIXTURE_USERS } from '@/tests/helpers/fixtures';
import { createFakeBoundary } from '@/tests/helpers/fakeBoundary';
import { buildClosedSession } from './helpers';

describe('badges/first_session', () => {
  it('awards first_session to every participant on their first closed session', async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: 'u-aman' });
    const session = await buildClosedSession(b, {
      createdBy: 'u-aman',
      participants: ['u-aman', 'u-ravi'],
      buyins: [
        { userId: 'u-aman', amountPaise: 10_000 },
        { userId: 'u-ravi', amountPaise: 10_000 },
      ],
      cashouts: [
        { userId: 'u-aman', chipCount: 12_000 },
        { userId: 'u-ravi', chipCount: 8_000 },
      ],
    });

    const m = badges.withBoundary(b);
    const awarded = await m.evaluateBadgesForSession(asSessionId(session.id));

    const firstSessionAwards = awarded.filter((a) => a.key === 'first_session');
    expect(firstSessionAwards.length).toBe(2);
    expect(firstSessionAwards.every((a) => a.sessionId === session.id)).toBe(true);
  });

  it('does not award first_session on a user’s second closed session', async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: 'u-aman' });
    // First closed session.
    const s1 = await buildClosedSession(b, {
      createdBy: 'u-aman',
      playedOn: '2026-01-01',
      participants: ['u-aman'],
      buyins: [{ userId: 'u-aman', amountPaise: 5000 }],
      cashouts: [{ userId: 'u-aman', chipCount: 5000 }],
    });
    const m = badges.withBoundary(b);
    await m.evaluateBadgesForSession(asSessionId(s1.id));

    // Second closed session.
    const s2 = await buildClosedSession(b, {
      createdBy: 'u-aman',
      playedOn: '2026-02-01',
      participants: ['u-aman'],
      buyins: [{ userId: 'u-aman', amountPaise: 5000 }],
      cashouts: [{ userId: 'u-aman', chipCount: 5000 }],
    });
    const awarded2 = await m.evaluateBadgesForSession(asSessionId(s2.id));
    const firstAgain = awarded2.filter((a) => a.key === 'first_session');
    expect(firstAgain.length).toBe(0);
  });
});
