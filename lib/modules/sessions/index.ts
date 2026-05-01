import type { DbBoundary } from '@/lib/db/boundary';
import type { Paise, SessionId, UserId } from '@/lib/modules/core';
import { createSessions } from './internal/factory';
export * from './types';

export interface Sessions {
  createSession(input: {
    name?: string;
    location?: string;
    blinds: { small: Paise; big: Paise };
  }): Promise<import('./types').Session>;
  getSession(id: SessionId): Promise<import('./types').Session>;
  listSessions(filter?: { status?: 'open' | 'closed' }): Promise<import('./types').Session[]>;
  addParticipant(sessionId: SessionId, userId: UserId): Promise<void>;
  removeParticipant(sessionId: SessionId, userId: UserId): Promise<void>;
  closeSession(sessionId: SessionId): Promise<import('./types').Session>;
  generateInviteUrl(sessionId: SessionId): Promise<string>;
}

export const withBoundary = (b: DbBoundary): Sessions => createSessions(b);
