import { describe, it, expect } from 'vitest';
import * as sessions from '@/lib/modules/sessions';
import { asPaise, asUserId } from '@/lib/modules/core';
import { FIXTURE_USERS } from '../../helpers/fixtures';
import { createFakeBoundary } from '../../helpers/fakeBoundary';

const setup = (currentUserId: string | null = 'u-aman') => {
  const b = createFakeBoundary({
    users: FIXTURE_USERS,
    ...(currentUserId !== null ? { currentUserId } : {}),
  });
  return { b, mod: sessions.withBoundary(b) };
};

const blinds = { small: asPaise(100), big: asPaise(200) };

describe('sessions/createSession', () => {
  it('creates a session with creator auto-added as participant', async () => {
    const { mod } = setup('u-aman');
    const sess = await mod.createSession({ blinds });
    expect(sess.createdBy).toBe('u-aman');
    expect(sess.participants).toContain('u-aman');
    expect(sess.status).toBe('open');
    expect(sess.chipsPerPaise).toBe(1);
    expect(sess.inviteToken).toMatch(/^tok_/);
    expect(sess.blinds.small).toBe(100);
    expect(sess.blinds.big).toBe(200);
  });

  it('snapshots chipsPerPaise from app settings at creation time', async () => {
    const b = createFakeBoundary({
      users: FIXTURE_USERS,
      currentUserId: 'u-aman',
      appSettings: { chipsPerPaise: 5 },
    });
    const sess = await sessions.withBoundary(b).createSession({ blinds });
    expect(sess.chipsPerPaise).toBe(5);
  });

  it('throws when not authenticated', async () => {
    const { mod } = setup(null);
    await expect(mod.createSession({ blinds })).rejects.toThrow('not_authenticated');
  });

  it('logs an audit entry for session_open', async () => {
    const { b, mod } = setup('u-aman');
    const sess = await mod.createSession({ blinds });
    const audit = await b.audit.listForSession(sess.id);
    expect(audit.some((a) => a.action === 'session_open')).toBe(true);
  });

  it('passes optional name and location through to the row', async () => {
    const { mod } = setup('u-aman');
    const sess = await mod.createSession({
      blinds,
      name: 'Friday Night',
      location: 'Aman house',
    });
    expect(sess.name).toBe('Friday Night');
    expect(sess.location).toBe('Aman house');
  });
});

describe('sessions/getSession + listSessions', () => {
  it('getSession throws not_found on unknown id', async () => {
    const { mod } = setup('u-aman');
    await expect(mod.getSession('does-not-exist' as never)).rejects.toThrow('not_found');
  });

  it('getSession returns the row with participants', async () => {
    const { mod } = setup('u-aman');
    const created = await mod.createSession({ blinds });
    const fetched = await mod.getSession(created.id);
    expect(fetched.id).toBe(created.id);
    expect(fetched.participants).toEqual(['u-aman']);
  });

  it('listSessions filters by status', async () => {
    const { mod } = setup('u-aman');
    await mod.createSession({ blinds });
    await mod.createSession({ blinds });
    const open = await mod.listSessions({ status: 'open' });
    const closed = await mod.listSessions({ status: 'closed' });
    expect(open.length).toBe(2);
    expect(closed.length).toBe(0);
  });
});

describe('sessions/closeSession', () => {
  it('rejects close from non-house', async () => {
    const env = setup('u-aman');
    const sess = await env.mod.createSession({ blinds });
    env.b.__setCurrentUser('u-ravi');
    await expect(sessions.withBoundary(env.b).closeSession(sess.id)).rejects.toThrow('not_house');
  });

  it('rejects close when no cashouts at all (incomplete)', async () => {
    const { b, mod } = setup('u-aman');
    const sess = await mod.createSession({ blinds });
    // Add a pending cashout — must be rejected.
    await b.cashouts.upsert({
      session_id: sess.id,
      user_id: 'u-aman',
      chip_count: 50000,
      amount_paise: 0,
      submitted_by: 'u-aman',
    });
    await expect(mod.closeSession(sess.id)).rejects.toThrow('cashouts_incomplete');
  });

  it('rejects close when cashouts include any pending', async () => {
    const { b, mod } = setup('u-aman');
    const sess = await mod.createSession({ blinds });

    const co1 = await b.cashouts.upsert({
      session_id: sess.id,
      user_id: 'u-aman',
      chip_count: 50000,
      amount_paise: 0,
      submitted_by: 'u-aman',
    });
    await b.cashouts.confirm(co1.id, 'u-aman');

    // Second cashout left pending.
    await b.cashouts.upsert({
      session_id: sess.id,
      user_id: 'u-ravi',
      chip_count: 50000,
      amount_paise: 0,
      submitted_by: 'u-aman',
    });

    await expect(mod.closeSession(sess.id)).rejects.toThrow('cashouts_incomplete');
  });

  it('happy path: closes when every cashout is confirmed', async () => {
    const { b, mod } = setup('u-aman');
    const sess = await mod.createSession({ blinds });

    const co = await b.cashouts.upsert({
      session_id: sess.id,
      user_id: 'u-aman',
      chip_count: 50000,
      amount_paise: 0,
      submitted_by: 'u-aman',
    });
    await b.cashouts.confirm(co.id, 'u-aman');

    const closed = await mod.closeSession(sess.id);
    expect(closed.status).toBe('closed');

    // Audit log includes session_close.
    const audit = await b.audit.listForSession(sess.id);
    expect(audit.some((a) => a.action === 'session_close')).toBe(true);
  });

  it('happy path: zero cashouts is treated as all-confirmed (vacuously) — empty session', async () => {
    // Edge case: a session with no buy-ins/cashouts has every() === true on empty array.
    const { mod } = setup('u-aman');
    const sess = await mod.createSession({ blinds });
    const closed = await mod.closeSession(sess.id);
    expect(closed.status).toBe('closed');
  });

  it('rejects close when already closed', async () => {
    const { mod } = setup('u-aman');
    const sess = await mod.createSession({ blinds });
    await mod.closeSession(sess.id);
    await expect(mod.closeSession(sess.id)).rejects.toThrow('already_closed');
  });
});

