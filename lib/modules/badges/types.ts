import type { SessionId } from '@/lib/modules/core';
export type BadgeKey = 'first_session' | 'streak_10' | 'biggest_pot' | 'comeback_kid' | string;
export type Badge = { key: BadgeKey; earnedAt: string; sessionId?: SessionId };
