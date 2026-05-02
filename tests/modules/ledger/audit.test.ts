import { describe, it, expect } from 'vitest';
import * as ledger from '@/lib/modules/ledger';
import { asChips, asPaise, asSessionId, asUserId } from '@/lib/modules/core';
import { FIXTURE_USERS } from '@/tests/helpers/fixtures';
import { createFakeBoundary } from '@/tests/helpers/fakeBoundary';

type Boundary = ReturnType<typeof createFakeBoundary>;

async function setup() {
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
  b.__setCurrentUser('u-ravi');
  await b.auth.joinSessionWithToken(sess.invite_token);
  b.__setCurrentUser('u-aman');
  const l = ledger.withBoundary(b);
  return { b, l, sess };
}

describe('ledger/audit', () => {
  it('listAudit returns full event sequence for a session', async () => {
    const e = await setup();
    const bi = await e.l.recordBuyin({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-ravi'),
      amount: asPaise(50000),
    });
    await e.l.editBuyin(bi.id, { amount: asPaise(60000) });
    const co = await e.l.submitCashout({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-ravi'),
      chipCount: asChips(60000),
    });
    await e.l.confirmCashout(co.id);

    const entries = await e.l.listAudit(asSessionId(e.sess.id));
    const actions = entries.map((a) => a.action);
    expect(actions).toContain('session_open');
    expect(actions).toContain('buyin_create');
    expect(actions).toContain('buyin_edit');
    expect(actions).toContain('cashout_submit');
    expect(actions).toContain('cashout_confirm');
  });

  it('audit entries carry actor and shaped before/after', async () => {
    const e = await setup();
    const bi = await e.l.recordBuyin({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-ravi'),
      amount: asPaise(50000),
    });
    const entries = await e.l.listAudit(asSessionId(e.sess.id));
    const create = entries.find((a) => a.action === 'buyin_create');
    expect(create).toBeDefined();
    expect(create?.actor).toBe('u-aman');
    expect(create?.before).toBeNull();
    const after = create?.after as { id: string } | null;
    expect(after?.id).toBe(bi.id);
  });

  it('listAudit rejects non-participant', async () => {
    const e = await setup();
    e.b.__setCurrentUser('u-karan');
    await expect(e.l.listAudit(asSessionId(e.sess.id))).rejects.toThrow('not_participant');
  });

  it('listAudit allowed for participant who is not the house', async () => {
    const e = await setup();
    e.b.__setCurrentUser('u-ravi');
    const entries = await e.l.listAudit(asSessionId(e.sess.id));
    expect(Array.isArray(entries)).toBe(true);
  });
});
