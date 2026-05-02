import { describe, it, expect } from 'vitest';
import * as badges from '@/lib/modules/badges';
import { asSessionId, asUserId } from '@/lib/modules/core';
import { FIXTURE_USERS } from '@/tests/helpers/fixtures';
import { createFakeBoundary } from '@/tests/helpers/fakeBoundary';
import { buildClosedSession } from './helpers';

describe('badges/biggest_pot', () => {
  it('awards biggest_pot to the unique high-buyin participant', async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: 'u-aman' });
    const session = await buildClosedSession(b, {
      createdBy: 'u-aman',
      participants: ['u-aman', 'u-ravi', 'u-priya'],
      buyins: [
        { userId: 'u-aman', amountPaise: 5000 },
        { userId: 'u-ravi', amountPaise: 25_000 }, // unique max
        { userId: 'u-priya', amountPaise: 10_000 },
      ],
      cashouts: [
        { userId: 'u-aman', chipCount: 5000 },
        { userId: 'u-ravi', chipCount: 25_000 },
        { userId: 'u-priya', chipCount: 10_000 },
      ],
    });
    const m = badges.withBoundary(b);
    const awarded = await m.evaluateBadgesForSession(asSessionId(session.id));
    const big = awarded.filter((a) => a.key === 'biggest_pot');
    expect(big.length).toBe(1);
    // listForUser confirms it's tagged to Ravi.
    const ravi = (await m.listBadgesForUser(asUserId('u-ravi'))).map((x) => x.key);
    expect(ravi).toContain('biggest_pot');
    const aman = (await m.listBadgesForUser(asUserId('u-aman'))).map((x) => x.key);
    expect(aman).not.toContain('biggest_pot');
  });

  it('does not award biggest_pot when there is a tie at the top', async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: 'u-aman' });
    const session = await buildClosedSession(b, {
      createdBy: 'u-aman',
      participants: ['u-aman', 'u-ravi'],
      buyins: [
        { userId: 'u-aman', amountPaise: 10_000 },
        { userId: 'u-ravi', amountPaise: 10_000 },
      ],
      cashouts: [
        { userId: 'u-aman', chipCount: 10_000 },
        { userId: 'u-ravi', chipCount: 10_000 },
      ],
    });
    const m = badges.withBoundary(b);
    const awarded = await m.evaluateBadgesForSession(asSessionId(session.id));
    expect(awarded.filter((a) => a.key === 'biggest_pot').length).toBe(0);
  });
});
