import type { DbBoundary } from '@/lib/db/boundary';
import type { SessionId, UserId } from '@/lib/modules/core';
import { createBadges } from './internal/factory';
export * from './types';

export interface Badges {
  evaluateBadgesForSession(sessionId: SessionId): Promise<import('./types').Badge[]>;
  listBadgesForUser(userId: UserId): Promise<import('./types').Badge[]>;
}

export const withBoundary = (b: DbBoundary): Badges => createBadges(b);
