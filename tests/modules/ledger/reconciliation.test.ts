import { describe, it, expect } from 'vitest';
import * as ledger from '@/lib/modules/ledger';
import { asChips, asPaise, asSessionId, asUserId } from '@/lib/modules/core';
import { FIXTURE_USERS } from '@/tests/helpers/fixtures';
import { createFakeBoundary } from '@/tests/helpers/fakeBoundary';

type Boundary = ReturnType<typeof createFakeBoundary>;

async function setupSessionWithThreePlayers() {
  const b: Boundary = createFakeBoundary({
    users: FIXTURE_USERS,
    currentUserId: 'u-aman',
    appSettings: { chipsPerPaise: 1 },
  });
  const sess = await b.sessions.create({
    created_by: 'u-aman',
    blinds_small: 100,
    blinds_big: 200,
    chips_per_paise: 1,
  });
  // Add Ravi and Priya as participants via invite token.
  for (const userId of ['u-ravi', 'u-priya']) {
    b.__setCurrentUser(userId);
    await b.auth.joinSessionWithToken(sess.invite_token);
  }
  b.__setCurrentUser('u-aman');
  const l = ledger.withBoundary(b);
  return { b, l, sess };
}

describe('ledger/reconciliation', () => {
  it('matches: zero discrepancy when chips conserved and confirmed', async () => {
    const e = await setupSessionWithThreePlayers();
    await e.l.recordBuyin({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-aman'),
      amount: asPaise(50000),
    });
    await e.l.recordBuyin({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-ravi'),
      amount: asPaise(50000),
    });
    const c1 = await e.l.submitCashout({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-aman'),
      chipCount: asChips(40000),
    });
    const c2 = await e.l.submitCashout({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-ravi'),
      chipCount: asChips(60000),
    });
    await e.l.confirmCashout(c1.id);
    await e.l.confirmCashout(c2.id);

    const r = await e.l.getReconciliation(asSessionId(e.sess.id));
    expect(r.expected).toBe(100000);
    expect(r.actual).toBe(100000);
    expect(r.discrepancy).toBe(0);
  });

  it('deficit: discrepancy positive when total cashouts < total buy-ins', async () => {
    const e = await setupSessionWithThreePlayers();
    await e.l.recordBuyin({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-aman'),
      amount: asPaise(50000),
    });
    await e.l.recordBuyin({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-ravi'),
      amount: asPaise(50000),
    });
    const c1 = await e.l.submitCashout({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-aman'),
      chipCount: asChips(30000),
    });
    const c2 = await e.l.submitCashout({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-ravi'),
      chipCount: asChips(60000),
    });
    await e.l.confirmCashout(c1.id);
    await e.l.confirmCashout(c2.id);

    const r = await e.l.getReconciliation(asSessionId(e.sess.id));
    expect(r.expected).toBe(100000);
    expect(r.actual).toBe(90000);
    expect(r.discrepancy).toBe(10000);
  });

  it('surplus: discrepancy negative when total cashouts > total buy-ins', async () => {
    const e = await setupSessionWithThreePlayers();
    await e.l.recordBuyin({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-aman'),
      amount: asPaise(50000),
    });
    const c1 = await e.l.submitCashout({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-aman'),
      chipCount: asChips(70000),
    });
    await e.l.confirmCashout(c1.id);

    const r = await e.l.getReconciliation(asSessionId(e.sess.id));
    expect(r.expected).toBe(50000);
    expect(r.actual).toBe(70000);
    expect(r.discrepancy).toBe(-20000);
  });

  it('only counts confirmed cashouts toward actual', async () => {
    const e = await setupSessionWithThreePlayers();
    await e.l.recordBuyin({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-ravi'),
      amount: asPaise(50000),
    });
    // Submit but don't confirm.
    await e.l.submitCashout({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-ravi'),
      chipCount: asChips(50000),
    });

    const r = await e.l.getReconciliation(asSessionId(e.sess.id));
    expect(r.expected).toBe(50000);
    expect(r.actual).toBe(0);
    expect(r.discrepancy).toBe(50000);
  });

  it('getSessionLedger rolls up per-player buy-ins, cashouts and net', async () => {
    const e = await setupSessionWithThreePlayers();
    // Aman: 50k buy-in, 40k cashout → net -10k
    // Ravi: 30k + 20k buy-ins, 80k cashout → net +30k
    // Priya: no buy-ins, no cashout → net 0
    await e.l.recordBuyin({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-aman'),
      amount: asPaise(50000),
    });
    await e.l.recordBuyin({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-ravi'),
      amount: asPaise(30000),
    });
    await e.l.recordBuyin({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-ravi'),
      amount: asPaise(20000),
    });
    await e.l.submitCashout({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-aman'),
      chipCount: asChips(40000),
    });
    await e.l.submitCashout({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-ravi'),
      chipCount: asChips(80000),
    });

    const led = await e.l.getSessionLedger(asSessionId(e.sess.id));
    const aman = led.find((p) => p.userId === 'u-aman');
    const ravi = led.find((p) => p.userId === 'u-ravi');
    const priya = led.find((p) => p.userId === 'u-priya');
    expect(aman?.totalBuyinsPaise).toBe(50000);
    expect(aman?.cashoutPaise).toBe(40000);
    expect(aman?.netPaise).toBe(-10000);
    expect(ravi?.totalBuyinsPaise).toBe(50000);
    expect(ravi?.cashoutPaise).toBe(80000);
    expect(ravi?.netPaise).toBe(30000);
    expect(priya?.totalBuyinsPaise).toBe(0);
    expect(priya?.cashoutPaise).toBe(0);
    expect(priya?.netPaise).toBe(0);
  });
});
