import type { DbBoundary } from '@/lib/db/boundary';
import type { UserId } from '@/lib/modules/core';
import { createProfiles } from './internal/factory';
export * from './types';

export interface Profiles {
  getProfile(userId: UserId): Promise<import('./types').ProfileSummary>;
  updateProfile(patch: { nickname?: string; avatarUrl?: string }): Promise<void>;
}

export const withBoundary = (b: DbBoundary): Profiles => createProfiles(b);
