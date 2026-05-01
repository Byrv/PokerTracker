import type { DbBoundary } from '@/lib/db/boundary';
import { createAuth } from './internal/factory';
export * from './types';

export interface Auth {
  signInWithMagicLink(email: string, redirectTo: string): Promise<void>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<import('./types').CurrentUser | null>;
  requireUser(): Promise<import('./types').CurrentUser>;
  joinSessionByToken(token: string): Promise<import('./types').SessionId>;
}

export const withBoundary = (b: DbBoundary): Auth => createAuth(b);
