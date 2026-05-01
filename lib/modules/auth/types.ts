import type { UserId, SessionId } from '@/lib/modules/core';
export type CurrentUser = { id: UserId; email: string; nickname: string; avatarUrl?: string };
export type { UserId, SessionId };
