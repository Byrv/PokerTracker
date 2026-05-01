import type { DbBoundary } from '@/lib/db/boundary';
import type { Badges } from '../index';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createBadges(_b: DbBoundary): Badges {
  throw new Error('badges: not implemented');
}