describe('sessions/generateInviteUrl', () => {
  it('returns a stable URL for a given session (idempotent)', async () => {
    const { mod } = setup('u-aman');
    const sess = await mod.createSession({ blinds });
    const a = await mod.generateInviteUrl(sess.id);
    const c = await mod.generateInviteUrl(sess.id);
    expect(a).toBe(c);
    expect(a).toContain('/join/');
    expect(a).toContain(sess.inviteToken);
  });

  it('honors NEXT_PUBLIC_SITE_URL when set', async () => {
    const prev = process.env['NEXT_PUBLIC_SITE_URL'];
    process.env['NEXT_PUBLIC_SITE_URL'] = 'https://example.test';
    try {
      const { mod } = setup('u-aman');
      const sess = await mod.createSession({ blinds });
      const url = await mod.generateInviteUrl(sess.id);
      expect(url.startsWith('https://example.test/join/')).toBe(true);
    } finally {
      if (prev === undefined) delete process.env['NEXT_PUBLIC_SITE_URL'];
      else process.env['NEXT_PUBLIC_SITE_URL'] = prev;
    }
  });

  it('falls back to localhost:3000 when env var is unset', async () => {
    const prev = process.env['NEXT_PUBLIC_SITE_URL'];
    delete process.env['NEXT_PUBLIC_SITE_URL'];
    try {
      const { mod } = setup('u-aman');
      const sess = await mod.createSession({ blinds });
      const url = await mod.generateInviteUrl(sess.id);
      expect(url.startsWith('http://localhost:3000/join/')).toBe(true);
    } finally {
      if (prev !== undefined) process.env['NEXT_PUBLIC_SITE_URL'] = prev;
    }
  });

  it('throws not_found for unknown session id', async () => {
    const { mod } = setup('u-aman');
    await expect(mod.generateInviteUrl('missing' as never)).rejects.toThrow('not_found');
  });
});

describe('sessions/addParticipant', () => {
  it('is a no-op when the user is already a participant (creator)', async () => {
    const { mod } = setup('u-aman');
    const sess = await mod.createSession({ blinds });
    await expect(mod.addParticipant(sess.id, asUserId('u-aman'))).resolves.toBeUndefined();
  });

  it('is idempotent when a non-creator joined via invite URL', async () => {
    const { b, mod } = setup('u-aman');
    const sess = await mod.createSession({ blinds });
    // Simulate Ravi accepting the invite.
    b.__setCurrentUser('u-ravi');
    await b.auth.joinSessionWithToken(sess.inviteToken);
    b.__setCurrentUser('u-aman');
    await expect(mod.addParticipant(sess.id, asUserId('u-ravi'))).resolves.toBeUndefined();
    // Calling twice still succeeds.
    await expect(mod.addParticipant(sess.id, asUserId('u-ravi'))).resolves.toBeUndefined();
  });
});

describe('sessions/removeParticipant', () => {
  it('rejects when caller is not house', async () => {
    const env = setup('u-aman');
    const sess = await env.mod.createSession({ blinds });
    env.b.__setCurrentUser('u-ravi');
    await expect(
      sessions.withBoundary(env.b).removeParticipant(sess.id, asUserId('u-aman')),
    ).rejects.toThrow('not_house');
  });

  it('rejects on a closed session', async () => {
    const { mod } = setup('u-aman');
    const sess = await mod.createSession({ blinds });
    await mod.closeSession(sess.id);
    await expect(mod.removeParticipant(sess.id, asUserId('u-aman'))).rejects.toThrow(
      'session_closed',
    );
  });

  it('removes a participant when caller is house and session is open', async () => {
    const { b, mod } = setup('u-aman');
    const sess = await mod.createSession({ blinds });
    b.__setCurrentUser('u-ravi');
    await b.auth.joinSessionWithToken(sess.inviteToken);
    b.__setCurrentUser('u-aman');
    await mod.removeParticipant(sess.id, asUserId('u-ravi'));
    const after = await mod.getSession(sess.id);
    expect(after.participants).not.toContain('u-ravi');
  });
});
