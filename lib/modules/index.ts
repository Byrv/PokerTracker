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

export async function getModules() {
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
}
