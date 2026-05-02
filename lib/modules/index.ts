import { cache } from 'react';
import { createRealBoundary } from '@/lib/db/realBoundary';
import * as core from './core';
import * as auth from './auth';
import * as sessions from './sessions';
import * as ledger from './ledger';
import * as leaderboard from './leaderboard';
import * as profiles from './profiles';
import * as badges from './badges';
import * as media from './media';
import * as exportMod from './export';

/**
 * Per-request module composition. Wrapped in React.cache() so a single
 * request (layout + page + nested server components) shares one DbBoundary
 * instance — i.e. one Supabase client. This is load-bearing: without
 * memoization, each getModules() call creates a fresh client; the first
 * call's auth.getUser() can rotate the JWT (Supabase refresh near expiry),
 * and subsequent calls in sibling components see the old, now-revoked
 * cookie value and throw not_authenticated. Server Components can't write
 * cookies (refresh persistence happens in proxy.ts), so the second call's
 * stale view is not recoverable. cache() collapses everything into one
 * client per request, side-stepping the race.
 */
export const getModules = cache(async () => {
  const b = await createRealBoundary();
  return {
    core: core.withBoundary(b),
    auth: auth.withBoundary(b),
    sessions: sessions.withBoundary(b),
    ledger: ledger.withBoundary(b),
    leaderboard: leaderboard.withBoundary(b),
    profiles: profiles.withBoundary(b),
    badges: badges.withBoundary(b),
    media: media.withBoundary(b),
    export: exportMod.withBoundary(b),
  };
});
