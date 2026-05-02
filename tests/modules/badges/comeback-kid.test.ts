import { describe, it, expect } from 'vitest';
import * as badges from '@/lib/modules/badges';
import { asSessionId, asUserId } from '@/lib/modules/core';
import { FIXTURE_USERS } from '@/tests/helpers/fixtures';
import { createFakeBoundary } from '@/tests/helpers/fakeBoundary';
import { buildClosedSession } from './helpers';

describe('badges/comeback_kid', () => {
  it('awards comeback_kid when player rebought (≥ 2 buy-ins) and finished net positive by > 2*BB', async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: 'u-aman' });
    const session = await buildClosedSession(b, {
      createdBy: 'u-aman',
      blindsBig: 200,
      participants: ['u-aman', 'u-ravi'],
      buyins: [
        { userId: 'u-aman', amountPaise: 10_000 },
        { userId: 'u-aman', amountPaise: 10_000 }, // reload
        { userId: 'u-ravi', amountPaise: 10_000 },
      ],
      cashouts: [
        // Aman invested 20_000, cashes 25_000 → net +5000 (margin = 400 paise; 5000 > 400)
        { userId: 'u-aman', chipCount: 25_000 },
        { userId: 'u-ravi', chipCount: 5_000 },
      ],
    });
    const m = badges.withBoundary(b);
    const awarded = await m.evaluateBadgesForSession(asSessionId(session.id));
    const comeback = awarded.filter((a) => a.key === 'comeback_kid');
    expect(comeback.length).toBe(1);
    const aman = (await m.listBadgesForUser(asUserId('u-aman'))).map((x) => x.key);
    expect(aman).toContain('comeback_kid');
  });

  it('does not award comeback_kid for a single buy-in even with profit', async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: 'u-aman' });
    const session = await buildClosedSession(b, {
      createdBy: 'u-aman',
      participants: ['u-aman'],
      buyins: [{ userId: 'u-aman', amountPaise: 10_000 }],
      cashouts: [{ userId: 'u-aman', chipCount: 30_000 }],
    });
    const m = badges.withBoundary(b);
    const awarded = await m.evaluateBadgesForSession(asSessionId(session.id));
    expect(awarded.filter((a) => a.key === 'comeback_kid').length).toBe(0);
  });

  it('does not award comeback_kid when the player finishes negative', async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: 'u-aman' });
    const session = await buildClosedSession(b, {
      createdBy: 'u-aman',
      participants: ['u-aman'],
      buyins: [
        { userId: 'u-aman', amountPaise: 10_000 },
        { userId: 'u-aman', amountPaise: 10_000 },
      ],
      cashouts: [{ userId: 'u-aman', chipCount: 5_000 }],
    });
    const m = badges.withBoundary(b);
    const awarded = await m.evaluateBadgesForSession(asSessionId(session.id));
    expect(awarded.filter((a) => a.key === 'comeback_kid').length).toBe(0);
  });
});
