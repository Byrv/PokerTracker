import type { DbBoundary } from '@/lib/db/boundary';
import type { UserId } from '@/lib/modules/core';
import { createProfiles } from './internal/factory';
export * from './types';

export type UserSummary = { id: UserId; nickname: string; avatarUrl?: string };

export interface Profiles {
  getProfile(userId: UserId): Promise<import('./types').ProfileSummary>;
  updateProfile(patch: { nickname?: string; avatarUrl?: string }): Promise<void>;
  listAllUsers(): Promise<UserSummary[]>;
}

export const withBoundary = (b: DbBoundary): Profiles => createProfiles(b);
