import { describe, it, expect, beforeEach } from 'vitest';
import * as ledger from '@/lib/modules/ledger';
import { asPaise, asSessionId, asUserId } from '@/lib/modules/core';
import { FIXTURE_USERS } from '@/tests/helpers/fixtures';
import { createFakeBoundary } from '@/tests/helpers/fakeBoundary';

type Boundary = ReturnType<typeof createFakeBoundary>;

async function setup(opts?: { chipsPerPaise?: number }) {
  const b: Boundary = createFakeBoundary({
    users: FIXTURE_USERS,
    currentUserId: 'u-aman',
    appSettings: { chipsPerPaise: opts?.chipsPerPaise ?? 1 },
  });
  // House (Aman) creates an open session.
  const sess = await b.sessions.create({
    created_by: 'u-aman',
    blinds_small: 100,
    blinds_big: 200,
    chips_per_paise: opts?.chipsPerPaise ?? 1,
  });
  const l = ledger.withBoundary(b);
  return { b, l, sess };
}

describe('ledger/buyins', () => {
  let env: Awaited<ReturnType<typeof setup>>;

  beforeEach(async () => {
    env = await setup();
  });

  it('records a buy-in and writes audit', async () => {
    const buyin = await env.l.recordBuyin({
      sessionId: asSessionId(env.sess.id),
      userId: asUserId('u-ravi'),
      amount: asPaise(50000),
    });
    expect(buyin.amount).toBe(50000);
    expect(buyin.chips).toBe(50000); // chipsPerPaise=1
    expect(buyin.userId).toBe('u-ravi');

    const audit = await env.l.listAudit(asSessionId(env.sess.id));
    expect(audit.some((a) => a.action === 'buyin_create')).toBe(true);
  });

  it('snapshots chips from session.chips_per_paise (not app_settings)', async () => {
    // Session created with chipsPerPaise=2; if we change app_settings later it must NOT affect this session's buyins.
    const e = await setup({ chipsPerPaise: 2 });
    await e.b.appSettings.update({ chips_per_paise: 7 });
    const bi = await e.l.recordBuyin({
      sessionId: asSessionId(e.sess.id),
      userId: asUserId('u-ravi'),
      amount: asPaise(1000),
    });
    expect(bi.chips).toBe(2000); // 1000 * 2 (session snapshot)
  });

  it('rejects buy-in from non-house', async () => {
    env.b.__setCurrentUser('u-ravi');
    await expect(
      env.l.recordBuyin({
        sessionId: asSessionId(env.sess.id),
        userId: asUserId('u-ravi'),
        amount: asPaise(50000),
      }),
    ).rejects.toThrow('not_house');
  });

  it('rejects buy-in when not authenticated', async () => {
    env.b.__setCurrentUser(null);
    await expect(
      env.l.recordBuyin({
        sessionId: asSessionId(env.sess.id),
        userId: asUserId('u-ravi'),
        amount: asPaise(50000),
      }),
    ).rejects.toThrow('not_authenticated');
  });

  it('rejects buy-in for unknown session', async () => {
    await expect(
      env.l.recordBuyin({
        sessionId: asSessionId('nonexistent'),
        userId: asUserId('u-ravi'),
        amount: asPaise(50000),
      }),
    ).rejects.toThrow('not_found');
  });

  it('edits a buy-in and writes audit', async () => {
    const created = await env.l.recordBuyin({
      sessionId: asSessionId(env.sess.id),
      userId: asUserId('u-ravi'),
      amount: asPaise(50000),
    });
    const updated = await env.l.editBuyin(created.id, { amount: asPaise(60000) });
    expect(updated.amount).toBe(60000);
    const audit = await env.l.listAudit(asSessionId(env.sess.id));
    expect(audit.some((a) => a.action === 'buyin_edit')).toBe(true);
  });

  it('deletes a buy-in and writes audit', async () => {
    const created = await env.l.recordBuyin({
      sessionId: asSessionId(env.sess.id),
      userId: asUserId('u-ravi'),
      amount: asPaise(50000),
    });
    await env.l.deleteBuyin(created.id);
    const remaining = await env.l.listBuyins(asSessionId(env.sess.id));
    expect(remaining).toHaveLength(0);
    const audit = await env.l.listAudit(asSessionId(env.sess.id));
    expect(audit.some((a) => a.action === 'buyin_delete')).toBe(true);
  });

  it('lists buy-ins for participant', async () => {
    await env.l.recordBuyin({
      sessionId: asSessionId(env.sess.id),
      userId: asUserId('u-ravi'),
      amount: asPaise(50000),
    });
    await env.l.recordBuyin({
      sessionId: asSessionId(env.sess.id),
      userId: asUserId('u-aman'),
      amount: asPaise(20000),
    });
    const list = await env.l.listBuyins(asSessionId(env.sess.id));
    expect(list).toHaveLength(2);
  });

  it('rejects listBuyins from a non-participant', async () => {
    // Karan never joined this session.
    env.b.__setCurrentUser('u-karan');
    await expect(env.l.listBuyins(asSessionId(env.sess.id))).rejects.toThrow('not_participant');
  });

  it('locks out buy-in writes after session close (DB trigger)', async () => {
    // Close session via boundary (mirrors the DB lockout).
    await env.b.sessions.update(env.sess.id, { status: 'closed' });
    await expect(
      env.l.recordBuyin({
        sessionId: asSessionId(env.sess.id),
        userId: asUserId('u-ravi'),
        amount: asPaise(50000),
      }),
    ).rejects.toThrow('session_closed');
  });

  it('locks out edit/delete after session close', async () => {
    const created = await env.l.recordBuyin({
      sessionId: asSessionId(env.sess.id),
      userId: asUserId('u-ravi'),
      amount: asPaise(50000),
    });
    await env.b.sessions.update(env.sess.id, { status: 'closed' });
    await expect(env.l.editBuyin(created.id, { amount: asPaise(70000) })).rejects.toThrow(
      'session_closed',
    );
    await expect(env.l.deleteBuyin(created.id)).rejects.toThrow('session_closed');
  });
});
