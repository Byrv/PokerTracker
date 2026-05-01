import type { DbBoundary } from '@/lib/db/boundary';
import { createLeaderboard } from './internal/factory';
export * from './types';

export interface Leaderboard {
  getLeaderboard(
    filter?: import('./types').LeaderboardFilter,
    sort?: import('./types').LeaderboardSort,
  ): Promise<import('./types').LeaderboardEntry[]>;
}

export const withBoundary = (b: DbBoundary): Leaderboard => createLeaderboard(b);
