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

// Memoize per request via React.cache so layout + page + every nested Server
// Component share ONE boundary (and therefore one Supabase client + one
// auth-state cache). Without this, each Server Component creates its own
// client; the first one's token refresh stays in-memory only (Server
// Components can't write cookies), and subsequent clients read stale
// cookies, race the now-consumed refresh token, and fail with
// not_authenticated.
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
