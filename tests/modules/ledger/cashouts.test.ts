import { describe, it, expect } from 'vitest';
import * as ledger from '@/lib/modules/ledger';
import { asChips, asSessionId, asUserId } from '@/lib/modules/core';
import { FIXTURE_USERS } from '@/tests/helpers/fixtures';
import { createFakeBoundary } from '@/tests/helpers/fakeBoundary';

type Boundary = ReturnType<typeof createFakeBoundary>;

async function setup(opts?: { chipsPerPaise?: number }) {
  const b: Boundary = createFakeBoundary({
    users: FIXTURE_USERS,
    currentUserId: 'u-aman',
    appSettings: { chipsPerPaise: opts?.chipsPerPaise ?? 1 },
  });
  const sess = await b.sessions.create({
    created_by: 'u-aman',
    blinds_small: 100,
    blinds_big: 200,
    chips_per_paise: opts?.chipsPerPaise ?? 1,
  });
  // Ravi joins via the invite token.
  b.__setCurrentUser('u-ravi');
  await b.auth.joinSessionWithToken(sess.invite_token);
  // Restore Aman as the active user (house).
  b.__setCurrentUser('u-aman');
  const l = ledger.withBoundary(b);
  return { b, l, sess };
}

describe('ledger/cashouts', () => {
  it('participant submits a cashout with status=pending', async () => {
    const e = await setup();
    e.b.__setCurrentUser('u-ravi');
    const co = await e.l.submitCashout({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-ravi'),
      chipCount: asChips(60000),
    });
    expect(co.status).toBe('pending');
    expect(co.chipCount).toBe(60000);
    expect(co.amount).toBe(60000); // chipsPerPaise=1
  });

  it('house can submit cashout for any participant', async () => {
    const e = await setup();
    const co = await e.l.submitCashout({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-ravi'),
      chipCount: asChips(40000),
    });
    expect(co.status).toBe('pending');
    expect(co.userId).toBe('u-ravi');
    expect(co.submittedBy).toBe('u-aman');
  });

  it('participant cannot submit cashout for someone else', async () => {
    const e = await setup();
    e.b.__setCurrentUser('u-ravi');
    await expect(
      e.l.submitCashout({
        sessionId: asSessionId(e.sess.id),
        userId: asUserId('u-aman'),
        chipCount: asChips(40000),
      }),
    ).rejects.toThrow('not_house');
  });

  it('non-participant cannot submit cashout', async () => {
    const e = await setup();
    e.b.__setCurrentUser('u-karan');
    await expect(
      e.l.submitCashout({
        sessionId: asSessionId(e.sess.id),
        userId: asUserId('u-karan'),
        chipCount: asChips(0),
      }),
    ).rejects.toThrow('not_participant');
  });

  it('submitCashout twice for same user upserts the existing row', async () => {
    const e = await setup();
    const first = await e.l.submitCashout({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-ravi'),
      chipCount: asChips(40000),
    });
    const second = await e.l.submitCashout({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-ravi'),
      chipCount: asChips(50000),
    });
    expect(second.id).toBe(first.id);
    expect(second.chipCount).toBe(50000);
    const all = await e.l.listCashouts(asSessionId(e.sess.id));
    expect(all).toHaveLength(1);
  });

  it('confirmCashout flips status from pending to confirmed (house)', async () => {
    const e = await setup();
    const co = await e.l.submitCashout({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-ravi'),
      chipCount: asChips(40000),
    });
    const confirmed = await e.l.confirmCashout(co.id);
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.confirmedBy).toBe('u-aman');
  });

  it('re-submitting after confirmation flips status back to pending', async () => {
    const e = await setup();
    const co = await e.l.submitCashout({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-ravi'),
      chipCount: asChips(40000),
    });
    const confirmed = await e.l.confirmCashout(co.id);
    expect(confirmed.status).toBe('confirmed');
    const reSubmitted = await e.l.submitCashout({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-ravi'),
      chipCount: asChips(50000),
    });
    expect(reSubmitted.id).toBe(co.id);
    expect(reSubmitted.status).toBe('pending');
  });

  it('amount_paise is derived from chipCount via session ratio (chipsPerPaise=2)', async () => {
    const e = await setup({ chipsPerPaise: 2 });
    e.b.__setCurrentUser('u-ravi');
    const co = await e.l.submitCashout({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-ravi'),
      chipCount: asChips(120),
    });
    expect(co.amount).toBe(240); // 120 * 2
  });

  it('locks out submit after session close', async () => {
    const e = await setup();
    await e.b.sessions.update(e.sess.id, { status: 'closed' });
    await expect(
      e.l.submitCashout({
        sessionId: asSessionId(e.sess.id),
        userId: asUserId('u-ravi'),
        chipCount: asChips(40000),
      }),
    ).rejects.toThrow('session_closed');
  });

  it('locks out confirm after session close', async () => {
    const e = await setup();
    const co = await e.l.submitCashout({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-ravi'),
      chipCount: asChips(40000),
    });
    await e.b.sessions.update(e.sess.id, { status: 'closed' });
    await expect(e.l.confirmCashout(co.id)).rejects.toThrow('session_closed');
  });

  it('listCashouts requires participant or house', async () => {
    const e = await setup();
    e.b.__setCurrentUser('u-karan');
    await expect(e.l.listCashouts(asSessionId(e.sess.id))).rejects.toThrow('not_participant');
  });
});
