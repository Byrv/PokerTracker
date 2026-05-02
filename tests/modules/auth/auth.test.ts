import { describe, it, expect, vi } from 'vitest';
import * as auth from '@/lib/modules/auth';
import { FIXTURE_USERS } from '@/tests/helpers/fixtures';
import { createFakeBoundary } from '@/tests/helpers/fakeBoundary';

describe('auth/getCurrentUser', () => {
  it('returns null when signed out', async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS });
    const a = auth.withBoundary(b);
    expect(await a.getCurrentUser()).toBeNull();
  });

  it('returns the signed-in user merged with profile data', async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: 'u-aman' });
    const a = auth.withBoundary(b);
    const u = await a.getCurrentUser();
    expect(u).not.toBeNull();
    expect(u?.id).toBe('u-aman');
    expect(u?.email).toBe('aman@example.com');
    expect(u?.nickname).toBe('Aman');
    expect(u?.avatarUrl).toBeUndefined();
  });

  it('falls back to email local-part when no profile row exists', async () => {
    // Seed a "user" without a profile by pushing an entry the fake's auth side
    // recognises but the profiles map does not.
    const b = createFakeBoundary({
      users: [{ id: 'u-ghost', email: 'ghost@example.com', nickname: 'Ghost' }],
      currentUserId: 'u-ghost',
    });
    // Drop the profile to simulate a freshly-authed user before onboarding.
    b.profiles.get = vi.fn(async () => null);
    const a = auth.withBoundary(b);
    const u = await a.getCurrentUser();
    expect(u?.nickname).toBe('ghost');
  });

  it('exposes avatarUrl when profile has one', async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: 'u-aman' });
    const original = b.profiles.get;
    b.profiles.get = vi.fn(async (uid: string) => {
      const row = await original(uid);
      return row ? { ...row, avatar_url: 'https://cdn.example.com/a.png' } : null;
    });
    const a = auth.withBoundary(b);
    const u = await a.getCurrentUser();
    expect(u?.avatarUrl).toBe('https://cdn.example.com/a.png');
  });
});

describe('auth/requireUser', () => {
  it('throws not_authenticated when signed out', async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS });
    const a = auth.withBoundary(b);
    await expect(a.requireUser()).rejects.toThrow('not_authenticated');
  });

  it('returns the user when signed in', async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: 'u-ravi' });
    const a = auth.withBoundary(b);
    const u = await a.requireUser();
    expect(u.id).toBe('u-ravi');
    expect(u.nickname).toBe('Ravi');
  });
});

describe('auth/signInWithMagicLink', () => {
  it('forwards email and redirectTo to the boundary', async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS });
    const spy = vi.fn(async () => {});
    b.auth.signInWithMagicLink = spy;
    const a = auth.withBoundary(b);
    await a.signInWithMagicLink('me@example.com', 'https://app.example.com/auth/callback');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('me@example.com', 'https://app.example.com/auth/callback');
  });

  it('propagates boundary errors without retry', async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS });
    b.auth.signInWithMagicLink = vi.fn(async () => {
      throw new Error('rate_limited');
    });
    const a = auth.withBoundary(b);
    await expect(a.signInWithMagicLink('x@example.com', 'https://x')).rejects.toThrow(
      'rate_limited',
    );
  });
});

describe('auth/signOut', () => {
  it('delegates to the boundary and clears the current user', async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: 'u-aman' });
    const a = auth.withBoundary(b);
    expect(await a.getCurrentUser()).not.toBeNull();
    await a.signOut();
    expect(await a.getCurrentUser()).toBeNull();
  });
});

describe('auth/joinSessionByToken', () => {
  it('returns the session id (branded) for a valid open session token', async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: 'u-aman' });
    // Seed an open session directly via the boundary so we have a real invite token.
    const created = await b.sessions.create({
      created_by: 'u-aman',
      blinds_small: 100,
      blinds_big: 200,
      chips_per_paise: 1,
    });
    // Switch identity so the joiner is a different user (mirrors invite-link flow).
    b.__setCurrentUser('u-ravi');
    const a = auth.withBoundary(b);
    const id = await a.joinSessionByToken(created.invite_token);
    expect(id).toBe(created.id);
    // After join, the joiner is now in participants.
    const parts = await b.sessions.listParticipants(created.id);
    expect(parts.some((p) => p.user_id === 'u-ravi')).toBe(true);
  });

  it('throws invalid_or_closed_invite for an unknown token', async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: 'u-aman' });
    const a = auth.withBoundary(b);
    await expect(a.joinSessionByToken('does-not-exist')).rejects.toThrow(
      'invalid_or_closed_invite',
    );
  });

  it('throws invalid_or_closed_invite for a closed-session token', async () => {
    const b = createFakeBoundary({ users: FIXTURE_USERS, currentUserId: 'u-aman' });
    const created = await b.sessions.create({
      created_by: 'u-aman',
      blinds_small: 100,
      blinds_big: 200,
      chips_per_paise: 1,
    });
    // Close the session directly through the boundary.
    await b.sessions.update(created.id, { status: 'closed', closed_at: new Date().toISOString() });
    b.__setCurrentUser('u-ravi');
    const a = auth.withBoundary(b);
    await expect(a.joinSessionByToken(created.invite_token)).rejects.toThrow(
      'invalid_or_closed_invite',
    );
  });
});
