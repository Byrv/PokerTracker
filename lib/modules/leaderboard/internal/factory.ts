import type { DbBoundary } from '@/lib/db/boundary';
import type { Leaderboard } from '../index';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createLeaderboard(_b: DbBoundary): Leaderboard {
  throw new Error('leaderboard: not implemented');
}
